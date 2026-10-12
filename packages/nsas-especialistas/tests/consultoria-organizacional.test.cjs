const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000007',
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
  return { adapter: api.criarConsultoriaOrganizacional({ mapa }), mapa };
}

test('adapter recusa caso sem fato_juridico', async () => {
  const { adapter } = novoAdapter();
  await assert.rejects(
    () => adapter.consultar(casoDe('   ')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('dominio e versao carimbam identidade do adapter', () => {
  const { adapter, mapa } = novoAdapter();
  assert.equal(adapter.dominio, 'consultoria-organizacional');
  assert.equal(adapter.versao, `consultoria-organizacional@${mapa.versao}`);
});

test('diagnostico operacional: tema detectado + risco de método', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('socia pediu diagnostico operacional da clinica porque esta travando o fluxo'),
  );
  assert.equal(parecer.especialista, 'consultoria-organizacional');
  assert.ok(parecer.fatos.some((f) => /diagn[óo]stico operacional/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /levantamento in loco|consultoria organizacional dedicada/i.test(r)));
});

test('mapa de processo comercial: aciona risco de publicidade medica', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('revisao do processo comercial e da jornada do paciente nos pontos de contato'),
  );
  assert.ok(parecer.fatos.some((f) => /mapa de processo comercial/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /CFM Res\. 2\.336|publicidade m[ée]dica/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /autonomia|CEM art\.\s*1/i.test(r)));
});

test('organograma e papeis: aciona risco de delegacao indevida', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('reorganizar organograma e descricao de cargo da secretaria clinica'),
  );
  assert.ok(parecer.fatos.some((f) => /organograma/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /Lei 7\.498|COFEN|operacional-dh-aps/i.test(r)));
});

test('estrutura setorial: aciona invariante do canal de dado clinico', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('redesenhar integracao entre areas administrativa e clinica para fluxo entre setores'),
  );
  assert.ok(parecer.fatos.some((f) => /estrutura setorial/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /canal (?:de )?dado cl[íi]nico|administrativo n[ãa]o pode/i.test(r)));
});

test('indicadores e governanca: aciona LGPD e meta vinculada a ato medico', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('definir KPI de performance operacional e dashboard gerencial'),
  );
  assert.ok(parecer.fatos.some((f) => /indicadores e governan[çc]a/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /LGPD|arts\.\s*7|arts\.\s*11/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /CFM Res\. 2\.336|autonomia t[ée]cnica/i.test(r)));
});

test('todos os temas sao LACUNA EXPLICITA: fundamentos sempre vazio (eixos=[])', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('diagnostico operacional e organograma e indicadores juntos'),
  );
  assert.ok(parecer.fatos.length >= 1);
  assert.equal(parecer.fundamentos.length, 0, 'adapter bibliografico nao pode citar norma do mapa');
  assert.ok(parecer.riscos.some((r) => /NSAS detecta o assunto e sinaliza riscos conhecidos, mas N[ÃA]O produz parecer t[ée]cnico substitutivo/i.test(r)));
});

test('fato sem tema reconhecido retorna lacuna generica', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussao sobre segredo medico em prontuario eletronico'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema de consultoria organizacional/i);
});

test('classificador padrao roteia KPI para consultoria-organizacional', () => {
  const classificador = api.criarClassificadorNsasPadrao();
  const dominios = classificador.classificar('definir indicador e governanca corporativa da clinica');
  assert.ok(dominios.includes('consultoria-organizacional'));
});

test('roteador padrao inclui consultoria-organizacional', () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  assert.ok(roteador.dominiosRegistrados.includes('consultoria-organizacional'));
  assert.ok(api.DOMINIOS_NSAS_PADRAO.includes('consultoria-organizacional'));
});
