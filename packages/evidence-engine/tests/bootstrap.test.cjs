const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('evidências validam fontes e mantêm correlações separadas', () => {
  const engine = new api.EvidenceEngine();
  const ev = engine.addEvidence('c1', { type: 'metric', key: 'total', value: 2, tags: [], metadata: {}, source: { type: 'script', scriptName: 'tasks', timestamp: new Date(), confidence: 0.8 } });
  assert.ok(ev.id);
  assert.equal(engine.getConfidence('c1'), 0.8);
  assert.deepEqual(engine.getSummary('c1'), { total: 2 });
  assert.deepEqual(engine.getEvidence('c2'), []);
  engine.clear('c1');
  assert.equal(engine.getConfidence('c1'), 0);
});
