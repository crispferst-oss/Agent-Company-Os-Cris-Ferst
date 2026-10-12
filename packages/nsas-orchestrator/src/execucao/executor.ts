import type { NsasCasoPseudonimizado, NsasParecerParcial } from '@jev/shared-types';
import type { ConsultarEspecialista } from '@jev/nsas-especialistas';
import { ErroConsultaEspecialista } from '@jev/nsas-especialistas';
import type { NoConsulta, PlanoConsulta, PoliticaFalha, Relogio } from '../contratos';
import { ErroOrquestrador } from '../contratos';
import { validarDag } from './validador';

/**
 * Executor do PlanoConsulta.
 *
 * Invariantes (ADR-007):
 *   #5 timeout por nó + política abortar|degradar
 *   #6 recursão zero: cada adapter chamado no máximo uma vez via Map<dominio>
 *   #7 isolamento de falha: erro de um nó não derruba nós sãos
 *   #8 carimbo de versões: pacote traz versão do executor + versão de cada adapter
 *
 * O executor NUNCA retorna rascunho — apenas o pacote bruto para o redator consumir.
 */

export const VERSAO_EXECUTOR = 'executor-nsas@1';

export type EstadoNoExecutado =
  | 'ok'
  | 'erro'
  | 'timeout'
  | 'pulado'
  | 'desconhecido';

export interface ResultadoNoExecutado {
  readonly no_id: string;
  readonly dominio: string;
  readonly estado: EstadoNoExecutado;
  readonly politica: PoliticaFalha;
  readonly parecer?: NsasParecerParcial;
  readonly erro?: {
    readonly motivo: string;
    readonly mensagem: string;
  };
  readonly versao_adapter?: string;
  readonly duracao_ms: number;
}

export interface PacoteExecucao {
  readonly versao_executor: string;
  readonly pareceres: ReadonlyArray<NsasParecerParcial>;
  readonly resultados: ReadonlyArray<ResultadoNoExecutado>;
  readonly carimbo_versoes: ReadonlyArray<string>;
  readonly abortado: boolean;
}

export interface DependenciasExecutor {
  readonly adapters: ReadonlyMap<string, ConsultarEspecialista>;
  readonly relogio: Relogio;
}

export class ExecutorPlano {
  constructor(private readonly deps: DependenciasExecutor) {}

  async executar(
    plano: PlanoConsulta,
    caso: NsasCasoPseudonimizado,
  ): Promise<PacoteExecucao> {
    validarDag(plano);

    const nosPorId = new Map<string, NoConsulta>();
    for (const no of plano.nos) nosPorId.set(no.id, no);

    const resultados = new Map<string, ResultadoNoExecutado>();
    const emExecucao = new Map<string, Promise<ResultadoNoExecutado>>();
    const abortar = { ativo: false };

    const prontos = (): NoConsulta[] =>
      plano.nos.filter(
        (no) =>
          !resultados.has(no.id) &&
          !emExecucao.has(no.id) &&
          no.depende_de.every((d) => resultados.has(d) && resultados.get(d)!.estado === 'ok'),
      );

    const marcarPulados = (motivoFalhaDominio: string): void => {
      for (const no of plano.nos) {
        if (resultados.has(no.id) || emExecucao.has(no.id)) continue;
        resultados.set(no.id, {
          no_id: no.id,
          dominio: no.dominio,
          politica: no.politica,
          estado: 'pulado',
          erro: {
            motivo: 'dependencia_falhou',
            mensagem: `Pulado: dependência falhou (${motivoFalhaDominio}) ou lote abortado.`,
          },
          duracao_ms: 0,
        });
      }
    };

    const propagarFalha = (resultado: ResultadoNoExecutado): void => {
      if (resultado.politica === 'abortar') {
        abortar.ativo = true;
        return;
      }
      // degradar: pula só os descendentes que dependem (diretos ou transitivos)
      // deste nó falho; outros ramos continuam.
      const descendentes = new Set<string>([resultado.no_id]);
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (const no of plano.nos) {
          if (descendentes.has(no.id)) continue;
          if (no.depende_de.some((d) => descendentes.has(d))) {
            descendentes.add(no.id);
            mudou = true;
          }
        }
      }
      for (const id of descendentes) {
        if (id === resultado.no_id) continue;
        if (resultados.has(id) || emExecucao.has(id)) continue;
        const no = nosPorId.get(id)!;
        resultados.set(id, {
          no_id: id,
          dominio: no.dominio,
          politica: no.politica,
          estado: 'pulado',
          erro: {
            motivo: 'dependencia_falhou',
            mensagem: `Pulado: dependência "${resultado.no_id}" falhou.`,
          },
          duracao_ms: 0,
        });
      }
    };

