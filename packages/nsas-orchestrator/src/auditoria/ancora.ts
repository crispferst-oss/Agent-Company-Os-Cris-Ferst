import { closeSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { canonicalJson } from '../canonical';

export interface CheckpointAuditoria {
  readonly quantidade: number;
  readonly ultimo_hash: string;
}

/** Operações síncronas: o repositório mantém o lock SQLite durante a atualização. */
export interface AncoraAuditoria {
  ler(): CheckpointAuditoria | null;
  inicializar(): void;
  gravar(checkpoint: CheckpointAuditoria): void;
}

const CheckpointSchema = z.object({
  quantidade: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ultimo_hash: z.string(),
}).strict().refine(c => c.quantidade === 0
  ? c.ultimo_hash === '' : /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(c.ultimo_hash));

/** Arquivo separado do banco. A custódia/backup deve preservar esta separação. */
export class AncoraArquivo implements AncoraAuditoria {
  readonly caminho: string;

  constructor(caminho: string) {
    this.caminho = resolve(caminho);
  }

  ler(): CheckpointAuditoria | null {
    try {
      return CheckpointSchema.parse(JSON.parse(readFileSync(this.caminho, 'utf8')));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error('Falha ao ler âncora de auditoria.', { cause: erro });
    }
  }

  inicializar(): void {
    try {
      const fd = openSync(this.caminho, 'wx', 0o600);
      try {
        writeFileSync(fd, canonicalJson({ quantidade: 0, ultimo_hash: '' }));
        fsyncSync(fd);
      } finally { closeSync(fd); }
    } catch (erro) {
      throw new Error('Não foi possível inicializar a âncora de auditoria.', { cause: erro });
    }
  }

  gravar(checkpoint: CheckpointAuditoria): void {
    const validado = CheckpointSchema.parse(checkpoint);
    if (!this.ler()) throw new Error('Âncora de auditoria ausente.');
    const temporario = `${this.caminho}.${randomUUID()}.tmp`;
    try {
      const fd = openSync(temporario, 'wx', 0o600);
      try {
        writeFileSync(fd, canonicalJson(validado));
        fsyncSync(fd);
      } finally { closeSync(fd); }
      renameSync(temporario, this.caminho);
    } catch (erro) {
      try { unlinkSync(temporario); } catch (limpeza) {
        if ((limpeza as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new AggregateError([erro, limpeza], 'Falha na gravação e limpeza da âncora.');
        }
      }
      throw new Error('Falha ao gravar âncora de auditoria.', { cause: erro });
    }
  }
}
