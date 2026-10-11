# ADR-003 — Conselho de Arquitetura obrigatório antes de mudança estrutural

**Data:** 2026-10-11
**Status:** Aceito

## Contexto
Autonomia arquitetural sem contrapeso vira deriva. Usuária delegou arquitetura ao orquestrador e pediu construção saudável.

## Decisão
Toda mudança estrutural (criar/remover agente, mudar formato de retorno, introduzir pacote/dependência, mudar fluxo de dados) exige veredito do Conselho antes de ser aplicada:

1. `arquiteto-chefe` propõe desenho.
2. `revisor-arquitetura` confronta com princípios do charter.
3. `guardiao-seguranca` audita LGPD, segredos, blast radius.
4. `guardiao-qualidade` exige teste, reversibilidade, doc.

Veredito: APROVADO (segue) · AJUSTAR (nova rodada) · BLOQUEADO (não aplica).

## Fundamentos
- Adversarialidade interna evita autoconvencimento do arquiteto.
- Divisão de preocupações (desenho × princípios × segurança × qualidade).
- Toda decisão fica registrada como ADR, consultável pela usuária.

## Consequências
- Mudanças pequenas e reversíveis (ex.: ajustar texto de instrução) não exigem Conselho — só ADR se afetarem contrato público do agente.
- Falhas de qualidade/segurança descobertas depois geram learnings e novo ADR.
