# ADR-009 — Selo de borda e Tradutor Jurídico: pseudonimização fail-closed CCS ↔ Orquestrador

**Data:** 2026-10-11
**Status:** Aceito
**Decisor:** Orquestrador NSAS + Conselho

## Contexto
[ADR-006](ADR-006-arquitetura-hexagonal.md) e [ADR-007](ADR-007-orquestrador-como-application-service.md) declararam como invariante que o caso só entra no núcleo se vier pseudonimizado e com selo do Canal Clínico Segregado (CCS). Faltava mecanismo. Esta ADR converte o enunciado em contrato operacional e introduz uma mudança conceitual: **o que atravessa a fronteira para os especialistas não é dado clínico mascarado — são predicados jurídicos verificados** extraídos pelo **Tradutor Jurídico** dentro do CCS.

## Decisão
1. **Quatro classes de dado clínico (DC)** com detector determinístico na borda (adapter), nunca no núcleo:
   - DC-1 binário clínico (DICOM, PDF com HL7/LOINC/CID, EXIF médico) → recusa dura no canal admin.
   - DC-2 estruturado colado (CID-10, resultado lab, TUSS) → mascara in-place; cobertura > limiar ⇒ recusa.
   - DC-3 narrativa clínica → LLM-classifier local no adapter; mascara preservando fato jurídico.
   - DC-4 identificador vinculável (prontuário, carteirinha, CNS, guia TISS) → pseudônimo determinístico HMAC-SHA256.
2. **CasoPseudonimizado** entregue ao especialista: `caso_id`, `titular_ref` (HMAC estável por titular+operadora), `operadora` em claro, `fato_juridico` reescrito, `refs_clinicas[]` opacas, `documentos_opaco[]` só hashes, `selo`.
3. **Selo = JWS assinado Ed25519 pelo CCS**. Campos: `v`, `policy_v`, `caso_id`, `issued_at`/`expires_at` (24h default), `canal_origem`, `detectores[]`, `predicados_verificados[]`, `cofre_id`, `custodia_chave`, `sig`. Orquestrador verifica antes de executar; falha ⇒ abort + log + alerta síncrono à titular.
4. **CCS tem 4 portas apenas**: `ingest_profissional` (mTLS + credencial), `ingest_prontuario` (mTLS + OAuth), `emit_selo` (token do Orquestrador), `visualizador_titular` (step-up MFA da OAB, watermark, sem download).
5. **Fiscalização ACG** ([ADR-008](ADR-008-autogovernanca-de-codigo.md)): import `ccs.*` em `nucleo.*` ⇒ bloqueio mecânico pre-merge; porta aceitando sem selo ⇒ bloqueio mecânico; fixtures com PII real ⇒ bloqueio.
6. **Reversão (LGPD art. 18)**: dupla custódia (titular OAB + sistema de auditoria); nunca invocável por especialista nem pelo Orquestrador no fluxo normal; NT trafega com `titular_ref` e é re-nominalizada apenas no ato de emissão sob mão da titular.

## Fundamentos
- Charter: pseudonimização LGPD; isolamento; fonte verificável.
- [ADR-002](ADR-002-formato-retorno.md): `ParecerParcial` segue `{fatos, fundamentos, riscos, fontes}` sobre o `CasoPseudonimizado`.
- LGPD art. 5º II, 11, 13 §4º, 16, 18, 33, 48; CFM CEM arts. 73-79.

## Alternativas descartadas
- DC mascarado atravessa para o especialista: tentação permanente de pedir "o original"; sem barreira de tipo.
- Especialista com visualizador próprio: multiplica superfície de risco LGPD.
- Anonimização em vez de pseudonimização: impede emissão nominativa.
- Selo sem assinatura: integração maliciosa fabrica caso aparentemente selado.

## Consequências
- Invariante #2 do Orquestrador deixa de ser enunciado e vira contrato verificável em pre-merge e runtime.
- Tentação de "ver o laudo" eliminada por tipo (porta não aceita).
- Tradutor Jurídico vira lugar canônico onde direito material é codificado — alinhado com modus operandi NSAS. Inventário de predicados em [ADR-010](ADR-010-inventario-predicados-v1.md).
- Negativa: custo de setup (KMS, HSM, assinatura, cofres). Tradutor mal formalizado degrada todos os pareceres — mitigado pelo inventário fechado.

## Reversão
Decisão fundacional de borda. Reversão exige ADR nova + reescrita do CCS e do contrato do Orquestrador.
