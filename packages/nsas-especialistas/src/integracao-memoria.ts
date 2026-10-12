import {
  ConsultarMemoriaInstitucional,
  ContextoMemoriaInstitucional,
  ErroMemoriaInstitucional,
} from './memoria';
import type { PacoteConsultaEspecialistas } from './roteador';
import { MemoriaSqliteAdapter, calcularHuella } from './adapters/memoria-sqlite';

/**
 * Camada de integração entre `RoteadorEspecialistas` e `RedatorNotaTecnica`
 * (plano §6.1): consulta a memória institucional **antes** da composição
 * documental, nunca a partir do redator.
 *
 * O redator continua puro — recebe um `ContextoMemoriaInstitucional`
 * imutável (ou `null`) e nunca abre conexões.
 */

export interface OpcoesIntegracao {
  readonly memoria: ConsultarMemoriaInstitucional;
  readonly limite?: number;
  readonly somente_validadas?: boolean;
}

/**
 * Deriva os domínios que efetivamente devem puxar memória — usa a lista de
 * especialistas que **de fato produziram parecer**, não a lista nominal
 * passada ao roteador (plano §4.4 regra 3: filtragem por domínio explícita).
 */
export function dominiosDoPacote(pacote: PacoteConsultaEspecialistas): ReadonlyArray<string> {
  return Array.from(new Set(pacote.versoesConsultadas.map((v) => v.split('@')[0]).filter(Boolean)));
}

export async function consultarMemoriaParaPacote(
  pacote: PacoteConsultaEspecialistas,
  opcoes: OpcoesIntegracao,
): Promise<ContextoMemoriaInstitucional> {
  const dominios = dominiosDoPacote(pacote);
  if (dominios.length === 0) {
    return {
      versao_consulta: opcoes.memoria.versao,
      consultada_em: new Date().toISOString(),
      dominios_consultados: [],
      notas: [],
      huella: calcularHuella([]),
    };
  }
  if (opcoes.memoria instanceof MemoriaSqliteAdapter) {
    return opcoes.memoria.consultarComoContexto({
      dominios,
      limite: opcoes.limite,
      somente_validadas: opcoes.somente_validadas,
    });
  }
  try {
    const notas = await opcoes.memoria.consultar({
      dominios,
      limite: opcoes.limite,
      somente_validadas: opcoes.somente_validadas,
    });
    return {
      versao_consulta: opcoes.memoria.versao,
      consultada_em: new Date().toISOString(),
      dominios_consultados: dominios,
      notas,
      huella: calcularHuella(notas),
    };
  } catch (erro) {
    if (erro instanceof ErroMemoriaInstitucional) throw erro;
    throw new ErroMemoriaInstitucional(
      'interno',
      `Falha ao consultar memória institucional: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  }
}
