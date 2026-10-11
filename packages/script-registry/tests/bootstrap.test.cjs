const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('registro preserva permissões durante validação', () => {
  const registry = new api.ScriptRegistry();
  const def = require('@jev/shared-types').JevScriptDefinitionSchema.parse({ id: 'x', name: 'x', description: 'Teste', category: 'read', permissions: [{ minRole: 'admin' }] });
  registry.register(def);
  assert.equal(registry.canExecute('x', { tenantId: 't', userId: 'u', roles: ['viewer'], permissions: [] }), false);
  assert.equal(registry.canExecute('x', { tenantId: 't', userId: 'u', roles: ['admin'], permissions: [] }), true);
  assert.equal(registry.canExecute('missing', { roles: ['admin'] }), false);
});
