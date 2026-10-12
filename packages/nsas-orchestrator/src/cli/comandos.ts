import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { NsasCasoPseudonimizado } from '@jev/shared-types';
import { canonicalJson, sha256Base64url } from '../canonical';
import {
  ErroOrquestrador,
  type AprovacaoAssinada,
  type AprovacaoRepository,
  type AuditLogRepository,
  type CasoRepository,
  type Decisao,
  type ManifestoEmissao,
  type PlanoConsulta,
  type Relogio,
  type SeloVerifier,
} from '../contratos';
import { ExecutorPlano, type DependenciasExecutor } from '../execucao';
import { submeterAprovacaoOAB } from '../aprovacao/submeter';
import { AssinadorOabEd25519 } from '../aprovacao/assinador';

/**
 * Camada CLI do nsas-orchestrator (card 07).
 *
 * Funções puras: recebem `AppContexto` + argumentos tipados e devolvem
 * objetos JSON serializáveis. O binário `nsas` (src/cli/bin.ts) só traduz
 * argv/env em chamadas e formata a saída.
 */

export interface AppContexto {
  readonly casoRepository: CasoRepository;
  readonly aprovacaoRepository: AprovacaoRepository;
  readonly auditLogRepository: AuditLogRepository;
  readonly seloVerifier: SeloVerifier;
  readonly assinadorOab: AssinadorOabEd25519;
  readonly executor: DependenciasExecutor;
  readonly relogio: Relogio;
  readonly redator: {
    redigir(
      pacote: unknown,
      metadados: unknown,
      opcoes?: { memoriaContexto?: unknown },
    ): string;
  };
}

export interface EntradaIniciar {
  readonly caso: NsasCasoPseudonimizado;
  readonly plano: PlanoConsulta;
  readonly metadados: Readonly<Record<string, unknown>>;
  readonly chaveOperacao: string;
}

export interface SaidaIniciar {
  readonly caso_id: string;
  readonly estado: 'rascunho' | 'abortado';
  readonly rascunho_hash?: string;
  readonly abortado: boolean;
  readonly nos: ReadonlyArray<{ no_id: string; dominio: string; estado: string }>;
}

export async function comandoIniciar(
  ctx: AppContexto,
  entrada: EntradaIniciar,
): Promise<SaidaIniciar> {
  const selo = await ctx.seloVerifier.verificar(entrada.caso.selo, entrada.caso);
  if (!selo.ok) {
    await ctx.auditLogRepository.anexar({
      tipo: 'selo_invalido',
      caso_id: entrada.caso.caso_id,
      horario: ctx.relogio.agora(),
      payload: { motivo: selo.motivo },
    });
    throw new ErroOrquestrador(
      selo.motivo === 'expirado' ? 'selo_expirado' : 'selo_invalido',
      `Selo CCS inválido: ${selo.motivo}`,
    );
  }

  const agora = ctx.relogio.agora();
  await ctx.casoRepository.salvarIdempotente(
    {
      caso_id: entrada.caso.caso_id,
      estado: 'iniciado',
      criado_em: agora,
      atualizado_em: agora,
      plano: entrada.plano,
    },
    entrada.chaveOperacao,
  );

  const executor = new ExecutorPlano(ctx.executor);
  const pacote = await executor.executar(entrada.plano, entrada.caso);

  if (pacote.abortado) {
    await ctx.casoRepository.atualizarEstado(entrada.caso.caso_id, 'abortado');
    await ctx.auditLogRepository.anexar({
      tipo: 'execucao_abortada',
      caso_id: entrada.caso.caso_id,
      horario: ctx.relogio.agora(),
      payload: {
        nos: pacote.resultados.map((r) => ({ no_id: r.no_id, estado: r.estado })),
      },
    });
    return {
      caso_id: entrada.caso.caso_id,
      estado: 'abortado',
      abortado: true,
      nos: pacote.resultados.map((r) => ({
        no_id: r.no_id,
        dominio: r.dominio,
        estado: r.estado,
      })),
    };
  }

  const conteudo = ctx.redator.redigir(pacote, entrada.metadados);
  const hash = sha256Base64url(
    canonicalJson({ caso_id: entrada.caso.caso_id, conteudo }),
  );
  await ctx.casoRepository.salvarRascunho(entrada.caso.caso_id, hash, conteudo);
  await ctx.casoRepository.atualizarEstado(entrada.caso.caso_id, 'rascunho');
  await ctx.auditLogRepository.anexar({
    tipo: 'rascunho_consolidado',
    caso_id: entrada.caso.caso_id,
    horario: ctx.relogio.agora(),
    payload: { rascunho_hash: hash, carimbo_versoes: pacote.carimbo_versoes },
  });

  return {
    caso_id: entrada.caso.caso_id,
    estado: 'rascunho',
    rascunho_hash: hash,
    abortado: false,
    nos: pacote.resultados.map((r) => ({
      no_id: r.no_id,
      dominio: r.dominio,
      estado: r.estado,
    })),
  };
}

