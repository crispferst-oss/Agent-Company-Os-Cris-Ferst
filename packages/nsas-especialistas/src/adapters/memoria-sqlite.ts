import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { PADROES_TERMOS_CLINICOS } from '@jev/nsas-ingresso';
import {
  ConsultarMemoriaInstitucional,
  ContextoMemoriaInstitucional,
  ErroMemoriaInstitucional,
  FiltroMemoria,
  NotaInstitucional,
  RegistrarMemoriaInstitucional,
  StatusValidacao,
} from '../memoria';

/**
 * Adapter SQLite (via `node:sqlite`, Node 22.11+) para memória institucional.
 *
 * Decisões de implementação, decorrentes do plano §4.5:
 * - usa `node:sqlite` (ao invés de `better-sqlite3`) porque o toolchain carimbado
 *   é Node 22.11.0 portátil, incompatível com better-sqlite3@13+ (que exige 22.13+);
 *   os testes rodam com `--experimental-sqlite`;
 * - schema versionado (`PRAGMA user_version`), migração explícita em `aplicarMigracoes`;
 * - transações nas escritas; consultas sempre parametrizadas;
 * - histórico preservado: `UPDATE` nunca sobrescreve conteúdo — correções geram
 *   novo registro com `versao_registro` incrementada e o anterior fica no mesmo
 *   `id` apenas se marcado `revogada` (política documentada no README do pacote);
 * - validação defensiva de segunda camada (plano §5.2) ocorre em `validarAntesDeGravar`:
 *   recusa conteúdo com termos clínicos canônicos ou identificadores pessoais
 *   óbvios (CPF, telefone, e-mail) — não substitui a validação upstream.
 */

const VERSAO_SCHEMA = 1;
const VERSAO_ADAPTER = `memoria-sqlite@v${VERSAO_SCHEMA}`;

// Padrões adicionais para a segunda camada de validação defensiva.
// Não substituem o fluxo de pseudonimização upstream (plano §5.1).
const PADRAO_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PADRAO_TELEFONE_BR = /\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/;
const PADRAO_EMAIL = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i;
const PADRAO_CID = /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/;
// Variante textual do padrão compartilhado — usa `\b` em vez de `[._-]`
// porque conteúdo corrido não respeita separadores de nome de arquivo.
// Os termos vêm literalmente de `PADROES_TERMOS_CLINICOS` (sem redefinir
// o conjunto, apenas a borda de palavra).
const PADRAO_TERMOS_CLINICOS_TEXTO = new RegExp(
  '\\b(?:' +
    PADROES_TERMOS_CLINICOS.source
      .replace(/^\(\^\|\[\._-\]\)/, '')
      .replace(/\(\[\._-\]\|\$\)$/, '')
      .replace(/^\(/, '')
      .replace(/\)$/, '') +
    ')\\b',
  'iu',
);

export interface OpcoesMemoriaSqlite {
  /** Caminho do arquivo SQLite ou `:memory:` para testes. */
  readonly caminho: string;
}

interface LinhaBruta {
  readonly id: string;
  readonly criada_em: string;
  readonly autora: string;
  readonly dominios: string;
  readonly conteudo_pseudonimizado: string;
  readonly origem: string;
  readonly referencia_documental: string | null;
  readonly status_validacao: string;
  readonly versao_registro: string;
}

