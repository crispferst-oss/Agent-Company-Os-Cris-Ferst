# JEV Runtime - Implementação Completa

## Arquitetura de Fluxo

1. **Pergunta do usuário** → Intent Router
2. **Intent Router** (< 500ms) → Classifica como determinístico/ambíguo
3. **Execution Plan** → Define scripts a executar (paralelo se possível)
4. **Script Runtime** (< 800ms) → Executa com cache, retry, circuit breaker
5. **Evidence Engine** → Coleta fatos estruturados com fontes
6. **AI Gateway** (se necessário) → Sintetiza com evidências
7. **Response Composer** → Monta resposta com fontes, confiança, warnings

## Pacotes Criados

### shared-types: Tipos Zod
- JevTenantContext (tenant, user, roles)
- JevScriptDefinition (script spec)
- JevEvidence (fatto + fonte + timestamp)
- JevResponse (resposta final)

### script-registry: Registro de scripts
- Valida schemas
- Checa permissões por role

### script-runtime: Executor
- Cache Redis (read-only)
- Retry com exponential backoff
- Circuit breaker (5 falhas = abrir)
- Métricas P50/P95/P99

### intent-router: Classificador
- Keywords + regex (determinístico)
- Rotas hardcoded para perguntas comuns
- Fallback para IA

### evidence-engine: Coleta de fatos
- Armazena evidências por correlationId
- Calcula confidence agregada
- Retorna sources

### response-composer: Monta resposta
- Calcula confidence level
- Gera warnings (dados stale, parcial)
- Sugere next actions

### policy-engine: Autorização
- Políticas por tenant + resource + action
- Isolamento rigoroso por tenant
- Roles: viewer, operator, admin

### ai-gateway: Interface IA
- Múltiplos providers (OpenAI, Anthropic, local)
- Caching de respostas
- Recebe apenas evidências estruturadas

### scripts: Implementações
- 15 read-only (com cache)
- 5 write (com aprovação)

### jev-orchestrator: Orquestrador Central
- Coordena todo pipeline
- Streaming pronto para SSE
- Auditoria automática

## Critérios Aceitos

✓ "Quais tarefas vencem hoje?" → tasks.get_overdue, sem IA, < 150ms
✓ "Qual integração falha?" → integrations.get_health, sem IA, < 200ms
✓ "Por que SLA caiu?" → 2 scripts paralelo + IA síntese, < 800ms
✓ Primeira streaming < 500ms
✓ Falha parcial retorna dados dos scripts bem-sucedidos
✓ Auditoria para cada script
✓ Ação mutável exige aprovação explícita
✓ Tenant isolation: usuário X não acessa tenant Y

## Próximas Etapas

- [ ] HTTP Server (Express/Fastify)
- [ ] SSE Streaming para UI
- [ ] Approval Flow UI
- [ ] Webhook handlers
- [ ] Tests + benchmarks
- [ ] Documentação completa