    while (resultados.size + emExecucao.size < plano.nos.length) {
      if (abortar.ativo) break;
      const disponiveis = prontos();
      if (disponiveis.length === 0 && emExecucao.size === 0) break;
      for (const no of disponiveis) {
        const promessa = this.executarNo(no, caso).then((r) => {
          resultados.set(no.id, r);
          emExecucao.delete(no.id);
          if (r.estado !== 'ok') propagarFalha(r);
          return r;
        });
        emExecucao.set(no.id, promessa);
      }
      if (emExecucao.size > 0) await Promise.race(emExecucao.values());
    }

    // Aguarda nós em voo mesmo após decisão de abortar.
    await Promise.allSettled(emExecucao.values());
    if (abortar.ativo) marcarPulados('política abortar acionada');

    const resultadosOrdenados = plano.nos.map((no) => resultados.get(no.id)!);
    const pareceres: NsasParecerParcial[] = [];
    for (const r of resultadosOrdenados) if (r.parecer) pareceres.push(r.parecer);
    const carimbo_versoes = [
      VERSAO_EXECUTOR,
      ...resultadosOrdenados
        .map((r) => r.versao_adapter)
        .filter((v): v is string => Boolean(v)),
    ];

    return {
      versao_executor: VERSAO_EXECUTOR,
      pareceres,
      resultados: resultadosOrdenados,
      carimbo_versoes,
      abortado: abortar.ativo,
    };
  }

  private async executarNo(
    no: NoConsulta,
    caso: NsasCasoPseudonimizado,
  ): Promise<ResultadoNoExecutado> {
    const inicio = Date.parse(this.deps.relogio.agora());
    const adapter = this.deps.adapters.get(no.dominio);
    if (!adapter) {
      const duracao_ms = Math.max(0, Date.parse(this.deps.relogio.agora()) - inicio);
      return {
        no_id: no.id,
        dominio: no.dominio,
        politica: no.politica,
        estado: 'desconhecido',
        erro: {
          motivo: 'especialista_desconhecido',
          mensagem: `Nenhum adapter registrado para o domínio "${no.dominio}".`,
        },
        duracao_ms,
      };
    }

    let temporizador: NodeJS.Timeout | undefined;
    try {
      const parecer = await Promise.race<NsasParecerParcial>([
        adapter.consultar(caso),
        new Promise<NsasParecerParcial>((_, reject) => {
          temporizador = setTimeout(
            () => reject(new ErroOrquestrador('timeout_abortado', `timeout no nó "${no.id}"`)),
            no.timeout_ms,
          );
          if (typeof temporizador.unref === 'function') temporizador.unref();
        }),
      ]);
      const duracao_ms = Math.max(0, Date.parse(this.deps.relogio.agora()) - inicio);
      return {
        no_id: no.id,
        dominio: no.dominio,
        politica: no.politica,
        estado: 'ok',
        parecer,
        versao_adapter: adapter.versao,
        duracao_ms,
      };
    } catch (erro) {
      const duracao_ms = Math.max(0, Date.parse(this.deps.relogio.agora()) - inicio);
      if (erro instanceof ErroOrquestrador && erro.motivo === 'timeout_abortado') {
        return {
          no_id: no.id,
          dominio: no.dominio,
          politica: no.politica,
          estado: 'timeout',
          versao_adapter: adapter.versao,
          erro: { motivo: 'timeout', mensagem: erro.message },
          duracao_ms,
        };
      }
      if (erro instanceof ErroConsultaEspecialista) {
        return {
          no_id: no.id,
          dominio: no.dominio,
          politica: no.politica,
          estado: 'erro',
          versao_adapter: adapter.versao,
          erro: { motivo: erro.motivo, mensagem: erro.message },
          duracao_ms,
        };
      }
      return {
        no_id: no.id,
        dominio: no.dominio,
        politica: no.politica,
        estado: 'erro',
        versao_adapter: adapter.versao,
        erro: {
          motivo: 'interno',
          mensagem: erro instanceof Error ? erro.message : String(erro),
        },
        duracao_ms,
      };
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  }
}
