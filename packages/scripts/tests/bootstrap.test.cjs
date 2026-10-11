const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('catálogo expõe handlers e exige aprovação declarada nas escritas', () => {
  assert.equal(Object.keys(api.SCRIPT_REGISTRY).length, 20);
  for (const [id, definition] of Object.entries(api.SCRIPT_REGISTRY)) {
    assert.equal(typeof api[id.replaceAll('.', '_')], 'function', id);
    if (definition.category === 'write') assert.equal(definition.requiresApproval, true);
  }
});
test('handler simulado de escrita rejeita entrada incompleta', async () => {
  const result = await api.tasks_create({ input: {} });
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_INPUT');
});
