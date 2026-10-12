const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000002',
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
  return { adapter: api.criarEticaMedicaProntuario({ mapa }), mapa };
}

test('adapter recusa caso sem fato_juridico', async () => {
  const { adapter } = novoAdapter();
  await assert.rejects(
    () => adapter.consultar(casoDe('')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('tema prontuário: fatos, fundamentos do eixo 2 e risco de guarda', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico pergunta sobre guarda de prontuário eletrônico e cópia ao paciente'),
  );
  assert.equal(parecer.especialista, 'etica-medica-prontuario');
  assert.ok(parecer.fatos.some((f) => /prontu[áa]rio/i.test(f)));
  assert.ok(parecer.fundamentos.length > 0);
  assert.ok(parecer.riscos.some((r) => /guarda m[íi]nima|20 anos/i.test(r)));
});

test('tema alteração retroativa dispara riscos probatório e ético', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico quer saber se pode fazer alteração retroativa do prontuário para corrigir anotação'),
  );
  assert.ok(parecer.fatos.some((f) => /altera[çc][ãa]o retroativ/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /probat[óo]rio/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /CFM Res\. 2\.145\/2016|PEP/.test(r)));
});

test('tema segredo médico aponta risco criminal (art. 154 CP)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('consulta sobre quebra de sigilo médico a pedido de familiar'),
  );
  assert.ok(parecer.fatos.some((f) => /segredo/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*154 CP/i.test(r)));
});

test('tema telemedicina liga eixo 3 e risco ICP-Brasil', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico faz teleconsulta sem registro em prontuário e emite receita eletrônica'),
  );
  assert.ok(parecer.fatos.some((f) => /telemedicina/i.test(f)));
  assert.ok(parecer.fundamentos.some((f) => /2\.314/.test(f.norma)));
  assert.ok(parecer.riscos.some((r) => /ICP-Brasil/i.test(r)));
});

test('tema documento médico aponta risco criminal (atestado falso, art. 302 CP)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('paciente pede atestado médico retroativo para empresa'),
  );
  assert.ok(parecer.fatos.some((f) => /documento m[ée]dico/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*302 CP/i.test(r)));
});

test('múltiplos temas: prontuário + segredo acumulam riscos sem duplicar', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('médico pergunta sobre prontuário e dever de segredo médico perante pedido de operadora'),
  );
  assert.ok(parecer.fatos.length >= 2);
  assert.ok(parecer.riscos.some((r) => /probat[óo]rio/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /segredo m[ée]dico|CEM arts\. 73-79/.test(r)));
});

test('fato sem tema reconhecido retorna lacuna com fonte do mapa', async () => {
  const { adapter, mapa } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussão sobre reajuste contratual de aluguel comercial'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema/i);
  assert.ok(parecer.fontes[0].includes(mapa.versao));
});

test('risco explícito de delegação à pesquisa-normativa (recursão zero, invariante #6)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('duvida sobre prontuário eletrônico atual'),
  );
  assert.ok(
    parecer.riscos.some((r) => /pesquisa-normativa.*n[óo] irm[ãa]o/i.test(r)),
    'adapter deve sinalizar que atualização normativa é feita por nó irmão, não por chamada direta',
  );
});

test('adapter carimba versão com a versão do mapa', () => {
  const { adapter, mapa } = novoAdapter();
  assert.equal(adapter.dominio, 'etica-medica-prontuario');
  assert.match(adapter.versao, /^etica-medica-prontuario@/);
  assert.ok(adapter.versao.includes(mapa.versao));
});
