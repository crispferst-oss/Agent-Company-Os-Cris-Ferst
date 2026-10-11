import type { NsasDetectorVeredicto } from '@jev/shared-types';

/**
 * Detector de dado clínico na borda — Fase A implementa apenas DC-1 (binário clínico).
 * DC-2, DC-3, DC-4 ficam para Fase B conforme ADR-009.
 *
 * Invariante arquitetural ([.claude/decisions/ADR-006](../../.claude/decisions/ADR-006-arquitetura-hexagonal.md)):
 * o detector roda SOMENTE no adapter de borda; o núcleo jurídico nunca vê bytes brutos.
 */

export interface AnexoBruto {
  readonly nome: string;
  readonly mime?: string;
  readonly tamanhoBytes?: number;
}

/**
 * MIMEs que, por si só, caracterizam dado clínico binário (DC-1).
 * Lista mínima; estender conforme ADR nova.
 */
const MIMES_CLINICOS_DUROS = new Set<string>([
  'application/dicom',
  'application/dicom+json',
  'image/dicom-rle',
  'application/hl7-v2+er7',
  'application/hl7-v2+xml',
  'application/hl7-v3+xml',
  'application/fhir+json',
  'application/fhir+xml',
]);

/**
 * Extensões típicas de laudo/exame/imagem médica.
 * Combinam com `application/pdf` ou `application/octet-stream` para configurar DC-1.
 */
const EXTENSOES_SUSPEITAS = /\.(dcm|dicom|hl7|fhir|laudo|exame|prontuario|prontuário|rx|ecg|usg|tc|rm|mamografia)(\.|$)/iu;

/**
 * Classifica um anexo quanto a dado clínico binário (DC-1).
 * Fail-closed: na dúvida, recusa.
 */
export function classificarAnexoDC1(anexo: AnexoBruto): NsasDetectorVeredicto {
  const mime = (anexo.mime ?? '').toLowerCase();
  const nome = anexo.nome ?? '';

  if (MIMES_CLINICOS_DUROS.has(mime)) {
    return {
      classe: 'DC-1',
      confianca: 1,
      acao: 'recusa_dura',
      motivo: `MIME '${mime}' é clínico de produção; não pode entrar por canal administrativo. Via legítima: Canal Clínico Segregado.`,
      span: { campo: 'mime' },
    };
  }

  if (EXTENSOES_SUSPEITAS.test(nome)) {
    return {
      classe: 'DC-1',
      confianca: 0.9,
      acao: 'recusa_dura',
      motivo: `Nome de arquivo '${nome}' sugere laudo/exame/imagem médica. Via legítima: Canal Clínico Segregado.`,
      span: { campo: 'nome' },
    };
  }

  return {
    classe: 'limpo',
    confianca: 1,
    acao: 'aceita',
    motivo: 'Anexo não classificado como DC-1.',
  };
}

export interface IngressoAdministrativo {
  readonly texto?: string;
  readonly anexos?: ReadonlyArray<AnexoBruto>;
}

export interface ResultadoBorda {
  readonly aceito: boolean;
  readonly motivoRecusa?: string;
  readonly orientacao?: string;
  readonly veredictos: ReadonlyArray<NsasDetectorVeredicto>;
}

/**
 * Avalia uma mensagem administrativa (WhatsApp, e-mail, formulário) na borda do CCS.
 * Qualquer anexo DC-1 ⇒ recusa dura (fail-closed, invariante ADR-009).
 * Fase A: só avalia anexos. Texto corporal passa adiante — DC-2/DC-3 serão
 * implementados em pacotes separados (ADR-009).
 */
export function avaliarIngressoAdministrativo(entrada: IngressoAdministrativo): ResultadoBorda {
  const veredictos = (entrada.anexos ?? []).map(classificarAnexoDC1);
  const bloqueantes = veredictos.filter((v) => v.acao === 'recusa_dura');

  if (bloqueantes.length > 0) {
    return {
      aceito: false,
      motivoRecusa: bloqueantes[0].motivo,
      orientacao:
        'Dado clínico não deve trafegar por canal administrativo. ' +
        'Encaminhar o conteúdo via Canal Clínico Segregado (CCS) do consultório — ' +
        'o profissional de saúde ou a própria titular do dado faz o upload direto, ' +
        'nunca a secretária/administrativo.',
      veredictos,
    };
  }

  return {
    aceito: true,
    veredictos,
  };
}
