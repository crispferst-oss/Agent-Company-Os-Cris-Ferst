import type { PlanoConsulta } from '../contratos';
import { ErroOrquestrador } from '../contratos';

/**
 * Valida semanticamente o PlanoConsulta ao chegar no executor:
 * - IDs únicos
 * - toda dependência referencia um id existente
 * - sem ciclos (Kahn's algorithm)
 *
 * Validação estrutural (schema Zod) já roda em `PlanoConsultaSchema`
 * no card 01; este validador cuida da amarração entre nós.
 */
export function validarDag(plano: PlanoConsulta): ReadonlyArray<string> {
  const ids = new Set<string>();
  for (const no of plano.nos) {
    if (ids.has(no.id)) {
      throw new ErroOrquestrador('dag_ciclico', `Plano tem id duplicado: "${no.id}".`);
    }
    ids.add(no.id);
  }
  for (const no of plano.nos) {
    for (const dep of no.depende_de) {
      if (!ids.has(dep)) {
        throw new ErroOrquestrador(
          'dag_ciclico',
          `Nó "${no.id}" depende de "${dep}" que não existe no plano.`,
        );
      }
      if (dep === no.id) {
        throw new ErroOrquestrador('dag_ciclico', `Nó "${no.id}" depende de si mesmo.`);
      }
    }
  }

  const grau = new Map<string, number>();
  const dependentes = new Map<string, string[]>();
  for (const no of plano.nos) {
    grau.set(no.id, no.depende_de.length);
    for (const dep of no.depende_de) {
      const lista = dependentes.get(dep) ?? [];
      lista.push(no.id);
      dependentes.set(dep, lista);
    }
  }

  const ordem: string[] = [];
  const fila: string[] = [];
  for (const [id, g] of grau) if (g === 0) fila.push(id);
  while (fila.length > 0) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const d of dependentes.get(id) ?? []) {
      const g = (grau.get(d) ?? 0) - 1;
      grau.set(d, g);
      if (g === 0) fila.push(d);
    }
  }

  if (ordem.length !== plano.nos.length) {
    throw new ErroOrquestrador('dag_ciclico', 'Plano contém ciclo entre nós.');
  }

  return ordem;
}
