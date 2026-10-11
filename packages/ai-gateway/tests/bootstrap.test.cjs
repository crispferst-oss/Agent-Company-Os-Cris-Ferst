const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('gateway local simulado é importável e mantém cache local', async () => {
  const gateway = api.createAIGateway({ id: 'demo', name: 'local', model: 'demo' });
  const first = await gateway.synthesize('Teste', [], 'c1');
  assert.equal(first.provider, 'local');
  assert.equal(first.cached, false);
  assert.equal((await gateway.synthesize('Teste', [], 'c2')).cached, true);
  gateway.clearCache();
  assert.equal((await gateway.synthesize('Teste', [], 'c3')).cached, false);
});
test('gateway preserva a causa original ao encapsular uma falha', async () => {
  const cause = new Error('Provedor indisponível');
  const provider = { id: 'broken', model: 'demo', get name() { throw cause; } };
  const gateway = api.createAIGateway(provider);
  await assert.rejects(gateway.synthesize('Teste', [], 'c1'), error => {
    assert.equal(error.cause, cause);
    return true;
  });
});
