import { readFileSync } from 'node:fs';

/**
 * Linha do mapa normativo (uma norma). Reflete o cabeçalho da tabela
 * em `.claude/references/mapa-normativo-v1.md`:
 * | norma | nº/ano | hierarquia | status | aplicação-consultório |
 */
export interface EntradaNormativa {
  readonly eixo: number;
  readonly eixoTitulo: string;
  readonly norma: string;
  readonly numeroAno: string;
  readonly hierarquia: string;
  readonly status: string;
  readonly aplicacaoConsultorio: string;
  readonly precisaVerificarVigencia: boolean;
  readonly revogada: boolean;
}

export interface MapaNormativo {
  readonly versao: string;
  readonly dataConsulta: string;
  readonly entradas: ReadonlyArray<EntradaNormativa>;
}

const REGEX_LINHA_TABELA = /^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|\s*$/;
const REGEX_EIXO = /^## Eixo (\d+)\s+[—-]\s+(.+)$/;
const REGEX_VERSAO = /^-\s+\*\*Versão:\*\*\s*(.+)$/;
const REGEX_DATA = /^-\s+\*\*Data de consulta:\*\*\s*(.+)$/;

/**
 * Carrega e parseia o mapa normativo canônico.
 * Fail-fast: um mapa malformado é defeito de deploy, não de runtime.
 */
export function carregarMapaNormativo(caminho: string): MapaNormativo {
  const texto = readFileSync(caminho, 'utf8');
  return parsearMapaNormativo(texto);
}

export function parsearMapaNormativo(texto: string): MapaNormativo {
  const linhas = texto.split(/\r?\n/);
  let versao = '';
  let dataConsulta = '';
  let eixoAtual = 0;
  let eixoTituloAtual = '';
  let cabecalhoLido = false;
  const entradas: EntradaNormativa[] = [];

  for (const linha of linhas) {
    const matchVersao = REGEX_VERSAO.exec(linha);
    if (matchVersao) {
      versao = matchVersao[1].trim();
      continue;
    }
    const matchData = REGEX_DATA.exec(linha);
    if (matchData) {
      dataConsulta = matchData[1].trim();
      continue;
    }
    const matchEixo = REGEX_EIXO.exec(linha);
    if (matchEixo) {
      eixoAtual = Number(matchEixo[1]);
      eixoTituloAtual = matchEixo[2].trim();
      cabecalhoLido = false;
      continue;
    }
    const matchLinha = REGEX_LINHA_TABELA.exec(linha);
    if (!matchLinha || eixoAtual === 0) continue;

    const colunas = matchLinha.slice(1).map((c) => c.trim());
    const primeira = colunas[0].toLowerCase();

    if (primeira === 'norma' || primeira.startsWith('---')) {
      cabecalhoLido = true;
      continue;
    }
    if (!cabecalhoLido) continue;

    const status = colunas[3];
    entradas.push({
      eixo: eixoAtual,
      eixoTitulo: eixoTituloAtual,
      norma: colunas[0],
      numeroAno: colunas[1],
      hierarquia: colunas[2],
      status,
      aplicacaoConsultorio: colunas[4],
      precisaVerificarVigencia: /\[verificar vig[eê]ncia\]/i.test(status),
      revogada: /revogada/i.test(status),
    });
  }

  if (!versao || !dataConsulta || entradas.length === 0) {
    throw new Error(
      `Mapa normativo malformado: versao='${versao}', dataConsulta='${dataConsulta}', entradas=${entradas.length}`,
    );
  }

  return { versao, dataConsulta, entradas };
}
