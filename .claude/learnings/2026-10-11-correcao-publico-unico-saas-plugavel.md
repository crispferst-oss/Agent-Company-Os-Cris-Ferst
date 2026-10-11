# Learning — 2026-10-11 — Correção de escopo: público único + SaaS plugável

## Contexto
Após criar o primeiro ciclo de 17 arquivos e depois adicionar 2 agentes para "consultório médico" (ADR-004, rotulado como "expansão"), a usuária esclareceu: o SaaS **sempre** foi para médicos; operadora é só fonte de expertise; e o SaaS **pluga** no sistema que o médico já usa.

## O que aconteceu
- Erro em cadeia: na primeira rodada, inferi público errado da atuação da usuária → segunda rodada tratei como "expansão" (dois públicos) em vez de "correção" (um público, com fonte de expertise diferente de cliente).
- Faltava dimensão de **integração plugável** com sistemas do médico (PEP, agenda, mensageria), que é característica central do produto.

## Causa raiz
1. Confusão entre **fonte de expertise** (onde a usuária trabalha) e **público do produto** (quem paga/usa o SaaS). São eixos ortogonais; tratei como mesmo eixo.
2. Após a primeira correção, assumi que mencionar um novo público significava "mais um", em vez de "o único correto".
3. Não li o pedido de maneira literal — a usuária disse "esse saas aqui será utilizado por médicos ou assistentes", o que define público único.

## Correção
- Removida classificação de público do `orquestrador-nsas`.
- `juridico-saude-suplementar` reorientado para a dor do médico (glosa, auditoria, cobertura negada ao paciente, laudo, perícia).
- Criado `integracao-sistemas-medico` para adapters com PEPs, agendas, mensageria.
- ADR-005 registrado; ADR-004 marcado como parcialmente superseded.

## Como evitar no futuro
1. **Distinguir sempre** fonte de expertise vs público do produto. Pergunta mental: "quem paga pelo SaaS? quem o usa diariamente?".
2. **Ler o pedido de forma literal**. Quando a usuária diz "esse SaaS será utilizado por X", o público é X — ponto. Qualquer outro grupo é contexto.
3. **Classificação de público é decisão de produto, não de arquitetura**. Antes de criar agente/domínio, confirmar o público uma única vez — depois disso, não reinferir.
4. **"Expansão" deve ser rara**. A maioria das descobertas sobre público é correção de inferência, não ampliação real. Preferir rótulo "correção" quando houver dúvida.
5. **SaaS plugável exige camada de integração desde o início** — não deixar para quando chegar o primeiro cliente real.

## Teste de regressão
Pendente: caso real do médico (ex.: "paciente mandou foto de exame no WhatsApp fora do horário — como a secretária responde?"). Valida orquestrador classificando domínio (comunicação), delegando a `comunicacao-medico-paciente` + `revisor-lgpd`, consolidando via `redator-nota-tecnica` em rascunho para aprovação OAB.
