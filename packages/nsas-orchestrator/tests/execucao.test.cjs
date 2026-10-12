const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');

const casoBase = {
  caso_id: '00000000-0000-4000-8000-000000000003',
  titular_ref: 'hmac:xyz',
  fato_juridico: 'fato de teste',
  refs_clinicas: [],
  documentos_opaco: [],
  predicados: [],
  tradutor_v: '1.0',
  selo: {
    caso_id: '00000000-0000-4000-8000-000000000003',
    issued_at: new Date(),
    expires_at: new Date(Date.now() + 60_000),
    sig: 'x',
  },
};

const relogio = { agora: () => new Date().toISOString() };

function parecer(dominio) {
  return {
    especialista: dominio,
    fatos: [`fato de ${dominio}`],
    fundamentos: [],
    riscos: [],
    fontes: [],
  };
}

function adapterOk(dominio, atraso_ms = 0) {
  return {
    dominio,
    versao: `${dominio}@test-1`,
    async consultar() {
      if (atraso_ms > 0) await new Promise((r) => setTimeout(r, atraso_ms));
      return parecer(dominio);
    },
  };
}

function adapterLento(dominio, atraso_ms) {
  return {
    dominio,
    versao: `${dominio}@test-lento`,
    async consultar() {
      await new Promise((r) => setTimeout(r, atraso_ms));
      return parecer(dominio);
    },
  };
}

function adapterFalha(dominio, motivo = 'fonte_indisponivel') {
  const { ErroConsultaEspecialista } = require('@jev/nsas-especialistas');
  return {
    dominio,
    versao: `${dominio}@test-falha`,
    async consultar() {
      throw new ErroConsultaEspecialista(dominio, motivo, `falha simulada em ${dominio}`);
    },
  };
}

test('validador rejeita id duplicado, dep inexistente, self-loop e ciclo (invariante #6 operacional)', () => {
  const base = { versao: '1', nos: [] };
  for (const nos of [
    [
      { id: 'a', dominio: 'd', depende_de: [], politica: 'abortar', timeout_ms: 100 },
      { id: 'a', dominio: 'd', depende_de: [], politica: 'abortar', timeout_ms: 100 },
    ],
    [{ id: 'a', dominio: 'd', depende_de: ['fantasma'], politica: 'abortar', timeout_ms: 100 }],
    [{ id: 'a', dominio: 'd', depende_de: ['a'], politica: 'abortar', timeout_ms: 100 }],
    [
      { id: 'a', dominio: 'd', depende_de: ['b'], politica: 'abortar', timeout_ms: 100 },
      { id: 'b', dominio: 'd', depende_de: ['a'], politica: 'abortar', timeout_ms: 100 },
    ],
  ]) {
    assert.throws(() => api.validarDag({ ...base, nos }), (e) => e.motivo === 'dag_ciclico');
  }
  const linear = api.validarDag({
    versao: '1',
    nos: [
      { id: 'c', dominio: 'd', depende_de: ['b'], politica: 'abortar', timeout_ms: 100 },
      { id: 'b', dominio: 'd', depende_de: ['a'], politica: 'abortar', timeout_ms: 100 },
      { id: 'a', dominio: 'd', depende_de: [], politica: 'abortar', timeout_ms: 100 },
    ],
  });
  assert.deepEqual(linear, ['a', 'b', 'c']);
});

test('fluxo feliz: nós independentes rodam em paralelo e carimbo de versões sai no pacote (invariante #8)', async () => {
  const adapters = new Map([
    ['a', adapterOk('a', 40)],
    ['b', adapterOk('b', 40)],
  ]);
  const executor = new api.ExecutorPlano({ adapters, relogio });
  const plano = {
    versao: '1',
    nos: [
      { id: 'n1', dominio: 'a', depende_de: [], politica: 'abortar', timeout_ms: 500 },
      { id: 'n2', dominio: 'b', depende_de: [], politica: 'abortar', timeout_ms: 500 },
    ],
  };
  const t0 = Date.now();
  const pacote = await executor.executar(plano, casoBase);
  const dt = Date.now() - t0;
  assert.equal(pacote.abortado, false);
  assert.equal(pacote.pareceres.length, 2);
  assert.ok(pacote.carimbo_versoes.includes(api.VERSAO_EXECUTOR));
  assert.ok(pacote.carimbo_versoes.includes('a@test-1'));
  assert.ok(pacote.carimbo_versoes.includes('b@test-1'));
  assert.ok(dt < 150, `esperava paralelismo, levou ${dt}ms`);
});

