const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { JevOrchestrator } = require('..');
const { PolicyEngine } = require('@jev/policy-engine');
const tenant = () => ({ tenantId: randomUUID(), userId: randomUUID(), roles: ['viewer'], permissions: [] });
test('permissão negada impede a execução do handler', async () => {
  let calls = 0;
  const app = new JevOrchestrator({ policy: new PolicyEngine(), readHandlers: { 'tasks.get_overdue': async () => { calls++; throw new Error('não deve executar'); } } });
  const response = await app.answer('Quais tarefas vencem hoje?', tenant());
  assert.equal(response.status, 'error'); assert.equal(calls, 0); assert.match(response.answer, /Permissão negada/);
});
test('falha de consulta não produz resposta de sucesso', async () => {
  const app = new JevOrchestrator({ readHandlers: { 'tasks.get_overdue': async () => ({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'indisponível' }, evidence: [], executionTimeMs: 0, cacheHit: false }) } });
  const response = await app.answer('Quais tarefas vencem hoje?', tenant());
  assert.equal(response.status, 'error'); assert.equal(response.summary.results[0].error.code, 'DB_UNAVAILABLE'); assert.deepEqual(response.evidence, []);
});
test('pergunta não suportada e tenant inválido não geram sucesso', async () => {
  const app = new JevOrchestrator();
  assert.equal((await app.answer('Pedido desconhecido', tenant())).status, 'error');
  assert.equal((await app.answer('Quais tarefas vencem hoje?', { ...tenant(), tenantId: '' })).status, 'error');
});
test('não permite registrar escrita como fonte de consulta', () => {
  assert.throws(() => new JevOrchestrator({ readHandlers: { 'tasks.create': async () => ({}) } }), /não permitido/);
});
