# ADR-010 — Inventário v1.0 de Predicados do Tradutor Jurídico (15 predicados)

**Data:** 2026-10-11
**Status:** Aceito
**Decisor:** Orquestrador NSAS + Conselho (com validação OAB da titular)
**Fonte normativa:** [.claude/references/mapa-normativo-v1.md](../references/mapa-normativo-v1.md)

## Contexto
[ADR-009](ADR-009-selo-de-borda-tradutor-juridico.md) fixou que o Tradutor Jurídico extrai predicados verificáveis. Faltava fixar **quais**. Público-alvo ([ADR-005](ADR-005-publico-unico-arquitetura-plugavel.md)): médico de consultório particular / clínica, perfil avesso a questionário. Teto duro: **15 predicados** — não é meta, é teto. Critério de corte: frequência real no consultório + exposição regulatória alta + verificabilidade sem fricção.

## Decisão
Inventário v1.0 imutável com os 15 abaixo. Toda citação normativa rastreável no mapa normativo v1.

| id | nome | tipo | verif | operância | fonte |
|---|---|---|---|---|---|
| 01 | prontuario_existe_e_tem_identificacao_minima | booleano | mecânico | falso ⇒ infração CEM art.87 + inversão probatória | Lei 13.787/18; CFM Res. 1.638/02; CEM art.87 |
| 02 | prazo_guarda_minima_cumprido | booleano | mecânico | eliminação antes do prazo é infração | Lei 13.787/18 art.6º |
| 03 | copia_entregue_quando_solicitada | booleano | metadado | atraso ⇒ infração CEM art.88 + LGPD art.18 II | CEM art.88; LGPD art.18 II |
| 04 | tcle_formalizado_padrao_cfm | booleano | classif-termos | ausência ⇒ ponto fraco em qualquer processo | CFM Recom. 1/2016; CEM art.22 |
| 05 | papel_do_medico_no_ato | enum{assistente, auditor, perito, plantonista, preceptor} | declarativo | enquadramento errado inverte NT; perito que atendeu paciente = CEM art.93 | CEM arts. 92-98 |
| 06 | documento_tem_identificacao_minima | booleano | mecânico (OCR) | cobre receita/atestado/laudo em um só predicado | CEM art.11; CFM Res. 1.658/02 |
| 07 | cid_em_atestado_tem_autorizacao_expressa | enum{autorizado, dever_legal, sem_base} | llm-local (grupo_documental) | sem_base ⇒ violação sigilo em atestado | CFM Res. 1.658/02 art.3º; CEM art.73 |
| 08 | plataforma_telemedicina_atende_sigilo | enum{certificada, generica_adequada, whatsapp_email} | declarativo | whatsapp_email ⇒ violação sigilo + LGPD art.46 | CFM Res. 2.314/22 art.4º §4º; LGPD art.46 |
| 09 | valor_ajustado_previamente_telemedicina | booleano | metadado | falso ⇒ risco disciplinar + consumerista | CFM Res. 2.314/22 art.16 |
| 10 | peca_contem_antes_depois | booleano | classif-termos+llm-local | infração vedada no Manual CFM | CFM Res. 2.336/23 + Manual |
| 11 | peca_promete_resultado | booleano | llm-local | infração CFM + CDC art.37 | CFM Res. 2.336/23; CDC art.37 |
| 12 | uso_de_imagem_de_paciente_tem_tcle_proprio | enum{tcle_especifico, ausente} | metadado+llm-local | ausente ⇒ CEM art.75 + LGPD art.11 | CFM Res. 2.336/23; CEM art.75; LGPD art.11 |
| 13 | consultorio_e_agente_pequeno_porte | booleano | mecânico | **CHAVE** — define regime LGPD inteiro | Res. CD/ANPD 2/2022 |
| 14 | incidente_com_dado_sensivel_de_saude | booleano | classif-termos+llm-local | gatilho da obrigação art.48 | LGPD art.48; Res. CD/ANPD 15/2024 [verificar] |
| 15 | cheque_caucao_exigido_em_emergencia | booleano | declarativo+mecânico | **PENAL** — aciona escala_para_criminal | Lei 12.653/12; CP art.135-A |

### Regras estruturais vinculadas
1. **Versionamento imutável.** Adicionar/remover/alterar predicado é mudança estrutural ⇒ Conselho ⇒ ADR nova. 15 é teto, não meta.
2. **Confiança do LLM-classifier.** Score abaixo de limiar ⇒ `inconclusivo`, não falso.
3. **Flag `vigencia_verificar=true`** ⇒ Orquestrador aciona `pesquisa-normativa` antes de consumir; vigência desatualizada ⇒ `inconclusivo`. Aplica-se hoje a predicado 14.
4. **Qualifier `declarativo`** nunca sustenta NT emitível automaticamente.
5. **Escalada penal.** Predicado 15 verdadeiro ⇒ `escala_para_criminal=true`; Redator muda output: não é NT administrativa, é orientação de BO + comunicação ao MP.
6. **Correlação multi-documento (`grupo_documental`)** fica em ADR futura (schema de `CasoPseudonimizado`); predicado 07 permanece `inconclusivo` até lá.

## Fundamentos
- Charter: mínima superfície; aprovação humana no produto.
- [ADR-005](ADR-005-publico-unico-arquitetura-plugavel.md): público único médico de consultório.
- [ADR-009](ADR-009-selo-de-borda-tradutor-juridico.md): Tradutor Jurídico produz predicados verificáveis.
- `feedback_mastigado_eh_teto_numerico` (memória): "mastigado" = teto numérico, não adjetivo.

## Alternativas descartadas
- Inventário amplo (60-70 predicados): contraria perfil do público; rejeitada após v1 (68) e v2 (64) do rascunho.
- Inventário focado em cooperado: contraria [ADR-005](ADR-005-publico-unico-arquitetura-plugavel.md); glosa/credenciamento removidos.
- Predicados abertos: impede verificação determinística.
- LLM-classifier na determinação final: viola V7 da ACG (determinismo); LLM só na detecção.

## Consequências
- 9 de 15 verificáveis sem perguntar ao médico.
- Blocos ausentes (saúde suplementar fora do consultório, responsabilidade civil, tutela, sanitário) deixam demanda real fora; entram via ADR quando aparecer uso recorrente.
- Predicado 07 depende de `grupo_documental` pendente.

## Reversão
Rascunhos v1 e v2 do inventário preservados no histórico git; reversão para v2 (64) ou v1 (68) exige ADR superseding + Conselho.
