const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('schemas preservam metadados usados pelos consumidores', () => {
  const intent = api.JevIntentSchema.parse({ type: 'deterministic', confidence: 1, matchedKeywords: ['tarefas'] });
  assert.deepEqual(intent.matchedKeywords, ['tarefas']);
  const def = api.JevScriptDefinitionSchema.parse({ id: 'read', name: 'Leitura', description: 'Teste', category: 'read', permissions: [{ minRole: 'admin' }] });
  assert.deepEqual(def.permissions, [{ minRole: 'admin' }]);
  const response = api.JevResponseSchema.parse({ correlationId: 'test', status: 'success', answer: 'Ok', durationMs: 1, executedAt: new Date(0), warnings: ['Aviso'], nextActions: ['Revisar'] });
  assert.equal(response.executedAt.getTime(), 0);
  assert.deepEqual(response.warnings, ['Aviso']);
  assert.deepEqual(response.nextActions, ['Revisar']);
});
test('schemas rejeitam papéis inválidos e aceitam duração zero', () => {
  assert.equal(api.JevScriptDefinitionSchema.safeParse({ id: 'x', name: 'x', description: 'x', category: 'read', permissions: [{ minRole: 'root' }] }).success, false);
  assert.equal(api.JevScriptResultSchema.safeParse({ success: true, executionTimeMs: 0 }).success, true);
  assert.equal(api.JevResponseSchema.safeParse({ correlationId: 'x', status: 'success', answer: 'x', durationMs: 0 }).success, true);
});
