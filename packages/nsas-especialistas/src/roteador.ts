import type { NsasCasoPseudonimizado, NsasParecerParcial } from '@jev/shared-types';
import { ConsultarEspecialista, ErroConsultaEspecialista } from './port';
import type { MapaNormativo } from './mapa-normativo';
import { PesquisaNormativaAdapter } from './adapters/pesquisa-normativa';
import { criarEticaMedicaProntuario } from './adapters/etica-medica-prontuario';
import { criarComunicacaoMedicoPaciente } from './adapters/comunicacao-medico-paciente';
import { criarJuridicoSaudeSuplementar } from './adapters/juridico-saude-suplementar';
import { criarComplianceRegulatorioLgpd } from './adapters/compliance-regulatorio-lgpd';
import { criarOperacionalDhAps } from './adapters/operacional-dh-aps';
import { criarConsultoriaOrganizacional } from './adapters/consultoria-organizacional';
import { criarIntegracaoSistemasMedico } from './adapters/integracao-sistemas-medico';

/**
 * Roteador plural da porta `ConsultarEspecialista`
 * (ADR-007 — orquestrador como application service).
 *
 * Responsabilidades:
 * - mantém um registro `dominio -> ConsultarEspecialista` (sem acoplamento ao mapa)
 * - executa consultas em paralelo preservando a invariante #6 (recursão zero:
 *   roteador consulta cada adapter uma única vez, nunca encadeia um ao outro)
 * - carimba o pacote de resposta com a versão do mapa + versões dos adapters
 *   (invariante #8)
 * - normaliza erros de adapter em `ErroPacoteEspecialistas` sem derrubar o lote
 */

export interface PacoteConsultaEspecialistas {
  readonly versaoRoteador: string;
  readonly pareceres: ReadonlyArray<NsasParecerParcial>;
  readonly erros: ReadonlyArray<ErroPacoteEspecialistas>;
  readonly versoesConsultadas: ReadonlyArray<string>;
  readonly dominiosDesconhecidos: ReadonlyArray<string>;
}

export interface ErroPacoteEspecialistas {
  readonly dominio: string;
  readonly motivo: ErroConsultaEspecialista['motivo'] | 'adapter_desconhecido' | 'erro_interno';
  readonly mensagem: string;
}

export interface RoteadorEspecialistas {
  readonly dominiosRegistrados: ReadonlyArray<string>;
  consultarDominios(
    dominios: ReadonlyArray<string>,
    caso: NsasCasoPseudonimizado,
  ): Promise<PacoteConsultaEspecialistas>;
}

export interface OpcoesRoteador {
  readonly mapa: MapaNormativo;
  readonly adapters?: ReadonlyArray<ConsultarEspecialista>;
}

export const DOMINIOS_NSAS_PADRAO = [
  'pesquisa-normativa',
  'etica-medica-prontuario',
  'comunicacao-medico-paciente',
  'juridico-saude-suplementar',
  'compliance-regulatorio-lgpd',
  'operacional-dh-aps',
  'consultoria-organizacional',
  'integracao-sistemas-medico',
] as const;

export function criarRoteadorEspecialistas(opcoes: OpcoesRoteador): RoteadorEspecialistas {
  const adapters = opcoes.adapters ?? adaptersPadrao(opcoes.mapa);
  const registro = new Map<string, ConsultarEspecialista>();
  for (const a of adapters) {
    if (registro.has(a.dominio)) {
      throw new Error(`RoteadorEspecialistas: domínio duplicado "${a.dominio}".`);
    }
    registro.set(a.dominio, a);
  }
  const versaoRoteador = `roteador-nsas@${opcoes.mapa.versao}`;

  return {
    dominiosRegistrados: Array.from(registro.keys()),
    async consultarDominios(dominios, caso) {
      const unicos = Array.from(new Set(dominios));
      const dominiosDesconhecidos: string[] = [];
      const alvos: ConsultarEspecialista[] = [];
      for (const d of unicos) {
        const adapter = registro.get(d);
        if (adapter) alvos.push(adapter);
        else dominiosDesconhecidos.push(d);
      }

      const resultados = await Promise.all(
        alvos.map((adapter) => executarComFalhaSuave(adapter, caso)),
      );

      const pareceres: NsasParecerParcial[] = [];
      const erros: ErroPacoteEspecialistas[] = [];
      for (const r of resultados) {
        if (r.tipo === 'ok') pareceres.push(r.parecer);
        else erros.push(r.erro);
      }
      for (const d of dominiosDesconhecidos) {
        erros.push({
          dominio: d,
          motivo: 'adapter_desconhecido',
          mensagem: `Nenhum adapter registrado para o domínio "${d}".`,
        });
      }

      return {
        versaoRoteador,
        pareceres,
        erros,
        versoesConsultadas: alvos.map((a) => a.versao),
        dominiosDesconhecidos,
      };
    },
  };
}

export function adaptersPadrao(mapa: MapaNormativo): ReadonlyArray<ConsultarEspecialista> {
  return [
    new PesquisaNormativaAdapter({ mapa }),
    criarEticaMedicaProntuario({ mapa }),
    criarComunicacaoMedicoPaciente({ mapa }),
    criarJuridicoSaudeSuplementar({ mapa }),
    criarComplianceRegulatorioLgpd({ mapa }),
    criarOperacionalDhAps({ mapa }),
    criarConsultoriaOrganizacional({ mapa }),
    criarIntegracaoSistemasMedico({ mapa }),
  ];
}

type ResultadoAdapter =
  | { readonly tipo: 'ok'; readonly parecer: NsasParecerParcial }
  | { readonly tipo: 'erro'; readonly erro: ErroPacoteEspecialistas };

async function executarComFalhaSuave(
  adapter: ConsultarEspecialista,
  caso: NsasCasoPseudonimizado,
): Promise<ResultadoAdapter> {
  try {
    const parecer = await adapter.consultar(caso);
    return { tipo: 'ok', parecer };
  } catch (erro) {
    if (erro instanceof ErroConsultaEspecialista) {
      return {
        tipo: 'erro',
        erro: { dominio: adapter.dominio, motivo: erro.motivo, mensagem: erro.message },
      };
    }
    return {
      tipo: 'erro',
      erro: {
        dominio: adapter.dominio,
        motivo: 'erro_interno',
        mensagem: erro instanceof Error ? erro.message : String(erro),
      },
    };
  }
}
