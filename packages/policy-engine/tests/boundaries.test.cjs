const test = require('node:test');
const assert = require('node:assert/strict');
const { PolicyEngine } = require('..');
const t = { tenantId: 'tenant-a', userId: 'user-a', roles: ['viewer'], permissions: [] };
test('wildcard respeita tenant, recurso, ação e papel', () => {
  const policy = new PolicyEngine();
  policy.addPolicy({ id: 'p', tenantId: t.tenantId, resource: 'tasks/*', action: 'read', allowedRoles: ['viewer'] });
  assert.equal(policy.canAccess(t, 'tasks/123', 'read'), true);
  for (const resource of ['tasksOther/123', 'alerts/123', 'tasks/../policies/123', 'tasks/']) assert.equal(policy.canAccess(t, resource, 'read'), false);
  assert.equal(policy.canAccess({ ...t, tenantId: 'tenant-b' }, 'tasks/123', 'read'), false);
  assert.equal(policy.canAccess({ ...t, roles: [] }, 'tasks/123', 'read'), false);
  assert.equal(policy.canAccess(t, 'tasks/123', 'write'), false);
});
test('condições ainda não suportadas negam acesso em vez de serem ignoradas', () => {
  const policy = new PolicyEngine();
  policy.addPolicy({ id: 'p', tenantId: t.tenantId, resource: 'tasks/*', action: 'read', allowedRoles: ['viewer'], conditions: { owner: 'other' } });
  assert.equal(policy.canAccess(t, 'tasks/123', 'read'), false);
});
