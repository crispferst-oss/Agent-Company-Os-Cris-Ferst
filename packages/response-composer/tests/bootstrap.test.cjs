const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('composer produz resposta validável sem perder metadados', () => {
  const result = new api.ResponseComposer().compose({ correlationId: 'test', status: 'partial', answer: 'Dados parciais', evidence: [], sources: ['script', 'script'], durationMs: 0 });
  const parsed = require('@jev/shared-types').JevResponseSchema.parse(result);
  assert.equal(parsed.confidenceLevel, 'low');
  assert.deepEqual(parsed.sources, ['script']);
  assert.deepEqual(parsed.warnings, result.warnings);
  assert.ok(parsed.warnings.length > 0);
  assert.ok(parsed.executedAt instanceof Date);
  assert.deepEqual(parsed.nextActions, result.nextActions);
});
