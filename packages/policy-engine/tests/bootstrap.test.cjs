const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('política de recurso exato nega por padrão e separa tenants', () => {
  const policy = new api.PolicyEngine();
  const tenant = { tenantId: 'tenant-a', userId: 'user', roles: ['viewer'], permissions: [] };
  assert.equal(policy.canAccess(tenant, 'tasks/*', 'read'), false);
  policy.addPolicy({ id: 'p', tenantId: 'tenant-a', resource: 'tasks/*', action: 'read', allowedRoles: ['viewer'] });
  assert.equal(policy.canAccess(tenant, 'tasks/*', 'read'), true);
  assert.equal(policy.canAccess({ ...tenant, tenantId: 'tenant-b' }, 'tasks/*', 'read'), false);
  assert.throws(() => policy.assertAccess(tenant, 'tasks/*', 'write'), /Access denied/);
});
