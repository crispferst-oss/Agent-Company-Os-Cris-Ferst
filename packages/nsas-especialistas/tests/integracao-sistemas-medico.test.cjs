const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000008',
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
  return { adapter: api.criarIntegracaoSistemasMedico({ mapa }), mapa };
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
  assert.equal(adapter.dominio, 'integracao-sistemas-medico');
  assert.equal(adapter.versao, `integracao-sistemas-medico@${mapa.versao}`);
});

test('prontuario eletronico: aciona eixos 2 e 6 do mapa', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('precisamos integrar com iClinic para ler prontuario eletronico do medico'),
  );
  assert.equal(parecer.especialista, 'integracao-sistemas-medico');
  assert.ok(parecer.fatos.some((f) => /prontu[áa]rio eletr[ôo]nico/i.test(f)));
  assert.ok(parecer.fundamentos.length > 0, 'eixos 2+6 devem puxar normas do mapa');
  assert.ok(parecer.riscos.some((r) => /art\.?\s*11.*II|base legal taxativa/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /acoplamento|APIs propriet[áa]rias/i.test(r)));
});

test('agendamento integrado: aciona risco de transferencia internacional', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('sincronizar Google Calendar com a agenda do consultorio para agendamento integrado'),
  );
  assert.ok(parecer.fatos.some((f) => /agendamento integrado/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /transfer[êe]ncia internacional|arts\.?\s*33.*36/i.test(r)));
});

test('mensageria paciente: aciona invariante do canal clinico', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('integrar WhatsApp Business como canal de comunicacao com paciente'),
  );
  assert.ok(parecer.fatos.some((f) => /mensageria/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /canal cl[íi]nico|recepcionar exame|invariante do canal de dado cl[íi]nico/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /2\.336|2\.314|teleorienta|teleconsulta/i.test(r)));
});

test('receita digital: aciona CFM 2.314 e ICP-Brasil', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('integrar Memed para receita digital com assinatura ICP-Brasil'),
  );
  assert.ok(parecer.fatos.some((f) => /receita digital/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /2\.314|MP 2\.200-2|ICP[- ]Brasil/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /rastreabilidade|hash|timestamp/i.test(r)));
});

test('interoperabilidade FHIR: aciona TISS/ANS 501 e sinaliza lacuna', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('adotar HL7 FHIR como padrao de interoperabilidade com clinicas conveniadas'),
  );
  assert.ok(parecer.fatos.some((f) => /interoperabilidade/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /Res\.?\s*ANS 501|TISS atualizado/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /HL7 FHIR e OpenEHR.*n[ãa]o constam|Lacuna no mapa canônico/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /pesquisa-normativa/i.test(r)));
});

test('certificacao SBIS: aciona CFM 2.228 e dever de guarda do papel', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('verificar certificacao SBIS NGS2 do PEP antes de contratar'),
  );
  assert.ok(parecer.fatos.some((f) => /certifica[çc][ãa]o SBIS/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /2\.228|guarda do prontu[áa]rio f[íi]sico|dever de guarda do papel/i.test(r)));
});

test('base legal: aciona art. 11 II taxativo e RIPD/DPIA', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('definir base legal LGPD art 11 e minimizacao de dados para a integracao com DPIA'),
  );
  assert.ok(parecer.fatos.some((f) => /base legal e minimiza[çc][ãa]o/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /rol taxativo|al\.\s*"?[adf]"?/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /RIPD|DPIA|art\.\s*38/i.test(r)));
});

test('multiplos temas: PEP + receita digital nao duplica norma', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('integrar iClinic ao Memed para receita digital a partir do prontuario eletronico'),
  );
  assert.ok(parecer.fatos.length >= 2);
  const normas = parecer.fundamentos.map((f) => f.norma);
  const dedup = new Set(normas);
  assert.equal(normas.length, dedup.size, 'não pode duplicar norma na mesma consulta');
});

test('fato sem tema reconhecido retorna lacuna', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussao sobre reajuste do contrato de aluguel do consultorio'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema de integra[çc][ãa]o/i);
});

test('classificador padrao roteia FHIR para integracao-sistemas-medico', () => {
  const classificador = api.criarClassificadorNsasPadrao();
  const dominios = classificador.classificar('adotar HL7 FHIR na troca com operadora');
  assert.ok(dominios.includes('integracao-sistemas-medico'));
});

test('roteador padrao inclui integracao-sistemas-medico nos 8 adapters NSAS', () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  assert.ok(roteador.dominiosRegistrados.includes('integracao-sistemas-medico'));
  assert.ok(api.DOMINIOS_NSAS_PADRAO.includes('integracao-sistemas-medico'));
  assert.equal(roteador.dominiosRegistrados.length, 8);
});
