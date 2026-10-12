const test = require('node:test');
const assert = require('node:assert/strict');
const { criarNucleoNsas } = require('..');

// Fakes mínimos — o núcleo é composition root puro; não precisa de adapters reais.

function fakeAvaliarIngressoAceita(entrada) {
  return { aceito: true, veredictos: [] };
}

function fakeAvaliarIngressoBloqueia(_entrada) {
  return {
    aceito: false,
    motivoRecusa: "Nome de arquivo 'laudo.dcm' sugere dado clínico.",
    orientacao: 'Encaminhar via Canal Clínico Segregado.',
    veredictos: [
      {
        classe: 'DC-1',
        confianca: 1,
        acao: 'recusa_dura',
        motivo: 'DICOM bloqueado na borda',
        span: { campo: 'mime' },
      },
    ],
  };
}

function fakeClassificador(dominios) {
  return {
    dominios,
    classificar() {
      return dominios;
    },
  };
}

function fakeRoteador(pareceres = [], erros = []) {
  return {
    dominiosRegistrados: pareceres.map((p) => p.dominio),
    async consultarDominios(dominios, _caso) {
      return {
        versaoRoteador: 'roteador-nsas@test-1',
        pareceres,
        erros,
        versoesConsultadas: pareceres.map((p) => `${p.dominio}@test-1`),
        dominiosDesconhecidos: [],
      };
    },
  };
}

function fakeRedator() {
  return {
    redigir(pacote, metadados, opcoes) {
      const marca = opcoes && opcoes.memoriaContexto ? '[com-memoria]' : '[sem-memoria]';
      return [
        '[RASCUNHO — PENDENTE DE APROVAÇÃO OAB]',
        `NSAS.${metadados.numero}/${metadados.ano} — ${metadados.tema}`,
        `pareceres=${pacote.pareceres.length} ${marca}`,
      ].join('\n');
    },
  };
}

function fakeMemoriaVazia() {
  return {
    versao: 'memoria-fake@test-1',
    async consultar(_filtro) {
      return [];
    },
  };
}

const casoBase = {
  caso_id: '00000000-0000-4000-8000-000000000001',
  titular_ref: 'hmac:abc',
  fato_juridico: 'médico pergunta sobre glosa da operadora em consulta eletiva',
  refs_clinicas: [],
  documentos_opaco: [],
  predicados: [],
  tradutor_v: '1.0',
  selo: { origem: 'borda-admin', integridade: 'ok' },
};

const metadadosBase = {
  numero: '001',
  ano: 2026,
  data: '2026-10-12',
  destinatario: 'Dra. X',
  assunto: 'Glosa',
  encaminhamento: 'Operadora Y',
  tema: 'glosa de operadora',
  fatoJuridico: casoBase.fato_juridico,
};

test('borda bloqueia DC-1: núcleo retorna recusa sem acionar classificador/roteador/redator', async () => {
  let classifChamado = false;
  let roteadorChamado = false;
  let redatorChamado = false;

  const nucleo = criarNucleoNsas({
    avaliarIngresso: fakeAvaliarIngressoBloqueia,
    classificador: {
      dominios: [],
      classificar() {
        classifChamado = true;
        return [];
      },
    },
    roteador: {
      dominiosRegistrados: [],
      async consultarDominios() {
        roteadorChamado = true;
        return { versaoRoteador: '', pareceres: [], erros: [], versoesConsultadas: [], dominiosDesconhecidos: [] };
      },
    },
    redator: {
      redigir() {
        redatorChamado = true;
        return '';
      },
    },
  });

  const resultado = await nucleo.processar({
    bruto: { anexos: [{ nome: 'laudo.dcm', mime: 'application/dicom' }] },
    caso: casoBase,
    metadados: metadadosBase,
  });

  assert.equal(resultado.aceito, false);
  assert.match(resultado.motivoRecusa, /dad(o|ínico|cl)/i);
  assert.ok(resultado.orientacao.includes('Canal Clínico Segregado'));
  assert.equal(resultado.veredictos.length, 1);
  assert.equal(resultado.veredictos[0].classe, 'DC-1');
  assert.equal(classifChamado, false, 'classificador não deve rodar após bloqueio');
  assert.equal(roteadorChamado, false, 'roteador não deve rodar após bloqueio');
  assert.equal(redatorChamado, false, 'redator não deve rodar após bloqueio');
});

