import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { CasoPersistido, CasoRepository, EstadoCaso, Relogio, AprovacaoRepository, AprovacaoAssinada } from '../contratos';
import { canonicalJson } from '../canonical';
import { PlanoConsultaSchema, AprovacaoAssinadaSchema } from '../schemas';
import { ErroOrquestrador } from '../contratos';

const uuid = z.string().uuid();
const hashSchema = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
const estadoSchema = z.enum(['iniciado', 'classificado', 'executando', 'rascunho', 'aprovado', 'rejeitado', 'emitido', 'abortado']);
const casoSchema = z.object({ caso_id: uuid, estado: estadoSchema, criado_em: z.string().datetime(), atualizado_em: z.string().datetime(), plano: PlanoConsultaSchema.optional(), rascunho_hash: hashSchema.optional() }).strict();

/** Deliberadamente não inclui causa SQL, payload ou caminho em mensagens. */
export class ErroPersistencia extends Error {
  constructor() { super('Falha na persistência NSAS.'); this.name = 'ErroPersistencia'; }
}
function seguro<T>(operacao: () => T): T {
  try { return operacao(); } catch (erro) {
    if (erro instanceof ErroOrquestrador) throw erro;
    // O erro SQL pode conter conteúdo sensível; não preservar a causa.
    throw new ErroPersistencia();
  }
}

export class BancoNsasSqlite {
  readonly db: DatabaseSync;
  private fechado = false;
  constructor(readonly caminho: string) {
    this.db = seguro(() => new DatabaseSync(caminho));
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      this.transacao(() => {
        const versao = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
        if (versao > 1) throw new ErroPersistencia();
        if (versao === 1) return;
        this.db.exec(`
          CREATE TABLE caso (caso_id TEXT PRIMARY KEY NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('iniciado','classificado','executando','rascunho','aprovado','rejeitado','emitido','abortado')), criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);
          CREATE TABLE plano (caso_id TEXT PRIMARY KEY REFERENCES caso(caso_id), payload_canonico TEXT NOT NULL);
          CREATE TABLE operacao (caso_id TEXT NOT NULL REFERENCES caso(caso_id), chave_operacao TEXT NOT NULL, resultado TEXT NOT NULL, UNIQUE(caso_id,chave_operacao));
          CREATE TABLE execucao_no (caso_id TEXT NOT NULL REFERENCES caso(caso_id), no_id TEXT NOT NULL, estado TEXT NOT NULL, resultado TEXT, PRIMARY KEY(caso_id,no_id));
          CREATE TABLE rascunho (caso_id TEXT PRIMARY KEY REFERENCES caso(caso_id), hash TEXT NOT NULL, conteudo TEXT NOT NULL, UNIQUE(caso_id,hash));
          CREATE TABLE aprovacao (caso_id TEXT NOT NULL, rascunho_hash TEXT NOT NULL, payload_canonico TEXT NOT NULL, PRIMARY KEY(caso_id,rascunho_hash), FOREIGN KEY(caso_id,rascunho_hash) REFERENCES rascunho(caso_id,hash));
          CREATE TABLE emissao (caso_id TEXT PRIMARY KEY REFERENCES caso(caso_id), manifesto_canonico TEXT NOT NULL);
          CREATE TABLE auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT, prev_hash TEXT NOT NULL, payload_canonico TEXT NOT NULL, hash TEXT NOT NULL);
          CREATE TRIGGER auditoria_sem_update BEFORE UPDATE ON auditoria BEGIN SELECT RAISE(ABORT,'auditoria imutavel'); END;
          CREATE TRIGGER auditoria_sem_delete BEFORE DELETE ON auditoria BEGIN SELECT RAISE(ABORT,'auditoria imutavel'); END;
          CREATE TRIGGER rascunho_sem_update BEFORE UPDATE ON rascunho BEGIN SELECT RAISE(ABORT,'rascunho imutavel'); END;
          CREATE TRIGGER rascunho_sem_delete BEFORE DELETE ON rascunho BEGIN SELECT RAISE(ABORT,'rascunho imutavel'); END;
          CREATE TRIGGER aprovacao_sem_update BEFORE UPDATE ON aprovacao BEGIN SELECT RAISE(ABORT,'aprovacao imutavel'); END;
          CREATE TRIGGER aprovacao_sem_delete BEFORE DELETE ON aprovacao BEGIN SELECT RAISE(ABORT,'aprovacao imutavel'); END;
          PRAGMA user_version = 1;
        `);
      });
    } catch { this.close(); throw new ErroPersistencia(); }
  }
  transacao<T>(operacao: () => T): T {
    return seguro(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const resultado = operacao();
        if (resultado && typeof (resultado as { then?: unknown }).then === 'function') throw new ErroPersistencia();
        this.db.exec('COMMIT');
        return resultado;
      } catch (erro) {
        this.db.exec('ROLLBACK');
        if (erro instanceof ErroOrquestrador) throw erro;
        throw new ErroPersistencia();
      }
    });
  }
  close(): void { if (!this.fechado) { this.db.close(); this.fechado = true; } }
}

