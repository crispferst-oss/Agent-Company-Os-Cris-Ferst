const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ScriptRuntime } = require('..');
const tenant = () => ({ tenantId: randomUUID(), userId: randomUUID(), roles: ['viewer'], permissions: [] });
const ctx = (t = tenant()) => ({ scriptId: 'probe', tenant: t, input: {}, retryCount: 0, correlationId: randomUUID(), executedAt: new Date() });

test('cache preserva evidência e impede mutação por quem recebe o resultado', async () => {
  const runtime = new ScriptRuntime(); let calls = 0; const c = ctx(); const timestamp = new Date();
  runtime.registerHandler('probe', async () => { calls++; return { success: true, data: { value: 1 }, evidence: [{ id: 'fixture', type: 'metric', key: 'value', value: 1, source: { type: 'script', scriptName: 'probe', timestamp, confidence: 1 }, tags: [], metadata: {} }], executionTimeMs: 900, cacheHit: false }; }, { category: 'read' });
  const first = await runtime.execute(c, 60000); first.data.value = 99;
  const second = await runtime.execute(c, 60000); second.data.value = 88;
  const third = await runtime.execute(c, 60000);
  assert.equal(calls, 1); assert.equal(third.data.value, 1); assert.equal(second.cacheHit, true);
  assert.equal(third.evidence[0].source.timestamp.getTime(), timestamp.getTime());
});
test('cache separa usuários e alterações de permissões no mesmo tenant', async () => {
  const runtime = new ScriptRuntime(); let calls = 0; const a = tenant();
  runtime.registerHandler('probe', async () => ++calls, { category: 'read' });
  for (const t of [a, { ...a, userId: randomUUID() }, { ...a, permissions: ['private'] }, { ...a, roles: ['admin'] }]) {
    assert.equal((await runtime.execute(ctx(t), 60000)).cacheHit, false);
  }
  assert.equal(calls, 4);
});
test('falhas estruturadas não entram no cache e mantêm o código original', async () => {
  const runtime = new ScriptRuntime(); let calls = 0; const c = ctx();
  runtime.registerHandler('probe', async () => { calls++; return { success: false, error: { code: 'INVALID_INPUT', message: 'inválido' }, evidence: [], executionTimeMs: 0, cacheHit: false }; }, { category: 'read' });
  for (let i = 0; i < 2; i++) assert.equal((await runtime.execute(c, 60000)).error.code, 'INVALID_INPUT');
  assert.equal(calls, 2); assert.equal(runtime.getMetrics('probe').errorRate, 1);
});
test('circuit breaker de um tenant não bloqueia outro', async () => {
  const runtime = new ScriptRuntime(); const a = tenant(); const b = tenant();
  runtime.registerHandler('probe', async c => { if (c.tenant.tenantId === a.tenantId) throw new Error('synthetic'); return 'ok'; }, { category: 'read' });
  for (let i = 0; i < 5; i++) await runtime.execute(ctx(a));
  assert.equal((await runtime.execute(ctx(a))).error.code, 'CIRCUIT_OPEN');
  assert.equal((await runtime.execute(ctx(b))).data, 'ok');
});
test('handler sem classificação é bloqueado antes de ser chamado, mesmo com aprovação forjada', async () => {
  const runtime = new ScriptRuntime(); let calls = 0; const c = ctx();
  c.input = { approved: true, approvalId: 'forged' };
  runtime.registerHandler('probe', async () => { calls++; return 'queued'; });
  assert.equal((await runtime.execute(c, 60000)).error.code, 'APPROVAL_REQUIRED');
  assert.equal(calls, 0);
});
test('reclassificação como escrita invalida cache de leitura', async () => {
  const runtime = new ScriptRuntime(); const c = ctx();
  runtime.registerHandler('probe', async () => 'old', { category: 'read' });
  await runtime.execute(c, 60000);
  runtime.registerHandler('probe', async () => 'queued', { category: 'write' });
  assert.equal((await runtime.execute(c, 60000)).error.code, 'APPROVAL_REQUIRED');
});
test('resultado estruturado malformado não vira sucesso', async () => {
  const runtime = new ScriptRuntime();
  runtime.registerHandler('probe', async () => ({ success: 'yes' }), { category: 'read' });
  assert.equal((await runtime.execute(ctx())).error.code, 'INVALID_RESULT');
});

test('contexto malformado retorna erro estruturado sem executar handler', async () => {
  const runtime = new ScriptRuntime(); let calls = 0;
  runtime.registerHandler('probe', async () => { calls++; return 'não deve executar'; }, { category: 'read' });
  for (const invalid of [{ ...ctx(), tenant: { tenantId: 'invalid', userId: 'invalid' } }, { ...ctx(), tenant: { ...tenant(), roles: ['superuser'] } }]) {
    const result = await runtime.execute(invalid);
    assert.equal(result.error.code, 'INVALID_CONTEXT');
  }
  assert.equal(calls, 0);
});