export class MemoriaSqliteAdapter
  implements RegistrarMemoriaInstitucional, ConsultarMemoriaInstitucional
{
  readonly versao = VERSAO_ADAPTER;
  private readonly db: DatabaseSync;

  constructor(opcoes: OpcoesMemoriaSqlite) {
    try {
      this.db = new DatabaseSync(opcoes.caminho);
    } catch (erro) {
      throw new ErroMemoriaInstitucional(
        'armazenamento_indisponivel',
        `Falha ao abrir banco em '${opcoes.caminho}': ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
    this.aplicarMigracoes();
  }

  close(): void {
    this.db.close();
  }

  async registrar(nota: NotaInstitucional): Promise<void> {
    validarAntesDeGravar(nota);
    const dominios = JSON.stringify([...nota.dominios]);
    try {
      this.db.exec('BEGIN');
      const existente = this.db
        .prepare('SELECT 1 AS marcador FROM notas_institucionais WHERE id = ? AND versao_registro = ?')
        .get(nota.id, nota.versao_registro) as { marcador: number } | undefined;
      if (existente) {
        this.db.exec('ROLLBACK');
        throw new ErroMemoriaInstitucional(
          'nota_duplicada',
          `Nota ${nota.id} versão ${nota.versao_registro} já persistida; para corrigir, grave versão nova.`,
        );
      }
      this.db
        .prepare(
          `INSERT INTO notas_institucionais
           (id, criada_em, autora, dominios, conteudo_pseudonimizado, origem,
            referencia_documental, status_validacao, versao_registro)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          nota.id,
          nota.criada_em,
          nota.autora,
          dominios,
          nota.conteudo_pseudonimizado,
          nota.origem,
          nota.referencia_documental ?? null,
          nota.status_validacao,
          nota.versao_registro,
        );
      this.db.exec('COMMIT');
    } catch (erro) {
      if (erro instanceof ErroMemoriaInstitucional) throw erro;
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* ignora erro de rollback após falha */
      }
      throw new ErroMemoriaInstitucional(
        'interno',
        `Falha ao gravar nota ${nota.id}: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
  }

  async consultar(filtro: FiltroMemoria): Promise<ReadonlyArray<NotaInstitucional>> {
    if (!filtro.dominios || filtro.dominios.length === 0) {
      throw new ErroMemoriaInstitucional(
        'dominios_ausentes',
        'Consulta à memória institucional exige lista explícita de domínios (plano §4.4 regra 3).',
      );
    }
    const somenteValidadas = filtro.somente_validadas !== false;
    const limite = Math.max(1, Math.min(filtro.limite ?? 100, 500));

    const linhas = this.db
      .prepare(
        `SELECT id, criada_em, autora, dominios, conteudo_pseudonimizado, origem,
                referencia_documental, status_validacao, versao_registro
           FROM notas_institucionais
           ORDER BY criada_em DESC, id ASC`,
      )
      .all() as unknown as LinhaBruta[];

    const dominiosSolicitados = new Set(filtro.dominios);
    const notas: NotaInstitucional[] = [];
    for (const linha of linhas) {
      const nota = materializarNota(linha);
      if (somenteValidadas && nota.status_validacao !== 'validada') continue;
      if (!nota.dominios.some((d) => dominiosSolicitados.has(d))) continue;
      notas.push(nota);
      if (notas.length >= limite) break;
    }
    return notas;
  }

  async consultarComoContexto(
    filtro: FiltroMemoria,
  ): Promise<ContextoMemoriaInstitucional> {
    const notas = await this.consultar(filtro);
    return {
      versao_consulta: this.versao,
      consultada_em: new Date().toISOString(),
      dominios_consultados: [...filtro.dominios],
      notas,
      huella: calcularHuella(notas),
    };
  }

  private aplicarMigracoes(): void {
    const resultado = this.db.prepare('PRAGMA user_version').get() as
      | { user_version: number }
      | undefined;
    const versaoAtual = resultado?.user_version ?? 0;
    if (versaoAtual >= VERSAO_SCHEMA) return;
    this.db.exec('BEGIN');
    try {
      if (versaoAtual < 1) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS notas_institucionais (
            id TEXT NOT NULL,
            criada_em TEXT NOT NULL,
            autora TEXT NOT NULL,
            dominios TEXT NOT NULL,
            conteudo_pseudonimizado TEXT NOT NULL,
            origem TEXT NOT NULL,
            referencia_documental TEXT,
            status_validacao TEXT NOT NULL,
            versao_registro TEXT NOT NULL,
            PRIMARY KEY (id, versao_registro)
          );
          CREATE INDEX IF NOT EXISTS idx_notas_status ON notas_institucionais(status_validacao);
          CREATE INDEX IF NOT EXISTS idx_notas_criada_em ON notas_institucionais(criada_em DESC);
        `);
      }
      this.db.exec(`PRAGMA user_version = ${VERSAO_SCHEMA}`);
      this.db.exec('COMMIT');
    } catch (erro) {
      this.db.exec('ROLLBACK');
      throw new ErroMemoriaInstitucional(
        'armazenamento_indisponivel',
        `Falha ao aplicar migração: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
  }
}

export function validarAntesDeGravar(nota: NotaInstitucional): void {
  if (!nota.id || nota.id.trim().length === 0) {
    throw new ErroMemoriaInstitucional('validacao_falhou', 'Nota sem id.');
  }
  if (!nota.criada_em || Number.isNaN(Date.parse(nota.criada_em))) {
    throw new ErroMemoriaInstitucional('validacao_falhou', 'Nota com criada_em ausente ou inválida.');
  }
  if (!nota.autora || nota.autora.trim().length === 0) {
    throw new ErroMemoriaInstitucional('validacao_falhou', 'Nota sem autora institucional.');
  }
  if (!nota.origem || nota.origem.trim().length === 0) {
    throw new ErroMemoriaInstitucional('validacao_falhou', 'Nota sem origem documental.');
  }
  if (!nota.versao_registro || !/^v\d+(?:\.\d+)*$/.test(nota.versao_registro)) {
    throw new ErroMemoriaInstitucional(
      'validacao_falhou',
      `versao_registro deve seguir o formato "vN" ou "vN.M" (recebido: "${nota.versao_registro}").`,
    );
  }
  if (!Array.isArray(nota.dominios) || nota.dominios.length === 0) {
    throw new ErroMemoriaInstitucional('validacao_falhou', 'Nota sem domínios declarados.');
  }
  const statusValidos: StatusValidacao[] = ['pendente', 'validada', 'revogada'];
  if (!statusValidos.includes(nota.status_validacao)) {
    throw new ErroMemoriaInstitucional(
      'validacao_falhou',
      `status_validacao inválido: "${nota.status_validacao}".`,
    );
  }
  verificarConteudoSensivel(nota.conteudo_pseudonimizado);
}

function verificarConteudoSensivel(texto: string): void {
  if (!texto || texto.trim().length === 0) {
    throw new ErroMemoriaInstitucional('validacao_falhou', 'conteudo_pseudonimizado vazio.');
  }
  if (PADRAO_TERMOS_CLINICOS_TEXTO.test(texto)) {
    throw new ErroMemoriaInstitucional(
      'conteudo_sensivel_bruto',
      'Conteúdo contém termo clínico canônico (laudo/exame/prontuário/…). Pseudonimizar upstream antes de registrar.',
    );
  }
  if (PADRAO_CPF.test(texto)) {
    throw new ErroMemoriaInstitucional('conteudo_sensivel_bruto', 'Conteúdo contém CPF cru.');
  }
  if (PADRAO_EMAIL.test(texto)) {
    throw new ErroMemoriaInstitucional('conteudo_sensivel_bruto', 'Conteúdo contém e-mail cru.');
  }
  if (PADRAO_TELEFONE_BR.test(texto)) {
    throw new ErroMemoriaInstitucional('conteudo_sensivel_bruto', 'Conteúdo contém telefone cru.');
  }
  if (PADRAO_CID.test(texto)) {
    throw new ErroMemoriaInstitucional('conteudo_sensivel_bruto', 'Conteúdo contém código CID.');
  }
}

function materializarNota(linha: LinhaBruta): NotaInstitucional {
  return {
    id: linha.id,
    criada_em: linha.criada_em,
    autora: linha.autora,
    dominios: Object.freeze(JSON.parse(linha.dominios) as string[]),
    conteudo_pseudonimizado: linha.conteudo_pseudonimizado,
    origem: linha.origem,
    referencia_documental: linha.referencia_documental ?? undefined,
    status_validacao: linha.status_validacao as StatusValidacao,
    versao_registro: linha.versao_registro,
  };
}

export function calcularHuella(notas: ReadonlyArray<NotaInstitucional>): string {
  const chaves = notas
    .map((n) => `${n.id}@${n.versao_registro}`)
    .sort()
    .join('|');
  return createHash('sha256').update(chaves).digest('hex').slice(0, 16);
}
