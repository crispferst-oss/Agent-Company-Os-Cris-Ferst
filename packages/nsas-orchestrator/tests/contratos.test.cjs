const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');

test('serialização preserva primitivos, ordem lexicográfica numérica e referências compartilhadas', () => {
  const comum = { x: null };
  assert.equal(api.canonicalJson({ b: comum, a: comum }), '{"a":{"x":null},"b":{"x":null}}');
  assert.equal(api.canonicalJson({ 2: false, 10: -0 }), '{"10":0,"2":false}');
  assert.equal(api.canonicalJson(Object.assign(Object.create(null), { b: 2, a: 1 })), '{"a":1,"b":2}');
  assert.equal(api.canonicalJson(JSON.parse('{"__proto__":1}')), '{"__proto__":1}');
});

test('serialização rejeita perdas silenciosas, ciclos, acessores e objetos não JSON', () => {
  const ciclo = {}; ciclo.self = ciclo;
  const getter = Object.defineProperty({}, 'x', { enumerable: true, get() { throw new Error('não executar'); } });
  const simbolo = { [Symbol('x')]: 1 };
  for (const valor of [undefined, NaN, Infinity, 1n, () => 1, Symbol('x'), new Date(), new Map(), ciclo,
    { x: undefined }, [undefined], new Array(1), getter, simbolo, Object.assign([], { extra: 1 })]) {
    assert.throws(() => api.canonicalJson(valor), TypeError);
  }
  assert.throws(() => api.canonicalJson({ x: { y: undefined } }), TypeError);
});

test('JSON canônico ordena objetos recursivamente e preserva arrays', () => {
  assert.equal(api.canonicalJson({ z: [{ b: 2, a: 'ação' }, 1], a: true }), '{"a":true,"z":[{"a":"ação","b":2},1]}');
  assert.equal(api.sha256Base64url('abc'), 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
});

const aprovacao = {
  caso_id: '00000000-0000-4000-8000-000000000001',
  rascunho_hash: 'A'.repeat(43), decisao: 'aprovado', justificativa: 'Revisão concluída.',
  horario: '2026-10-12T12:00:00.000Z', oab_kid: 'titular-01', assinatura_ed25519: 'A'.repeat(86),
};

test('aprovação rejeita decisão inválida e manifesto válido preserva contrato', () => {
  assert.equal(api.AprovacaoAssinadaSchema.safeParse({ ...aprovacao, decisao: 'pendente' }).success, false);
  const manifesto = { caso_id: aprovacao.caso_id, artefato_path: 'nota.md', artefato_hash: 'A'.repeat(43), aprovacao,
    carimbo_versoes: ['redator@1'], manifesto_hash: 'A'.repeat(43), assinatura_ed25519: 'A'.repeat(86) };
  assert.deepEqual(api.ManifestoEmissaoSchema.parse(manifesto), manifesto);
});

test('aprovação valida campos externos sem aceitar campos extras ou base64url não canônico', () => {
  assert.deepEqual(api.AprovacaoAssinadaSchema.parse({ ...aprovacao, decisao: 'rejeitado' }), { ...aprovacao, decisao: 'rejeitado' });
  for (const alteracao of [{ caso_id: 'inválido' }, { horario: 'ontem' }, { justificativa: '' },
    { assinatura_ed25519: 'A'.repeat(85) + 'B' }, { rascunho_hash: 'A'.repeat(42) + 'B' }, { segredo: 'extra' }]) {
    assert.equal(api.AprovacaoAssinadaSchema.safeParse({ ...aprovacao, ...alteracao }).success, false);
  }
});

test('plano exige política explícita e timeout inteiro positivo', () => {
  const no = { id: 'n1', dominio: 'pesquisa-normativa', depende_de: [], politica: 'abortar', timeout_ms: 1000 };
  assert.deepEqual(api.PlanoConsultaSchema.parse({ versao: '1', nos: [no] }), { versao: '1', nos: [no] });
  assert.equal(api.PlanoConsultaSchema.safeParse({ versao: '1', nos: [{ ...no, politica: 'degradar' }] }).success, true);
  for (const alteracao of [{ politica: undefined }, { politica: 'ignorar' }, { timeout_ms: 0 }, { timeout_ms: 0.5 }, { timeout_ms: Infinity }]) {
    assert.equal(api.PlanoConsultaSchema.safeParse({ versao: '1', nos: [{ ...no, ...alteracao }] }).success, false);
  }
});

test('auditoria aceita JSON e rejeita payload não serializável', () => {
  const evento = { tipo: 'iniciado', horario: aprovacao.horario, payload: { estado: 'iniciado', detalhes: [null, true, 3] } };
  assert.deepEqual(api.EventoAuditoriaSchema.parse(evento), evento);
  assert.equal(api.EventoAuditoriaSchema.safeParse({ ...evento, payload: { valor: undefined } }).success, false);
  assert.equal(api.EventoAuditoriaSchema.safeParse({ ...evento, payload: { valor: NaN } }).success, false);
});

test('erro nomeado preserva motivo e mensagem', () => {
  const erro = new api.ErroOrquestrador('dag_ciclico', 'Plano contém ciclo.');
  assert.ok(erro instanceof Error);
  assert.equal(erro.name, 'ErroOrquestrador');
  assert.equal(erro.motivo, 'dag_ciclico');
  assert.equal(erro.message, 'Plano contém ciclo.');
});
