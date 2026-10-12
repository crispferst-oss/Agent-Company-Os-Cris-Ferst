const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000003',
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
  return { adapter: api.criarComunicacaoMedicoPaciente({ mapa }), mapa };
}

test('adapter recusa caso sem fato_juridico', async () => {
  const { adapter } = novoAdapter();
  await assert.rejects(
    () => adapter.consultar(casoDe('  ')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('whatsapp: dispara risco LGPD, probatório e de modalidade clínica', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('paciente envia foto de lesão pelo WhatsApp fora do horário'),
  );
  assert.equal(parecer.especialista, 'comunicacao-medico-paciente');
  assert.ok(parecer.fatos.some((f) => /WhatsApp/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /LGPD/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /probat[óo]rio/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /teleconsulta/i.test(r)));
});

test('publicidade com antes e depois: risco ético e LGPD', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('medico quer postar antes e depois de procedimento no Instagram'),
  );
  assert.ok(parecer.fatos.some((f) => /publicidade/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /2\.336\/23|PEP/.test(r)));
  assert.ok(parecer.fundamentos.some((f) => /2\.336/.test(f.norma)));
});

test('receita digital por WhatsApp: risco ICP-Brasil e RDC 471/21', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('medico envia receita digital por WhatsApp para paciente'),
  );
  assert.ok(parecer.fatos.some((f) => /WhatsApp/i.test(f)));
  assert.ok(parecer.fatos.some((f) => /receita digital/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /ICP-Brasil/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /RDC 471/i.test(r)));
});

test('secretária transmitindo orientação clínica: exercício irregular', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('secretária transmite orientação clínica a paciente por telefone'),
  );
  assert.ok(parecer.fatos.some((f) => /administrativ/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /exerc[íi]cio irregular|art\.\s*282 CP/i.test(r)));
});

test('teleorientação sem teleconsulta: dispara risco de modalidade', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('medico faz teleorientacao e emite diagnóstico ao final'),
  );
  assert.ok(parecer.fatos.some((f) => /teleorienta/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /modalidade/i.test(r)));
  assert.ok(parecer.fundamentos.some((f) => /2\.314/.test(f.norma)));
});

test('consentimento genérico: aponta falha de forma e LGPD art. 11', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clinica usa TCLE genérico para todos procedimentos'),
  );
  assert.ok(parecer.fatos.some((f) => /consentimento/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /espec[íi]fico|revog[áa]vel/i.test(r)));
});

test('múltiplos temas: publicidade + LGPD acumulam sem duplicar norma', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('medico publica depoimento de paciente no Instagram sem analisar LGPD base legal'),
  );
  assert.ok(parecer.fatos.length >= 2);
  const normas = parecer.fundamentos.map((f) => f.norma);
  const dedup = new Set(normas);
  assert.equal(normas.length, dedup.size, 'não pode duplicar norma na mesma consulta');
});

test('fato sem tema reconhecido retorna lacuna', async () => {
  const { adapter, mapa } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussão sobre reajuste de aluguel comercial do consultório'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema/i);
  assert.ok(parecer.fontes[0].includes(mapa.versao));
});

test('adapter sinaliza delegação a pesquisa-normativa (recursão zero)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('medico usa WhatsApp com paciente'),
  );
  assert.ok(
    parecer.riscos.some((r) => /pesquisa-normativa.*n[óo] irm[ãa]o/i.test(r)),
  );
});

test('adapter carimba versão com a versão do mapa', () => {
  const { adapter, mapa } = novoAdapter();
  assert.equal(adapter.dominio, 'comunicacao-medico-paciente');
  assert.match(adapter.versao, /^comunicacao-medico-paciente@/);
  assert.ok(adapter.versao.includes(mapa.versao));
});
