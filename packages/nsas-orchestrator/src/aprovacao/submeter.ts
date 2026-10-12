import { sha256Base64url, canonicalJson } from '../canonical';
import {
  ErroOrquestrador,
  type AprovacaoAssinada,
  type AprovacaoRepository,
  type AssinadorOab,
  type CasoRepository,
  type Decisao,
  type Relogio,
} from '../contratos';

/**
 * Caso de uso SubmeterAprovacaoOAB.
 *
 * Fluxo:
 *   1. Lê rascunho persistido para o caso; falha fechada se não houver.
 *   2. Recalcula sha256 base64url do conteúdo do rascunho em canonical JSON
 *      e compara com `rascunho_hash_atual` passado pelo chamador.
 *   3. Carimba `horario` do relógio injetado (`Relogio.agora()`).
 *   4. Pede ao `AssinadorOab` para assinar o payload canônico.
 *   5. Persiste via `AprovacaoRepository.registrar` (idempotente).
 *
 * Invariantes:
 *   - aprovação sobre hash H1 nunca valida rascunho H2 (hash está no payload
 *     assinado + é chave composta em DB);
 *   - rejeição também é assinada (trilhabilidade);
 *   - CasoRepository nunca é atualizado por este caso de uso — a mudança de
 *     estado é feita por quem orquestra o fluxo (CLI/aplicação) após sucesso.
 */

export interface DependenciasAprovacao {
  readonly casoRepository: CasoRepository;
  readonly aprovacaoRepository: AprovacaoRepository;
  readonly assinador: AssinadorOab;
  readonly relogio: Relogio;
}

export interface EntradaAprovacao {
  readonly caso_id: string;
  readonly rascunho_hash_atual: string;
  readonly decisao: Decisao;
  readonly justificativa: string;
  readonly passphrase: string;
}

export async function submeterAprovacaoOAB(
  deps: DependenciasAprovacao,
  entrada: EntradaAprovacao,
): Promise<AprovacaoAssinada> {
  const rascunho = await deps.casoRepository.obterRascunho(entrada.caso_id);
  if (!rascunho) {
    throw new ErroOrquestrador(
      'aprovacao_ausente',
      `Caso "${entrada.caso_id}" não tem rascunho persistido para aprovar.`,
    );
  }

  const hashRecalculado = sha256Base64url(
    canonicalJson({ caso_id: entrada.caso_id, conteudo: rascunho.conteudo }),
  );
  if (
    hashRecalculado !== rascunho.hash ||
    entrada.rascunho_hash_atual !== rascunho.hash
  ) {
    throw new ErroOrquestrador(
      'aprovacao_hash_divergente',
      'Hash do rascunho atual diverge do hash informado para aprovação.',
    );
  }

  const horario = deps.relogio.agora();
  const aprovacao = await deps.assinador.assinar(
    {
      caso_id: entrada.caso_id,
      rascunho_hash: rascunho.hash,
      decisao: entrada.decisao,
      justificativa: entrada.justificativa,
      horario,
    },
    entrada.passphrase,
  );

  await deps.aprovacaoRepository.registrar(aprovacao);
  return aprovacao;
}
