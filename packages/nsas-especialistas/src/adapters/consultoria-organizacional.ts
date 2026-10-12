import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

/**
 * Adapter 7 — consultoria organizacional.
 *
 * Diferença estrutural dos 6 adapters anteriores: o escopo (diagnóstico,
 * processo, organograma, indicadores) é CONSULTIVO/BIBLIOGRÁFICO, não
 * normativo. O mapa-normativo-v1 não cobre essas boas práticas, portanto
 * TODOS os temas aqui declaram `eixos: []` — a lacuna é explícita e
 * reconhecida por design (ver `project-porta-consultar-especialista`).
 *
 * Comportamento: detecta o assunto, carimba o tema no parecer, injeta
 * riscos específicos de consultoria e delega a análise substantiva para
 * fora do NSAS (consultoria dedicada / referência bibliográfica).
 */

export interface OpcoesConsultoriaOrganizacional {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'diagnostico_operacional'
  | 'mapa_processo_comercial'
  | 'organograma_papeis'
  | 'estrutura_setorial'
  | 'indicadores_governanca';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'diagnostico_operacional',
    regex: /diagn[óo]stico (?:operacional|da opera[çc][ãa]o)|funcionamento atual|est[áa] travando|n[ãa]o flui|gargalo|opera[çc][ãa]o (?:da |do )?(?:cl[íi]nica|consult[óo]rio)/i,
    eixos: [],
    riscos: [
      'Risco de recomendação prematura: NSAS Preventivo trata risco jurídico; diagnóstico de operação exige levantamento in loco (entrevistas, observação de processo, análise de documentos internos) — fora do escopo deste especialista.',
      'Risco de confusão de método: diagnóstico organizacional não substitui parecer jurídico; recomenda-se consultoria organizacional dedicada antes de qualquer decisão estrutural.',
    ],
  },
  {
    tema: 'mapa_processo_comercial',
    regex: /jornada (?:do|da) (?:cliente|paciente)|processo comercial|ponto de contato|funil (?:de vendas|comercial)|capta[çc][ãa]o de paciente|experi[êe]ncia do paciente/i,
    eixos: [],
    riscos: [
      'Risco regulatório indireto (CFM Res. 2.336/23 — publicidade médica): mapeamento comercial da jornada do paciente pode acionar restrições de publicidade médica em pontos de contato específicos; checar com adapter comunicacao-medico-paciente antes de implementar.',
      'Risco de descaracterização do ato médico: processo comercial não pode condicionar diagnóstico/prescrição a métrica de conversão — fere autonomia (CEM art. 1º).',
    ],
  },
  {
    tema: 'organograma_papeis',
    regex: /organograma|papel (?:do|da)|respons[áa]vel por|quem (?:faz|executa|responde)|cargo|fun[çc][ãa]o (?:do|da) (?:colaborador|equipe|secret[áa]ria)|descri[çc][ãa]o de cargo/i,
    eixos: [],
    riscos: [
      'Risco de ambiguidade: todo papel deve ter responsável nomeado e substituto designado — ausência gera falha operacional e exposição ética (quem respondeu pelo paciente?).',
      'Risco de delegação indevida: definição de papéis deve respeitar competência profissional (Lei 7.498/86, CFM, COFEN) — ver adapter operacional-dh-aps para ato privativo médico.',
    ],
  },
  {
    tema: 'estrutura_setorial',
    regex: /setor (?:de|administrativo|cl[íi]nico)|departamento|[áa]rea (?:administrativa|cl[íi]nica|comercial)|integra[çc][ãa]o entre [áa]reas|interface (?:entre|com)|fluxo entre setores/i,
    eixos: [],
    riscos: [
      'Risco de barreira clínico-administrativa: estrutura setorial deve preservar a invariante do canal de dado clínico (feedback_canal_dado_clinico) — administrativo não pode recepcionar exame/laudo.',
      'Risco de SLA ausente: interface entre áreas sem entrada/saída/SLA/dono definidos gera retrabalho e falha de responsabilização.',
    ],
  },
  {
    tema: 'indicadores_governanca',
    regex: /indicador|KPI|m[ée]trica (?:de|do)|governan[çc]a corporativa|SLA|performance (?:da cl[íi]nica|operacional)|painel gerencial|dashboard gerencial/i,
    eixos: [],
    riscos: [
      'Risco LGPD: indicadores que usem dados pessoais/sensíveis de pacientes exigem base legal (LGPD arts. 7º/11), finalidade específica e anonimização quando possível — ver adapter compliance-regulatorio-lgpd.',
      'Risco de meta vinculada a ato médico: KPI que premie volume de prescrição, exame ou procedimento fere a autonomia técnica e pode caracterizar infração ética (CFM Res. 2.336/23 + CEM art. 1º).',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'diagnostico_operacional':
      return 'diagnóstico operacional';
    case 'mapa_processo_comercial':
      return 'mapa de processo comercial';
    case 'organograma_papeis':
      return 'organograma e papéis';
    case 'estrutura_setorial':
      return 'estrutura setorial e interfaces';
    case 'indicadores_governanca':
      return 'indicadores e governança';
  }
}

export function criarConsultoriaOrganizacional(
  opcoes: OpcoesConsultoriaOrganizacional,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'consultoria-organizacional',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema de consultoria organizacional foi reconhecido no fato_juridico (temas cobertos: diagnóstico operacional, mapa de processo comercial, organograma/papéis, estrutura setorial, indicadores/governança).',
    mensagemDelegacao:
      'Domínio consultoria-organizacional é bibliográfico/consultivo — não há eixo normativo correspondente no mapa canônico v1. NSAS detecta o assunto e sinaliza riscos conhecidos, mas NÃO produz parecer técnico substitutivo: recomenda-se consultoria organizacional dedicada (metodologia in loco com entrevistas, observação e análise documental).',
  });
}
