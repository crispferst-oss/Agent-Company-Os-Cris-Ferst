const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('roteamento determinístico mantém palavras e contrato', () => {
  const router = new api.IntentRouter();
  router.addRule({ id: 'tasks', keywords: ['tarefas'], scripts: ['tasks.get_overdue'], requiresAI: false, priority: 1 });
  const result = router.route('Quais tarefas vencem hoje?');
  const parsed = require('@jev/shared-types').JevIntentSchema.parse(result);
  assert.equal(parsed.aiGatewayNeeded, false);
  assert.deepEqual(parsed.matchedKeywords, ['tarefas']);
  assert.deepEqual(parsed.scripts, ['tasks.get_overdue']);
  assert.equal(router.route('consulta desconhecida').type, 'ambiguous');
});
