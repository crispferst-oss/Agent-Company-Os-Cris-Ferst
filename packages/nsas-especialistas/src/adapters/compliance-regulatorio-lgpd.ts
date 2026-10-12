import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

export interface OpcoesComplianceRegulatorioLgpd {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'incidente_seguranca'
  | 'dpo_encarregado'
  | 'ripd_relatorio_impacto'
  | 'direitos_titular'
  | 'retencao_eliminacao'
  | 'transferencia_internacional'
  | 'funcionamento_eas'
  | 'residuos_rss'
  | 'seguranca_paciente'
  | 'cnes_licenca';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'incidente_seguranca',
    regex: /incidente de seguran[çc]a|vazamento|exposi[çc][ãa]o de dados|data breach|invas[ãa]o/i,
    eixos: [6],
    riscos: [
      'Risco LGPD (ANPD): comunicação de incidente de segurança (LGPD art. 48 + Res. CD/ANPD 15/2024) tem prazo e formulário próprios; silêncio ou atraso é agravante na dosimetria (Res. CD/ANPD 4/2023).',
      'Risco ao titular: dever de notificar titulares afetados em prazo razoável; falha gera dano moral in re ipsa e exposição civil.',
      'Risco documental: ausência de registro de operações e de plano de resposta a incidentes impede defesa em fiscalização ANPD.',
    ],
  },
  {
    tema: 'dpo_encarregado',
    regex: /encarregado|DPO|data protection officer|canal LGPD|Res\.\s*2\/2022/i,
    eixos: [6],
    riscos: [
      'Risco regulatório: LGPD art. 41 exige encarregado; agente de pequeno porte (Res. CD/ANPD 2/2022) pode usar canal simplificado — mas a ausência total é infração.',
      'Risco de prova: encarregado sem registro público (site/contrato) impede o titular de exercer direitos, caracterizando descumprimento.',
    ],
  },
  {
    tema: 'ripd_relatorio_impacto',
    regex: /RIPD|relat[óo]rio de impacto|DPIA|avalia[çc][ãa]o de impacto/i,
    eixos: [6],
    riscos: [
      'Risco regulatório: tratamento de dado sensível em escala exige RIPD (LGPD art. 38 + Guia ANPD 2024); ausência pesa na dosimetria da sanção.',
      'Risco de projeto: implantar PEP/telemedicina sem RIPD prévio inverte o ônus da conformidade — depois do incidente a correção é mais cara.',
    ],
  },
  {
    tema: 'direitos_titular',
    regex: /direitos do titular|c[óo]pia do prontu[áa]rio|portabilidade|elimina[çc][ãa]o de dados|art\.\s*18 LGPD/i,
    eixos: [6],
    riscos: [
      'Risco LGPD (art. 18): titular pode exigir acesso, correção, portabilidade e eliminação; recusa sem fundamento é infração.',
      'Risco de conflito com guarda clínica: eliminação pedida pelo titular colide com Lei 13.787/18 (prontuário por 20 anos) — resposta deve explicar a base legal da retenção.',
    ],
  },
  {
    tema: 'retencao_eliminacao',
    regex: /reten[çc][ãa]o|guarda de prontu[áa]rio|elimina[çc][ãa]o|descarte de dados|Lei 13\.787/i,
    eixos: [6, 1],
    riscos: [
      'Risco LGPD: retenção além do necessário sem base legal viola a finalidade e a minimização; política de retenção escrita é obrigatória.',
      'Risco clínico: prontuário tem guarda mínima de 20 anos (Lei 13.787/18) — descarte antecipado é infração ética e sanitária.',
    ],
  },
  {
    tema: 'transferencia_internacional',
    regex: /transfer[êe]ncia internacional|nuvem (?:no exterior|fora do Brasil|internacional)|cross[- ]border|servidor nos? EUA/i,
    eixos: [6],
    riscos: [
      'Risco LGPD (arts. 33-36): transferência internacional de dado sensível exige base jurídica adequada (adequação ANPD, cláusulas-padrão, consentimento específico).',
      'Risco contratual: contrato com SaaS/PEP hospedado fora do BR deve prever cláusulas de proteção e auditoria; ausência é infração do controlador.',
    ],
  },
  {
    tema: 'funcionamento_eas',
    regex: /RDC 50|funcionamento (?:do consult[óo]rio|de EAS)|planta f[íi]sica|estabelecimento assistencial|RDC 63/i,
    eixos: [10],
    riscos: [
      'Risco sanitário: Anvisa RDC 50/2002 e RDC 63/2011 fixam padrão físico-funcional e boas práticas; não conformidade suspende alvará.',
      'Risco cível: inadequação estrutural somada a evento adverso adensa a responsabilidade (CDC art. 14 c/c CC art. 951).',
    ],
  },
  {
    tema: 'residuos_rss',
    regex: /RSS|res[íi]duos de servi[çc]os de sa[úu]de|PGRSS|descarte de perfurocortante|RDC 222/i,
    eixos: [10],
    riscos: [
      'Risco sanitário: PGRSS é obrigatório (Anvisa RDC 222/2018); fiscalização VISA aplica interdição e multa.',
      'Risco ambiental: destinação inadequada gera responsabilidade solidária com o transportador (Lei 12.305/10).',
    ],
  },
  {
    tema: 'seguranca_paciente',
    regex: /seguran[çc]a do paciente|evento adverso|near miss|NSP|n[úu]cleo de seguran[çc]a|RDC 36/i,
    eixos: [10],
    riscos: [
      'Risco sanitário: Anvisa RDC 36/2013 exige protocolos de segurança do paciente mesmo em ambulatorial invasivo; falha é agravante em processo cível.',
      'Risco probatório: ausência de registro de evento adverso enfraquece a defesa — notificação ao Nagep/VISA deve ser contemporânea.',
    ],
  },
  {
    tema: 'cnes_licenca',
    regex: /CNES|cadastro nacional de estabelecimento|licen[çc]a sanit[áa]ria|VISA municipal|VISA estadual|alvar[áa] sanit[áa]rio/i,
    eixos: [10],
    riscos: [
      'Risco administrativo: CNES (Portaria MS/SAS 1.646/2015) é obrigatório; funcionamento sem cadastro impede faturamento SUS e expõe à autuação.',
      'Risco de jurisdição local: licença sanitária segue norma estadual/municipal — predicado "jurisdição local" deve ser confirmado antes de concluir sobre regularidade.',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'incidente_seguranca':
      return 'incidente de segurança (LGPD art. 48)';
    case 'dpo_encarregado':
      return 'encarregado/DPO';
    case 'ripd_relatorio_impacto':
      return 'RIPD — relatório de impacto';
    case 'direitos_titular':
      return 'direitos do titular (LGPD art. 18)';
    case 'retencao_eliminacao':
      return 'retenção e eliminação de dados';
    case 'transferencia_internacional':
      return 'transferência internacional de dados';
    case 'funcionamento_eas':
      return 'funcionamento do EAS (RDC 50/63)';
    case 'residuos_rss':
      return 'resíduos de serviços de saúde (PGRSS)';
    case 'seguranca_paciente':
      return 'segurança do paciente (RDC 36)';
    case 'cnes_licenca':
      return 'CNES e licença sanitária';
  }
}

export function criarComplianceRegulatorioLgpd(
  opcoes: OpcoesComplianceRegulatorioLgpd,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'compliance-regulatorio-lgpd',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema de compliance regulatório/LGPD foi reconhecido no fato_juridico (temas cobertos: incidente, DPO, RIPD, direitos do titular, retenção, transferência internacional, RDC 50/63, PGRSS, segurança do paciente, CNES/licença).',
    mensagemDelegacao:
      'Resoluções ANPD (15/2024) e Anvisa (RDC 573/21, 471/21) mudam com frequência; para corte temporal recente, orquestrador deve acionar pesquisa-normativa como nó irmão (recursão zero, invariante #6).',
  });
}
