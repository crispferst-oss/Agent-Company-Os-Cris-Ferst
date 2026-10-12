import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { canonicalJson } from '../canonical';
import { ErroOrquestrador, type AprovacaoAssinada, type AssinadorOab, type Decisao } from '../contratos';

/**
 * Assinador OAB concreto.
 *
 * Contrato de segurança (card 05):
 *   - chave privada em arquivo externo PKCS#8 PEM encriptado por passphrase;
 *   - passphrase recebida como argumento, nunca persistida em DB nem log;
 *   - KeyObject vive apenas no escopo da chamada `assinar` (try/finally);
 *   - verificação sanity: a assinatura é checada antes de retornar
 *     (defesa contra falha silenciosa de `crypto.sign`).
 */

export interface ConfiguracaoAssinadorOab {
  readonly kid: string;
  readonly caminhoChavePrivada: string;
  /** PEM Ed25519 público correspondente, para self-check pós-assinatura. */
  readonly chavePublica: string | KeyObject;
}

export class AssinadorOabEd25519 implements AssinadorOab {
  readonly kid: string;
  private readonly chavePublica: KeyObject;

  constructor(private readonly config: ConfiguracaoAssinadorOab) {
    if (!config.kid) throw new TypeError('kid é obrigatório.');
    this.kid = config.kid;
    this.chavePublica =
      typeof config.chavePublica === 'string'
        ? createPublicKey(config.chavePublica)
        : config.chavePublica;
    if (
      this.chavePublica.type !== 'public' ||
      this.chavePublica.asymmetricKeyType !== 'ed25519'
    ) {
      throw new TypeError('ConfiguracaoAssinadorOab exige chave pública Ed25519.');
    }
  }

  async assinar(
    payload: {
      caso_id: string;
      rascunho_hash: string;
      decisao: Decisao;
      justificativa: string;
      horario: string;
    },
    passphrase: string,
  ): Promise<AprovacaoAssinada> {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
      throw new ErroOrquestrador('passphrase_invalida', 'Passphrase obrigatória.');
    }

    const pem = this.lerPem();
    let chavePrivada: KeyObject | null = null;
    try {
      try {
        chavePrivada = createPrivateKey({ key: pem, format: 'pem', passphrase });
      } catch {
        throw new ErroOrquestrador('passphrase_invalida', 'Passphrase incorreta ou PEM inválido.');
      }
      if (chavePrivada.asymmetricKeyType !== 'ed25519') {
        throw new ErroOrquestrador(
          'passphrase_invalida',
          'Chave privada da OAB deve ser Ed25519 PKCS#8.',
        );
      }

      const canonico = canonicalJson({
        caso_id: payload.caso_id,
        rascunho_hash: payload.rascunho_hash,
        decisao: payload.decisao,
        justificativa: payload.justificativa,
        horario: payload.horario,
        oab_kid: this.kid,
      });
      const bytes = Buffer.from(canonico, 'utf8');
      const sig = sign(null, bytes, chavePrivada);
      if (!verify(null, bytes, this.chavePublica, sig)) {
        throw new ErroOrquestrador(
          'passphrase_invalida',
          'Assinatura gerada não verifica contra a chave pública configurada.',
        );
      }

      return {
        caso_id: payload.caso_id,
        rascunho_hash: payload.rascunho_hash,
        decisao: payload.decisao,
        justificativa: payload.justificativa,
        horario: payload.horario,
        oab_kid: this.kid,
        assinatura_ed25519: sig.toString('base64url'),
      };
    } finally {
      chavePrivada = null;
    }
  }

  private lerPem(): string {
    try {
      return readFileSync(this.config.caminhoChavePrivada, 'utf8');
    } catch {
      throw new ErroOrquestrador(
        'passphrase_invalida',
        'Chave privada OAB indisponível.',
      );
    }
  }
}
