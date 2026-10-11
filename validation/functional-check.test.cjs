// Testes de aceitação locais: apenas código compilado e dados sintéticos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { JevOrchestrator } = require('../packages/jev-orchestrator');
const { ScriptRuntime } = require('../packages/script-runtime');
const { setupDefaultPolicies, policyEngine } = require('../packages/policy-engine');
const { integrations_retry_webhook, tasks_create } = require('../packages/scripts/dist/write-scripts.js');
const tenant = () => ({ tenantId: randomUUID(), userId: randomUUID(), roles: ['viewer'], permissions: [] });
const context = (scriptId, t = tenant(), input = {}) => ({ scriptId, tenant: t, input, correlationId: randomUUID(), retryCount: 0, executedAt: new Date() });

test('consulta de tarefas retorna evidências, não apenas nomes de scripts', async () => {
  let calls = 0;
  const result = await new JevOrchestrator({ readHandlers: {
    'tasks.get_overdue': async ctx => {
      calls++;
      assert.equal(ctx.input.period, 'today');
      return { success: true, data: [{ title: 'Tarefa sintética' }], evidence: [{
        id: randomUUID(), type: 'entity', key: 'tasks', value: ['Tarefa sintética'],
        source: { type: 'script', scriptName: 'fixture.tasks', timestamp: new Date(), confidence: 1 },
        tags: ['synthetic'], metadata: { tenantId: ctx.tenant.tenantId },
      }], executionTimeMs: 0, cacheHit: false };
    },
  } }).answer('Quais tarefas vencem hoje?', tenant());
  console.log('CONSULTA', JSON.stringify(result));
  assert.ok(result.evidence.length > 0, 'Consulta retornou evidências vazias');
  assert.equal(calls, 1);
  assert.match(result.answer, /Tarefa sintética/);
  assert.equal(result.aiGenerated, false);
});

test('pedido de escrita não retorna sucesso sem solicitação de aprovação', async () => {
  const result = await new JevOrchestrator().answer('Reprocesse os webhooks com falha.', tenant());
  console.log('PEDIDO_ESCRITA', JSON.stringify(result));
  assert.notEqual(result.status, 'success', 'Retornou sucesso sem executar nem solicitar aprovação');
  assert.equal(result.summary.approvalRequest.status, 'pending');
  assert.equal(result.summary.approvalRequest.scriptId, 'integrations.retry_webhook');
});

test('cache isola dados de tenants diferentes', async () => {
  const runtime = new ScriptRuntime();
  runtime.registerHandler('probe.tenant', async ctx => ({ tenantId: ctx.tenant.tenantId }), { category: 'read' });
  const a = tenant(); const b = tenant();
  await runtime.execute(context('probe.tenant', a), 60000);
  const result = await runtime.execute(context('probe.tenant', b), 60000);
  console.log('CACHE', JSON.stringify({ esperado: b.tenantId, recebido: result.data, cacheHit: result.cacheHit }));
  assert.equal(result.data.tenantId, b.tenantId, 'Cache devolveu dados de outro tenant');
});

test('runtime não mascara falha de validação do handler como sucesso', async () => {
  const runtime = new ScriptRuntime();
  runtime.registerHandler('probe.invalid', async () => ({ success: false, error: { code: 'INVALID_INPUT', message: 'Entrada inválida' }, evidence: [], executionTimeMs: 0, cacheHit: false }), { category: 'read' });
  const result = await runtime.execute(context('probe.invalid'));
  console.log('VALIDACAO', JSON.stringify(result));
  assert.equal(result.success, false, 'Runtime encapsulou INVALID_INPUT como sucesso');
  assert.equal(result.error.code, 'INVALID_INPUT');
});

test('política padrão tasks/* permite leitura de um recurso concreto', () => {
  const t = tenant(); setupDefaultPolicies(t.tenantId);
  assert.equal(policyEngine.canAccess(t, 'tasks/123', 'read'), true, 'Wildcard padrão não resolve recurso concreto');
});

test('runtime bloqueia reprocessamento sem aprovação', async () => {
  const runtime = new ScriptRuntime();
  runtime.registerHandler('integrations.retry_webhook', integrations_retry_webhook);
  const result = await runtime.execute(context('integrations.retry_webhook', tenant(), { integrationId: 'synthetic', webhookId: 'synthetic' }));
  console.log('SEM_APROVACAO', JSON.stringify(result));
  assert.equal(result.success, false, 'Handler simulado retornou queued sem aprovação');
});
