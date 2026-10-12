import { resolve } from 'node:path';
import { canonicalJson, sha256Base64url } from '../canonical';
import { ErroOrquestrador, type AuditLogRepository, type EventoAuditoria, type MotivoAuditoria } from '../contratos';
import { BancoNsasSqlite } from '../persistencia';
import { EventoAuditoriaSchema } from '../schemas';
import { AncoraArquivo, type AncoraAuditoria } from './ancora';

interface LinhaAuditoria {
  id: number;
  prev_hash: string;
  payload_canonico: string;
  hash: string;
}

type Verificacao = Awaited<ReturnType<AuditLogRepository['verificar']>>;
const falha = (indice: number, motivo: MotivoAuditoria): Verificacao => ({ ok: false, indice, motivo });

export class AuditSqliteRepository implements AuditLogRepository {
  constructor(private readonly banco: BancoNsasSqlite, private readonly ancora: AncoraAuditoria) {
    if (ancora instanceof AncoraArquivo && resolve(banco.caminho).toLowerCase() === ancora.caminho.toLowerCase()) {
      throw new Error('Âncora deve estar fora do arquivo SQLite.');
    }
  }

  /** Provisionamento explícito, apenas para banco novo. Nunca repara/resetta histórico. */
  inicializar(): void {
    this.banco.transacao(() => {
      const linha = this.banco.db.prepare('SELECT COUNT(*) AS total FROM auditoria').get();
      if (linha?.total !== 0 || this.ancora.ler() !== null) {
        throw new Error('Auditoria já inicializada ou histórico existente.');
      }
      this.ancora.inicializar();
    });
  }

  async anexar(evento: EventoAuditoria): Promise<void> {
    const validado = EventoAuditoriaSchema.parse(evento);
    // Campo opcional explicitamente undefined não pertence ao JSON assinado.
    const serializavel = validado.caso_id === undefined
      ? { tipo: validado.tipo, horario: validado.horario, payload: validado.payload } : validado;
    const payload = canonicalJson(serializavel);
    this.banco.transacao(() => {
      const verificacao = this.verificarInterno();
      if (!verificacao.ok) throw new ErroOrquestrador('auditoria_corrompida', 'Auditoria divergente da âncora confiável.');
      const anterior = this.ancora.ler()!;
      const hash = sha256Base64url(canonicalJson({ prev_hash: anterior.ultimo_hash, evento: serializavel }));
      this.banco.db.prepare('INSERT INTO auditoria (id, prev_hash, payload_canonico, hash) VALUES (?, ?, ?, ?)')
        .run(anterior.quantidade + 1, anterior.ultimo_hash, payload, hash);
      // Âncora primeiro: falha/interrupção antes de COMMIT deixa divergência detectável.
      // Não há transação distribuída; nunca reverter a âncora para esconder a falha.
      this.ancora.gravar({ quantidade: anterior.quantidade + 1, ultimo_hash: hash });
    });
  }

  async verificar(): Promise<Verificacao> {
    // Mesma trava dos escritores: snapshot SQLite e âncora não podem ser lidos entre updates.
    return this.banco.transacao(() => this.verificarInterno());
  }

  private verificarInterno(): Verificacao {
    let checkpoint;
    try { checkpoint = this.ancora.ler(); } catch { return falha(0, 'cadeia_quebrada'); }
    if (!checkpoint) return falha(0, 'cadeia_quebrada');
    const linhas = this.banco.db.prepare('SELECT id, prev_hash, payload_canonico, hash FROM auditoria ORDER BY id').all() as unknown as LinhaAuditoria[];
    let anterior = '';
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (linha.id !== i + 1 || linha.prev_hash !== anterior) return falha(i + 1, 'cadeia_quebrada');
      let evento;
      try {
        evento = JSON.parse(linha.payload_canonico);
        if (!EventoAuditoriaSchema.safeParse(evento).success || canonicalJson(evento) !== linha.payload_canonico) {
          return falha(i + 1, 'payload_adulterado');
        }
      } catch { return falha(i + 1, 'payload_adulterado'); }
      const calculado = sha256Base64url(canonicalJson({ prev_hash: anterior, evento }));
      if (calculado !== linha.hash) return falha(i + 1, 'hash_divergente');
      anterior = linha.hash;
    }
    if (checkpoint.quantidade !== linhas.length) return falha(Math.min(checkpoint.quantidade, linhas.length) + 1, 'cadeia_quebrada');
    if (checkpoint.ultimo_hash !== anterior) return falha(linhas.length, 'hash_divergente');
    return { ok: true };
  }
}
