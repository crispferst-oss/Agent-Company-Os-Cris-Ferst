import { JevScriptContext, JevScriptResult, JevSource } from '@jev/shared-types';

// Mock data generators
const mockSource = (name: string): JevSource => ({
  type: 'script',
  scriptName: name,
  scriptVersion: '1.0.0',
  timestamp: new Date(),
  confidence: 0.95,
});

// ====== Read-only Scripts ======

export async function tasks_get_overdue(ctx: JevScriptContext): Promise<JevScriptResult> {
  // Simula query de tarefas vencidas
  const tasks = [
    { id: '1', title: 'Revisar protocolo', dueAt: new Date(Date.now() - 1000 * 60 * 60 * 2), owner: 'Camila' },
    { id: '2', title: 'Confirmar integração', dueAt: new Date(Date.now() - 1000 * 60 * 30), owner: 'Lucas' },
  ];
  return { success: true, data: tasks, evidence: [], executionTimeMs: 50, cacheHit: false };
}

export async function tasks_get_by_owner(ctx: JevScriptContext): Promise<JevScriptResult> {
  const owner = ctx.input.owner || 'unknown';
  const tasks = [{ id: '1', title: 'Task 1', owner }];
  return { success: true, data: tasks, evidence: [], executionTimeMs: 45, cacheHit: false };
}

export async function alerts_get_active(ctx: JevScriptContext): Promise<JevScriptResult> {
  const alerts = [
    { id: '1', severity: 'critical', title: 'WhatsApp integration failed', source: 'WhatsApp' },
    { id: '2', severity: 'warning', title: 'Low SLA on confirmations', source: 'System' },
  ];
  return { success: true, data: alerts, evidence: [], executionTimeMs: 40, cacheHit: false };
}

export async function alerts_get_by_severity(ctx: JevScriptContext): Promise<JevScriptResult> {
  const severity = ctx.input.severity || 'critical';
  const alerts = [{ id: '1', severity, title: 'Alert', source: 'System' }];
  return { success: true, data: alerts, evidence: [], executionTimeMs: 35, cacheHit: false };
}

export async function integrations_get_health(ctx: JevScriptContext): Promise<JevScriptResult> {
  const integrations = [
    { name: 'WhatsApp', status: 'warning', lastSync: new Date(Date.now() - 1000 * 60 * 12) },
    { name: 'Google Drive', status: 'healthy', lastSync: new Date() },
    { name: 'Agenda Externa', status: 'healthy', lastSync: new Date() },
  ];
  return { success: true, data: integrations, evidence: [], executionTimeMs: 60, cacheHit: false };
}

export async function integrations_get_failed_deliveries(ctx: JevScriptContext): Promise<JevScriptResult> {
  const failed = [
    { integrationId: 'whatsapp', failureCount: 3, lastFailure: new Date(Date.now() - 1000 * 60 * 2) },
  ];
  return { success: true, data: failed, evidence: [], executionTimeMs: 80, cacheHit: false };
}

export async function flows_get_health(ctx: JevScriptContext): Promise<JevScriptResult> {
  const flows = [
    { name: 'Primeiro Contato', status: 'healthy', slaPercent: 94 },
    { name: 'Confirmação', status: 'warning', slaPercent: 72 },
    { name: 'Onboarding', status: 'critical', slaPercent: 54 },
  ];
  return { success: true, data: flows, evidence: [], executionTimeMs: 55, cacheHit: false };
}

export async function flows_get_failed_runs(ctx: JevScriptContext): Promise<JevScriptResult> {
  const failed = [
    { flowId: 'onboarding', failureCount: 9, errorRate: 0.46 },
  ];
  return { success: true, data: failed, evidence: [], executionTimeMs: 70, cacheHit: false };
}

export async function graph_get_entity_neighbors(ctx: JevScriptContext): Promise<JevScriptResult> {
  const entity = ctx.input.entity || 'unknown';
  const neighbors = [{ id: 'related_1' }, { id: 'related_2' }];
  return { success: true, data: neighbors, evidence: [], executionTimeMs: 100, cacheHit: false };
}

export async function graph_get_dependencies(ctx: JevScriptContext): Promise<JevScriptResult> {
  const deps = [{ from: 'task_1', to: 'alert_1' }, { from: 'task_1', to: 'integration_1' }];
  return { success: true, data: deps, evidence: [], executionTimeMs: 90, cacheHit: false };
}

export async function graph_find_bottlenecks(ctx: JevScriptContext): Promise<JevScriptResult> {
  const bottlenecks = [{ entity: 'onboarding_flow', impactScore: 0.85 }];
  return { success: true, data: bottlenecks, evidence: [], executionTimeMs: 150, cacheHit: false };
}

export async function analytics_get_sla_summary(ctx: JevScriptContext): Promise<JevScriptResult> {
  const summary = {
    overall: 0.87,
    byProcess: { firstContact: 0.94, confirmation: 0.72, onboarding: 0.54 },
  };
  return { success: true, data: summary, evidence: [], executionTimeMs: 120, cacheHit: false };
}

export async function analytics_get_kpis(ctx: JevScriptContext): Promise<JevScriptResult> {
  const kpis = {
    taskCompletionRate: 0.91,
    alertResolutionTime: '45 mins avg',
    integrationUptime: 0.9995,
  };
  return { success: true, data: kpis, evidence: [], executionTimeMs: 100, cacheHit: false };
}

export async function knowledge_search_approved(ctx: JevScriptContext): Promise<JevScriptResult> {
  const query = ctx.input.query || '';
  const docs = [{ id: '1', title: 'Protocol Document', status: 'approved', version: '2.1' }];
  return { success: true, data: docs, evidence: [], executionTimeMs: 110, cacheHit: false };
}

export async function events_get_recent(ctx: JevScriptContext): Promise<JevScriptResult> {
  const events = [
    { timestamp: new Date(), action: 'script_executed', resource: 'tasks.create' },
    { timestamp: new Date(Date.now() - 1000 * 60 * 4), action: 'integration_failed', resource: 'whatsapp' },
  ];
  return { success: true, data: events, evidence: [], executionTimeMs: 95, cacheHit: false };
}
