const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');
test('runtime importável retorna erro estruturado para handler ausente', async () => {
  const runtime = new api.ScriptRuntime();
  const result = await runtime.execute({ scriptId: 'missing', input: {}, retryCount: 0 });
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
  assert.equal(require('@jev/shared-types').JevScriptResultSchema.safeParse(result).success, true);
});
