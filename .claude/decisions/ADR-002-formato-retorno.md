# ADR-002 — Formato de retorno padronizado dos especialistas

**Data:** 2026-10-11
**Status:** Aceito

## Contexto
Especialistas devolvendo texto livre causam perda de evidência e dificultam consolidação pelo redator.

## Decisão
Todo especialista devolve estrutura fixa:

```
## Fatos
- <observação objetiva, com fonte>

## Fundamentos
- <norma/artigo/precedente>: <aplicação ao caso>

## Riscos
- <risco regulatório/LGPD/operacional>

## Fontes
- <arquivo:linha | norma:artigo | url>
```

## Fundamentos
- Rastreabilidade: redator sabe de onde veio cada afirmação.
- Modus operandi NSAS exige fonte verificável.
- Simplifica consolidação pelo `redator-nota-tecnica`.

## Consequências
- Especialistas que não encontrarem fonte devem retornar `## Fontes\n- (ausente)` e sinalizar em `## Riscos`.
- Afirmação sem fonte é defeito, não feature.
