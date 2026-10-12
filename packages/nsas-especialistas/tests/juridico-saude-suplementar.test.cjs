const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000004',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: { tradutor_v: '1.0', detectores: [], predicados_verificados: [] },
  };
}

function novoAdapter() {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  return { adapter: api.criarJuridicoSaudeSuplementar({ mapa }), mapa };
}

test('adapter recusa caso sem fato_juridico', async () => {
  const { adapter } = novoAdapter();
  await assert.rejects(
    () => adapter.consultar(casoDe('   ')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('glosa: dispara risco contratual, probatório e de prazo', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('operadora aplicou glosa em procedimento sem fundamentação técnica'),
  );
  assert.equal(parecer.especialista, 'juridico-saude-suplementar');
  assert.ok(parecer.fatos.some((f) => /glosa/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /fundamenta[çc][ãa]o/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /prazo|tácita/i.test(r)));
});

test('autorização prévia: aciona RN ANS 259 e dever de motivação', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('operadora atrasou autorização prévia de OPME solicitada pelo médico'),
  );
  assert.ok(parecer.fatos.some((f) => /autoriza[çc][ãa]o pr[ée]via/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /RN ANS 259|prazos/i.test(r)));
  assert.ok(parecer.fundamentos.some((f) => /259/.test(f.norma)));
});

test('cobertura fora do rol: aciona Lei 14.454 e rol exemplificativo', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('plano negou procedimento fora do rol da ANS alegando rol taxativo'),
  );
  assert.ok(parecer.fatos.some((f) => /rol/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /14\.454|exemplificativo/i.test(r)));
  assert.ok(parecer.fundamentos.some((f) => /14\.454/.test(f.norma)));
});

test('reembolso: aciona art. 12 VI e tabela aviltante', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('paciente de consultório fora da rede pede reembolso e tabela de reembolso é aviltante'),
  );
  assert.ok(parecer.fatos.some((f) => /reembolso/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /12 VI|aviltante|livre escolha/i.test(r)));
});

test('laudo para operadora: aciona qualidade do laudo e LGPD art. 11', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico elabora laudo para operadora justificar procedimento ao auditor'),
  );
  assert.ok(parecer.fatos.some((f) => /laudo/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /CID|evid[êe]ncia/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /LGPD|art\.\s*11/i.test(r)));
});

test('tutela de urgência: aciona CPC 300 e Tema 106/STJ', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('paciente precisa de tutela de urgência contra plano por perigo de dano'),
  );
  assert.ok(parecer.fatos.some((f) => /tutela de urg[êe]ncia/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /CPC art\.\s*300|Tema 106/i.test(r)));
});

test('credenciamento: aviso prévio e substituição equivalente (art. 17)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('operadora comunicou descredenciamento unilateral da clínica sem aviso'),
  );
  assert.ok(parecer.fatos.some((f) => /credenciamento/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*17|aviso pr[ée]vio|substitui[çc][ãa]o/i.test(r)));
});

test('múltiplos temas: glosa + autorização prévia acumulam sem duplicar norma', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('operadora negou autorização prévia e depois aplicou glosa no mesmo procedimento'),
  );
  assert.ok(parecer.fatos.length >= 2);
  const normas = parecer.fundamentos.map((f) => f.norma);
  const dedup = new Set(normas);
  assert.equal(normas.length, dedup.size, 'não pode duplicar norma na mesma consulta');
});

test('fato sem tema reconhecido retorna lacuna', async () => {
  const { adapter, mapa } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussão sobre layout da sala de espera do consultório'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema/i);
  assert.ok(parecer.fontes[0].includes(mapa.versao));
});

test('adapter sinaliza delegação a pesquisa-normativa (recursão zero)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('operadora aplicou glosa'),
  );
  assert.ok(
    parecer.riscos.some((r) => /pesquisa-normativa.*n[óo] irm[ãa]o/i.test(r)),
  );
});

test('adapter carimba versão com a versão do mapa', () => {
  const { adapter, mapa } = novoAdapter();
  assert.equal(adapter.dominio, 'juridico-saude-suplementar');
  assert.match(adapter.versao, /^juridico-saude-suplementar@/);
  assert.ok(adapter.versao.includes(mapa.versao));
});
