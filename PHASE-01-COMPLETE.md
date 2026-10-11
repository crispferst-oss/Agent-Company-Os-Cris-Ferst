# JEV RUNTIME v0.1 — ENTREGA E VALIDAÇÃO DA FASE 01

## O que foi entregue e o que permanece pendente

**Inventário após bootstrap: 10 packages, 20 scripts de demonstração (15 de leitura e 5 de escrita), 10 schemas Zod e 1.040 linhas TypeScript de produção em 19 arquivos. Há 13 testes em 10 arquivos separados.**

O registro anterior indicava “13 tipos Zod” e “~1500 linhas”; a contagem dos arquivos atuais não confirma esses valores. Este documento preserva os requisitos, mas não declara aprovação técnica sem execução. Baseline: [STATUS.md](STATUS.md).

### Arquitetura definida como objetivo; validação ponta a ponta pendente
- Pipeline: Pergunta → Router → Planner → Scripts Paralelo → Evidência → Resposta
- Separação clara: Scripts (fatos), Evidence (coleta), IA (síntese), Response (metadata)
- Isolamento por tenant rigoroso requerido; ainda não comprovado e ausente da chave de cache do runtime
- Falha parcial vs erro genérico
- Auditoria modelada (JevAuditLog)

### Componentes
1. **shared-types** — 10 schemas Zod definidos; validação integrada pendente
2. **script-registry** — Registro + permissões
3. **script-runtime** — Cache, retry, circuit breaker, métricas P50/95/99
4. **intent-router** — Classificação determinística (keywords + regex)
5. **evidence-engine** — Coleta estruturada com fontes
6. **response-composer** — Resposta com confiança + warnings
7. **policy-engine** — Autorização por tenant/role/resource
8. **ai-gateway** — Interface para múltiplos providers
9. **scripts** — 15 read-only com TTL declarado + 5 write com aprovação declarada; handlers simulados, sem aprovação persistida ou fiscalização integrada
10. **jev-orchestrator** — Esqueleto do pipeline; hoje seleciona nomes de scripts, sem executá-los nem conectar evidência, IA e auditoria

## Critérios de aceite (12 requisitos; validação pendente)

- [ ] Pergunta "quais tarefas vencem hoje?" não chama IA e executa o script correto.
- [ ] Pergunta "qual integração está falhando?" não chama IA e retorna fatos.
- [ ] Pergunta "por que o SLA caiu?" executa scripts em paralelo + IA.
- [ ] Pergunta simples retorna em menos de 800 ms, medidos (não apenas estrutura).
- [ ] Primeiro evento de streaming chega em menos de 500 ms, medidos; transporte ainda ausente.
- [ ] Ação mutável exige aprovação efetivamente validada, além da modelagem.
- [ ] Todo script gera auditoria persistida; `JevAuditLog` está apenas modelado.
- [ ] Falha parcial é distinta de erro, usando `status: partial` no fluxo real.
- [ ] Isolamento por tenant é comprovado no pipeline e no cache, além de `PolicyEngine`.
- [ ] Métricas P50/P95/P99 de `ScriptRuntime` são testadas com execuções reais.
- [ ] IA recebe apenas evidências; `AIGateway` ainda usa respostas simuladas.
- [ ] Respostas incluem fontes verificáveis via `ResponseComposer` integrado.

## ⚠️ Status Real

**v0.1: Arquitetura + Núcleo**
- Workspace pnpm, configuração TypeScript compartilhada e build completos e validados nos 10 pacotes.
- Divergências de schemas e consumidores corrigidas; contratos cobertos por testes de bootstrap.
- Componentes separados em arquivos, ainda sem pipeline integrado.
- Falta: API HTTP, DB real, testes ponta a ponta, observabilidade, SSE e aprovação persistida. Os 13 testes de base não substituem esses gates.

## 🎯 Próxima Fase (Fase 02)

1. Resolver os bloqueios de [STATUS.md](STATUS.md) antes de avançar.
2. Usar [PROMPT-02.md](PROMPT-02.md), começando pela correção do monorepo.
3. Implementar `apps/api` com Fastify (diretório planejado, ainda inexistente).
4. Conectar PostgreSQL + Redis.
5. Criar testes + benchmark.
6. Validar `pnpm install`, `pnpm typecheck`, `pnpm build`, `pnpm test` e `pnpm dev:api` após configurar os scripts.

## 📋 Checklist Imediato

- [x] Confirmar que `pnpm install` funciona.
- [x] Confirmar que `pnpm typecheck` passa.
- [x] Confirmar que `pnpm build` passa.
- [ ] Criar esqueleto de `apps/api`.
- [ ] Configurar Docker Compose com PostgreSQL + Redis.
- [ ] Implementar `GET /health`.
- [ ] Implementar `POST /v1/jev/query`.

## ⏱️ Timeline

Estimativas originais de planejamento, não prazos validados:

**Fase 02: Hardening** → 2-3 semanas
**Fase 03: Cosmos 3D** → 1-2 semanas (só depois que Fase 02 passar)
**Fase 04: MCP Brain** → 1-2 semanas (só depois que Fase 03 passar)

---

**Conclusão:** JEV Runtime v0.1 possui bootstrap compilável e testado, não um runtime aprovado. Cache e execução paralela têm implementações isoladas; streaming, persistência e integração do pipeline continuam pendentes. O objetivo é evitar chat adivinhando estado por meio de fatos, evidência e auditoria. Próximo passo: implementar e comprovar API, DB, testes ponta a ponta e comportamento real antes de produção ou Cosmos 3D, em etapa separada.
