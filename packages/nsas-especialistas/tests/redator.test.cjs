const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-0000000000bb',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: { tradutor_v: '1.0', detectores: [], predicados_verificados: [] },
  };
}

function metadadosDe(overrides = {}) {
  return {
    numero: '012',
    ano: 2026,
    data: '2026-10-11',
    destinatario: 'Diretoria Executiva da Cooperativa',
    assunto: 'Risco de glosa recorrente em autorização prévia de OPME.',
    encaminhamento: 'Diretoria Executiva',
    copia: 'NSP e DPO',
    tema: 'Glosa recorrente em OPME',
    fatoJuridico: 'Operadora aplicou glosa sem fundamentação após autorização prévia emitida.',
    autora: 'Cristhiane Pacheco Ferst',
    oab: 'OAB/PR 66.462',
    ...overrides,
  };
}

async function pacoteDe(fato, dominios) {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  return roteador.consultarDominios(dominios, casoDe(fato));
}

test('rascunho contém selo de pendente de aprovação OAB (duas vezes)', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  const marcadores = md.match(/PENDENTE DE APROVAÇÃO OAB/g) || [];
  assert.ok(marcadores.length >= 2, 'selo deve aparecer no topo e no rodapé');
});

test('rascunho segue a ordem canônica das seções', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  const ordem = [
    '# Nota Técnica NSAS',
    '## Assunto',
    '## Contexto',
    '## Fundamentos',
    '## Recomendações operacionais',
    '## Pontos de atenção',
    '## Encaminhamento',
    '## Fontes consultadas',
  ];
  let cursor = 0;
  for (const titulo of ordem) {
    const idx = md.indexOf(titulo, cursor);
    assert.ok(idx > -1, `faltou seção: ${titulo}`);
    cursor = idx;
  }
});

test('metadados aparecem no bloco Assunto', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  assert.match(md, /NSAS\.012\/2026/);
  assert.match(md, /Diretoria Executiva da Cooperativa/);
});

test('fundamentos são deduplicados entre pareceres', async () => {
  const pacote = await pacoteDe(
    'operadora negou autorização prévia e aplicou glosa na mesma solicitação',
    ['juridico-saude-suplementar'],
  );
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  const bloco = md.split('## Fundamentos')[1].split('##')[0];
  const normas = bloco.match(/\*\*([^*]+)\*\*/g) || [];
  const dedup = new Set(normas);
  assert.equal(normas.length, dedup.size);
});

test('tabela de recomendações é stub por risco com cabeçalho canônico', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  assert.match(md, /\| Ação \| O que fazer \| Respons[áa]vel \| Prazo sugerido \|/);
  assert.match(md, /\| Ação 1 \|.*derivar de/);
});

test('pontos de atenção listam riscos sem duplicar', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  const bloco = md.split('## Pontos de atenção')[1].split('##')[0];
  const linhas = bloco.split('\n').filter((l) => l.startsWith('- '));
  const dedup = new Set(linhas);
  assert.equal(linhas.length, dedup.size);
});

test('fontes carimbam roteador e todas as versões consultadas', async () => {
  const pacote = await pacoteDe(
    'operadora aplicou glosa e paciente pede tutela de urgência',
    ['juridico-saude-suplementar', 'compliance-regulatorio-lgpd'],
  );
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  assert.match(md, /Roteador:\*\* roteador-nsas@/);
  for (const v of pacote.versoesConsultadas) {
    assert.ok(md.includes(v), `faltou versão ${v}`);
  }
});

test('assinatura usa autora e OAB padrão quando omitidos', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe({ autora: undefined, oab: undefined }));
  assert.match(md, /Cristhiane Pacheco Ferst · OAB\/PR 66\.462/);
});

test('encaminhamento com cópia preserva o campo', async () => {
  const pacote = await pacoteDe('operadora aplicou glosa', ['juridico-saude-suplementar']);
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  assert.match(md, /\*\*Para:\*\* Diretoria Executiva/);
  assert.match(md, /\*\*Cópia:\*\* NSP e DPO/);
});

test('erros do pacote são expostos na seção Fontes (nunca escondidos)', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const pacote = await roteador.consultarDominios(
    ['pesquisa-normativa', 'especialista-fantasma'],
    casoDe('prontuário'),
  );
  const redator = api.criarRedatorNotaTecnica();
  const md = redator.redigir(pacote, metadadosDe());
  assert.match(md, /adapter_desconhecido/);
  assert.match(md, /especialista-fantasma/);
});

test('integração: fato → classificador → roteador → redator produz rascunho carimbado', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const classificador = api.criarClassificadorNsasPadrao();
  const roteador = api.criarRoteadorEspecialistas({ mapa });
  const redator = api.criarRedatorNotaTecnica();

  const fato = 'operadora aplicou glosa e clínica teve vazamento de dados sensíveis dos pacientes';
  const dominios = classificador.classificar(fato);
  const pacote = await roteador.consultarDominios(dominios, casoDe(fato));
  const md = redator.redigir(pacote, metadadosDe({ tema: 'Glosa + incidente LGPD' }));

  assert.match(md, /# Nota Técnica NSAS – Glosa \+ incidente LGPD/);
  assert.match(md, /PENDENTE DE APROVAÇÃO OAB/);
  assert.match(md, /juridico-saude-suplementar@/);
  assert.match(md, /compliance-regulatorio-lgpd@/);
});
