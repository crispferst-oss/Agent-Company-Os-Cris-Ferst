# ADR-004 — Expansão de escopo: consultório médico

**Data:** 2026-10-11
**Status:** Aceito (rótulo "expansão" superseded por ADR-005; conteúdo mantido)
**Decisor:** Orquestrador NSAS + Conselho (simulado nesta sessão)

## Contexto
Usuária em 2026-10-11 definiu o público-alvo real do SaaS: **médicos e assistentes de consultório**. Casos de uso declarados: riscos de prontuário mal elaborado, o que pode/não pode falar com paciente no WhatsApp, rotinas de consultório. O escopo inicial presumia cooperativa/operadora (NSAS interno), que agora é um dos dois públicos.

## Decisão
1. Adicionar dois especialistas focados no consultório:
   - `etica-medica-prontuario` (CFM 1.638/02, 2.217/18, 2.228/19, 2.314/22, Lei 13.787/18, segredo médico).
   - `comunicacao-medico-paciente` (WhatsApp, teleconsulta vs teleorientação, publicidade médica, consentimento, LGPD).
2. Ajustar `orquestrador-nsas` para classificar público (consultório × operadora) antes de rotear.
3. Manter demais especialistas — `compliance-regulatorio-lgpd`, `operacional-dh-aps`, `consultoria-organizacional`, `pesquisa-normativa`, `revisor-lgpd`, `redator-nota-tecnica` são transversais.
4. `juridico-saude-suplementar` continua existindo, dedicado ao público operadora/cooperativa.

## Fundamentos
- Charter: mínima superfície (apenas 2 agentes novos, nenhum removido).
- Charter: isolamento (vocabulário jurídico de cada público não contamina o outro).
- ADR-001: hierarquia 2 níveis preservada; só adiciona especialistas-irmãos.
- Modus operandi NSAS: formato de Nota Técnica único, aplicável aos dois públicos.

## Alternativas descartadas
- **Instanciar sistema separado por público**: duplica infraestrutura; viola mínima superfície.
- **Fundir ética médica + comunicação em um único agente**: fronteira larga demais; risco de resposta genérica.

## Consequências
- Orquestrador precisa classificar público corretamente — risco mitigado por pergunta explícita quando ambíguo.
- `revisor-lgpd` e Conselho continuam cobrindo os dois públicos sem ajuste.
- Primeiro caso real serve como teste de regressão (ver learning 2026-10-11).

## Reversão
Reversível removendo os dois agentes novos e revertendo a edição do `orquestrador-nsas` (histórico Git quando houver repositório).
