const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function notaValida(overrides = {}) {
  return {
    id: 'NSAS-M-001',
    criada_em: '2026-10-11T10:00:00.000Z',
    autora: 'Núcleo de Saúde Suplementar',
    dominios: ['juridico-saude-suplementar'],
    conteudo_pseudonimizado: 'Cooperativa deliberou política de autorização prévia em assembleia 2026-09.',
    origem: 'Ata de Assembleia 2026/09',
    referencia_documental: 'docs/atas/2026-09.pdf',
    status_validacao: 'validada',
    versao_registro: 'v1',
    ...overrides,
  };
}

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-0000000000cc',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: { tradutor_v: '1.0', detectores: [], predicados_verificados: [] },
  };
}

test('registra e recupera nota validada por domínio', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida());
  const notas = await adapter.consultar({ dominios: ['juridico-saude-suplementar'] });
  assert.equal(notas.length, 1);
  assert.equal(notas[0].id, 'NSAS-M-001');
  adapter.close();
});

test('filtragem por domínio é explícita — ausência de domínios lança erro', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await assert.rejects(
    () => adapter.consultar({ dominios: [] }),
    (err) => err instanceof api.ErroMemoriaInstitucional && err.motivo === 'dominios_ausentes',
  );
  adapter.close();
});

test('consulta não retorna notas de outros domínios', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ id: 'A', dominios: ['juridico-saude-suplementar'] }));
  await adapter.registrar(notaValida({ id: 'B', dominios: ['compliance-regulatorio-lgpd'] }));
  const notas = await adapter.consultar({ dominios: ['juridico-saude-suplementar'] });
  assert.equal(notas.length, 1);
  assert.equal(notas[0].id, 'A');
  adapter.close();
});

test('não inclui notas pendentes ou revogadas por padrão', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ id: 'val', status_validacao: 'validada' }));
  await adapter.registrar(notaValida({ id: 'pen', status_validacao: 'pendente' }));
  await adapter.registrar(notaValida({ id: 'rev', status_validacao: 'revogada' }));
  const notas = await adapter.consultar({ dominios: ['juridico-saude-suplementar'] });
  assert.equal(notas.length, 1);
  assert.equal(notas[0].id, 'val');
  adapter.close();
});

test('ordenação determinística: criada_em desc, desempate por id', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ id: 'B', criada_em: '2026-10-10T10:00:00.000Z' }));
  await adapter.registrar(notaValida({ id: 'A', criada_em: '2026-10-10T10:00:00.000Z' }));
  await adapter.registrar(notaValida({ id: 'C', criada_em: '2026-10-11T10:00:00.000Z' }));
  const notas = await adapter.consultar({ dominios: ['juridico-saude-suplementar'] });
  assert.deepEqual(notas.map((n) => n.id), ['C', 'A', 'B']);
  adapter.close();
});

test('recusa registros sem campos obrigatórios', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await assert.rejects(() => adapter.registrar(notaValida({ id: '' })), /validacao_falhou|sem id/);
  await assert.rejects(() => adapter.registrar(notaValida({ autora: '' })), /autora/);
  await assert.rejects(() => adapter.registrar(notaValida({ origem: '' })), /origem/);
  await assert.rejects(() => adapter.registrar(notaValida({ versao_registro: 'abc' })), /versao_registro/);
  await assert.rejects(() => adapter.registrar(notaValida({ dominios: [] })), /dom[íi]nios/);
  await assert.rejects(() => adapter.registrar(notaValida({ status_validacao: 'xyz' })), /status/);
  adapter.close();
});

test('recusa conteúdo com termo clínico canônico', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await assert.rejects(
    () => adapter.registrar(notaValida({ conteudo_pseudonimizado: 'Paciente apresentou laudo com achados.' })),
    (err) => err instanceof api.ErroMemoriaInstitucional && err.motivo === 'conteudo_sensivel_bruto',
  );
  adapter.close();
});

test('recusa conteúdo com CPF, telefone, e-mail ou CID crus', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await assert.rejects(
    () => adapter.registrar(notaValida({ conteudo_pseudonimizado: 'Beneficiário CPF 123.456.789-00.' })),
    /CPF/,
  );
  await assert.rejects(
    () => adapter.registrar(notaValida({ conteudo_pseudonimizado: 'Contato: beneficiario@example.com.' })),
    /e-mail/,
  );
  await assert.rejects(
    () => adapter.registrar(notaValida({ conteudo_pseudonimizado: 'Contato (41) 99999-8888.' })),
    /telefone/,
  );
  await assert.rejects(
    () => adapter.registrar(notaValida({ conteudo_pseudonimizado: 'Diagnóstico G44.1 anotado.' })),
    /CID/,
  );
  adapter.close();
});

test('recusa duplicata na mesma versão do mesmo id', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida());
  await assert.rejects(
    () => adapter.registrar(notaValida()),
    (err) => err instanceof api.ErroMemoriaInstitucional && err.motivo === 'nota_duplicada',
  );
  adapter.close();
});

test('persiste através de reinicialização (arquivo real)', async () => {
  const tmp = path.join(os.tmpdir(), `nsas-mem-${Date.now()}.sqlite`);
  const a = new api.MemoriaSqliteAdapter({ caminho: tmp });
  await a.registrar(notaValida());
  a.close();
  const b = new api.MemoriaSqliteAdapter({ caminho: tmp });
  const notas = await b.consultar({ dominios: ['juridico-saude-suplementar'] });
  assert.equal(notas.length, 1);
  b.close();
  fs.unlinkSync(tmp);
});

