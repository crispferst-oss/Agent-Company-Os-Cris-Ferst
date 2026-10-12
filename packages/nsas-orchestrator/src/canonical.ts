import { createHash } from 'node:crypto';

/** JSON estrito: sem coerções, toJSON ou descarte silencioso de valores. */
export function canonicalJson(valor: unknown): string {
  return serializar(valor, new Set<object>());
}

function serializar(valor: unknown, ancestrais: Set<object>): string {
  if (valor === null) return 'null';
  if (typeof valor === 'string' || typeof valor === 'boolean') return JSON.stringify(valor);
  if (typeof valor === 'number' && Number.isFinite(valor)) return JSON.stringify(valor);
  if (typeof valor !== 'object') throw new TypeError('Valor não representável em JSON.');
  if (ancestrais.has(valor)) throw new TypeError('JSON cíclico.');
  const proto = Object.getPrototypeOf(valor);
  if (!Array.isArray(valor) && proto !== Object.prototype && proto !== null) {
    throw new TypeError('JSON exige objetos simples.');
  }
  if (Object.getOwnPropertySymbols(valor).length) throw new TypeError('JSON não aceita símbolos.');
  ancestrais.add(valor);
  try {
    if (Array.isArray(valor)) {
      if (Object.keys(valor).length !== valor.length) throw new TypeError('Array JSON inválido.');
      return '[' + Array.from({ length: valor.length }, (_, i) => serializarCampo(valor, String(i), ancestrais)).join(',') + ']';
    }
    return '{' + Object.keys(valor).sort().map(chave =>
      JSON.stringify(chave) + ':' + serializarCampo(valor, chave, ancestrais),
    ).join(',') + '}';
  } finally {
    ancestrais.delete(valor);
  }
}

function serializarCampo(objeto: object, chave: string, ancestrais: Set<object>): string {
  const descriptor = Object.getOwnPropertyDescriptor(objeto, chave);
  if (!descriptor || !('value' in descriptor)) throw new TypeError('JSON não aceita getters ou lacunas.');
  return serializar(descriptor.value, ancestrais);
}

/** SHA-256 dos bytes UTF-8, sem padding na codificação base64url. */
export function sha256Base64url(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('base64url');
}
