import { JevScriptContext, JevScriptResult } from '@jev/shared-types';

// ====== Write Scripts (require approval) ======
// Nenhuma flag no input equivale a aprovação verificada. Até o serviço
// persistido existir, os handlers não simulam sucesso nem efeitos externos.
function approvalRequired(): JevScriptResult {
  return { success: false, error: { code: 'APPROVAL_REQUIRED',
    message: 'Escrita bloqueada: aprovação persistida ainda não disponível' },
    evidence: [], executionTimeMs: 0, cacheHit: false };
}

export async function tasks_create(ctx: JevScriptContext): Promise<JevScriptResult> {
  const { title, owner, dueDate } = ctx.input;
  if (!title || !owner) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'title and owner required' },
      evidence: [],
      executionTimeMs: 10,
      cacheHit: false,
    };
  }

  return approvalRequired();
}

export async function alerts_create(ctx: JevScriptContext): Promise<JevScriptResult> {
  const { title, severity, source } = ctx.input;
  if (!title || !severity) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'title and severity required' },
      evidence: [],
      executionTimeMs: 10,
      cacheHit: false,
    };
  }

  return approvalRequired();
}

export async function flows_trigger(ctx: JevScriptContext): Promise<JevScriptResult> {
  const { flowId, params } = ctx.input;
  if (!flowId) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'flowId required' },
      evidence: [],
      executionTimeMs: 10,
      cacheHit: false,
    };
  }

  return approvalRequired();
}

export async function integrations_retry_webhook(ctx: JevScriptContext): Promise<JevScriptResult> {
  const { integrationId, webhookId } = ctx.input;
  if (!integrationId || !webhookId) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'integrationId and webhookId required' },
      evidence: [],
      executionTimeMs: 10,
      cacheHit: false,
    };
  }

  return approvalRequired();
}

export async function notifications_send(ctx: JevScriptContext): Promise<JevScriptResult> {
  const { channel, recipient, message } = ctx.input;
  if (!channel || !recipient || !message) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'channel, recipient, message required' },
      evidence: [],
      executionTimeMs: 10,
      cacheHit: false,
    };
  }

  return approvalRequired();
}
