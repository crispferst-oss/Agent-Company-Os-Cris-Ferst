const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { SeloCcsVerifier, criarPayloadSelo } = require('../dist/selo/index.js');
// TEST ONLY: ephemeral keys never leave this test process.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const now = '2026-10-12T12:00:00.000Z';
function casoFixture() {
  const caso_id = '6c2c004c-41bd-4d90-a380-0e1ac2bb3ba8';
  return { caso_id, titular_ref: 'hmac', fato_juridico: 'Fato pseudonimizado', refs_clinicas: [], documentos_opaco: [], predicados: [], tradutor_v: '1.0', selo: {
    v: '1.0', policy_v: '1', caso_id, issued_at: new Date('2026-10-12T11:00:00Z'), expires_at: new Date('2026-10-12T13:00:00Z'), canal_origem: 'profissional_autenticado', detectores: [], predicados_verificados: [], custodia_chave: [], sig: '',
  } };
}
function token(payload, header = { alg: 'EdDSA', typ: 'JWT', kid: 'ccs-test' }, key = privateKey) {
  const body = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return body + '.' + sign(null, Buffer.from(body), key).toString('base64url');
}
function selar(caso = casoFixture()) { caso.selo.sig = token(criarPayloadSelo(caso)); return caso; }
function verifier(alertas = [], relogio = { agora: () => now }) {
  return new SeloCcsVerifier({ chavePublica: publicKey, kid: 'ccs-test', relogio, alerta: { disparar: async evento => { alertas.push(evento); } } });
}
test('selo CCS valido autoriza o caso vinculado sem alertar', async () => {
  const caso = selar(); const alertas = [];
  assert.deepEqual(await verifier(alertas).verificar(caso.selo, caso), { ok: true });
  assert.deepEqual(alertas, []);
});

test('falhas de selo retornam motivo especifico e alerta sem conteudo juridico', async t => {
  const scenarios = [
    ['ausente', c => null, 'ausente'],
    ['malformado', c => ({ ...c.selo, sig: 'invalid' }), 'assinatura'],
    ['algoritmo trocado', c => ({ ...c.selo, sig: token(criarPayloadSelo(c), { alg: 'none', typ: 'JWT', kid: 'ccs-test' }) }), 'assinatura'],
    ['kid desconhecido', c => ({ ...c.selo, sig: token(criarPayloadSelo(c), { alg: 'EdDSA', typ: 'JWT', kid: 'outro' }) }), 'assinatura'],
    ['chave nao confiavel', c => ({ ...c.selo, sig: token(criarPayloadSelo(c), undefined, generateKeyPairSync('ed25519').privateKey) }), 'assinatura'],
    ['caso divergente', c => ({ ...c.selo, sig: token({ ...criarPayloadSelo(c), caso_id: 'outro' }) }), 'caso_divergente'],
    ['expirado', c => { c.selo.expires_at = new Date(now); selar(c); return c.selo; }, 'expirado'],
    ['conteudo alterado', c => { c.fato_juridico += ' alterado'; return c.selo; }, 'assinatura'],
    ['metadata alterada', c => { c.selo.policy_v = 'alterado'; return c.selo; }, 'assinatura'],
    ['selo distinto', c => ({ ...c.selo, policy_v: 'alterado' }), 'assinatura'],
    ['exp alterado', c => ({ ...c.selo, sig: token({ ...criarPayloadSelo(c), exp: 9999999999 }) }), 'assinatura'],
    ['header com chave', c => ({ ...c.selo, sig: token(criarPayloadSelo(c), { alg: 'EdDSA', typ: 'JWT', kid: 'ccs-test', jwk: {} }) }), 'assinatura'],
    ['base64 nao canonico', c => ({ ...c.selo, sig: c.selo.sig + '=' }), 'assinatura'],
    ['data futura', c => { c.selo.issued_at = new Date('2026-10-12T12:30:00Z'); selar(c); return c.selo; }, 'assinatura'],
  ];
  for (const [name, change, motivo] of scenarios) await t.test(name, async () => {
    const caso = selar(); const alertas = [];
    assert.deepEqual(await verifier(alertas).verificar(change(caso), caso), { ok: false, motivo });
    assert.deepEqual(alertas, [{ tipo: 'selo_invalido', caso_id: caso.caso_id, detalhe: motivo }]);
  });
});

test('aguarda alerta sincrono e propaga indisponibilidade do canal sem autorizar', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const v = new SeloCcsVerifier({ chavePublica: publicKey, kid: 'ccs-test', relogio: { agora: () => now }, alerta: { disparar: () => pending } });
  let terminou = false;
  const verificacao = v.verificar(null, casoFixture()).then(value => { terminou = true; return value; });
  await Promise.resolve(); assert.equal(terminou, false);
  release(); assert.deepEqual(await verificacao, { ok: false, motivo: 'ausente' });
  const indisponivel = new SeloCcsVerifier({ chavePublica: publicKey, kid: 'ccs-test', relogio: { agora: () => now }, alerta: { disparar: async () => { throw new Error('indisponivel'); } } });
  await assert.rejects(indisponivel.verificar(null, casoFixture()), /indisponivel/);
});

test('relogio invalido e configuracao sem chave publica Ed25519 falham fechados', async () => {
  const caso = selar();
  assert.deepEqual(await verifier([], { agora: () => 'invalido' }).verificar(caso.selo, caso), { ok: false, motivo: 'assinatura' });
  assert.throws(() => new SeloCcsVerifier({ chavePublica: privateKey, kid: 'ccs-test' }), /chave publica/);
});

test('alerta omite identificador malformado que pode conter dados pessoais', async () => {
  const alertas = [];
  assert.deepEqual(await verifier(alertas).verificar(null, { caso_id: 'clinical/name text' }), { ok: false, motivo: 'ausente' });
  assert.deepEqual(alertas, [{ tipo: 'selo_invalido', detalhe: 'ausente' }]);
});
