import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

export interface OpcoesComunicacaoMedicoPaciente {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'whatsapp_mensageria'
  | 'teleorientacao_vs_teleconsulta'
  | 'publicidade_medica'
  | 'consentimento'
  | 'lgpd_comunicacao'
  | 'receita_digital'
  | 'papel_administrativo';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'papel_administrativo',
    regex: /secret[áa]ria|recepcionista|assistente administrativ|administrativo (?:transmit|orient|responde)/i,
    eixos: [1, 6],
    riscos: [
      'Risco ético (CFM): secretária/administrativo que transmite orientação clínica configura exercício irregular da medicina (apoio ao art. 282 CP) e expõe o médico à infração ética por delegação indevida.',
      'Risco LGPD: profissional administrativo não pode recepcionar dado clínico — fluxo deve ser bloqueado na borda (ADR-009), nunca mediado.',
    ],
  },
  {
    tema: 'receita_digital',
    regex: /receita digital|receita eletr[ôo]nic|prescri[çc][ãa]o eletr[ôo]nic|ICP-Brasil|RDC 471/i,
    eixos: [3],
    riscos: [
      'Risco de validade: receita digital sem assinatura ICP-Brasil (ou validação CFM) e sem atender à RDC Anvisa 471/21 não é aceita pela farmácia e pode ser recusada em juízo.',
      'Risco de controle especial: receita de medicamento controlado por WhatsApp sem fluxo RDC 471/21 é infração sanitária.',
    ],
  },
  {
    tema: 'whatsapp_mensageria',
    regex: /whatsapp|mensageria|mensagem.*paciente|foto.*exame|foto.*les[ãa]o|[áa]udio cl[íi]nic|grupo de pacientes/i,
    eixos: [1, 3, 6],
    riscos: [
      'Risco ético (CFM): WhatsApp não é teleconsulta; orientação clínica profunda por mensagem exige modalidade adequada registrada em prontuário (CFM Res. 2.314/22).',
      'Risco LGPD: dado clínico em app pessoal do médico, sem controle de retenção/vazamento, viola finalidade e minimização; configura tratamento de dado sensível sem base legal específica (LGPD art. 11).',
      'Risco probatório: orientação dada por WhatsApp sem espelho no prontuário é defesa frágil em perícia ou PEP.',
      'Risco de grupo: grupo de pacientes com mesmo diagnóstico quebra sigilo entre eles — risco de dano moral e PEP.',
    ],
  },
  {
    tema: 'teleorientacao_vs_teleconsulta',
    regex: /teleorient|teleconsult|telediagn|telemonitor|teleinterconsult|telecirurg/i,
    eixos: [3],
    riscos: [
      'Risco de modalidade: teleorientação não substitui teleconsulta; emitir diagnóstico/prescrição em teleorientação viola CFM Res. 2.314/22.',
      'Risco de registro: toda modalidade de telemedicina exige registro em prontuário e consentimento específico; ausência configura infração ética.',
    ],
  },
  {
    tema: 'publicidade_medica',
    regex: /instagram|facebook|tiktok|redes? sociais|antes e depois|antes\/depois|google ads|an[úu]ncio|publicidade m[ée]dic|divulga[çc][ãa]o/i,
    eixos: [4],
    riscos: [
      'Risco ético (CFM): publicidade com antes/depois, promessa de resultado, sensacionalismo ou selfie em cirurgia viola CFM Res. 2.336/23 e sujeita a PEP.',
      'Risco de depoimento: uso de depoimento de paciente, ainda que autorizado, é vedado — autorização não convalida vedação deontológica.',
      'Risco LGPD: imagem/depoimento de paciente é dado pessoal; publicidade sem base legal específica (consentimento inequívoco e revogável) é infração.',
    ],
  },
  {
    tema: 'consentimento',
    regex: /consentimento|TCLE|autoriza[çc][ãa]o do paciente|anu[êe]ncia|informa[çc][ãa]o ao paciente/i,
    eixos: [1, 6],
    riscos: [
      'Risco de forma: consentimento genérico não cobre procedimento específico; TCLE deve ser por procedimento, com riscos, alternativas e revogabilidade (CFM Recom. 1/2016).',
      'Risco LGPD: consentimento para tratamento de dado sensível (art. 11) deve ser destacado, específico e revogável; genérico não vale.',
    ],
  },
  {
    tema: 'lgpd_comunicacao',
    regex: /LGPD|dado sensível|dado sens[íi]vel|finalidade|minimiza[çc][ãa]o|base legal|vazamento|incidente de seguran[çc]a/i,
    eixos: [6],
    riscos: [
      'Risco LGPD (ANPD): tratamento de dado clínico sem base legal específica (art. 11), sem registro de operações e sem política de incidentes expõe a sanção administrativa.',
      'Risco cível: vazamento gera dever de notificar ANPD/titular e dever de indenizar; prazo e forma de notificação são curtos.',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'whatsapp_mensageria':
      return 'WhatsApp/mensageria';
    case 'teleorientacao_vs_teleconsulta':
      return 'teleorientação vs teleconsulta';
    case 'publicidade_medica':
      return 'publicidade médica';
    case 'consentimento':
      return 'consentimento informado';
    case 'lgpd_comunicacao':
      return 'LGPD aplicada à comunicação';
    case 'receita_digital':
      return 'receita digital';
    case 'papel_administrativo':
      return 'papel do administrativo';
  }
}

export function criarComunicacaoMedicoPaciente(
  opcoes: OpcoesComunicacaoMedicoPaciente,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'comunicacao-medico-paciente',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema de comunicação médico-paciente foi reconhecido no fato_juridico (temas cobertos: WhatsApp/mensageria, teleorientação/teleconsulta, publicidade, consentimento, LGPD, receita digital, papel administrativo).',
    mensagemDelegacao:
      'Resoluções CFM/ANPD/Anvisa sobre comunicação mudam com frequência; para corte temporal recente, orquestrador deve acionar pesquisa-normativa como nó irmão (recursão zero, invariante #6).',
  });
}
