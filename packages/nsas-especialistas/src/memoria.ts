/**
 * Memória institucional auditável — importação controlada do padrão
 * `shared_memory` do `router_mesh_starter`, submetida às invariantes do NSAS:
 *
 * - duas portas independentes (`Registrar` e `Consultar`) — o redator **não**
 *   grava, modifica, cancela ou exclui notas (plano §4.2);
 * - toda consulta é filtrada por domínios explícitos (plano §4.4 regra 3);
 * - só retornam notas com `status_validacao === 'validada'` no fluxo canônico
 *   (plano §4.4 regra 2);
 * - resultados ordenados por `criada_em` descendente, desempate por `id`
 *   (regra 4);
 * - conteúdo é dado contextual, **nunca** instrução executável (regra 6);
 * - falha de consulta é sinalizada por erro tipado, nunca substituída por
 *   informação presumida (regra 9).
 *
 * O contrato é puro: a dependência deste módulo recai sobre as portas, não
 * sobre a implementação concreta de persistência (ver `adapters/memoria-sqlite`).
 */

export type StatusValidacao = 'pendente' | 'validada' | 'revogada';

export interface NotaInstitucional {
  readonly id: string;
  readonly criada_em: string;
  readonly autora: string;
  readonly dominios: ReadonlyArray<string>;
  readonly conteudo_pseudonimizado: string;
  readonly origem: string;
  readonly referencia_documental?: string;
  readonly status_validacao: StatusValidacao;
  readonly versao_registro: string;
}

export interface FiltroMemoria {
  readonly dominios: ReadonlyArray<string>;
  readonly limite?: number;
  readonly somente_validadas?: boolean;
}

export interface RegistrarMemoriaInstitucional {
  readonly versao: string;
  registrar(nota: NotaInstitucional): Promise<void>;
}

export interface ConsultarMemoriaInstitucional {
  readonly versao: string;
  consultar(filtro: FiltroMemoria): Promise<ReadonlyArray<NotaInstitucional>>;
}

/**
 * Erro tipado para falhas de registro ou consulta de memória institucional.
 * Nunca deve ser capturado silenciosamente — a camada chamadora precisa decidir
 * entre abortar o fluxo ou degradar explicitamente (plano §4.4 regra 9).
 */
export class ErroMemoriaInstitucional extends Error {
  constructor(
    public readonly motivo:
      | 'validacao_falhou'
      | 'conteudo_sensivel_bruto'
      | 'dominios_ausentes'
      | 'nota_duplicada'
      | 'armazenamento_indisponivel'
      | 'nota_nao_encontrada'
      | 'interno',
    message: string,
  ) {
    super(message);
    this.name = 'ErroMemoriaInstitucional';
  }
}

/**
 * Pacote de contexto institucional entregue ao redator — snapshot imutável
 * e versionado para preservar reprodutibilidade (plano §6.4).
 *
 * `huella` é um identificador estável do conjunto (hash hex sobre id + versão
 * de cada registro), permitindo rastreabilidade de qual exato subconjunto
 * participou da composição de uma Nota Técnica.
 */
export interface ContextoMemoriaInstitucional {
  readonly versao_consulta: string;
  readonly consultada_em: string;
  readonly dominios_consultados: ReadonlyArray<string>;
  readonly notas: ReadonlyArray<NotaInstitucional>;
  readonly huella: string;
}
