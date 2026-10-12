import type { NsasCasoPseudonimizado, NsasParecerParcial } from '@jev/shared-types';

/**
 * Porta única `ConsultarEspecialista` definida pelo
 * [ADR-007](../../../.claude/decisions/ADR-007-orquestrador-como-application-service.md).
 *
 * Contrato:
 * - entrada: domínio (identificador do especialista) + caso pseudonimizado
 *   (invariante #2 do orquestrador: nunca dado clínico bruto)
 * - saída: `NsasParecerParcial` no formato ADR-002
 *   ({fatos, fundamentos, riscos, fontes})
 * - um adapter concreto por agente de `.claude/agents/` (15 especialistas NSAS)
 * - recursão zero entre especialistas (invariante #6); especialista não chama
 *   outro especialista pela porta
 */
export interface ConsultarEspecialista {
  /**
   * Identificador estável do domínio/especialista
   * (ex.: 'pesquisa-normativa', 'etica-medica-prontuario').
   */
  readonly dominio: string;

  /**
   * Versão do adapter — carimbo exigido pela invariante #8 do orquestrador.
   */
  readonly versao: string;

  /**
   * Executa a consulta ao especialista.
   * Entrada opaca ao núcleo: adapter NÃO deve mutar o caso.
   */
  consultar(caso: NsasCasoPseudonimizado): Promise<NsasParecerParcial>;
}

/**
 * Erro estrutural de consulta ao especialista — propagado ao orquestrador
 * para política de abort/degrade declarada pelo Classificador (invariante #5).
 */
export class ErroConsultaEspecialista extends Error {
  constructor(
    public readonly dominio: string,
    public readonly motivo: 'fonte_indisponivel' | 'caso_invalido' | 'timeout' | 'interno',
    message: string,
  ) {
    super(message);
    this.name = 'ErroConsultaEspecialista';
  }
}
