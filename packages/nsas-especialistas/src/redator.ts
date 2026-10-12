import type { NsasParecerParcial } from '@jev/shared-types';
import type { PacoteConsultaEspecialistas } from './roteador';
import type { ContextoMemoriaInstitucional, NotaInstitucional } from './memoria';

/**
 * Redator da Nota Técnica NSAS — consome o `PacoteConsultaEspecialistas`
 * e emite o rascunho no formato canônico (`project_nota_tecnica_formato`):
 * Título · Metadados · Assunto · Contexto · Fundamentos · Recomendações
 * operacionais · Pontos de atenção · Encaminhamento · Assinatura.
 *
 * Toda saída é marcada como **[RASCUNHO — PENDENTE DE APROVAÇÃO OAB]**
 * (`redator-nota-tecnica` nunca emite nota final — a assinatura OAB é humana).
 */

export interface MetadadosNotaTecnica {
  readonly numero: string;
  readonly ano: number;
  readonly data: string;
  readonly destinatario: string;
  readonly assunto: string;
  readonly encaminhamento: string;
  readonly copia?: string;
  readonly tema: string;
  readonly fatoJuridico: string;
  readonly autora?: string;
  readonly oab?: string;
}

export interface OpcoesRedacao {
  readonly memoriaContexto?: ContextoMemoriaInstitucional;
}

export interface RedatorNotaTecnica {
  redigir(
    pacote: PacoteConsultaEspecialistas,
    metadados: MetadadosNotaTecnica,
    opcoes?: OpcoesRedacao,
  ): string;
}

const SELO_PENDENTE = '[RASCUNHO — PENDENTE DE APROVAÇÃO OAB]';
const PREAMBULO_LIMITES =
  'Documento sujeito à validação jurídica. Fundamentos e referências devem ser verificáveis. ' +
  'Divergências identificadas devem permanecer explícitas. ' +
  'O tratamento de informações está sujeito aos controles de pseudonimização e segurança do NSAS.';
const AUTORA_PADRAO = 'Cristhiane Pacheco Ferst';
const OAB_PADRAO = 'OAB/PR 66.462';

export function criarRedatorNotaTecnica(): RedatorNotaTecnica {
  return {
    redigir(pacote, metadados, opcoes) {
      const linhas: string[] = [];
      linhas.push(`# Nota Técnica NSAS – ${metadados.tema}`);
      linhas.push('');
      linhas.push(SELO_PENDENTE);
      linhas.push('');
      linhas.push(`> ${PREAMBULO_LIMITES}`);
      linhas.push('');
      linhas.push(`**Data:** ${metadados.data} · **Autora:** @${metadados.autora ?? AUTORA_PADRAO}`);
      linhas.push('');
      linhas.push(secaoAssunto(metadados));
      linhas.push(secaoContexto(metadados, pacote.pareceres));
      linhas.push(secaoFundamentos(pacote.pareceres));
      linhas.push(secaoRecomendacoes(pacote.pareceres));
      linhas.push(secaoPontosDeAtencao(pacote.pareceres));
      if (opcoes?.memoriaContexto) {
        linhas.push(secaoMemoriaInstitucional(opcoes.memoriaContexto));
      }
      linhas.push(secaoEncaminhamento(metadados));
      linhas.push(secaoFontes(pacote, opcoes?.memoriaContexto));
      linhas.push(secaoAssinatura(metadados));
      return linhas.join('\n');
    },
  };
}

function secaoMemoriaInstitucional(ctx: ContextoMemoriaInstitucional): string {
  const linhas = ['## Memória institucional consultada', ''];
  if (ctx.notas.length === 0) {
    linhas.push(
      '*Memória institucional foi consultada para os domínios ' +
        `${ctx.dominios_consultados.join(', ')}, sem registros aplicáveis.*`,
    );
    linhas.push('');
    linhas.push(`*Huella da consulta: \`${ctx.huella}\` · versão: \`${ctx.versao_consulta}\`.*`);
    linhas.push('');
    return linhas.join('\n');
  }
  for (const nota of ctx.notas) {
    linhas.push(formatarNota(nota));
  }
  linhas.push('');
  linhas.push(
    '> Os registros institucionais apresentados possuem caráter contextual e ' +
      'não substituem a verificação jurídica, regulatória ou documental pertinente.',
  );
  linhas.push('');
  linhas.push(`*Huella da consulta: \`${ctx.huella}\` · versão: \`${ctx.versao_consulta}\`.*`);
  linhas.push('');
  return linhas.join('\n');
}

function formatarNota(nota: NotaInstitucional): string {
  const partes: string[] = [];
  partes.push(`- **${nota.id}** (${nota.versao_registro}) — ${nota.criada_em.slice(0, 10)}`);
  partes.push(`  - Origem: ${nota.origem}${nota.referencia_documental ? ` — ${nota.referencia_documental}` : ''}`);
  partes.push(`  - Domínio(s): ${nota.dominios.join(', ')}`);
  partes.push(`  - Status: ${nota.status_validacao}`);
  partes.push(`  - Conteúdo: ${nota.conteudo_pseudonimizado}`);
  return partes.join('\n');
}

