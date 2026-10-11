# PROJETO 02 — JEV RUNTIME HARDENING E API EXECUTÁVEL

Transformar runtime conceitual em sistema executável, testável e observável.

## CORRIGIR PRIMEIRO

1. `pnpm install` deve funcionar. Se falhar, parar e corrigir ambiente, dependências e workspaces antes de implementar infraestrutura.
2. `pnpm typecheck` deve passar; criar o script ausente e validar também `pnpm -r typecheck` e `pnpm -r exec tsc --noEmit`.
3. `pnpm build` e `pnpm -r build` devem passar.
4. `pnpm test` e `pnpm -r test` devem passar em execução não interativa.

Baseline e bloqueios conhecidos: [STATUS.md](STATUS.md). Esta fase não está autorizada pela simples existência dos arquivos.

Antes de Fastify, PostgreSQL ou Redis, revalidar o bootstrap descrito em `STATUS.md`. Já existem `pnpm-workspace.yaml`, lockfile, pontos de entrada internos, `turbo.json`, `tsconfig.base.json` na raiz e configurações de análise/build por pacote; a autodependência foi removida e as divergências de schemas corrigidas. Manter esses gates verdes. A alternativa `packages/config/tsconfig.base.json`, `packages/config/tsconfig.node.json` e `packages/config/tsconfig.react.json` continua possível se necessária na expansão, mas esses caminhos não existem e não são pré-requisito do bootstrap atual. Não remover requisitos ao evoluir os contratos.

## IMPLEMENTAR

1. **HTTP API Fastify** (`apps/api`, diretório a criar)
   - `POST /v1/jev/query`
   - `GET /v1/jev/query/:id/stream` (SSE)
   - `GET /v1/approvals` e `POST /v1/approvals`

2. **Persistência** (PostgreSQL)
   - `tenants`, `users`, `audit_events`, `approval_requests`, `jev_queries`

3. **Cache & Jobs** (Redis + BullMQ)
   - Filas: `jev-query`, `jev-write-actions`, `jev-retry`

4. **Testes** (16 críticos; enumerar os casos antes de implementar a suíte, pois o documento original não os detalha)

5. **Observabilidade** (Pino, Prometheus, OpenTelemetry)

6. **Benchmark** (100 queries determinísticas)

## CRITÉRIO GO

```bash
pnpm install && pnpm typecheck && pnpm build && pnpm test && pnpm verify
pnpm infra:up && pnpm db:migrate && pnpm dev:api
```

Em outro terminal, com a API em execução:

```bash
curl -i http://localhost:3001/health
```

Resultados esperados (não são comandos):

```text
1. Instalação, typecheck, build, testes e verify passam.
2. Infraestrutura, migrações e API iniciam corretamente.
3. GET /health retorna HTTP 200 OK.
4. POST /v1/jev/query e GET /v1/jev/query/:id/stream funcionam com SSE.
```

Os scripts `typecheck` e `verify` já existem e passaram no bootstrap. `verify` valida somente a base atual; deverá incorporar os gates de integração da Fase 02. Os scripts `infra:up`, `db:migrate` e `dev:api` continuam requisitos a implementar e não existem hoje no manifesto raiz.

## TESTES PONTA A PONTA OBRIGATÓRIOS

### Consulta determinística

Pergunta: “Quais tarefas vencem hoje?”

- Não chamar AI Gateway.
- Executar `tasks.get_overdue` de fato, não apenas retornar seu identificador.
- Retornar fatos em menos de 800 ms no ambiente local, medidos no benchmark.
- Emitir eventos SSE e incluir fonte, horário de atualização e nível de confiança.
- Consultar PostgreSQL no tenant correto e Redis quando aplicável.
- Persistir log/auditoria da consulta.
- Resolver explicitamente a diferença entre “vencem hoje” e “vencidas”: o handler atual simula tarefas vencidas; manter o identificador solicitado e testar o recorte temporal correto.

### Escrita com aprovação

Pedido: “Reprocesse os webhooks com falha.”

- Não executar de imediato.
- Criar approval request persistido e apresentar resumo dos impactos.
- Enfileirar job somente após aprovação válida.
- Gerar logs e audit events.
- Impedir reutilização da mesma aprovação.

### Fluxo completo de aceite

```text
Browser ou curl -> POST /v1/jev/query -> Fastify -> JEV Router
-> Seleção de scripts -> Execução paralela -> Redis (quando aplicável)
-> PostgreSQL do tenant correto -> Progresso SSE
-> Resposta com fontes -> Audit event persistido
```

**Regra:** Só avançar para Cosmos 3D quando os quatro critérios GO e os testes ponta a ponta passarem. Criar arquivos não constitui aceite. Falhas iniciais de typecheck, build ou testes só permitem iniciar a correção do monorepo nesta fase; não autorizam pular esse bloqueio e implementar infraestrutura.
