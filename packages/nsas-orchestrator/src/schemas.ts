import { z } from 'zod';
import type { AprovacaoAssinada, ManifestoEmissao, PlanoConsulta, EventoAuditoria } from './contratos';
import { canonicalJson } from './canonical';

const texto = z.string().min(1);
const hash = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
const assinatura = z.string().regex(/^[A-Za-z0-9_-]{85}[AQgw]$/);
const horario = z.string().datetime();

export const AprovacaoAssinadaSchema = z.object({
  caso_id: z.string().uuid(), rascunho_hash: hash,
  decisao: z.enum(['aprovado', 'rejeitado']), justificativa: texto,
  horario, oab_kid: texto, assinatura_ed25519: assinatura,
}).strict() satisfies z.ZodType<AprovacaoAssinada>;

export const ManifestoEmissaoSchema = z.object({
  caso_id: z.string().uuid(), artefato_path: texto, artefato_hash: hash,
  aprovacao: AprovacaoAssinadaSchema, carimbo_versoes: z.array(texto).min(1),
  manifesto_hash: hash, assinatura_ed25519: assinatura,
}).strict() satisfies z.ZodType<ManifestoEmissao>;

// Validação estrutural. Ciclos, referências e execução pertencem ao card 03.
export const PlanoConsultaSchema = z.object({
  versao: texto,
  nos: z.array(z.object({
    id: texto, dominio: texto, depende_de: z.array(texto),
    politica: z.enum(['abortar', 'degradar']),
    timeout_ms: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }).strict()).min(1),
}).strict() satisfies z.ZodType<PlanoConsulta>;

export const EventoAuditoriaSchema = z.object({
  tipo: texto, caso_id: z.string().uuid().optional(), horario,
  payload: z.record(z.unknown()).refine(valor => {
    try { canonicalJson(valor); return true; } catch { return false; }
  }, 'Payload deve ser JSON canônico serializável.'),
}).strict() satisfies z.ZodType<EventoAuditoria>;
