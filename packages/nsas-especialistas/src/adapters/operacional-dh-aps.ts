import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

export interface OpcoesOperacionalDhAps {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'continuidade_cuidado'
  | 'comunicacao_beneficiario'
  | 'responsabilidade_por_equipe'
  | 'gestao_equipe_tecnica'
  | 'recusa_atendimento_emergencial'
  | 'assedio_conduta_hostil'
  | 'cat_acidente_trabalho';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'continuidade_cuidado',
    regex: /continuidade (?:do|de) cuidado|APS|aten[çc][ãa]o prim[áa]ria|aban?dono (?:de|do) (?:paciente|tratamento)|alta a pedido|transfer[êe]ncia (?:de|do) paciente/i,
    eixos: [1, 8],
    riscos: [
      'Risco ético (CFM): abandono de paciente sem garantir continuidade do cuidado configura infração ética (CEM arts. 1º, 7º, 36); exige comunicação prévia e encaminhamento documentado.',
      'Risco cível: ruptura unilateral do vínculo sem substituição adequada pode gerar responsabilidade civil (CC art. 951) — especialmente em paciente crônico ou em tratamento ativo.',
      'Risco probatório: a comunicação de encerramento deve ir ao prontuário e, quando possível, por meio rastreável — ausência enfraquece a defesa em CRM/PEP.',
    ],
  },
  {
    tema: 'comunicacao_beneficiario',
    regex: /carta orientativa|aviso ao benefici[áa]rio|cartaz|comunicado ao paciente|informe (?:ao|para) o paciente|comunica[çc][ãa]o ao benefici[áa]rio/i,
    eixos: [7, 1],
    riscos: [
      'Risco CDC (art. 6º III e art. 31): comunicação ao beneficiário deve ser clara, ostensiva e em linguagem acessível; falha configura publicidade enganosa por omissão.',
      'Risco ético (CFM): comunicado que vincula médico a produto, resultado ou promessa viola publicidade médica (CFM Res. 2.336/23) — revisar antes de afixar/enviar.',
      'Risco de prova: datar, assinar e arquivar o comunicado (prontuário ou pasta administrativa) é o que sustenta a defesa — comunicado verbal não existe para fins de PEP.',
    ],
  },
  {
    tema: 'responsabilidade_por_equipe',
    regex: /respons[áa]bilidade.*empregado|erro de (?:enfermeiro|t[ée]cnico|auxiliar)|preposto|cl[íi]nica responde|ato de (?:terceiro|funcion[áa]rio)/i,
    eixos: [8, 12],
    riscos: [
      'Risco cível (CC arts. 932, 933): a clínica responde objetivamente por ato de seu empregado — não cabe discutir culpa do preposto na demanda do paciente.',
      'Risco de ação regressiva: condenada a clínica, cabe regressivo contra o profissional (CC art. 934); contrato de trabalho/prestação deve prever cláusula de garantia.',
      'Risco de competência profissional: ato praticado por técnico/enfermeiro fora da sua competência (Lei 7.498/86 + Dec. 94.406/87) adensa a responsabilidade do médico supervisor.',
    ],
  },
  {
    tema: 'gestao_equipe_tecnica',
    regex: /equipe (?:de enfermagem|t[ée]cnica)|supervis[ãa]o de t[ée]cnico|delega[çc][ãa]o de ato m[ée]dico|delega.*ato privativo|ato privativo m[ée]dico|t[ée]cnico (?:de enfermagem )?(?:executa|executou|aplica|realiz)|escopo de pr[áa]tica|COFEN|CFN|nutricionista na cl[íi]nica/i,
    eixos: [12, 1],
    riscos: [
      'Risco ético: delegação de ato privativo médico a técnico/enfermeiro é infração ética (CEM art. 1º) e caracteriza exercício irregular (CP art. 282).',
      'Risco regulatório: cada profissão tem código próprio (COFEN Res. 564/17; CFN Res. 599/18); conflito com decisão médica deve estar documentado — o médico assistente conduz, mas não anula a autonomia técnica da equipe.',
    ],
  },
  {
    tema: 'recusa_atendimento_emergencial',
    regex: /recusa (?:de )?atendimento|condicionar atendimento|cheque[- ]cau[çc][ãa]o|dep[óo]sito pr[ée]vio|garantia pr[ée]via|emerg[êe]ncia (?:n[ãa]o|sem) atender/i,
    eixos: [7, 1],
    riscos: [
      'Risco criminal (CP art. 135-A): condicionar atendimento emergencial a garantia prévia é tipo penal autônomo — alcança clínica e profissional de recepção.',
      'Risco administrativo: Lei 12.653/2012 veda cheque-caução em emergência; prática expõe a autuação do Procon e sanção CDC.',
      'Risco ético (CFM): recusa de atendimento em urgência fora das hipóteses taxativas é infração ética grave (CEM art. 33).',
    ],
  },
  {
    tema: 'assedio_conduta_hostil',
    regex: /ass[ée]dio moral|ass[ée]dio sexual|conduta hostil|ambiente t[óo]xico|den[úu]ncia de colaborador|rela[çc][ãa]o abusiva com (?:funcion[áa]rio|empregado)/i,
    eixos: [],
    riscos: [
      'Risco trabalhista: assédio é causa de rescisão indireta (CLT art. 483) e dano moral; a jurisprudência trabalhista cobra prevenção documentada (código de conduta, canal, treinamento).',
      'Risco penal: assédio sexual é tipo penal (CP art. 216-A); omissão da gestão em apurar denúncia pode caracterizar coautoria por omissão imprópria.',
      'Lacuna no mapa canônico v1: temas trabalhistas stricto sensu não constam dos eixos 1-12; orquestrador deve delegar à pesquisa-normativa para citar CLT, NR-01 (GRO/PGR) e Lei 14.457/22 (CIPA + prevenção ao assédio) atualizadas.',
    ],
  },
  {
    tema: 'cat_acidente_trabalho',
    regex: /CAT|comunica[çc][ãa]o de acidente de trabalho|acidente de trabalho|afastamento previdenci[áa]rio|B-91|nexo t[ée]cnico/i,
    eixos: [],
    riscos: [
      'Risco previdenciário: CAT (Lei 8.213/91 art. 22) deve ser emitida no 1º dia útil seguinte ao acidente, mesmo sem afastamento; atraso gera multa e inverte presunção de nexo.',
      'Risco trabalhista: ausência de CAT com nexo técnico epidemiológico (NTEP) presumido reforça pretensão indenizatória do colaborador.',
      'Lacuna no mapa canônico v1: Lei 8.213/91 e NR-07 (PCMSO) não constam dos eixos 1-12; orquestrador deve delegar à pesquisa-normativa para corte temporal recente.',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'continuidade_cuidado':
      return 'continuidade do cuidado (APS)';
    case 'comunicacao_beneficiario':
      return 'comunicação ao beneficiário';
    case 'responsabilidade_por_equipe':
      return 'responsabilidade por ato de empregado';
    case 'gestao_equipe_tecnica':
      return 'gestão de equipe técnica';
    case 'recusa_atendimento_emergencial':
      return 'recusa de atendimento emergencial';
    case 'assedio_conduta_hostil':
      return 'assédio e conduta hostil';
    case 'cat_acidente_trabalho':
      return 'CAT e acidente de trabalho';
  }
}

export function criarOperacionalDhAps(
  opcoes: OpcoesOperacionalDhAps,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'operacional-dh-aps',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema operacional/DH/APS foi reconhecido no fato_juridico (temas cobertos: continuidade do cuidado, comunicação ao beneficiário, responsabilidade por equipe, gestão técnica, recusa emergencial, assédio, CAT).',
    mensagemDelegacao:
      'Temas trabalhistas (CLT, NR-01, Lei 14.457/22) e previdenciários (Lei 8.213/91) não estão nos eixos 1-12 do mapa canônico v1; orquestrador deve acionar pesquisa-normativa como nó irmão (recursão zero, invariante #6).',
  });
}