export interface EntradaDecisao {
  readonly caso_id: string;
  readonly justificativa: string;
  readonly passphrase: string;
  readonly rascunho_hash_atual: string;
}

export async function comandoAprovar(
  ctx: AppContexto,
  entrada: EntradaDecisao,
): Promise<AprovacaoAssinada> {
  return decidir(ctx, entrada, 'aprovado');
}

export async function comandoRejeitar(
  ctx: AppContexto,
  entrada: EntradaDecisao,
): Promise<AprovacaoAssinada> {
  return decidir(ctx, entrada, 'rejeitado');
}

async function decidir(
  ctx: AppContexto,
  entrada: EntradaDecisao,
  decisao: Decisao,
): Promise<AprovacaoAssinada> {
  const aprovacao = await submeterAprovacaoOAB(
    {
      casoRepository: ctx.casoRepository,
      aprovacaoRepository: ctx.aprovacaoRepository,
      assinador: ctx.assinadorOab,
      relogio: ctx.relogio,
    },
    { ...entrada, decisao },
  );
  await ctx.casoRepository.atualizarEstado(entrada.caso_id, decisao);
  await ctx.auditLogRepository.anexar({
    tipo: decisao === 'aprovado' ? 'aprovacao_registrada' : 'rejeicao_registrada',
    caso_id: entrada.caso_id,
    horario: ctx.relogio.agora(),
    payload: { rascunho_hash: aprovacao.rascunho_hash, oab_kid: aprovacao.oab_kid },
  });
  return aprovacao;
}

export interface EntradaEmitir {
  readonly caso_id: string;
  readonly diretorioSaida: string;
  readonly carimboVersoes: ReadonlyArray<string>;
  readonly passphrase: string;
}

export async function comandoEmitir(
  ctx: AppContexto,
  entrada: EntradaEmitir,
): Promise<ManifestoEmissao> {
  const rascunho = await ctx.casoRepository.obterRascunho(entrada.caso_id);
  if (!rascunho) {
    throw new ErroOrquestrador('aprovacao_ausente', 'Caso sem rascunho — nada a emitir.');
  }
  const aprovacao = await ctx.aprovacaoRepository.obterPorHash(
    entrada.caso_id,
    rascunho.hash,
  );
  if (!aprovacao) {
    throw new ErroOrquestrador(
      'aprovacao_ausente',
      'Rascunho corrente não tem aprovação registrada.',
    );
  }
  if (aprovacao.decisao !== 'aprovado') {
    throw new ErroOrquestrador(
      'aprovacao_rejeitada',
      'Rascunho corrente foi rejeitado; emissão proibida.',
    );
  }

  mkdirSync(entrada.diretorioSaida, { recursive: true });
  const artefato_path = join(entrada.diretorioSaida, `${entrada.caso_id}.md`);
  writeFileSync(artefato_path, rascunho.conteudo, { encoding: 'utf8' });
  const artefato_hash = sha256Base64url(rascunho.conteudo);

  const corpo = {
    caso_id: entrada.caso_id,
    artefato_path,
    artefato_hash,
    aprovacao,
    carimbo_versoes: entrada.carimboVersoes,
  };
  const assinado = await ctx.assinadorOab.assinarManifesto(corpo, entrada.passphrase);
  const manifesto: ManifestoEmissao = { ...corpo, ...assinado };

  writeFileSync(
    join(entrada.diretorioSaida, `${entrada.caso_id}.manifesto.json`),
    canonicalJson(manifesto),
    { encoding: 'utf8' },
  );
  await ctx.casoRepository.atualizarEstado(entrada.caso_id, 'emitido');
  await ctx.auditLogRepository.anexar({
    tipo: 'emissao_registrada',
    caso_id: entrada.caso_id,
    horario: ctx.relogio.agora(),
    payload: { manifesto_hash: manifesto.manifesto_hash, artefato_hash },
  });
  return manifesto;
}

export interface SaidaStatus {
  readonly caso_id: string;
  readonly estado: string;
  readonly rascunho_hash?: string;
  readonly tem_aprovacao: boolean;
  readonly aprovacao_decisao?: Decisao;
}

export async function comandoStatus(
  ctx: AppContexto,
  caso_id: string,
): Promise<SaidaStatus | null> {
  const caso = await ctx.casoRepository.obter(caso_id);
  if (!caso) return null;
  let aprovacao: AprovacaoAssinada | null = null;
  if (caso.rascunho_hash) {
    aprovacao = await ctx.aprovacaoRepository.obterPorHash(caso_id, caso.rascunho_hash);
  }
  return {
    caso_id: caso.caso_id,
    estado: caso.estado,
    rascunho_hash: caso.rascunho_hash,
    tem_aprovacao: !!aprovacao,
    aprovacao_decisao: aprovacao?.decisao,
  };
}

export async function comandoAuditoriaVerificar(
  ctx: AppContexto,
): Promise<{ ok: boolean; motivo?: string; indice?: number }> {
  const resultado = await ctx.auditLogRepository.verificar();
  if (resultado.ok) return { ok: true };
  return { ok: false, motivo: resultado.motivo, indice: resultado.indice };
}
