const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000099',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: { tradutor_v: '1.0', detectores: [], predicados_verificados: [] },
  };
}

function novoRoteador() {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  return { roteador: api.criarRoteadorEspecialistas({ mapa }), mapa };
}

test('roteador padrão registra os 6 domínios NSAS', () => {
  const { roteador } = novoRoteador();
  for (const d of api.DOMINIOS_NSAS_PADRAO) {
    assert.ok(
      roteador.dominiosRegistrados.includes(d),
      `faltou registrar o domínio "${d}"`,
    );
  }
  assert.equal(roteador.dominiosRegistrados.length, api.DOMINIOS_NSAS_PADRAO.length);
});

test('consultarDominios executa adapters em paralelo e devolve pareceres', async () => {
  const { roteador } = novoRoteador();
  const pacote = await roteador.consultarDominios(
    ['etica-medica-prontuario', 'comunicacao-medico-paciente'],
    casoDe('médico envia foto de lesão pelo WhatsApp e registra depois no prontuário'),
  );
  assert.equal(pacote.pareceres.length, 2);
  assert.equal(pacote.erros.length, 0);
  const dominios = pacote.pareceres.map((p) => p.especialista);
  assert.ok(dominios.includes('etica-medica-prontuario'));
  assert.ok(dominios.includes('comunicacao-medico-paciente'));
});

test('consultarDominios deduplica domínios repetidos', async () => {
  const { roteador } = novoRoteador();
  const pacote = await roteador.consultarDominios(
    ['pesquisa-normativa', 'pesquisa-normativa'],
    casoDe('prontuário médico'),
  );
  assert.equal(pacote.pareceres.length, 1);
});

test('consultarDominios sinaliza domínio desconhecido sem derrubar o lote', async () => {
  const { roteador } = novoRoteador();
  const pacote = await roteador.consultarDominios(
    ['pesquisa-normativa', 'especialista-fantasma'],
    casoDe('prontuário médico'),
  );
  assert.equal(pacote.pareceres.length, 1);
  assert.equal(pacote.erros.length, 1);
  assert.equal(pacote.erros[0].motivo, 'adapter_desconhecido');
  assert.deepEqual(pacote.dominiosDesconhecidos, ['especialista-fantasma']);
});

test('consultarDominios captura ErroConsultaEspecialista sem travar os demais', async () => {
  const { roteador } = novoRoteador();
  const pacote = await roteador.consultarDominios(
    ['pesquisa-normativa', 'etica-medica-prontuario'],
    casoDe('   '),
  );
  assert.equal(pacote.pareceres.length, 0);
  assert.equal(pacote.erros.length, 2);
  for (const e of pacote.erros) {
    assert.equal(e.motivo, 'caso_invalido');
  }
});

test('versoesConsultadas carimba versão de cada adapter alvo', async () => {
  const { roteador, mapa } = novoRoteador();
  const pacote = await roteador.consultarDominios(
    ['juridico-saude-suplementar', 'operacional-dh-aps'],
    casoDe('operadora negou autorização prévia e clínica recusou atendimento emergencial'),
  );
  assert.equal(pacote.versoesConsultadas.length, 2);
  for (const v of pacote.versoesConsultadas) {
    assert.ok(v.includes(mapa.versao), `versão "${v}" não carimba o mapa`);
  }
  assert.match(pacote.versaoRoteador, /^roteador-nsas@/);
});

test('invariante #6: roteador não concatena adapters — consulta é 1-por-1', async () => {
  const { roteador } = novoRoteador();
  const pacote = await roteador.consultarDominios(
    ['compliance-regulatorio-lgpd'],
    casoDe('vazamento de dados sensíveis de pacientes'),
  );
  assert.equal(pacote.pareceres.length, 1);
  assert.equal(pacote.pareceres[0].especialista, 'compliance-regulatorio-lgpd');
});

test('construtor rejeita adapters com domínio duplicado', () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const dup = api.criarEticaMedicaProntuario({ mapa });
  assert.throws(
    () => api.criarRoteadorEspecialistas({ mapa, adapters: [dup, dup] }),
    /duplicado/,
  );
});

test('roteador aceita adapters customizados substituindo o conjunto padrão', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({
    mapa,
    adapters: [api.criarComplianceRegulatorioLgpd({ mapa })],
  });
  assert.deepEqual(roteador.dominiosRegistrados, ['compliance-regulatorio-lgpd']);
  const pacote = await roteador.consultarDominios(
    ['etica-medica-prontuario'],
    casoDe('prontuário'),
  );
  assert.equal(pacote.dominiosDesconhecidos.length, 1);
});