export class CasoSqliteRepository implements CasoRepository {
  constructor(private readonly banco: BancoNsasSqlite, private readonly relogio: Relogio) {}
  private ler(caso_id: string): CasoPersistido | null {
    const linha = this.banco.db.prepare('SELECT c.*, p.payload_canonico AS plano, r.hash AS rascunho_hash FROM caso c LEFT JOIN plano p USING(caso_id) LEFT JOIN rascunho r USING(caso_id) WHERE c.caso_id = ?').get(uuid.parse(caso_id));
    if (!linha) return null;
    const { plano, rascunho_hash, ...campos } = linha;
    return casoSchema.parse({ ...campos, ...(plano === null ? {} : { plano: JSON.parse(String(plano)) }), ...(rascunho_hash === null ? {} : { rascunho_hash }) });
  }
  async obter(caso_id: string): Promise<CasoPersistido | null> { return seguro(() => this.ler(caso_id)); }
  async salvarIdempotente(caso: CasoPersistido, chave_operacao: string): Promise<CasoPersistido> {
    return this.banco.transacao(() => {
      const entrada = casoSchema.parse(caso);
      z.string().min(1).parse(chave_operacao);
      const db = this.banco.db;
      const repetida = db.prepare('SELECT resultado FROM operacao WHERE caso_id=? AND chave_operacao=?').get(entrada.caso_id, chave_operacao);
      if (repetida) return casoSchema.parse(JSON.parse(String(repetida.resultado)));
      db.prepare('INSERT OR IGNORE INTO caso(caso_id,estado,criado_em,atualizado_em) VALUES (?,?,?,?)').run(entrada.caso_id, entrada.estado, entrada.criado_em, entrada.atualizado_em);
      if (entrada.plano) db.prepare('INSERT OR IGNORE INTO plano(caso_id,payload_canonico) VALUES (?,?)').run(entrada.caso_id, canonicalJson(entrada.plano));
      const atual = this.ler(entrada.caso_id);
      if (!atual || (entrada.rascunho_hash && atual.rascunho_hash !== entrada.rascunho_hash)) throw new ErroPersistencia();
      db.prepare('INSERT OR IGNORE INTO operacao(caso_id,chave_operacao,resultado) VALUES (?,?,?)').run(entrada.caso_id, chave_operacao, canonicalJson(atual));
      const linha = db.prepare('SELECT resultado FROM operacao WHERE caso_id=? AND chave_operacao=?').get(entrada.caso_id, chave_operacao);
      return casoSchema.parse(JSON.parse(String(linha?.resultado)));
    });
  }
  async atualizarEstado(caso_id: string, estado: EstadoCaso): Promise<void> {
    this.banco.transacao(() => {
      const resultado = this.banco.db.prepare('UPDATE caso SET estado=?, atualizado_em=? WHERE caso_id=?').run(estadoSchema.parse(estado), z.string().datetime().parse(this.relogio.agora()), uuid.parse(caso_id));
      if (resultado.changes !== 1) throw new ErroPersistencia();
    });
  }
  async salvarRascunho(caso_id: string, hash: string, conteudo: string): Promise<void> {
    this.banco.transacao(() => {
      uuid.parse(caso_id); hashSchema.parse(hash); z.string().min(1).parse(conteudo);
      this.banco.db.prepare('INSERT OR IGNORE INTO rascunho(caso_id,hash,conteudo) VALUES (?,?,?)').run(caso_id, hash, conteudo);
      const salvo = this.banco.db.prepare('SELECT hash,conteudo FROM rascunho WHERE caso_id=?').get(caso_id);
      if (salvo?.hash !== hash || salvo.conteudo !== conteudo) throw new ErroPersistencia();
    });
  }
  async obterRascunho(caso_id: string): Promise<{ hash: string; conteudo: string } | null> {
    return seguro(() => {
      const salvo = this.banco.db.prepare('SELECT hash,conteudo FROM rascunho WHERE caso_id=?').get(uuid.parse(caso_id));
      return salvo ? { hash: hashSchema.parse(salvo.hash), conteudo: z.string().min(1).parse(salvo.conteudo) } : null;
    });
  }
}

export class AprovacaoSqliteRepository implements AprovacaoRepository {
  constructor(private readonly banco: BancoNsasSqlite) {}
  async registrar(aprovacao: AprovacaoAssinada): Promise<void> {
    this.banco.transacao(() => {
      const valor = AprovacaoAssinadaSchema.parse(aprovacao);
      const payload = canonicalJson(valor);
      this.banco.db.prepare('INSERT OR IGNORE INTO aprovacao(caso_id,rascunho_hash,payload_canonico) VALUES (?,?,?)').run(valor.caso_id, valor.rascunho_hash, payload);
      const salvo = this.banco.db.prepare('SELECT payload_canonico FROM aprovacao WHERE caso_id=? AND rascunho_hash=?').get(valor.caso_id, valor.rascunho_hash);
      if (salvo?.payload_canonico !== payload) throw new ErroPersistencia();
    });
  }
  async obterPorHash(caso_id: string, rascunho_hash: string): Promise<AprovacaoAssinada | null> {
    return seguro(() => {
      const salvo = this.banco.db.prepare('SELECT payload_canonico FROM aprovacao WHERE caso_id=? AND rascunho_hash=?').get(uuid.parse(caso_id), hashSchema.parse(rascunho_hash));
      return salvo ? AprovacaoAssinadaSchema.parse(JSON.parse(String(salvo.payload_canonico))) : null;
    });
  }
}
