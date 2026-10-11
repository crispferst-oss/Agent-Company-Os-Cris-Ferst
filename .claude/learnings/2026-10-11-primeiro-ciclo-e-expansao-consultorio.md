# Learning — 2026-10-11 — Primeiro ciclo validado e expansão para consultório

## Contexto
Primeiro ciclo do sistema de agentes NSAS foi criado (17 arquivos: charter, 3 ADRs, instrução-base, 4 Conselho, 8 especialistas/orquestrador/revisor-lgpd/redator). Usuária confirmou funcionamento ("funcionou aqui") e revelou o público-alvo real: médicos e assistentes de consultório.

## O que aconteceu
- Estrutura inicial foi aceita sem ajustes.
- Escopo inicial assumia operadora/cooperativa; público real inclui consultório médico com dor própria (prontuário, WhatsApp, rotinas).
- Dois domínios novos (ética médica/prontuário; comunicação médico-paciente) foram adicionados sem conflito com a hierarquia existente.

## Causa raiz do desvio inicial
Classificação de público não foi explicitada na primeira rodada porque a usuária havia descrito a atuação dela (NSAS, OAB). O sistema inferiu o público errado do produto a partir do histórico de atuação da usuária. Lição: **atuação profissional da usuária ≠ público do SaaS que ela está construindo**.

## Correção
- Criados `etica-medica-prontuario` e `comunicacao-medico-paciente`.
- `orquestrador-nsas` agora classifica público (consultório × operadora) antes de rotear.
- ADR-004 registrado.

## Como evitar no futuro
1. Em qualquer novo produto, perguntar o público-alvo logo que ele é mencionado — e nunca inferi-lo da atuação de quem pede.
2. Classificar público é a **única** pergunta ao usuário que o orquestrador pode fazer sem violar autogovernança — está documentado no agente agora.
3. Monitorar se os dois públicos continuam cobrindo a demanda; se surgir terceiro (ex.: paciente final), reavaliar.

## Teste de regressão
Pendente: primeiro caso real da usuária (ex.: "paciente mandou foto de exame no WhatsApp — como responder?") servirá como validação ponta a ponta do fluxo com os novos agentes.
