import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

/**
 * Adapter 8 — integração do SaaS com os sistemas do médico.
 *
 * Posicionamento (ver `.claude/agents/integracao-sistemas-medico.md`):
 * o SaaS pluga no sistema que o médico já usa — não substitui. Toda
 * integração começa pelo adapter: contrato de dados, canal, base legal,
 * minimização.
 *
 * Natureza híbrida: parte normativa (LGPD art. 11, TISS/ANS, CFM 2.228,
 * SBIS/CFM NGS2) + parte técnica/consultiva (HL7 FHIR, OpenEHR, OAuth2,
 * APIs proprietárias) — padrões técnicos não têm eixo no mapa canônico v1
 * e são sinalizados como delegação à pesquisa-normativa + documentação
 * oficial do fornecedor.
 */

export interface OpcoesIntegracaoSistemasMedico {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'prontuario_eletronico'
  | 'agendamento_integrado'
  | 'mensageria_paciente'
  | 'receita_digital'
  | 'interoperabilidade'
  | 'certificacao_sbis'
  | 'base_legal_integracao';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'prontuario_eletronico',
    regex: /iClinic|Doctoralia|Memed(?!.*receita)|Tasy|Philips Tasy|MV (?:Sistemas)?|Feegow|Amplimed|Clinicorp|prontu[áa]rio eletr[ôo]nico|PEP|integrar (?:com )?prontu[áa]rio|ler prontu[áa]rio/i,
    eixos: [2, 6],
    riscos: [
      'Risco LGPD (art. 11, II): leitura/escrita de prontuário envolve dado pessoal sensível de saúde; base legal taxativa (tutela da saúde, exercício regular de direitos, cumprimento de obrigação legal/regulatória) — escolher UMA e documentar.',
      'Risco de acoplamento: APIs proprietárias de PEP mudam sem aviso; adapter deve isolar o SaaS da mudança (anti-corrupção) e versionar o contrato de dados.',
      'Risco de responsabilidade compartilhada: fornecedor do PEP é operador OU controlador conjunto? Documentar em contrato de tratamento (LGPD art. 39) antes da primeira integração.',
      'Risco de minimização: adapter deve puxar APENAS os campos necessários à finalidade declarada — não espelhar o prontuário inteiro.',
    ],
  },
  {
    tema: 'agendamento_integrado',
    regex: /Google Calendar|agenda (?:do m[ée]dico|do consult[óo]rio|propriet[áa]ria)|agendamento integrado|sincroniza[çc][ãa]o de agenda|calend[áa]rio integrado/i,
    eixos: [6],
    riscos: [
      'Risco LGPD (art. 7º): dado de agenda contém nome, telefone, horário e, frequentemente, motivo da consulta — este último é dado sensível (art. 11); separar campos públicos (horário) de sensíveis (motivo) no contrato de integração.',
      'Risco de transferência internacional (LGPD arts. 33-36): Google Calendar hospeda nos EUA; verificar cláusulas-padrão/decisão de adequação ANPD vigente antes de usar como repositório canônico.',
      'Risco de retenção: política de retenção do SaaS deve ser mais curta que a do PEP; agendamento histórico que vive só no SaaS gera obrigação de guarda que o SaaS não é obrigado a cumprir.',
    ],
  },
  {
    tema: 'mensageria_paciente',
    regex: /WhatsApp Business|Twilio|mensageria (?:paciente|cl[íi]nica)|API (?:de )?mensagem|canal de comunica[çc][ãa]o com paciente|bot de atendimento|chatbot cl[íi]nica/i,
    eixos: [6, 1],
    riscos: [
      'Risco de canal clínico: WhatsApp/Twilio NÃO podem recepcionar exame/laudo (invariante do canal de dado clínico — bloqueio na porta de entrada). Adapter deve recusar anexo clínico no fluxo administrativo.',
      'Risco ético (CFM Res. 2.336/23 + Res. 2.314/22): mensageria com paciente pode caracterizar teleorientação ou teleconsulta a depender do conteúdo; distinguir no contrato de integração.',
      'Risco LGPD (art. 7º VIII — proteção do crédito/legítimo interesse NÃO cobre marketing clínico): consentimento específico (art. 8º) para lembrete, pesquisa de satisfação, campanha educativa.',
      'Risco de registro: toda mensagem com conteúdo clínico vai ao prontuário (CEM art. 87); se o canal é só administrativo, adapter precisa impedir conteúdo clínico ou derivar para fluxo próprio.',
    ],
  },
  {
    tema: 'receita_digital',
    regex: /receita digital|prescri[çc][ãa]o eletr[ôo]nica|Memed(?:.*receita)?|Prescrevi|ICP[- ]Brasil|assinatura digital qualificada|certificado digital m[ée]dico/i,
    eixos: [3],
    riscos: [
      'Risco regulatório (CFM Res. 2.314/22 arts. 6º-7º + MP 2.200-2/2001): receita digital exige assinatura ICP-Brasil ou validação CFM; adapter deve rejeitar prescrição sem carimbo criptográfico válido.',
      'Risco de rastreabilidade: integração com Memed/Prescrevi delega a validação ao fornecedor — adapter deve guardar comprovante da validação (hash + timestamp) para defesa em PEP/CRM.',
      'Risco de confidencialidade: prescrição é dado sensível e sigiloso (CEM arts. 73-79); canal de retorno (download da receita pelo paciente) exige autenticação forte, não link público.',
    ],
  },
  {
    tema: 'interoperabilidade',
    regex: /HL7 FHIR|FHIR|OpenEHR|TISS|TISS\/ANS|Res\. ANS 501|padr[ãa]o de interoperabilidade|interoperabilidade cl[íi]nica/i,
    eixos: [9, 2],
    riscos: [
      'Risco regulatório (saúde suplementar): operadora/clínica credenciada DEVE usar padrão TISS atualizado (Res. ANS 501/22 e sucessoras) para troca com operadora; adapter próprio não dispensa o padrão.',
      'Risco de bloqueio tecnológico: padrão proprietário sem FHIR/OpenEHR impede portabilidade do dado do paciente (LGPD art. 18 V) — avaliar antes de contratar fornecedor fechado.',
      'Risco de versão: FHIR e TISS têm releases frequentes; adapter deve carimbar a versão do padrão usada em cada integração (equivalente à invariante #8 para versão de norma).',
      'Lacuna no mapa canônico v1: HL7 FHIR e OpenEHR como padrões técnicos não constam dos eixos 1-12; orquestrador deve delegar à pesquisa-normativa para citar Res. ANS 501/22 atualizada e eventual Portaria MS/Conitec vigente.',
    ],
  },
  {
    tema: 'certificacao_sbis',
    regex: /SBIS|NGS2|NGS1|certifica[çc][ãa]o SBIS|certifica[çc][ãa]o CFM.*sistema|Sociedade Brasileira de Inform[áa]tica em Sa[úu]de/i,
    eixos: [2],
    riscos: [
      'Risco regulatório (CFM Res. 2.228/19 + SBIS/CFM NGS2): sistema sem certificação NGS2 obriga guarda do prontuário físico — adapter deve avisar que, se o PEP integrado não é certificado, o médico mantém dever de guarda do papel.',
      'Risco de prova: certificação SBIS cria presunção de integridade do registro; integrar com PEP não certificado desloca o ônus probatório para o médico em PEP/CRM.',
      'Risco de renovação: certificação NGS2 tem validade; adapter deve consultar o status corrente do fornecedor antes de carimbar o parecer.',
    ],
  },
  {
    tema: 'base_legal_integracao',
    regex: /base legal.*(?:integra[çc][ãa]o|LGPD art\.?\s*11|art\.?\s*11)|finalidade (?:da |de )?integra[çc][ãa]o|minimiza[çc][ãa]o de dados|DPIA|RIPD|relat[óo]rio de impacto|reten[çc][ãa]o (?:de dado|do dado)/i,
    eixos: [6],
    riscos: [
      'Risco LGPD (art. 11, II — rol taxativo): base legal para dado sensível de saúde é fechada; não há "legítimo interesse" aqui — adapter deve escolher UMA entre tutela da saúde (al. "f"), cumprimento de obrigação legal/regulatória (al. "a"), ou exercício regular de direitos (al. "d").',
      'Risco de desvio de finalidade (LGPD art. 6º I): dado puxado para "alertar prontuário incompleto" não pode ser reusado para marketing ou pesquisa; adapter precisa versionar a finalidade declarada.',
      'Risco de ausência de RIPD/DPIA (LGPD art. 38): integração que trata dado sensível em larga escala exige Relatório de Impacto; sem ele, exposição a sanção ANPD.',
      'Risco de retenção indevida (LGPD art. 16): adapter precisa de política de retenção explícita; dado puxado e nunca excluído configura tratamento sem base legal após extinção da finalidade.',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'prontuario_eletronico':
      return 'prontuário eletrônico (PEP)';
    case 'agendamento_integrado':
      return 'agendamento integrado';
    case 'mensageria_paciente':
      return 'mensageria com paciente';
    case 'receita_digital':
      return 'receita digital';
    case 'interoperabilidade':
      return 'interoperabilidade (FHIR/TISS/OpenEHR)';
    case 'certificacao_sbis':
      return 'certificação SBIS/CFM NGS2';
    case 'base_legal_integracao':
      return 'base legal e minimização da integração';
  }
}

export function criarIntegracaoSistemasMedico(
  opcoes: OpcoesIntegracaoSistemasMedico,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'integracao-sistemas-medico',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema de integração de sistemas foi reconhecido no fato_juridico (temas cobertos: PEP, agendamento, mensageria, receita digital, interoperabilidade FHIR/TISS, certificação SBIS, base legal LGPD da integração).',
    mensagemDelegacao:
      'Padrões técnicos (HL7 FHIR, OpenEHR, OAuth2/mTLS) e documentação proprietária dos fornecedores (iClinic, Memed, Tasy, etc.) não constam do mapa canônico v1; orquestrador deve delegar à pesquisa-normativa para Res. ANS 501/22 atualizada e revisor-lgpd antes de qualquer rascunho final (regra do agente).',
  });
}
