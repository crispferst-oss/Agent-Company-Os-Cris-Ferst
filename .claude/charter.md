# Charter — NSAS Preventivo

Produto: SaaS de consultoria jurídica preventiva em saúde suplementar.
Autoridade final sobre conteúdo: Cristhiane Pacheco Ferst, OAB/PR 66.462.
Autoridade sobre arquitetura: Orquestrador NSAS, validado pelo Conselho interno.

## Princípios de construção saudável

1. **Reversibilidade** — toda mudança desfazível sem perda; preferir adicionar antes de remover.
2. **Isolamento** — camadas não vazam; cada subagente recebe só o que precisa.
3. **Fonte verificável** — toda afirmação técnica cita arquivo/linha; toda afirmação jurídica cita norma/artigo.
4. **Pseudonimização LGPD** — nenhum dado sensível sai do contexto do agente que legitimamente o processa.
5. **Testabilidade** — toda nova capacidade entra com caso de uso real como teste de regressão.
6. **Observabilidade** — decisões arquiteturais em `.claude/decisions/` (ADR curto por mudança).
7. **Mínima superfície** — adicionar agente/pacote só com justificativa escrita.
8. **Caminho feliz padronizado** — todo subagente devolve `{fatos, fundamentos, riscos, fontes}`.
9. **Aprovação humana no produto** — rascunho só vira entrega com flag `aprovado_oab=true`.
10. **Autodidata** — toda falha ou correção registra lição em `.claude/learnings/`; próxima mudança consulta.

## Modus operandi (herdado das Notas Técnicas NSAS)

Fato → Fundamento → Recomendações tabuladas (`Ação · O que fazer · Responsável · Prazo`) → Pontos de atenção → Encaminhamento.
Objetividade; sem adjetivação ornamental; infinitivos de ação; delegação nomeada.

## Fronteira usuária × orquestrador

- Usuária decide: fatos do caso, fontes jurídicas específicas, aprovação de rascunho, prioridades de produto.
- Orquestrador decide: arquitetura, estrutura, dependências, decomposição, teste, padrão de código.
- Dúvida arquitetural não vai para a usuária; vai para o Conselho interno.
