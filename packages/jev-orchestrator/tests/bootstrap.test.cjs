const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('orquestrador sem fonte retorna indisponibilidade em vez de fatos simulados', async () => {
  const { randomUUID } = require('node:crypto');
  const result = await new api.JevOrchestrator().answer('Quais tarefas vencem hoje?', { tenantId: randomUUID(), userId: randomUUID(), roles: ['viewer'], permissions: [] });
  const parsed = require('@jev/shared-types').JevResponseSchema.parse(result);
  assert.deepEqual(parsed.sources, []);
  assert.equal(parsed.status, 'error');
  assert.ok(parsed.executedAt instanceof Date);
  assert.deepEqual(parsed.evidence, []);
});
