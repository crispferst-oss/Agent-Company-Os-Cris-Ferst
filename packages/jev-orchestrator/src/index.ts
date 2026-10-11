import { randomUUID } from 'node:crypto';
import { JevTenantContext, JevResponse, JevScriptContext, JevScriptResult, JevTenantContextSchema } from '@jev/shared-types';
import { ScriptRuntime } from '@jev/script-runtime';
import { IntentRouter } from '@jev/intent-router';
import { ResponseComposer } from '@jev/response-composer';
import { PolicyEngine } from '@jev/policy-engine';
import { SCRIPT_REGISTRY } from '@jev/scripts';

export interface OrchestratorOptions {
  // Fontes configuradas pelo servidor. Nenhum mock é habilitado implicitamente.
  readHandlers?: Record<string, (ctx: JevScriptContext) => Promise<JevScriptResult>>;
  policy?: PolicyEngine;
}

export class JevOrchestrator {
  private runtime = new ScriptRuntime();
  private router = new IntentRouter();
  private composer = new ResponseComposer();

  constructor(private options: OrchestratorOptions = {}) {
    const rules: [string, RegExp, string[]][] = [
      ['retry', /(?:reprocesse|reprocessar|reenvie|reenviar).*webhooks?/i, ['integrations.retry_webhook']],
      ['tasks', /tarefas?.*(?:venc|atrasad)/i, ['tasks.get_overdue']],
      ['alerts', /alertas?/i, ['alerts.get_active']],
      ['integrations', /integra[çc]/i, ['integrations.get_health']],
      ['flows', /fluxo|processo/i, ['flows.get_health']],
      ['sla', /sla|performance/i, ['analytics.get_sla_summary']],
    ];
    rules.forEach(([id, regex, scripts], priority) => this.router.addRule({ id, regex, scripts, priority, keywords: [], requiresAI: false }));
    for (const [id, handler] of Object.entries(options.readHandlers || {})) {
      const definition = SCRIPT_REGISTRY[id as keyof typeof SCRIPT_REGISTRY];
      if (!definition || definition.category !== 'read') throw new Error(`Script de leitura não permitido: ${id}`);
      this.runtime.registerHandler(id, handler, { category: 'read' });
    }
  }

  async answer(question: string, tenant: JevTenantContext): Promise<JevResponse> {
    const startTime = Date.now();
    const correlationId = randomUUID();
    const failure = (answer: string) => this.composer.compose({ correlationId, status: 'error', answer, evidence: [], sources: [], durationMs: Date.now() - startTime });
    if (!JevTenantContextSchema.safeParse(tenant).success) return failure('Contexto de tenant inválido.');
    const route = this.router.route(question);
    if (!route.scripts.length) return failure('Não foi identificada uma consulta suportada. Reformule o pedido.');
    const writeId = route.scripts.find(id => SCRIPT_REGISTRY[id as keyof typeof SCRIPT_REGISTRY]?.category !== 'read');
    if (writeId) {
      const response = failure('Reprocessamento não executado. É necessária aprovação antes de enfileirar qualquer job.');
      response.status = 'partial';
      response.summary = { approvalRequest: {
        id: randomUUID(), status: 'pending', scriptId: writeId,
        tenantId: tenant.tenantId, requestedBy: tenant.userId,
        impact: 'Pode reenviar notificações e repetir efeitos nos sistemas de destino.',
        persisted: false, executable: false,
      } };
      response.warnings = ['Solicitação não persistida; serviço de aprovação ainda indisponível. Nenhum job foi criado.'];
      response.nextActions = ['Definir integração e webhooks alvo; implementar aprovação persistida e autorização antes de executar.'];
      return response;
    }
    const policy = this.options.policy || new PolicyEngine();
    if (!this.options.policy) {
      for (const id of route.scripts) policy.addPolicy({ id, tenantId: tenant.tenantId,
        resource: `${id.split('.')[0]}/*`, action: 'read', allowedRoles: ['viewer', 'operator', 'admin'] });
    }
    if (route.scripts.some(id => !policy.canAccess(tenant, id.replace('.', '/'), 'read'))) return failure('Permissão negada para esta consulta.');
    const results = await Promise.all(route.scripts.map(scriptId => this.runtime.execute({
      scriptId, tenant, correlationId, retryCount: 0, executedAt: new Date(),
      input: { period: /hoje/i.test(question) ? 'today' : 'overdue' },
    })));
    const succeeded = results.filter(result => result.success);
    const evidence = succeeded.flatMap(result => result.evidence);
    const status = succeeded.length === 0 ? 'error' : succeeded.length < results.length ? 'partial' : 'success';
    return this.composer.compose({ correlationId, status,
      answer: succeeded.length ? succeeded.map(result => JSON.stringify(result.data) ?? 'Consulta concluída sem dados.').join('\n') : 'Consulta indisponível: nenhuma fonte configurada respondeu com sucesso.',
      summary: { results: results.map((result, index) => ({ scriptId: route.scripts[index], ...result })) },
      evidence, sources: [...new Set(evidence.map(item => item.source.scriptName).filter((name): name is string => !!name))],
      durationMs: Date.now() - startTime, aiGenerated: false,
    });
  }
}

export const jevOrchestrator = new JevOrchestrator();