function secaoAssunto(m: MetadadosNotaTecnica): string {
  return [
    '## Assunto',
    '',
    `**Nº:** NSAS.${m.numero}/${m.ano}`,
    `**Destinatário:** ${m.destinatario}`,
    '',
    m.assunto,
    '',
  ].join('\n');
}

function secaoContexto(
  m: MetadadosNotaTecnica,
  pareceres: ReadonlyArray<NsasParecerParcial>,
): string {
  const temasDetectados = pareceres
    .flatMap((p) => p.fatos)
    .filter((f) => /Tema detectado/i.test(f));
  const linhas = ['## Contexto', '', m.fatoJuridico, ''];
  if (temasDetectados.length > 0) {
    linhas.push('**Temas identificados pelos especialistas:**');
    linhas.push('');
    for (const t of temasDetectados) linhas.push(`- ${t}`);
    linhas.push('');
  }
  return linhas.join('\n');
}

function secaoFundamentos(pareceres: ReadonlyArray<NsasParecerParcial>): string {
  const vistos = new Set<string>();
  const itens: string[] = [];
  for (const p of pareceres) {
    for (const f of p.fundamentos) {
      const chave = f.norma;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      itens.push(`- **${f.norma}** — ${f.aplicacao}`);
    }
  }
  if (itens.length === 0) {
    itens.push('- *Nenhum fundamento normativo foi anexado pelos especialistas; delegar à pesquisa-normativa antes de assinar.*');
  }
  return ['## Fundamentos', '', ...itens, ''].join('\n');
}

function secaoRecomendacoes(pareceres: ReadonlyArray<NsasParecerParcial>): string {
  const riscos = pareceres.flatMap((p) => p.riscos);
  const linhas = [
    '## Recomendações operacionais',
    '',
    '| Ação | O que fazer | Responsável | Prazo sugerido |',
    '|---|---|---|---|',
  ];
  if (riscos.length === 0) {
    linhas.push('| *(preencher)* | *(preencher)* | *(preencher)* | *(preencher)* |');
  } else {
    riscos.forEach((r, i) => {
      linhas.push(`| Ação ${i + 1} | *(derivar de: ${abreviar(r, 80)})* | *(preencher)* | *(preencher)* |`);
    });
  }
  linhas.push('');
  linhas.push('> Esta tabela é **stub automático**; a autora revisa cada ação antes da assinatura OAB.');
  linhas.push('');
  return linhas.join('\n');
}

function secaoPontosDeAtencao(pareceres: ReadonlyArray<NsasParecerParcial>): string {
  const vistos = new Set<string>();
  const itens: string[] = [];
  for (const p of pareceres) {
    for (const r of p.riscos) {
      if (vistos.has(r)) continue;
      vistos.add(r);
      itens.push(`- ${r}`);
    }
  }
  if (itens.length === 0) itens.push('- *Nenhum risco sinalizado pelos especialistas.*');
  return ['## Pontos de atenção', '', ...itens, ''].join('\n');
}

function secaoEncaminhamento(m: MetadadosNotaTecnica): string {
  const linhas = ['## Encaminhamento', '', `**Para:** ${m.encaminhamento}`];
  if (m.copia) linhas.push(`**Cópia:** ${m.copia}`);
  linhas.push('');
  return linhas.join('\n');
}

function secaoFontes(
  pacote: PacoteConsultaEspecialistas,
  memoria?: ContextoMemoriaInstitucional,
): string {
  const linhas = [
    '## Fontes consultadas',
    '',
    `- **Roteador:** ${pacote.versaoRoteador}`,
  ];
  for (const v of pacote.versoesConsultadas) linhas.push(`- **Adapter:** ${v}`);
  if (memoria) {
    linhas.push(`- **Memória institucional:** ${memoria.versao_consulta} (huella ${memoria.huella}, ${memoria.notas.length} nota(s))`);
  }
  if (pacote.erros.length > 0) {
    linhas.push('');
    linhas.push('**Erros/lacunas de consulta:**');
    for (const e of pacote.erros) {
      linhas.push(`- ${e.dominio} (${e.motivo}): ${e.mensagem}`);
    }
  }
  linhas.push('');
  return linhas.join('\n');
}

function secaoAssinatura(m: MetadadosNotaTecnica): string {
  return [
    '---',
    '',
    `Núcleo de Saúde Suplementar · ${m.autora ?? AUTORA_PADRAO} · ${m.oab ?? OAB_PADRAO}`,
    '',
    SELO_PENDENTE,
  ].join('\n');
}

function abreviar(s: string, limite: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= limite ? t : t.slice(0, limite - 1) + '…';
}
