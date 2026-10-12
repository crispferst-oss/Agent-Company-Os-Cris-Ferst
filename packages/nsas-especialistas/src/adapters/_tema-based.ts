import type { NsasCasoPseudonimizado, NsasParecerParcial } from '@jev/shared-types';
import { ConsultarEspecialista, ErroConsultaEspecialista } from '../port';
import type { EntradaNormativa, MapaNormativo } from '../mapa-normativo';

/**
 * Base compartilhada por adapters que raciocinam por **temas**:
 * (1) regex sobre `fato_juridico` detecta temas,
 * (2) cada tema puxa eixos específicos do mapa normativo,
 * (3) cada tema injeta riscos próprios (código, não dado — ver débito registrado
 *     em `project_porta_consultar_especialista`).
 *
 * Difere do `pesquisa-normativa`, que faz busca por tokens sobre o mapa inteiro.
 */

export interface EntradaTema<T extends string> {
  readonly tema: T;
  readonly regex: RegExp;
  readonly eixos: ReadonlyArray<number>;
  readonly riscos: ReadonlyArray<string>;
}

export interface ConfigAdapterTemas<T extends string> {
  readonly dominio: string;
  readonly mapa: MapaNormativo;
  readonly temas: ReadonlyArray<EntradaTema<T>>;
  readonly rotuloTema: (tema: T) => string;
  /** Frase da lacuna informando que temas eram esperados. */
  readonly mensagemLacuna: string;
  /** Frase de delegação a pesquisa-normativa (invariante #6). */
  readonly mensagemDelegacao: string;
}

export function criarAdapterTemas<T extends string>(
  config: ConfigAdapterTemas<T>,
): ConsultarEspecialista {
  if (!config.mapa || config.mapa.entradas.length === 0) {
    throw new Error(`${config.dominio}: requer mapa normativo não vazio.`);
  }
  const versao = `${config.dominio}@${config.mapa.versao}`;

  return {
    dominio: config.dominio,
    versao,
    async consultar(caso: NsasCasoPseudonimizado): Promise<NsasParecerParcial> {
      if (!caso.fato_juridico || caso.fato_juridico.trim().length === 0) {
        throw new ErroConsultaEspecialista(
          config.dominio,
          'caso_invalido',
          `${config.dominio}: fato_juridico vazio.`,
        );
      }

      const detectados = config.temas.filter((t) => t.regex.test(caso.fato_juridico));
      if (detectados.length === 0) {
        return parecerDeLacuna(config);
      }

      const eixosRelevantes = Array.from(new Set(detectados.flatMap((t) => t.eixos)));
      const normas = config.mapa.entradas.filter((e) => eixosRelevantes.includes(e.eixo));

      return montarParecer(config, caso.fato_juridico, detectados, normas);
    },
  };
}

function parecerDeLacuna<T extends string>(
  config: ConfigAdapterTemas<T>,
): NsasParecerParcial {
  return {
    especialista: config.dominio,
    fatos: [config.mensagemLacuna],
    fundamentos: [],
    riscos: [
      `Lacuna identificada no domínio "${config.dominio}". Nenhum tema foi reconhecido no fato_juridico. ` +
        'O NSAS não produziu parecer técnico substitutivo; a lacuna fica registrada para avaliação. ' +
        'O caso pode pertencer a outro especialista, exigir pesquisa-normativa como nó irmão, ou ' +
        'ser reescrito pelo tradutor da borda com termos deste domínio.',
    ],
    fontes: [fonteDoMapa(config.mapa)],
  };
}

function montarParecer<T extends string>(
  config: ConfigAdapterTemas<T>,
  fato: string,
  detectados: ReadonlyArray<EntradaTema<T>>,
  normas: ReadonlyArray<EntradaNormativa>,
): NsasParecerParcial {
  const fatos = detectados.map(
    (t) => `Tema detectado: ${config.rotuloTema(t.tema)} (eixos ${t.eixos.join(', ')}).`,
  );

  const fundamentos = normas.map((e) => ({
    norma: `${e.norma} — ${e.numeroAno}`,
    aplicacao: e.aplicacaoConsultorio,
  }));

  const riscos: string[] = [];
  for (const t of detectados) riscos.push(...t.riscos);
  for (const e of normas) {
    if (e.revogada) {
      riscos.push(
        `${e.norma} (${e.numeroAno}) consta como revogada no mapa v${config.mapa.versao}; usar apenas para contraste.`,
      );
    }
    if (e.precisaVerificarVigencia) {
      riscos.push(
        `${e.norma} (${e.numeroAno}) marcada [verificar vigência]; delegar confirmação à pesquisa-normativa antes de citar em Nota Técnica.`,
      );
    }
  }
  riscos.push(config.mensagemDelegacao);

  const fontes = [
    fonteDoMapa(config.mapa),
    `fato_juridico analisado: "${resumir(fato, 120)}"`,
  ];

  return { especialista: config.dominio, fatos, fundamentos, riscos, fontes };
}

function fonteDoMapa(mapa: MapaNormativo): string {
  return `.claude/references/mapa-normativo-v${mapa.versao}.md (consulta ${mapa.dataConsulta})`;
}

function resumir(texto: string, limite: number): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length <= limite ? t : t.slice(0, limite - 1) + '…';
}
