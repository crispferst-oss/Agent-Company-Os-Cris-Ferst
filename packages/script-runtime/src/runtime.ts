import { JevScriptContext, JevScriptResult, JevScriptResultSchema, JevScriptContextSchema } from '@jev/shared-types';

interface CacheEntry {
  data: any;
  expiresAt: number;
}

interface ScriptHandler {
  (ctx: JevScriptContext): Promise<any>;
}

export class ScriptRuntime {
  private handlers = new Map<string, ScriptHandler>();
  private readOnly = new Set<string>();
  private cache = new Map<string, CacheEntry>();
  private circuitBreakers = new Map<string, { failures: number; lastFailure: number; isOpen: boolean }>();
  private metrics = new Map<string, { durations: number[]; errors: number; cacheHits: number }>();

  registerHandler(scriptId: string, handler: ScriptHandler, options?: { category: 'read' | 'write' | 'control' }): void {
    this.handlers.set(scriptId, handler);
    this.readOnly.delete(scriptId);
    if (options?.category === 'read') this.readOnly.add(scriptId);
    this.cache.clear();
  }

  async execute(ctx: JevScriptContext, cacheTTL?: number): Promise<JevScriptResult> {
    const startTime = Date.now();
    const handler = this.handlers.get(ctx.scriptId);
    const fail = (code: string, message: string): JevScriptResult => ({
      success: false, error: { code, message }, evidence: [],
      executionTimeMs: Date.now() - startTime, cacheHit: false,
    });
    if (!handler) return fail('NOT_FOUND', `Script handler ${ctx.scriptId} not found`);
    const validatedContext = JevScriptContextSchema.safeParse(ctx);
    if (!validatedContext.success) return fail('INVALID_CONTEXT', 'Contexto de execução inválido');
    ctx = validatedContext.data;
    // Negação por padrão: a classificação é configuração confiável do servidor, nunca input.
    if (!this.readOnly.has(ctx.scriptId)) return fail('APPROVAL_REQUIRED', 'Escrita bloqueada: aprovação persistida ainda não disponível');
    const cacheKey = JSON.stringify([ctx.tenant.tenantId, ctx.tenant.userId,
      [...ctx.tenant.roles].sort(), [...ctx.tenant.permissions].sort(), ctx.scriptId, ctx.input]);
    const breakerKey = JSON.stringify([ctx.tenant.tenantId, ctx.scriptId]);
    let cacheHit = false;

    // Check cache
    if (cacheTTL && this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (entry.expiresAt > Date.now()) {
        cacheHit = true;
        const duration = Date.now() - startTime;
        this.recordMetric(ctx.scriptId, duration, false, true);

        return {
          success: true,
          ...structuredClone(entry.data),
          executionTimeMs: duration,
          cacheHit: true,
        };
      }
      this.cache.delete(cacheKey);
    }

    // Circuit breaker check
    const cb = this.circuitBreakers.get(breakerKey);
    if (cb?.isOpen) {
      const timeSinceFailure = Date.now() - cb.lastFailure;
      if (timeSinceFailure < 30000) { // 30s timeout
        const duration = Date.now() - startTime;
        return {
          success: false,
          error: { code: 'CIRCUIT_OPEN', message: 'Script circuit breaker is open' },
          evidence: [],
          executionTimeMs: duration,
          cacheHit: false,
        };
      } else {
        cb.isOpen = false;
        cb.failures = 0;
      }
    }

    // Retry logic
    let lastError: any;
    const maxAttempts = Math.min(3, Math.max(0, Math.floor(ctx.retryCount || 0))) + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          Promise.resolve().then(() => handler(ctx)),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Timeout')), 5000);
          }),
        ]).finally(() => { if (timer) clearTimeout(timer); });
        const structured = result && typeof result === 'object' && 'success' in result;
        const parsed = structured ? JevScriptResultSchema.safeParse(result) : undefined;
        if (parsed && !parsed.success) return fail('INVALID_RESULT', 'Resultado do handler inválido');
        const normalized: JevScriptResult = parsed?.success ? parsed.data : {
          success: true, data: result, evidence: [], executionTimeMs: 0, cacheHit: false,
        };
        normalized.executionTimeMs = Date.now() - startTime;
        normalized.cacheHit = false;
        if (!normalized.success) {
          this.recordMetric(ctx.scriptId, normalized.executionTimeMs, true, false);
          return normalized;
        }

        // Success
        if (cacheTTL) {
          this.cache.set(cacheKey, { data: structuredClone(normalized), expiresAt: Date.now() + cacheTTL });
        }

        const duration = Date.now() - startTime;
        this.recordMetric(ctx.scriptId, duration, false, false);

        this.circuitBreakers.delete(breakerKey);
        return normalized;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts - 1) {
          const backoffMs = Math.pow(2, attempt) * 100;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Failed after retries
    const duration = Date.now() - startTime;
    this.recordMetric(ctx.scriptId, duration, true, false);

    // Update circuit breaker
    if (!this.circuitBreakers.has(breakerKey)) {
      this.circuitBreakers.set(breakerKey, { failures: 0, lastFailure: Date.now(), isOpen: false });
    }
    const cb2 = this.circuitBreakers.get(breakerKey)!;
    cb2.failures++;
    cb2.lastFailure = Date.now();
    if (cb2.failures >= 5) {
      cb2.isOpen = true;
    }

    return {
      success: false,
      error: { code: 'EXECUTION_FAILED', message: lastError?.message || 'Unknown error' },
      evidence: [],
      executionTimeMs: duration,
      cacheHit: false,
    };
  }

  async executeParallel(contexts: JevScriptContext[]): Promise<JevScriptResult[]> {
    return Promise.all(contexts.map(ctx => this.execute(ctx)));
  }

  private recordMetric(scriptId: string, duration: number, isError: boolean, cacheHit: boolean): void {
    const metric = this.metrics.get(scriptId) || { durations: [], errors: 0, cacheHits: 0 };
    metric.durations.push(duration);
    if (isError) metric.errors++;
    if (cacheHit) metric.cacheHits++;
    this.metrics.set(scriptId, metric);
  }

  getMetrics(scriptId: string): { p50: number; p95: number; p99: number; errorRate: number } | null {
    const metric = this.metrics.get(scriptId);
    if (!metric || metric.durations.length === 0) return null;

    const sorted = [...metric.durations].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      errorRate: metric.errors / sorted.length,
    };
  }
}

export const scriptRuntime = new ScriptRuntime();
