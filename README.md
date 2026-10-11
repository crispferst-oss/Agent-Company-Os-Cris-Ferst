# JEV OS Runtime - Monorepo

Sistema de Q&A operacional extremamente rápido. Scripts determinísticos primeiro, IA só para síntese.

## Estrutura

```
packages/
├── shared-types/              # Tipos Zod compartilhados
│   └── src/index.ts          # JevTenantContext, JevEvidence, JevResponse, etc
├── script-registry/           # Registro + validação de scripts
│   └── src/registry.ts       # ScriptRegistry class
├── script-runtime/            # Executor de scripts
│   └── src/runtime.ts        # Retry, cache, circuit breaker, métricas
├── intent-router/             # Classificador de perguntas
│   └── src/router.ts         # Keywords + regex → scripts
├── evidence-engine/           # Coleta evidências estruturadas
│   └── src/evidence.ts       # EvidenceEngine class
├── response-composer/         # Monta respostas finais
│   └── src/composer.ts       # ResponseComposer class
├── policy-engine/             # Autorização por tenant/role
│   └── src/policy.ts         # PolicyEngine class, tenant isolation
├── ai-gateway/                # Interface para múltiplos providers
│   └── src/gateway.ts        # AIGateway class
├── scripts/                   # 15 read-only + 5 write scripts
│   └── src/
│       ├── read-only-scripts.ts   # tasks.get_overdue, alerts.get_active, ...
│       ├── write-scripts.ts       # tasks.create, alerts.create, ...
│       └── index.ts              # Exports + SCRIPT_REGISTRY
└── jev-orchestrator/          # Orquestrador central
    └── src/index.ts          # JevOrchestrator class
```

## Arquitetura

```
┌─────────────────┐
│  Pergunta (Q)   │
└────────┬────────┘
         ↓
┌──────────────────────────┐   < 500ms
│ Intent Router            │   (keywords + regex)
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│ Execution Plan           │   (scripts a executar)
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐   < 800ms
│ Script Runtime (Paralelo)│   (cache, retry, circuit breaker)
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│ Evidence Engine          │   (coleta fatos com fonte)
└────────┬─────────────────┘
         ├→ Determinístico?
         │  SIM: Retorna dados imediatamente
         └→ Síntese necessária?
            SIM: Chama AI com evidências
                 (IA não executa scripts)
         ↓
┌──────────────────────────┐
│ Response Composer        │   (monta resposta + metadata)
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│ Response                 │   (answer, sources, confidence)
└──────────────────────────┘
```

## Princípios

✓ **Scripts primeiro, IA depois** — Perguntas determinísticas executam scripts, zero IA
✓ **Resposta imediata** — Primeira byte < 500ms, streaming desde o início
✓ **Dados estruturados** — Tudo com fonte, timestamp, confiança
✓ **Tenant isolation** — Usuário X nunca acessa dados de tenant Y
✓ **Falha parcial** — Se 1 script falha, retorna dados dos que funcionaram
✓ **Auditoria completa** — Todo script registra quem/o quê/quando/resultado
✓ **Ação mutável = aprovação** — tasks.create exige confirmação humana

## Exemplos de Uso

### Pergunta Determinística (sem IA)
```
Entrada: "Quais tarefas vencem hoje?"

1. Router: "tarefa" + "vence" → scripts: ['tasks.get_overdue']
2. Runtime: Execute tasks.get_overdue (cache 30s)
3. Evidence: { type: 'metric', key: 'overdue_count', value: 28 }
4. Response: "28 tarefas vencem hoje" + sources: ['tasks.get_overdue']

Tempo: ~150ms, IA: NÃO chamada, Confiança: high
```

### Pergunta de Síntese (com IA)
```
Entrada: "Por que o SLA caiu?"

1. Router: "por que" → requires_synthesis + scripts: ['analytics.get_sla_summary', 'flows.get_failed_runs']
2. Runtime: Execute ambos em paralelo (~200ms)
3. Evidence: { sla_overall: 0.87, sla_target: 0.95, failed_runs: [...] }
4. AI Gateway: "SLA caiu de 92% para 87% porque 46% das execuções do Onboarding falharam"
5. Response: Resposta sintetizada + sources: ['analytics.get_sla_summary', 'flows.get_failed_runs', 'openai']

Tempo: ~450ms, IA: SIM (recebe evidências), Confiança: high
```

### Ação Mutável (com Aprovação)
```
Entrada: "Cria tarefa 'Review Protocol' para Camila"

1. Router: "cria" + "tarefa" → requires_approval + script: 'tasks.create'
2. Orchestrator: "⚠️ Necessária aprovação para criar tarefa"
3. Usuário clica "Aprovar"
4. Runtime: Execute tasks.create(title: "Review Protocol", owner: "Camila")
5. Audit: Log { action: 'tasks.create', approved_by: 'user-123', timestamp: '...' }

Tempo: N/A (espera aprovação), IA: NÃO
```

## Scripts Implementados

### Read-only (com cache)
1. `tasks.get_overdue` (30s) — Tarefas vencidas
2. `tasks.get_by_owner` (30s) — Tarefas por responsável
3. `alerts.get_active` (15s) — Alertas ativos
4. `alerts.get_by_severity` (15s) — Alertas por severidade
5. `integrations.get_health` (60s) — Saúde das integrações
6. `integrations.get_failed_deliveries` (30s) — Webhooks falhados
7. `flows.get_health` (45s) — Saúde dos processos
8. `flows.get_failed_runs` (45s) — Execuções falhadas
9. `graph.get_entity_neighbors` (120s) — Vizinhos da entidade
10. `graph.get_dependencies` (120s) — Dependências
11. `graph.find_bottlenecks` (300s) — Gargalos
12. `analytics.get_sla_summary` (60s) — Resumo SLA
13. `analytics.get_kpis` (60s) — KPIs
14. `knowledge.search_approved` (300s) — Documentos aprovados
15. `events.get_recent` (10s) — Eventos recentes

### Write (requer aprovação)
1. `tasks.create` — Criar tarefa
2. `alerts.create` — Criar alerta
3. `flows.trigger` — Disparar fluxo
4. `integrations.retry_webhook` — Retry de webhook
5. `notifications.send` — Enviar notificação

## Critérios de Aceite

✅ Pergunta simples < 800ms
✅ Primeira streaming < 500ms
✅ Ação mutável exige aprovação
✅ Todo script gera auditoria
✅ Falha parcial vs erro
✅ Isolamento por tenant
✅ Métricas P50, P95, P99
✅ Zero IA para perguntas determinísticas
✅ IA recebe apenas evidências estruturadas
✅ Todas as respostas indicam fonte + confiança

## Próximas Etapas

- [ ] HTTP Server (Express/Fastify)
- [ ] SSE streaming para UI
- [ ] Approval flow UI
- [ ] Webhook handlers
- [ ] Tests + benchmarks
- [ ] Documentação completa
- [ ] Redis real (não mock)
- [ ] Prometheus metrics
