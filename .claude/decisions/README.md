# Decisões Arquiteturais — NSAS Preventivo

Local canônico das decisões arquiteturais do produto. Convenção fixada no [charter](../charter.md) princípio 6: *"decisões arquiteturais em `.claude/decisions/` (ADR curto por mudança)"*.

## Índice

| Nº | Título | Status |
|---|---|---|
| [001](ADR-001-hierarquia-2-niveis.md) | Hierarquia de agentes em 2 níveis | Aceito |
| [002](ADR-002-formato-retorno.md) | Formato de retorno padronizado dos especialistas | Aceito |
| [003](ADR-003-conselho-obrigatorio.md) | Conselho de Arquitetura obrigatório antes de mudança estrutural | Aceito |
| [004](ADR-004-expansao-consultorio-medico.md) | Expansão de escopo: consultório médico | Aceito (rótulo "expansão" superseded por ADR-005; conteúdo mantido) |
| [005](ADR-005-publico-unico-arquitetura-plugavel.md) | Público único (médico/consultório) e arquitetura plugável | Aceito |
| [006](ADR-006-arquitetura-hexagonal.md) | Arquitetura Hexagonal com bloqueio de dado clínico na borda | Aceito |
| [007](ADR-007-orquestrador-como-application-service.md) | Orquestrador como Application Service; Especialistas atrás de porta única | Aceito |
| [008](ADR-008-autogovernanca-de-codigo.md) | Autogovernança de Código (ACG): Validador automático e inbox tripartite | Aceito |
| [009](ADR-009-selo-de-borda-tradutor-juridico.md) | Selo de borda e Tradutor Jurídico: pseudonimização fail-closed CCS ↔ Orquestrador | Aceito |
| [010](ADR-010-inventario-predicados-v1.md) | Inventário v1.0 de Predicados do Tradutor Jurídico (15 predicados) | Aceito |

## Pendentes previstas

- Motor de execução do DAG do Classificador
- Schema canônico do `CasoPseudonimizado` + `grupo_documental` para predicado 07 de ADR-010
- DSL de regras da ACG, quarentena, cross-check
- Schema canônico da proposta de correção da ACG
- KMS, HSM, custódia e rotação de chaves do CCS
- Trilha imutável de auditoria (hash chain) consumida pela ACG e por auditoria regulatória
- Protocolo técnico de aprovação OAB da Nota Técnica
- Inbox tripartite: UI, SLAs
- Primeiro adapter de PEP (iClinic, Memed, Doctoralia, outros) — cada um gera ADR filho conforme [ADR-005](ADR-005-publico-unico-arquitetura-plugavel.md)

## Convenções

- Numeração sequencial `ADR-NNN` (3 dígitos).
- Status: `Aceito` · `Proposta` · `Superseded by ADR-NNN`.
- Formato enxuto: Contexto · Decisão · Fundamentos · Alternativas descartadas · Consequências · Reversão.
- Toda ADR aceita é vinculante para o Orquestrador e fiscalizada pela ACG ([ADR-008](ADR-008-autogovernanca-de-codigo.md)).
