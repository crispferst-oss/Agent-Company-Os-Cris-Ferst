# Learning — 2026-10-11 — Sistema paralelo de ADRs criado por ignorar o charter

## Contexto
Durante três sessões consecutivas, trabalhei em ADRs do produto (hexagonal, orquestrador, ACG, selo de borda, inventário de predicados) e criei a estrutura em `docs/adr/` com numeração própria (0001-0007). Só ao preparar o commit inicial de baseline descobri que a usuária já tinha `.claude/charter.md` fixando `.claude/decisions/` como local canônico e cinco ADRs numeradas (ADR-001 a ADR-005) com formato enxuto próprio.

## O que aconteceu
- Erro em cadeia: três ciclos de trabalho produzindo documentação arquitetural ignorando a estrutura existente.
- Mesmo padrão de erro das sessões anteriores: inferência de público-alvo (corrigido), inflação de inventário (corrigido), e agora criação de sistema paralelo de ADRs.
- Resultado: 7 arquivos em `docs/adr/` conflitando numericamente com 5 em `.claude/decisions/`, com sobreposição temática que exigiu consolidação retroativa.

## Causa raiz
1. **Não li o charter.** O arquivo `.claude/charter.md` fixa princípios e convenções do projeto, incluindo onde ADRs vivem. Não foi lido na primeira sessão nem nas seguintes.
2. **Não listei `.claude/` antes de criar documentação.** `.claude/decisions/` existia desde o primeiro ciclo da usuária; um simples listing teria revelado.
3. Assumi que `docs/adr/` era o convencional "fora da caixa" e segui, ignorando que o projeto já tinha convenção escrita.

## Correção aplicada hoje
- 5 ADRs em `docs/adr/` consolidadas em `.claude/decisions/ADR-006` a `ADR-010` em formato enxuto consistente com as 001-005.
- Mapa normativo (`docs/mapa-normativo-v1.md`) movido para `.claude/references/mapa-normativo-v1.md`.
- `docs/adr/` deletado (histórico git preserva).
- `.claude/decisions/README.md` criado com índice 001-010.

## Como evitar no futuro
1. **Antes de criar qualquer documentação em projeto novo**, listar `.claude/` recursivamente E ler `.claude/charter.md` (ou equivalente) por inteiro.
2. **Convenção do projeto > convenção genérica.** Charter dizendo "ADRs vivem em X" é vinculante — nunca criar em outro lugar sem ADR explícito mudando a convenção.
3. **O padrão de erro é claro agora**: subdiagnóstico recorrente é NÃO LER arquivos do projeto antes de agir. Memória cobre perfil + preferências; charter + decisions + learnings cobrem contexto estrutural. Os dois precisam ser lidos no início de qualquer sessão de produto.
4. **Learnings pré-existentes também valem.** O learning `2026-10-11-correcao-publico-unico-saas-plugavel.md` já continha a lição central ("fonte de expertise ≠ público"); eu repeti o padrão de ignorar o que estava escrito.

## Reforço
Esse learning é o terceiro no mesmo dia sobre a mesma causa raiz. Reforço de memória (`feedback_reler_memoria_antes_de_escopo.md`) foi criado mas abrange só memória global. Estender para incluir `.claude/charter.md` + `.claude/decisions/` + `.claude/learnings/` do projeto local.
