# ADR-008 — Autogovernança de Código (ACG): Validador automático e inbox tripartite

**Data:** 2026-10-11
**Status:** Aceito
**Decisor:** Orquestrador NSAS + Conselho

## Contexto
Manutenção manual da conformidade entre código e [ADR-006](ADR-006-arquitetura-hexagonal.md) / [ADR-007](ADR-007-orquestrador-como-application-service.md) sobrecarregaria a titular com decisão técnica trivial e deixaria sem guardião automático as invariantes críticas (pseudonimização fail-closed, recursão zero, bloqueio clínico).

Expansão operacional do [ADR-003](ADR-003-conselho-obrigatorio.md): Conselho delibera "o que o sistema deve ser"; ACG fiscaliza "se o código reflete isso".

## Decisão
1. **ACG = meta-contexto hexagonal autônomo**, fora do runtime de atendimento, adjacente ao Conselho (não dentro).
2. **Três classes de achado**:
   - **Mecânica** (determinística, reversível) → branch isolada → CI verde obrigatório → merge auto; trilha + log à titular (não fila).
   - **Deliberativa-simples** (ambígua, sem impacto estrutural) → proposta à titular → aprendizado persistido.
   - **Estrutural** (toca porta/BC/núcleo jurídico ou excede blast radius) → NÃO propõe → convoca Conselho + titular → ADR nova.
3. **Autoaprendizado simbólico**: regras persistidas como YAML versionado em git (`acg/regras/*.rule.yaml`), nunca peso de modelo. LLM só na detecção/redação; regra final é símbolo auditável.
4. **10 invariantes V1–V10 do Validador** (fail-closed arquitetural; blast radius ≤ K=5 arquivos/L=80 linhas; rollback automático se CI quebra; nunca toca núcleo jurídico sozinho; determinismo na camada hard; etc.).
5. **Inbox tripartite da titular** (filas separadas por natureza, apresentação unificada):
   - **Jurídica** → aprovação OAB da NT (bloqueia emissão).
   - **Arquitetural** → ADR nova / mudança estrutural (bloqueia merge estrutural).
   - **Código/ACG** → proposta de correção, regra nova (bloqueia só o item).

## Fundamentos
- Charter: autodidata (toda falha registra lição em `.claude/learnings/`).
- Charter: aprovação humana no produto; separação de ato OAB de aprovação técnica trivial.
- [ADR-003](ADR-003-conselho-obrigatorio.md): adversarialidade interna; ACG é braço executor + gatilho do Conselho.

## Alternativas descartadas
- Validador como especialista (adapter da porta `ConsultarEspecialista`): viola semântica da porta.
- Validador no runtime: tentação de autocorrigir em produção.
- Regra persistida como peso de modelo: não auditável, não versionável.
- Fila única da titular: contamina ato OAB com aprovação técnica.

## Consequências
- Invariantes arquiteturais críticas ganham guardião automático pre-merge.
- Titular valida regra uma vez, aplica para sempre; reverte quando quiser.
- Autoaprendizado versionado e revisável.
- Risco inicial: ruído de proposta se classificação deliberativa-simples for mal calibrada — V8 (fail-closed) mitiga.

## Reversão
Desligar ACG do pipeline reverte sem perda de código. Regras aprendidas ficam em git para re-aplicação futura.
