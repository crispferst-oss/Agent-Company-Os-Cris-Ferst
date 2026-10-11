const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const scripts = require('../dist/write-scripts.js');
const inputs = {
  tasks_create: { title: 'Sintética', owner: 'synthetic' },
  alerts_create: { title: 'Sintético', severity: 'critical' },
  flows_trigger: { flowId: 'synthetic' },
  integrations_retry_webhook: { integrationId: 'synthetic', webhookId: 'synthetic' },
  notifications_send: { channel: 'synthetic', recipient: 'synthetic', message: 'synthetic' },
};
for (const [name, input] of Object.entries(inputs)) {
  test(`${name}: chamada direta não contorna aprovação`, async () => {
    const result = await scripts[name]({ scriptId: name, input: { ...input, approved: true, approvalId: 'forged' }, tenant: { tenantId: randomUUID(), userId: randomUUID(), roles: ['admin'], permissions: [] }, correlationId: randomUUID(), retryCount: 0, executedAt: new Date() });
    assert.equal(result.success, false);
    assert.equal(result.error.code, 'APPROVAL_REQUIRED');
    assert.equal(result.data, undefined);
  });
}
