# ADR-010 — Síntese opcional assistida por LLM

**Status:** PROPOSTA — NÃO APROVADA
**Data da proposta:** 2026-10-11
**Instâncias do Conselho a decidir:** arquiteto-chefe, revisor-arquitetura, guardião-segurança, guardião-qualidade.

## Contexto

O `router_mesh_starter` possui um agente "Integrador de Resultados" que compõe
em prosa os múltiplos pareceres de especialistas, com instruções explícitas de
preservar divergências e não acrescentar fatos. O redator do NSAS hoje organiza
pareceres em Markdown canônico (fundamentos deduplicados, pontos de atenção
listados, tabela stub de recomendações) — não há camada que **integre em prosa**
divergências entre especialistas.

Essa capacidade seria útil quando múltiplos adapters apontam riscos sobrepostos
ou conflitantes. Introduzi-la, porém, significa aceitar LLM no fluxo canônico —
decisão que colide frontalmente com a invariante **Núcleo determinístico** (zero
LLM no runtime do núcleo).

## Questão arquitetural

A síntese assistida por LLM pode melhorar a legibilidade dos pareceres plurais
sem alterar os resultados determinísticos do classificador, do roteador, dos
adapters e do redator canônico?

## Alternativa preferencial para avaliação

Camada **externa e posterior** ao documento canônico:

1. O redator canônico produz o rascunho pendente de aprovação OAB (fluxo atual).
2. Opcionalmente, uma camada separada (`sintetizador-llm`, fora do pacote
   `nsas-especialistas`) recebe o rascunho pronto e **gera um texto auxiliar
   para apoio à revisão humana**, carimbado como material acessório.
3. O texto auxiliar não entra na Nota Técnica; é entregue apart.

Essa camada **não** poderá:

- Substituir o redator canônico.
- Alterar o carimbo de versão original.
- Apagar divergências.
- Criar fundamentos sem fontes verificáveis.
- Modificar os pareceres parciais.
- Registrar novos especialistas.
- Invocar recursivamente o núcleo.

## Pontos para avaliação do Conselho

- **Privacidade:** o rascunho contém fato jurídico pseudonimizado + fundamentos
  normativos; qualquer envio a LLM externa precisa de ponderação sobre fluxo
  internacional de dados (LGPD arts. 33-36) e cláusulas contratuais.
- **Custos:** chamadas por nota técnica, orçamento mensal esperado, mecanismo
  de desativação.
- **Rastreabilidade:** carimbo do modelo + prompt + versão da síntese;
  reprodutibilidade comprometida se o modelo for atualizado silenciosamente.
- **Tratamento de erros:** o que acontece quando a LLM falha, trunca ou alucina?
  A nota segue sem a síntese.
- **Risco de divergência:** se a síntese contradizer o rascunho canônico, qual
  prevalece? (Resposta esperada: sempre o canônico; a síntese nunca é fonte
  autoritativa.)
- **Guardrails:** evaluations automáticas que detectem invenção de normas ou
  omissão de divergências antes de servir a síntese.

## Decisão pendente

Nenhuma implementação de síntese por LLM será realizada enquanto esta decisão
permanecer pendente. O pacote `nsas-especialistas` continua operando apenas no
fluxo determinístico (classificador → roteador → redator), com a memória
institucional auditável adicionada como contexto consultivo (plano "Importação
controlada de capacidades do Router Mesh para o NSAS").

## Links

- `router_mesh_starter/router_mesh_starter/src/router_mesh.py` — função
  `synthesize` (linhas 291-309) que motivou a proposta.
- Plano canônico: `.claude/plans/olha-esse-router-misty-donut.md`.
