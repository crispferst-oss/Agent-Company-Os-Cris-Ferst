const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000006',
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
  return { adapter: api.criarOperacionalDhAps({ mapa }), mapa };
}

test('adapter recusa caso sem fato_juridico', async () => {
  const { adapter } = novoAdapter();
  await assert.rejects(
    () => adapter.consultar(casoDe('   ')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('continuidade do cuidado: aciona CEM e CC 951', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico quer encerrar vínculo e teme abandono de paciente em tratamento'),
  );
  assert.equal(parecer.especialista, 'operacional-dh-aps');
  assert.ok(parecer.fatos.some((f) => /continuidade/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /abandono|CEM/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /CC art\.\s*951/i.test(r)));
});

test('comunicação ao beneficiário: aciona CDC 6/31 e CFM 2.336', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica vai afixar cartaz com aviso ao paciente sobre horários'),
  );
  assert.ok(parecer.fatos.some((f) => /comunica[çc][ãa]o ao benefici[áa]rio/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /CDC|publicidade/i.test(r)));
});

test('responsabilidade por equipe: aciona CC 932/933 e ação regressiva', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica responde por erro de técnico de enfermagem na aplicação'),
  );
  assert.ok(parecer.fatos.some((f) => /responsabilidade/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /932|933/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /regress|934/i.test(r)));
});

test('recusa emergencial: aciona CP 135-A e Lei 12.653', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('recepção recusou atendimento em emergência exigindo cheque-caução'),
  );
  assert.ok(parecer.fatos.some((f) => /recusa|emergencial/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /135-A/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /12\.653/i.test(r)));
});

test('gestão de equipe técnica: aciona CEM, CP 282 e COFEN', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico delega ato privativo a técnico de enfermagem sob supervisão remota'),
  );
  assert.ok(parecer.fatos.some((f) => /equipe t[ée]cnica|delega/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*282|exerc[íi]cio irregular|CEM/i.test(r)));
});

test('assédio: sinaliza lacuna do mapa e delega à pesquisa-normativa', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('colaboradora denuncia assédio moral do sócio da clínica'),
  );
  assert.ok(parecer.fatos.some((f) => /ass[ée]dio/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /CLT|Lei 14\.457|NR-01/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /pesquisa-normativa/i.test(r)));
});

test('CAT: sinaliza lacuna previdenciária do mapa', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica precisa emitir CAT após acidente de trabalho da técnica'),
  );
  assert.ok(parecer.fatos.some((f) => /CAT|acidente de trabalho/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /Lei 8\.213|NR-07/i.test(r)));
});

test('múltiplos temas: responsabilidade por equipe + gestão técnica sem duplicar norma', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica responde por técnico de enfermagem que executou ato privativo médico'),
  );
  assert.ok(parecer.fatos.length >= 2);
  const normas = parecer.fundamentos.map((f) => f.norma);
  const dedup = new Set(normas);
  assert.equal(normas.length, dedup.size, 'não pode duplicar norma na mesma consulta');
});

test('fato sem tema reconhecido retorna lacuna', async () => {
  const { adapter, mapa } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussão sobre contrato de locação do imóvel do consultório'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema/i);
  assert.ok(parecer.fontes[0].includes(mapa.versao));
});

test('adapter sinaliza delegação a pesquisa-normativa (recursão zero)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('recusa de atendimento em emergência por falta de garantia'),
  );
  assert.ok(
    parecer.riscos.some((r) => /pesquisa-normativa.*n[óo] irm[ãa]o/i.test(r)),
  );
});

test('adapter carimba versão com a versão do mapa', () => {
  const { adapter, mapa } = novoAdapter();
  assert.equal(adapter.dominio, 'operacional-dh-aps');
  assert.match(adapter.versao, /^operacional-dh-aps@/);
  assert.ok(adapter.versao.includes(mapa.versao));
});
