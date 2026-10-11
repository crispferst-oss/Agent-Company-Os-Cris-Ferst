import { z } from 'zod';

export const JevTenantContextSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  roles: z.array(z.enum(['admin', 'operator', 'viewer'])).default(['viewer']),
  permissions: z.array(z.string()).default([]),
});
export type JevTenantContext = z.infer<typeof JevTenantContextSchema>;

export const JevSourceSchema = z.object({
  type: z.enum(['script', 'cache', 'api', 'database', 'ai_generated']),
  scriptName: z.string().optional(),
  scriptVersion: z.string().optional(),
  timestamp: z.date(),
  ttl: z.number().optional(),
  confidence: z.number().min(0).max(1),
});
export type JevSource = z.infer<typeof JevSourceSchema>;

export const JevEvidenceSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  type: z.enum(['metric', 'event', 'status', 'entity', 'relationship']),
  key: z.string(),
  value: z.any(),
  source: JevSourceSchema,
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});
export type JevEvidence = z.infer<typeof JevEvidenceSchema>;

export const JevScriptDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['read', 'write', 'control']),
  timeout: z.number().positive().default(5000),
  cacheTTL: z.number().positive().optional(),
  idempotent: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  permissions: z.array(z.object({
    minRole: z.enum(['admin', 'operator', 'viewer']),
  })).optional(),
});
export type JevScriptDefinition = z.infer<typeof JevScriptDefinitionSchema>;

export const JevScriptContextSchema = z.object({
  scriptId: z.string(),
  input: z.record(z.any()).default({}),
  tenant: JevTenantContextSchema,
  correlationId: z.string().default(() => crypto.randomUUID()),
  idempotencyKey: z.string().optional(),
  retryCount: z.number().default(0),
  executedAt: z.date().default(() => new Date()),
});
export type JevScriptContext = z.infer<typeof JevScriptContextSchema>;

export const JevScriptResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  evidence: z.array(JevEvidenceSchema).default([]),
  executionTimeMs: z.number().nonnegative(),
  cacheHit: z.boolean().default(false),
});
export type JevScriptResult = z.infer<typeof JevScriptResultSchema>;

export const JevExecutionPlanSchema = z.object({
  correlationId: z.string().default(() => crypto.randomUUID()),
  intent: z.string(),
  phases: z.array(z.object({
    id: z.string(),
    order: z.number(),
    parallel: z.boolean().default(false),
    scripts: z.array(z.object({ scriptId: z.string(), input: z.record(z.any()).default({}) })),
  })).min(1),
  requiresAI: z.boolean().default(false),
});
export type JevExecutionPlan = z.infer<typeof JevExecutionPlanSchema>;

export const JevIntentSchema = z.object({
  type: z.enum(['deterministic', 'ambiguous', 'requires_synthesis']),
  confidence: z.number().min(0).max(1),
  scripts: z.array(z.string()).default([]),
  aiGatewayNeeded: z.boolean().default(false),
  reason: z.string().optional(),
  matchedKeywords: z.array(z.string()).optional(),
});
export type JevIntent = z.infer<typeof JevIntentSchema>;

export const JevResponseSchema = z.object({
  correlationId: z.string(),
  status: z.enum(['success', 'partial', 'error']),
  answer: z.string(),
  summary: z.record(z.any()).optional(),
  evidence: z.array(JevEvidenceSchema).default([]),
  sources: z.array(z.string()).default([]),
  durationMs: z.number().nonnegative(),
  executedAt: z.date().optional(),
  warnings: z.array(z.string()).optional(),
  nextActions: z.array(z.string()).optional(),
  aiGenerated: z.boolean().default(false),
  confidenceLevel: z.enum(['high', 'medium', 'low']).default('high'),
});
export type JevResponse = z.infer<typeof JevResponseSchema>;

export const JevAuditLogSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  status: z.enum(['success', 'failure']),
  timestamp: z.date().default(() => new Date()),
});
export type JevAuditLog = z.infer<typeof JevAuditLogSchema>;
