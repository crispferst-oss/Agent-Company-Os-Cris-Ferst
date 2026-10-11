# ADR-001 — Hierarquia de agentes em 2 níveis

**Data:** 2026-10-11
**Status:** Aceito
**Decisor:** Orquestrador NSAS + Conselho

## Contexto
Proposta inicial tinha 3 níveis (orquestrador → coordenador → especialista), totalizando 19 agentes. A camada de coordenadores existia só para despachar.

## Decisão
Adotar 2 níveis: Orquestrador invoca especialistas diretamente. Total: 8 agentes NSAS + 4 Conselho.

## Fundamentos
- KISS/YAGNI: coordenadores sem lógica própria são overhead.
- Isolamento de contexto: cada hop vertical custa briefing completo.
- Fronteiras largas de especialistas reduzem ambiguidade entre domínios.

## Consequências
- Latência menor; menos tokens por pedido.
- Especialistas mais abrangentes exigem instruções mais robustas.
- Reavaliar se algum domínio crescer a ponto de precisar de subdivisão (nunca com camada intermediária; sempre com especialista irmão).
