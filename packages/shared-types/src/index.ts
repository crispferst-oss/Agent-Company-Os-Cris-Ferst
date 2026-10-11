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

// === NSAS Schemas ===
// Produto SaaS de consultoria jurídica preventiva para médicos de consultório.
// Ver .claude/decisions/ADR-006 a ADR-010.

/**
 * Resultado da detecção de dado clínico na borda (CCS adapter).
 * Classes definidas em ADR-009:
 *   DC-1 = binário clínico (DICOM, PDF HL7/LOINC/CID, EXIF médico)
 *   DC-2 = estruturado colado (CID-10, resultado lab, TUSS)
 *   DC-3 = narrativa clínica
 *   DC-4 = identificador vinculável (prontuário, CNS, guia TISS)
 */
export const NsasDetectorVeredictoSchema = z.object({
  classe: z.enum(['DC-1', 'DC-2', 'DC-3', 'DC-4', 'limpo']),
  confianca: z.number().min(0).max(1),
  acao: z.enum(['recusa_dura', 'mascara_in_place', 'pseudonimo_deterministico', 'aceita']),
  motivo: z.string(),
  span: z.object({
    start: z.number().nonnegative().optional(),
    end: z.number().nonnegative().optional(),
    campo: z.string().optional(),
  }).optional(),
});
export type NsasDetectorVeredicto = z.infer<typeof NsasDetectorVeredictoSchema>;

/**
 * Enumeração fechada dos predicados v1.0 (ADR-010).
 * Mudanças exigem Conselho + ADR nova (regra V10 da ACG).
 */
export const NsasPredicadoIdSchema = z.enum([
  '01', // prontuario_existe_e_tem_identificacao_minima
  '02', // prazo_guarda_minima_cumprido
  '03', // copia_entregue_quando_solicitada
  '04', // tcle_formalizado_padrao_cfm
  '05', // papel_do_medico_no_ato
  '06', // documento_tem_identificacao_minima
  '07', // cid_em_atestado_tem_autorizacao_expressa
  '08', // plataforma_telemedicina_atende_sigilo
  '09', // valor_ajustado_previamente_telemedicina
  '10', // peca_contem_antes_depois
  '11', // peca_promete_resultado
  '12', // uso_de_imagem_de_paciente_tem_tcle_proprio
  '13', // consultorio_e_agente_pequeno_porte
  '14', // incidente_com_dado_sensivel_de_saude
  '15', // cheque_caucao_exigido_em_emergencia
]);
export type NsasPredicadoId = z.infer<typeof NsasPredicadoIdSchema>;

export const NsasPredicadoVerificadoSchema = z.object({
  id: NsasPredicadoIdSchema,
  valor: z.union([z.boolean(), z.string(), z.null()]),
  resultado: z.enum(['verdadeiro', 'falso', 'inconclusivo']),
  confianca: z.number().min(0).max(1),
  evidencia_hash: z.string().optional(),
  qualifier: z.enum(['verificado', 'autodeclarado', 'vigencia_pendente']).default('verificado'),
});
export type NsasPredicadoVerificado = z.infer<typeof NsasPredicadoVerificadoSchema>;

/**
 * Selo JWS emitido pelo CCS; verificado pelo Orquestrador antes de executar o Plano.
 * Ausência ou falha de verificação ⇒ abort + alerta síncrono à titular (ADR-009).
 */
export const NsasSeloBordaSchema = z.object({
  v: z.literal('1.0'),
  policy_v: z.string(),
  caso_id: z.string().uuid(),
  issued_at: z.date(),
  expires_at: z.date(),
  canal_origem: z.enum(['profissional_autenticado', 'prontuario_pull', 'visualizador_titular']),
  detectores: z.array(NsasDetectorVeredictoSchema).default([]),
  predicados_verificados: z.array(NsasPredicadoVerificadoSchema).default([]),
  cofre_id: z.string().optional(),
  custodia_chave: z.array(z.string()).default([]),
  sig: z.string(), // Ed25519 em base64; verificado no Orquestrador
});
export type NsasSeloBorda = z.infer<typeof NsasSeloBordaSchema>;

/**
 * Carga que atravessa a fronteira CCS → núcleo jurídico.
 * NUNCA contém dado clínico bruto (ADR-009 invariante #2 da ADR-007).
 */
export const NsasCasoPseudonimizadoSchema = z.object({
  caso_id: z.string().uuid(),
  titular_ref: z.string(), // HMAC-SHA256 do beneficiário
  fato_juridico: z.string(), // narrativa reescrita; sem clínica bruta
  refs_clinicas: z.array(z.object({
    ref: z.string(),
    tipo: z.string(),
    atributos: z.record(z.unknown()).default({}),
  })).default([]),
  documentos_opaco: z.array(z.object({
    hash: z.string(),
    tipo: z.string(),
  })).default([]),
  predicados: z.array(NsasPredicadoVerificadoSchema).default([]),
  tradutor_v: z.string().default('1.0'),
  selo: NsasSeloBordaSchema,
});
export type NsasCasoPseudonimizado = z.infer<typeof NsasCasoPseudonimizadoSchema>;

/**
 * Resultado da ingestão de borda — o que o CCS devolve ao chamador.
 * Caminho feliz: `aceito=true` com `caso_id` para prosseguir ao Orquestrador.
 * Caminho recusado: `aceito=false` com orientação sobre via legítima.
 */
export const NsasResultadoIngressoSchema = z.object({
  aceito: z.boolean(),
  caso_id: z.string().uuid().optional(),
  motivo_recusa: z.string().optional(),
  orientacao: z.string().optional(),
  veredictos: z.array(NsasDetectorVeredictoSchema).default([]),
});
export type NsasResultadoIngresso = z.infer<typeof NsasResultadoIngressoSchema>;

/**
 * Formato de retorno padronizado dos especialistas NSAS (ADR-002).
 * "Afirmação sem fonte é defeito" — _base-nsas.md.
 */
export const NsasParecerParcialSchema = z.object({
  especialista: z.string(),
  fatos: z.array(z.string()).default([]),
  fundamentos: z.array(z.object({
    norma: z.string(),
    aplicacao: z.string(),
  })).default([]),
  riscos: z.array(z.string()).default([]),
  fontes: z.array(z.string()).default([]),
});
export type NsasParecerParcial = z.infer<typeof NsasParecerParcialSchema>;
