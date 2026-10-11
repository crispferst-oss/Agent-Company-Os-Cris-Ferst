# ADR-007 — Orquestrador como Application Service; Especialistas atrás de porta única

**Data:** 2026-10-11
**Status:** Aceito
**Decisor:** Orquestrador NSAS + Conselho

## Contexto
Com [ADR-006](ADR-006-arquitetura-hexagonal.md) fixando hexagonal, resta decidir onde mora a coordenação do fluxo (orquestração) e como se expressa arquiteturalmente o catálogo de especialistas jurídicos (os 15 agentes NSAS). Sem isso, "quem fala com quem, em que ordem" vaza para o núcleo jurídico.

## Decisão
1. **Orquestrador = application service** (não domínio puro, não BC de negócio). Expõe casos de uso: `IniciarConsultaNSAS`, `RotearParaEspecialistas`, `ConsolidarRascunho`, `SubmeterAprovacaoOAB`.
2. **Especialistas atrás de porta única** `ConsultarEspecialista(dominio, caso_pseudonimizado) → ParecerParcial`, com múltiplos adapters (os 15 agentes de `.claude/agents/`).
3. **Classificador no domínio** produz Plano de Consulta (DAG); orquestrador apenas executa.
4. **Redator (`redator-nota-tecnica`) é papel separado** — orquestrador invoca, não é.
5. **8 invariantes do Orquestrador** (sempre, independente do caso):
   - Entrega externa só com aprovação OAB registrada.
   - Pseudonimização pré-especialista — fail-closed sem selo da borda.
   - Idempotência por caso.
   - Trilha de auditoria append-only.
   - Timeout por nó com política abort/degrade declarada pelo Classificador.
   - Recursão zero entre especialistas (não se chamam).
   - Isolamento de falha.
   - Carimbo de versão em todos os componentes.

## Fundamentos
- [ADR-001](ADR-001-hierarquia-2-niveis.md): 2 níveis — orquestrador invoca especialistas direto; sem coordenadores.
- [ADR-002](ADR-002-formato-retorno.md): formato `{fatos, fundamentos, riscos, fontes}` padroniza o `ParecerParcial`.
- Charter: mínima superfície; isolamento; aprovação humana no produto.
- [ADR-005](ADR-005-publico-unico-arquitetura-plugavel.md): público único + plugável.

## Alternativas descartadas
- Orquestrador no núcleo: mistura fluxo com regra de direito.
- Orquestrador como BC: deus-contexto sem linguagem ubíqua própria.
- Especialistas decidem se se aplicam: regra de competência espalhada (anti-DRY).
- Redator interno ao orquestrador: mistura coordenação com produto editorial.

## Consequências
- Núcleo isolado de fluxo; testável sem motor rodando.
- Trilha OAB/LGPD unificada no Orquestrador.
- Especialistas evoluem com versionamento próprio.

## Reversão
Reversão exige retrabalho dos 8 invariantes e re-separação do Redator; registrado em ADR superseding.
