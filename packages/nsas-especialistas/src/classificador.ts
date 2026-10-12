/**
 * Classificador por domínio — primeiro nó do fluxo NSAS:
 * `fato_juridico` → lista de domínios a consultar via `RoteadorEspecialistas`.
 *
 * Mantém a invariante de que a usuária **não escolhe eixo**: o classificador
 * decide (`feedback_nao_oferecer_eixo`). Casa termos amplos do domínio; o
 * roteador delega a filtragem fina de temas a cada adapter.
 *
 * Fallback: se nada casar, devolve `['pesquisa-normativa']` — adapter de busca
 * genérica sobre o mapa canônico, que ou acha fundamentos ou devolve lacuna
 * (nunca erra calado).
 */

export interface ClassificadorDominio {
  readonly dominios: ReadonlyArray<string>;
  classificar(fato: string): ReadonlyArray<string>;
}

export interface RegraClassificacao {
  readonly dominio: string;
  readonly regex: RegExp;
}

export interface OpcoesClassificador {
  readonly regras?: ReadonlyArray<RegraClassificacao>;
  readonly fallback?: ReadonlyArray<string>;
}

export const REGRAS_CLASSIFICACAO_PADRAO: ReadonlyArray<RegraClassificacao> = [
  {
    dominio: 'etica-medica-prontuario',
    regex: /prontu[áa]rio|segredo m[ée]dico|atestado|receita (?:comum|m[ée]dica)|CRM|CFM Res|telemedicina|teleconsulta|documento m[ée]dico|CEM|c[óo]digo de [ée]tica|altera[çc][ãa]o retroativa/i,
  },
  {
    dominio: 'comunicacao-medico-paciente',
    regex: /whatsapp|mensageria|instagram|facebook|tiktok|rede social|publicidade|antes e depois|teleorienta|teleconsult|TCLE|consentimento|receita digital|secret[áa]ria|recepcionista|administrativo/i,
  },
  {
    dominio: 'juridico-saude-suplementar',
    regex: /glosa|operadora|plano de sa[úu]de|ANS|rol|RN ANS|reembolso|livre escolha|autoriza[çc][ãa]o pr[ée]via|credenciamento|descredenciamento|OPME|tutela de urg[êe]ncia.*plano|cobertura negada|Lei 9\.656|Lei 14\.454/i,
  },
  {
    dominio: 'compliance-regulatorio-lgpd',
    regex: /LGPD|ANPD|vazamento|incidente de seguran[çc]a|DPO|encarregado|RIPD|dado sens[íi]vel|transfer[êe]ncia internacional|RDC 50|RDC 63|RDC 222|RDC 36|PGRSS|res[íi]duos|evento adverso|CNES|licen[çc]a sanit[áa]ria|VISA|Anvisa/i,
  },
  {
    dominio: 'operacional-dh-aps',
    regex: /continuidade (?:do|de) cuidado|abandono de paciente|APS|ass[ée]dio|conduta hostil|CAT|acidente de trabalho|cheque[- ]cau[çc][ãa]o|recusa.*atendimento|equipe (?:de enfermagem|t[ée]cnica)|t[ée]cnico de enfermagem|carta orientativa|cartaz|comunicado ao paciente|aviso ao benefici[áa]rio|ato privativo m[ée]dico/i,
  },
  {
    dominio: 'consultoria-organizacional',
    regex: /diagn[óo]stico (?:operacional|da opera[çc][ãa]o)|funcionamento atual|gargalo|jornada (?:do|da) (?:cliente|paciente)|processo comercial|funil (?:de vendas|comercial)|organograma|descri[çc][ãa]o de cargo|setor administrativo|integra[çc][ãa]o entre [áa]reas|indicador|KPI|m[ée]trica (?:de|do)|governan[çc]a corporativa|SLA|painel gerencial|dashboard gerencial/i,
  },
  {
    dominio: 'integracao-sistemas-medico',
    regex: /iClinic|Doctoralia|Memed|Tasy|Philips Tasy|MV Sistemas|Feegow|Amplimed|Clinicorp|Prescrevi|prontu[áa]rio eletr[ôo]nico|PEP|HL7 FHIR|FHIR|OpenEHR|TISS|Res\. ANS 501|WhatsApp Business|Twilio|Google Calendar|SBIS|NGS2|receita digital|prescri[çc][ãa]o eletr[ôo]nica|ICP[- ]Brasil|interoperabilidade|integrar (?:com )?(?:prontu[áa]rio|sistema|PEP|agenda)/i,
  },
];

export function criarClassificadorNsasPadrao(
  opcoes: OpcoesClassificador = {},
): ClassificadorDominio {
  const regras = opcoes.regras ?? REGRAS_CLASSIFICACAO_PADRAO;
  const fallback = opcoes.fallback ?? ['pesquisa-normativa'];
  const dominios = Array.from(new Set(regras.map((r) => r.dominio)));

  return {
    dominios,
    classificar(fato) {
      if (typeof fato !== 'string' || fato.trim().length === 0) {
        return [...fallback];
      }
      const casados: string[] = [];
      for (const regra of regras) {
        if (regra.regex.test(fato) && !casados.includes(regra.dominio)) {
          casados.push(regra.dominio);
        }
      }
      return casados.length > 0 ? casados : [...fallback];
    },
  };
}
