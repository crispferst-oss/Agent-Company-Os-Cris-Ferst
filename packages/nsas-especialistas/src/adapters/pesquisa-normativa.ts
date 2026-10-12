import type { NsasCasoPseudonimizado, NsasParecerParcial } from '@jev/shared-types';
import { ConsultarEspecialista, ErroConsultaEspecialista } from '../port';
import type { EntradaNormativa, MapaNormativo } from '../mapa-normativo';

export interface OpcoesPesquisaNormativa {
  readonly mapa: MapaNormativo;
  readonly eixosRestricao?: ReadonlyArray<number>;
  readonly limite?: number;
}

const LIMITE_PADRAO = 15;

/**
 * Adapter `pesquisa-normativa` — primeiro implementador da porta
 * `ConsultarEspecialista` (ADR-007).
 *
 * Papel: especialista transversal em busca de normas. Casado com o agente
 * `.claude/agents/pesquisa-normativa.md` e com o mapa canônico em
 * `.claude/references/mapa-normativo-v1.md` (via loader).
 *
 * Regras herdadas do agente:
 * - Nunca inventa norma — só retorna o que está no mapa.
 * - Marca risco quando entrada está `[verificar vigência]` ou `revogada`.
 * - Sempre registra fonte (arquivo + versão + data de consulta).
 * - Entrada opaca: NÃO muta o caso recebido.
 */
export class PesquisaNormativaAdapter implements ConsultarEspecialista {
  readonly dominio = 'pesquisa-normativa';
  readonly versao: string;

  constructor(private readonly opcoes: OpcoesPesquisaNormativa) {
    if (!opcoes.mapa || opcoes.mapa.entradas.length === 0) {
      throw new Error('PesquisaNormativaAdapter requer mapa normativo não vazio.');
    }
    this.versao = `pesquisa-normativa@${opcoes.mapa.versao}`;
  }

  async consultar(caso: NsasCasoPseudonimizado): Promise<NsasParecerParcial> {
    if (!caso.fato_juridico || caso.fato_juridico.trim().length === 0) {
      throw new ErroConsultaEspecialista(
        this.dominio,
        'caso_invalido',
        'Caso sem fato_juridico; pesquisa normativa precisa de termo de busca.',
      );
    }

    const termos = extrairTermosBusca(caso.fato_juridico);
    const limite = this.opcoes.limite ?? LIMITE_PADRAO;
    const encontradas = buscarNormas(this.opcoes.mapa, termos, this.opcoes.eixosRestricao, limite);

    return montarParecer(this.dominio, this.opcoes.mapa, encontradas);
  }
}

function extrairTermosBusca(fato: string): ReadonlyArray<string> {
  return fato
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

function buscarNormas(
  mapa: MapaNormativo,
  termos: ReadonlyArray<string>,
  eixosRestricao: ReadonlyArray<number> | undefined,
  limite: number,
): ReadonlyArray<EntradaNormativa> {
  const candidatos = eixosRestricao && eixosRestricao.length > 0
    ? mapa.entradas.filter((e) => eixosRestricao.includes(e.eixo))
    : mapa.entradas;

  const pontuadas = candidatos.map((entrada) => {
    const corpus = `${entrada.norma} ${entrada.aplicacaoConsultorio} ${entrada.eixoTitulo}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const pontos = termos.reduce((acc, t) => (corpus.includes(t) ? acc + 1 : acc), 0);
    return { entrada, pontos };
  });

  return pontuadas
    .filter((p) => p.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map((p) => p.entrada);
}

function montarParecer(
  especialista: string,
  mapa: MapaNormativo,
  entradas: ReadonlyArray<EntradaNormativa>,
): NsasParecerParcial {
  if (entradas.length === 0) {
    return {
      especialista,
      fatos: ['Nenhuma norma do mapa canônico correspondeu aos termos do caso.'],
      fundamentos: [],
      riscos: [
        'Ausência de norma pertinente no mapa v' + mapa.versao +
          ' pode indicar lacuna do mapa, não ausência de norma vigente. ' +
          'Reformular o fato_juridico ou expandir o mapa antes de concluir.',
      ],
      fontes: [`.claude/references/mapa-normativo-v${mapa.versao}.md (consulta ${mapa.dataConsulta})`],
    };
  }

  const fatos = entradas.map(
    (e) => `${e.norma} (${e.numeroAno}) — eixo ${e.eixo}: ${e.eixoTitulo}`,
  );

  const fundamentos = entradas.map((e) => ({
    norma: `${e.norma} — ${e.numeroAno}`,
    aplicacao: e.aplicacaoConsultorio,
  }));

  const riscos: string[] = [];
  for (const e of entradas) {
    if (e.revogada) {
      riscos.push(`${e.norma} (${e.numeroAno}) consta como revogada — citar apenas para contraste histórico.`);
    }
    if (e.precisaVerificarVigencia) {
      riscos.push(`${e.norma} (${e.numeroAno}) marcada [verificar vigência] no mapa v${mapa.versao}; confirmar antes de citar em Nota Técnica.`);
    }
  }

  const fontes = [
    `.claude/references/mapa-normativo-v${mapa.versao}.md (consulta ${mapa.dataConsulta})`,
  ];

  return { especialista, fatos, fundamentos, riscos, fontes };
}