test('fluxo feliz sem memória: classifica, roteia, redige, carimba pendente de OAB', async () => {
  const parecer = {
    dominio: 'juridico-saude-suplementar',
    versao: 'juridico-saude-suplementar@test-1',
    fatos: ['Tema detectado: glosa'],
    fundamentos: [{ norma: 'Lei 9.656/98', aplicacao: 'cobertura mínima obrigatória' }],
    riscos: ['Operadora pode negar cobertura por item fora do rol'],
  };

  const nucleo = criarNucleoNsas({
    avaliarIngresso: fakeAvaliarIngressoAceita,
    classificador: fakeClassificador(['juridico-saude-suplementar']),
    roteador: fakeRoteador([parecer]),
    redator: fakeRedator(),
  });

  const resultado = await nucleo.processar({
    bruto: { texto: 'glosa de operadora' },
    caso: casoBase,
    metadados: metadadosBase,
  });

  assert.equal(resultado.aceito, true);
  assert.equal(resultado.pendenteAprovacaoOAB, true, 'invariante: toda nota do núcleo é pendente de OAB');
  assert.ok(resultado.notaTecnica.includes('[RASCUNHO — PENDENTE DE APROVAÇÃO OAB]'));
  assert.ok(resultado.notaTecnica.includes('[sem-memoria]'));
  assert.deepEqual(resultado.dominiosClassificados, ['juridico-saude-suplementar']);
  assert.equal(resultado.pacote.pareceres.length, 1);
  assert.equal(resultado.memoriaContexto, undefined);
});

test('fluxo feliz com memória: núcleo consulta memória institucional e injeta contexto no redator', async () => {
  const parecer = {
    dominio: 'etica-medica-prontuario',
    versao: 'etica-medica-prontuario@test-1',
    fatos: [],
    fundamentos: [],
    riscos: [],
  };

  const nucleo = criarNucleoNsas({
    avaliarIngresso: fakeAvaliarIngressoAceita,
    classificador: fakeClassificador(['etica-medica-prontuario']),
    roteador: fakeRoteador([parecer]),
    redator: fakeRedator(),
    consultarMemoria: fakeMemoriaVazia(),
  });

  const resultado = await nucleo.processar({
    bruto: { texto: 'alteração retroativa de prontuário' },
    caso: casoBase,
    metadados: metadadosBase,
  });

  assert.equal(resultado.aceito, true);
  assert.equal(resultado.pendenteAprovacaoOAB, true);
  assert.ok(resultado.notaTecnica.includes('[com-memoria]'));
  assert.ok(resultado.memoriaContexto);
  assert.equal(resultado.memoriaContexto.versao_consulta, 'memoria-fake@test-1');
  assert.deepEqual(resultado.memoriaContexto.dominios_consultados, ['etica-medica-prontuario']);
  assert.equal(resultado.memoriaContexto.notas.length, 0);
});

test('multi-domínio: núcleo propaga lista completa ao roteador e redator', async () => {
  const dominios = ['juridico-saude-suplementar', 'comunicacao-medico-paciente'];
  let dominiosPassados = null;

  const roteador = {
    dominiosRegistrados: dominios,
    async consultarDominios(dom, _caso) {
      dominiosPassados = dom;
      return {
        versaoRoteador: 'roteador-nsas@test-1',
        pareceres: dom.map((d) => ({ dominio: d, versao: `${d}@test-1`, fatos: [], fundamentos: [], riscos: [] })),
        erros: [],
        versoesConsultadas: dom.map((d) => `${d}@test-1`),
        dominiosDesconhecidos: [],
      };
    },
  };

  const nucleo = criarNucleoNsas({
    avaliarIngresso: fakeAvaliarIngressoAceita,
    classificador: fakeClassificador(dominios),
    roteador,
    redator: fakeRedator(),
  });

  const resultado = await nucleo.processar({
    bruto: { texto: 'glosa e whatsapp' },
    caso: casoBase,
    metadados: metadadosBase,
  });

  assert.equal(resultado.aceito, true);
  assert.deepEqual(dominiosPassados, dominios);
  assert.equal(resultado.pacote.pareceres.length, 2);
});
