import type { NsasCasoPseudonimizado, NsasDetectorVeredicto } from '@jev/shared-types';
import type {
  AnexoBruto,
  IngressoAdministrativo,
  ResultadoBorda,
} from '@jev/nsas-ingresso';
import {
  consultarMemoriaParaPacote,
  type ClassificadorDominio,
  type ConsultarMemoriaInstitucional,
  type ContextoMemoriaInstitucional,
  type MetadadosNotaTecnica,
  type PacoteConsultaEspecialistas,
  type RedatorNotaTecnica,
  type RoteadorEspecialistas,
} from '@jev/nsas-especialistas';

/**
 * Composition root do NSAS Preventivo (ADR-006 — hexagonal).
 *
 * Fluxo canônico de um pedido:
 *   bruto → ingresso (DC-1 fail-closed na borda)
 *         → classificador (fato → domínios)
 *         → roteador (domínios → PacoteConsultaEspecialistas)
 *         → memória institucional (opcional, contexto por domínio)
 *         → redator (Nota Técnica em rascunho pendente de OAB)
 *
 * Invariantes:
 *   - borda bloqueia dado clínico ANTES de qualquer processamento jurídico;
 *   - toda Nota Técnica emitida pelo núcleo está pendente de aprovação OAB;
 *   - o núcleo NÃO constrói adapters nem políticas — apenas compõe o que
 *     o chamador injeta (puro composition root).
 */

export interface AvaliarIngresso {
  (entrada: IngressoAdministrativo): ResultadoBorda;
}

export interface DependenciasNucleo {
  readonly avaliarIngresso: AvaliarIngresso;
  readonly classificador: ClassificadorDominio;
  readonly roteador: RoteadorEspecialistas;
  readonly redator: RedatorNotaTecnica;
  readonly consultarMemoria?: ConsultarMemoriaInstitucional;
}

export interface PedidoNsas {
  readonly bruto: {
    readonly texto?: string;
    readonly anexos?: ReadonlyArray<AnexoBruto>;
  };
  readonly caso: NsasCasoPseudonimizado;
  readonly metadados: MetadadosNotaTecnica;
}

export type ResultadoNsas =
  | {
      readonly aceito: false;
      readonly motivoRecusa: string;
      readonly orientacao: string;
      readonly veredictos: ReadonlyArray<NsasDetectorVeredicto>;
    }
  | {
      readonly aceito: true;
      readonly pendenteAprovacaoOAB: true;
      readonly notaTecnica: string;
      readonly pacote: PacoteConsultaEspecialistas;
      readonly dominiosClassificados: ReadonlyArray<string>;
      readonly memoriaContexto?: ContextoMemoriaInstitucional;
      readonly veredictos: ReadonlyArray<NsasDetectorVeredicto>;
    };

export function criarNucleoNsas(deps: DependenciasNucleo) {
  return {
    async processar(pedido: PedidoNsas): Promise<ResultadoNsas> {
      const borda = deps.avaliarIngresso({
        texto: pedido.bruto.texto,
        anexos: pedido.bruto.anexos,
      });

      if (!borda.aceito) {
        return {
          aceito: false,
          motivoRecusa: borda.motivoRecusa ?? 'Ingresso recusado na borda.',
          orientacao:
            borda.orientacao ??
            'Dado clínico não pode trafegar por canal administrativo. ' +
              'Encaminhar via Canal Clínico Segregado.',
          veredictos: borda.veredictos,
        };
      }

      const fato = pedido.caso.fato_juridico;
      const dominios = deps.classificador.classificar(fato);
      const pacote = await deps.roteador.consultarDominios(dominios, pedido.caso);

      let memoriaContexto: ContextoMemoriaInstitucional | undefined;
      if (deps.consultarMemoria) {
        memoriaContexto = await consultarMemoriaParaPacote(pacote, {
          memoria: deps.consultarMemoria,
        });
      }

      const notaTecnica = deps.redator.redigir(pacote, pedido.metadados, {
        memoriaContexto,
      });

      return {
        aceito: true,
        pendenteAprovacaoOAB: true,
        notaTecnica,
        pacote,
        dominiosClassificados: dominios,
        memoriaContexto,
        veredictos: borda.veredictos,
      };
    },
  };
}

export type NucleoNsas = ReturnType<typeof criarNucleoNsas>;
