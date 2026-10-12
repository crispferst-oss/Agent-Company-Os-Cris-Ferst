import { createPublicKey, KeyObject, verify } from 'node:crypto';
import { NsasCasoPseudonimizadoSchema, NsasSeloBordaSchema, type NsasCasoPseudonimizado } from '@jev/shared-types';
import { canonicalJson, sha256Base64url } from '../canonical';
import type { AlertaSincrono, MotivoSelo, Relogio, SeloVerifier } from '../contratos';

/** Wire contract: selo.sig contains compact JWS, never a detached signature.
 * Both dates are ISO UTC in the hashed case; every field except sig is bound.
 */
export function criarPayloadSelo(caso: NsasCasoPseudonimizado): { caso_id: string; exp: number; caso_hash: string } {
  NsasCasoPseudonimizadoSchema.parse(caso);
  const { sig: _sig, ...metadados } = caso.selo;
  const conteudo = { ...caso, selo: { ...metadados, issued_at: caso.selo.issued_at.toISOString(), expires_at: caso.selo.expires_at.toISOString() } };
  return { caso_id: caso.caso_id, exp: caso.selo.expires_at.getTime() / 1000, caso_hash: sha256Base64url(canonicalJson(conteudo)) };
}

export interface ConfiguracaoSeloCcs {
  readonly chavePublica: string | KeyObject;
  readonly kid: string;
  readonly relogio: Relogio;
  readonly alerta: AlertaSincrono;
}

export class SeloCcsVerifier implements SeloVerifier {
  private readonly chave: KeyObject;
  constructor(private readonly config: ConfiguracaoSeloCcs) {
    this.chave = typeof config.chavePublica === 'string' ? createPublicKey(config.chavePublica) : config.chavePublica;
    if (this.chave.type !== 'public' || this.chave.asymmetricKeyType !== 'ed25519' || !config.kid) {
      throw new TypeError('Configuracao CCS exige chave publica Ed25519 e kid.');
    }
  }

  async verificar(selo: unknown, caso: NsasCasoPseudonimizado): Promise<{ ok: true } | { ok: false; motivo: MotivoSelo }> {
    let motivo: MotivoSelo | undefined;
    try { motivo = this.validar(selo, caso); } catch { motivo = 'assinatura'; }
    if (!motivo) return { ok: true };
    const identificador = NsasCasoPseudonimizadoSchema.shape.caso_id.safeParse(caso?.caso_id);
    await this.config.alerta.disparar({ tipo: 'selo_invalido', ...(identificador.success ? { caso_id: identificador.data } : {}), detalhe: motivo });
    return { ok: false, motivo };
  }

  private validar(selo: unknown, caso: NsasCasoPseudonimizado): MotivoSelo | undefined {
    if (selo === null || selo === undefined) return 'ausente';
    const parsed = NsasSeloBordaSchema.safeParse(selo);
    if (!parsed.success) return 'assinatura';
    const partes = parsed.data.sig.split('.');
    if (partes.length !== 3) return 'assinatura';
    const [headerPart, payloadPart, signaturePart] = partes;
    const header = JSON.parse(decodificar(headerPart).toString('utf8'));
    if (!header || canonicalJson(Object.keys(header).sort()) !== canonicalJson(['alg', 'kid', 'typ']) ||
      header.alg !== 'EdDSA' || header.typ !== 'JWT' || header.kid !== this.config.kid) return 'assinatura';
    const assinatura = decodificar(signaturePart);
    if (assinatura.length !== 64 || !verify(null, Buffer.from(headerPart + '.' + payloadPart), this.chave, assinatura)) return 'assinatura';
    const payload = JSON.parse(decodificar(payloadPart).toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'assinatura';
    if (payload.caso_id !== caso.caso_id || parsed.data.caso_id !== caso.caso_id) return 'caso_divergente';
    const esperado = criarPayloadSelo(caso);
    if (canonicalJson(payload) !== canonicalJson(esperado) || parsed.data.sig !== caso.selo.sig ||
      canonicalJson({ ...parsed.data, issued_at: parsed.data.issued_at.toISOString(), expires_at: parsed.data.expires_at.toISOString() }) !==
      canonicalJson({ ...caso.selo, issued_at: caso.selo.issued_at.toISOString(), expires_at: caso.selo.expires_at.toISOString() })) return 'assinatura';
    const agora = Date.parse(this.config.relogio.agora());
    if (!Number.isFinite(agora) || caso.selo.issued_at.getTime() > agora || caso.selo.issued_at.getTime() >= caso.selo.expires_at.getTime()) return 'assinatura';
    if (agora >= esperado.exp * 1000) return 'expirado';
    return undefined;
  }
}

function decodificar(valor: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) throw new TypeError('JWS invalido.');
  const bytes = Buffer.from(valor, 'base64url');
  if (bytes.toString('base64url') !== valor) throw new TypeError('JWS invalido.');
  return bytes;
}