test('nota correta mantém id com nova versao_registro (histórico versionado)', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ versao_registro: 'v1' }));
  await adapter.registrar(notaValida({ versao_registro: 'v2', conteudo_pseudonimizado: 'Versão corrigida da deliberação.' }));
  const notas = await adapter.consultar({ dominios: ['juridico-saude-suplementar'] });
  assert.equal(notas.length, 2);
  const versoes = notas.map((n) => n.versao_registro).sort();
  assert.deepEqual(versoes, ['v1', 'v2']);
  adapter.close();
});

test('consultarComoContexto produz huella estável para conjunto equivalente', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ id: 'A' }));
  await adapter.registrar(notaValida({ id: 'B', criada_em: '2026-10-10T10:00:00.000Z' }));
  const c1 = await adapter.consultarComoContexto({ dominios: ['juridico-saude-suplementar'] });
  const c2 = await adapter.consultarComoContexto({ dominios: ['juridico-saude-suplementar'] });
  assert.equal(c1.huella, c2.huella);
  assert.equal(c1.notas.length, 2);
  adapter.close();
});

test('huella muda quando conjunto muda', async () => {
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ id: 'A' }));
  const c1 = await adapter.consultarComoContexto({ dominios: ['juridico-saude-suplementar'] });
  await adapter.registrar(notaValida({ id: 'B', criada_em: '2026-10-10T10:00:00.000Z' }));
  const c2 = await adapter.consultarComoContexto({ dominios: ['juridico-saude-suplementar'] });
  assert.notEqual(c1.huella, c2.huella);
  adapter.close();
});

test('integração: consultarMemoriaParaPacote filtra por domínios consultados', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });

  await adapter.registrar(notaValida({ id: 'JS', dominios: ['juridico-saude-suplementar'] }));
  await adapter.registrar(notaValida({ id: 'CL', dominios: ['compliance-regulatorio-lgpd'] }));
  await adapter.registrar(notaValida({ id: 'OP', dominios: ['operacional-dh-aps'] }));

  const pacote = await roteador.consultarDominios(
    ['juridico-saude-suplementar'],
    casoDe('operadora aplicou glosa'),
  );
  const ctx = await api.consultarMemoriaParaPacote(pacote, { memoria: adapter });
  assert.equal(ctx.notas.length, 1);
  assert.equal(ctx.notas[0].id, 'JS');
  assert.ok(ctx.huella);
  adapter.close();
});

test('integração: redator inclui seção Memória institucional quando contexto fornecido', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  await adapter.registrar(notaValida({ id: 'JS-1' }));
  const pacote = await roteador.consultarDominios(
    ['juridico-saude-suplementar'],
    casoDe('operadora aplicou glosa'),
  );
  const ctx = await api.consultarMemoriaParaPacote(pacote, { memoria: adapter });
  const md = api.criarRedatorNotaTecnica().redigir(
    pacote,
    {
      numero: '099',
      ano: 2026,
      data: '2026-10-11',
      destinatario: 'Diretoria',
      assunto: 'glosa',
      encaminhamento: 'Diretoria',
      tema: 'Teste',
      fatoJuridico: 'operadora aplicou glosa',
    },
    { memoriaContexto: ctx },
  );
  assert.match(md, /## Mem[óo]ria institucional consultada/);
  assert.match(md, /JS-1/);
  assert.match(md, /huella/i);
  adapter.close();
});

test('redator mantém saída anterior quando memoriaContexto é omitido', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const pacote = await roteador.consultarDominios(
    ['juridico-saude-suplementar'],
    casoDe('operadora aplicou glosa'),
  );
  const md = api.criarRedatorNotaTecnica().redigir(pacote, {
    numero: '099',
    ano: 2026,
    data: '2026-10-11',
    destinatario: 'Diretoria',
    assunto: 'glosa',
    encaminhamento: 'Diretoria',
    tema: 'Teste',
    fatoJuridico: 'operadora aplicou glosa',
  });
  assert.doesNotMatch(md, /## Mem[óo]ria institucional/);
});

test('redator exibe preâmbulo anti-alucinação após o selo', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const pacote = await roteador.consultarDominios(
    ['juridico-saude-suplementar'],
    casoDe('operadora aplicou glosa'),
  );
  const md = api.criarRedatorNotaTecnica().redigir(pacote, {
    numero: '099',
    ano: 2026,
    data: '2026-10-11',
    destinatario: 'Diretoria',
    assunto: 'glosa',
    encaminhamento: 'Diretoria',
    tema: 'Teste',
    fatoJuridico: 'operadora aplicou glosa',
  });
  assert.match(md, /sujeito à validação jurídica/i);
  assert.match(md, /pseudonimização e segurança/i);
  const idxSelo = md.indexOf('PENDENTE DE APROVAÇÃO OAB');
  const idxPreambulo = md.indexOf('sujeito à validação');
  assert.ok(idxSelo < idxPreambulo, 'preâmbulo deve vir depois do selo');
});

test('contexto vazio ainda é consultado e carimba huella', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const adapter = new api.MemoriaSqliteAdapter({ caminho: ':memory:' });
  const pacote = await roteador.consultarDominios(
    ['juridico-saude-suplementar'],
    casoDe('operadora aplicou glosa'),
  );
  const ctx = await api.consultarMemoriaParaPacote(pacote, { memoria: adapter });
  assert.equal(ctx.notas.length, 0);
  assert.ok(ctx.huella);
  adapter.close();
});

test('mensagem de lacuna refinada inclui domínio e orientação explícita', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = api.criarComplianceRegulatorioLgpd({ mapa });
  const parecer = await adapter.consultar(casoDe('reajuste do aluguel do consultório'));
  assert.ok(parecer.riscos.some((r) => /Lacuna identificada/i.test(r)));
  assert.ok(parecer.riscos.some((r) => /compliance-regulatorio-lgpd/.test(r)));
});
