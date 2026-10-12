import type { NsasCasoPseudonimizado } from '@jev/shared-types';

export type PoliticaFalha = 'abortar' | 'degradar';

export interface NoConsulta {
  readonly id: string;
  readonly dominio: string;
  readonly depende_de: ReadonlyArray<string>;
  readonly politica: PoliticaFalha;
  readonly timeout_ms: number;
}

export interface PlanoConsulta {
  readonly versao: string;
  readonly nos: ReadonlyArray<NoConsulta>;
}

export type EstadoCaso =
  | 'iniciado' | 'classificado' | 'executando' | 'rascunho'
  | 'aprovado' | 'rejeitado' | 'emitido' | 'abortado';

export type Decisao = 'aprovado' | 'rejeitado';

export interface AprovacaoAssinada {
  readonly caso_id: string;
  readonly rascunho_hash: string;      // sha256 base64url do rascunho canônico
  readonly decisao: Decisao;
  readonly justificativa: string;
  readonly horario: string;            // ISO 8601 UTC
  readonly oab_kid: string;
  readonly assinatura_ed25519: string; // base64url(sig)
}

export interface ManifestoEmissao {
  readonly caso_id: string;
  readonly artefato_path: string;
  readonly artefato_hash: string;
  readonly aprovacao: AprovacaoAssinada;
  readonly carimbo_versoes: ReadonlyArray<string>;
  readonly manifesto_hash: string;
  readonly assinatura_ed25519: string;
}

export interface Relogio {
  agora(): string; // ISO 8601 UTC
}

export interface AlertaSincrono {
  disparar(evento: { tipo: string; caso_id?: string; detalhe: string }): Promise<void>;
}

export type MotivoSelo = 'ausente' | 'assinatura' | 'caso_divergente' | 'expirado';

export interface SeloVerifier {
  verificar(
    selo: unknown,
    caso: NsasCasoPseudonimizado,
  ): Promise<{ ok: true } | { ok: false; motivo: MotivoSelo }>;
}

export interface AssinadorOab {
  readonly kid: string;
  assinar(
    payload: {
      caso_id: string;
      rascunho_hash: string;
      decisao: Decisao;
      justificativa: string;
      horario: string;
    },
    passphrase: string,
  ): Promise<AprovacaoAssinada>;
}

export interface CasoPersistido {
  readonly caso_id: string;
  readonly estado: EstadoCaso;
  readonly criado_em: string;
  readonly atualizado_em: string;
  readonly plano?: PlanoConsulta;
  readonly rascunho_hash?: string;
}

export interface CasoRepository {
  obter(caso_id: string): Promise<CasoPersistido | null>;
  salvarIdempotente(
    caso: CasoPersistido,
    chave_operacao: string,
  ): Promise<CasoPersistido>;
  atualizarEstado(caso_id: string, estado: EstadoCaso): Promise<void>;
  salvarRascunho(caso_id: string, hash: string, conteudo: string): Promise<void>;
  obterRascunho(caso_id: string): Promise<{ hash: string; conteudo: string } | null>;
}

export interface AprovacaoRepository {
  registrar(aprovacao: AprovacaoAssinada): Promise<void>;
  obterPorHash(
    caso_id: string,
    rascunho_hash: string,
  ): Promise<AprovacaoAssinada | null>;
}

export type MotivoAuditoria =
  | 'hash_divergente' | 'cadeia_quebrada' | 'payload_adulterado';

export interface EventoAuditoria {
  readonly tipo: string;
  readonly caso_id?: string;
  readonly horario: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface AuditLogRepository {
  anexar(evento: EventoAuditoria): Promise<void>;
  verificar(): Promise<
    | { ok: true }
    | { ok: false; indice: number; motivo: MotivoAuditoria }
  >;
}

export class ErroOrquestrador extends Error {
  constructor(
    public readonly motivo:
      | 'selo_invalido' | 'caso_divergente' | 'selo_expirado'
      | 'dag_ciclico' | 'especialista_desconhecido'
      | 'timeout_abortado' | 'aprovacao_ausente'
      | 'aprovacao_hash_divergente' | 'aprovacao_rejeitada'
      | 'passphrase_invalida' | 'auditoria_corrompida',
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroOrquestrador';
  }
}
