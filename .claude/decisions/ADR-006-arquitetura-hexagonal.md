# ADR-006 — Arquitetura Hexagonal com bloqueio de dado clínico na borda

**Data:** 2026-10-11
**Status:** Aceito
**Decisor:** Orquestrador NSAS + Conselho

## Contexto
Produto SaaS precisa isolar domínio jurídico de canais externos (PEP, agenda, mensageria, OpenDesign) que entrarão e sairão. LGPD (art. 5º II, 11) e CFM (segredo médico, CEM arts. 73-79) proíbem que canal administrativo (WhatsApp, e-mail) ou pessoal não habilitado recepcione dado clínico — nem transitório.

## Decisão
Adotar hexagonal (ports & adapters) como padrão único:
1. Núcleo (classificação jurídica, geração de NT, aprovação) é definido por **portas**; não conhece canal, protocolo nem fornecedor.
2. Todo canal externo é **adapter** plugado em porta.
3. **Bloqueio de dado clínico é na borda**: adapter de mensageria/e-mail detecta, recusa ingresso, orienta sobre via legítima (CCS) e emite evento auditável.
4. **Canal Clínico Segregado (CCS)** é contexto apartado; expõe ao núcleo apenas referências opacas (nunca conteúdo bruto). Detalhado em [ADR-009](ADR-009-selo-de-borda-tradutor-juridico.md).
5. Nenhuma NT é entregue sem gate `aprovado_oab=true` ([ADR-003](ADR-003-conselho-obrigatorio.md) e charter princípio 9).

## Fundamentos
- Charter: isolamento (camadas não vazam).
- Charter: reversibilidade (adapters substituíveis).
- Charter: pseudonimização LGPD (bloqueio arquitetural, não disciplina individual).
- [ADR-005](ADR-005-publico-unico-arquitetura-plugavel.md): SaaS plugável exige camada de integração desde o início.

## Alternativas descartadas
- **MVC/camadas tradicionais**: bloqueio clínico vazaria para controller; invariante regulatória fraca.
- **Microsserviços dia zero**: operação unipessoal, custo supera benefício; contextos no mesmo processo bastam.
- **Monolito modular sem hexagonal**: não impõe inversão de dependência; integrações vazam no domínio.

## Consequências
- Toda feature começa pela pergunta de porta: "o que o núcleo recebe e emite?"
- Toda feature de canal externo passa pelo checklist de borda clínica.
- Toda NT nasce `pendente_aprovacao_OAB`.
- Integração nova é adapter plugado em porta existente; sem porta adequada, revisar mapa de contextos antes.

## Reversão
Decisão fundacional. Reversão exige ADR nova + reescrita da estrutura de pacotes.
