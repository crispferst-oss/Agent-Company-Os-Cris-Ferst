# ADR-005 — Público único (médico/consultório) e arquitetura plugável

**Data:** 2026-10-11
**Status:** Aceito (supersedes parcial de ADR-004)
**Decisor:** Orquestrador NSAS + Conselho (simulado nesta sessão)

## Contexto
Esclarecimento da usuária em 2026-10-11: o SaaS **sempre** foi para médicos e equipes de consultório. A atuação dela no NSAS (operadora/cooperativa) é **fonte de expertise**, não público. O SaaS **pluga** no sistema que o médico já usa — PEP, agenda, mensageria.

ADR-001 e o orquestrador original inferiram incorretamente que havia dois públicos. ADR-004 nomeou a correção como "expansão", rótulo também incorreto.

## Decisão
1. **Público único**: médico, equipe de consultório, assistente/secretária. Operadora é contexto, nunca cliente do SaaS.
2. **Remover classificação de público** do `orquestrador-nsas`; manter apenas classificação de domínio.
3. **Reorientar `juridico-saude-suplementar`**: dor passa a ser do médico que lida com operadora (glosa, auditoria, credenciamento, cobertura negada ao paciente, laudos, perícia). Expertise de operadora vira vantagem defensiva do médico.
4. **Criar `integracao-sistemas-medico`**: especialista responsável por adapters com PEPs, agendas, mensageria, receita digital; cada integração nova gera ADR próprio.
5. **Manter** ADR-004 como registro histórico do erro de rótulo; conteúdo (criação de `etica-medica-prontuario` e `comunicacao-medico-paciente`) continua válido.

## Fundamentos
- Charter: mínima superfície (1 agente novo apenas).
- Charter: isolamento (adapters confinam dependências proprietárias).
- Charter: pseudonimização LGPD (integração com PEP recebe dado sensível direto da fonte; adapter minimiza).
- ADR-003: Conselho validou os 4 vereditos antes de aplicar.

## Alternativas descartadas
- **Manter dois públicos** (consultório × operadora): contraria o que a usuária definiu; só havia um.
- **Fundir integração dentro de `compliance-regulatorio-lgpd`**: viola isolamento; integração técnica ≠ compliance normativo.

## Consequências
- Operadora deixa de ser destinatária de Nota Técnica; vira cenário citado nas Notas dirigidas ao médico.
- Cada PEP novo (iClinic, Memed, Tasy...) gera um ADR filho (ADR-NNN-adapter-<nome>) e um subcaso em `integracao-sistemas-medico`.
- `revisor-lgpd` continua barreira obrigatória antes de qualquer rascunho sair; agora reforçada pelo tipo de dado que integração traz.
- Diferencial de produto fica explícito: expertise de operadora dentro de ferramenta do médico.

## Reversão
Edições estão em `orquestrador-nsas.md` e `juridico-saude-suplementar.md`; agente novo em `integracao-sistemas-medico.md`. Reversível revertendo os dois edits e removendo o novo arquivo.