test('timeout com política abortar interrompe lote (invariante #5)', async () => {
  const adapters = new Map([
    ['lento', adapterLento('lento', 500)],
    ['rapido', adapterOk('rapido', 10)],
  ]);
  const executor = new api.ExecutorPlano({ adapters, relogio });
  const plano = {
    versao: '1',
    nos: [
      { id: 'n1', dominio: 'lento', depende_de: [], politica: 'abortar', timeout_ms: 30 },
      { id: 'n2', dominio: 'rapido', depende_de: ['n1'], politica: 'abortar', timeout_ms: 100 },
    ],
  };
  const pacote = await executor.executar(plano, casoBase);
  assert.equal(pacote.abortado, true);
  const n1 = pacote.resultados.find((r) => r.no_id === 'n1');
  const n2 = pacote.resultados.find((r) => r.no_id === 'n2');
  assert.equal(n1.estado, 'timeout');
  assert.equal(n2.estado, 'pulado');
  assert.equal(pacote.pareceres.length, 0);
});

test('política degradar preserva nós sãos e marca apenas descendentes como pulados (invariantes #5 e #7)', async () => {
  const adapters = new Map([
    ['falha', adapterFalha('falha')],
    ['irmao', adapterOk('irmao', 10)],
    ['filho', adapterOk('filho', 10)],
  ]);
  const executor = new api.ExecutorPlano({ adapters, relogio });
  const plano = {
    versao: '1',
    nos: [
      { id: 'n1', dominio: 'falha', depende_de: [], politica: 'degradar', timeout_ms: 100 },
      { id: 'n2', dominio: 'filho', depende_de: ['n1'], politica: 'degradar', timeout_ms: 100 },
      { id: 'n3', dominio: 'irmao', depende_de: [], politica: 'degradar', timeout_ms: 100 },
    ],
  };
  const pacote = await executor.executar(plano, casoBase);
  assert.equal(pacote.abortado, false);
  const porId = Object.fromEntries(pacote.resultados.map((r) => [r.no_id, r]));
  assert.equal(porId.n1.estado, 'erro');
  assert.equal(porId.n1.erro.motivo, 'fonte_indisponivel');
  assert.equal(porId.n2.estado, 'pulado');
  assert.equal(porId.n3.estado, 'ok');
  assert.equal(pacote.pareceres.length, 1);
  assert.equal(pacote.pareceres[0].especialista, 'irmao');
});

test('especialista desconhecido vira estado nomeado sem derrubar o lote', async () => {
  const adapters = new Map();
  const executor = new api.ExecutorPlano({ adapters, relogio });
  const plano = {
    versao: '1',
    nos: [
      { id: 'n1', dominio: 'fantasma', depende_de: [], politica: 'degradar', timeout_ms: 100 },
    ],
  };
  const pacote = await executor.executar(plano, casoBase);
  const n1 = pacote.resultados[0];
  assert.equal(n1.estado, 'desconhecido');
  assert.equal(n1.erro.motivo, 'especialista_desconhecido');
  assert.equal(pacote.abortado, false);
});

test('isolamento de falha: duas falhas simultâneas não derrubam o nó são (invariante #7)', async () => {
  const adapters = new Map([
    ['f1', adapterFalha('f1', 'interno')],
    ['f2', adapterFalha('f2', 'caso_invalido')],
    ['ok', adapterOk('ok', 10)],
  ]);
  const executor = new api.ExecutorPlano({ adapters, relogio });
  const plano = {
    versao: '1',
    nos: [
      { id: 'n1', dominio: 'f1', depende_de: [], politica: 'degradar', timeout_ms: 100 },
      { id: 'n2', dominio: 'f2', depende_de: [], politica: 'degradar', timeout_ms: 100 },
      { id: 'n3', dominio: 'ok', depende_de: [], politica: 'degradar', timeout_ms: 100 },
    ],
  };
  const pacote = await executor.executar(plano, casoBase);
  const porId = Object.fromEntries(pacote.resultados.map((r) => [r.no_id, r]));
  assert.equal(porId.n1.estado, 'erro');
  assert.equal(porId.n2.estado, 'erro');
  assert.equal(porId.n3.estado, 'ok');
  assert.equal(pacote.pareceres.length, 1);
});

test('adapter chamado uma vez por nó: dois nós do mesmo domínio = duas chamadas, não dedup', async () => {
  let chamadas = 0;
  const adapter = {
    dominio: 'contador',
    versao: 'contador@1',
    async consultar() {
      chamadas += 1;
      return parecer('contador');
    },
  };
  const adapters = new Map([['contador', adapter]]);
  const executor = new api.ExecutorPlano({ adapters, relogio });
  const plano = {
    versao: '1',
    nos: [
      { id: 'a', dominio: 'contador', depende_de: [], politica: 'abortar', timeout_ms: 100 },
      { id: 'b', dominio: 'contador', depende_de: ['a'], politica: 'abortar', timeout_ms: 100 },
    ],
  };
  await executor.executar(plano, casoBase);
  assert.equal(chamadas, 2);
});
