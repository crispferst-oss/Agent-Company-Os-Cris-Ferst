import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

export interface OpcoesEticaMedicaProntuario {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'prontuario'
  | 'segredo'
  | 'telemedicina'
  | 'documento_medico'
  | 'alteracao_retroativa';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'alteracao_retroativa',
    regex: /rasura|altera[çc][ãa]o retroativ|exclus[ãa]o retroativ|apagar registro|refazer prontu/i,
    eixos: [2],
    riscos: [
      'Risco probatório em perícia: alteração retroativa de prontuário é indício de má-fé e inversão de ônus da prova; adicionar nota datada em vez de modificar o registro original.',
      'Risco ético (CFM): adulteração de prontuário configura infração ética passível de PEP (CFM Res. 2.145/2016).',
      'Risco cível/consumerista: prontuário adulterado perde valor probatório e tende a decidir ação indenizatória contra o médico.',
    ],
  },
  {
    tema: 'prontuario',
    regex: /prontu[áa]rio|anota[çc][ãa]o cl[íi]nica|registro cl[íi]nico|guarda do registro|c[óo]pia ao paciente/i,
    eixos: [2],
    riscos: [
      'Risco ético (CFM): prontuário incompleto, ilegível ou sem identificação viola CEM; sujeita a sindicância/PEP no CRM.',
      'Risco probatório em perícia: lacuna, ausência de data/hora, falta de assinatura/CRM ou abreviatura não padronizada enfraquecem a defesa do médico.',
      'Risco de guarda: Lei 13.787/18 exige guarda mínima de 20 anos a partir do último registro; descarte prematuro gera responsabilidade.',
    ],
  },
  {
    tema: 'segredo',
    regex: /segredo|sigilo|revela[çc][ãa]o|dever de informar|quebra de confidencialidade/i,
    eixos: [1],
    riscos: [
      'Risco ético (CFM): quebra de segredo médico fora das exceções do CEM arts. 73-79 configura infração ética grave.',
      'Risco cível: revelação indevida gera dever de indenizar por danos morais; interseção com LGPD art. 11 (dado sensível).',
      'Risco criminal: art. 154 CP (violação de segredo profissional), ação penal privada.',
    ],
  },
  {
    tema: 'telemedicina',
    regex: /telemed|teleconsult|teleorient|telediagn[óo]stic|telemonitor|telecirurg/i,
    eixos: [3],
    riscos: [
      'Risco ético (CFM): teleconsulta sem registro em prontuário físico/eletrônico e sem consentimento específico viola CFM Res. 2.314/22.',
      'Risco de prescrição: receita eletrônica sem assinatura ICP-Brasil ou validação CFM é inválida.',
      'Risco de plataforma: uso de plataforma não certificada (SBIS/NGS2 adaptado) fragiliza a validade jurídica do atendimento.',
    ],
  },
  {
    tema: 'documento_medico',
    regex: /atestado|receita|laudo|declara[çc][ãa]o m[ée]dica|parecer m[ée]dico/i,
    eixos: [5],
    riscos: [
      'Risco ético (CFM): atestado/laudo sem identificação completa, CID (quando devido) ou com conteúdo falso configura infração ética.',
      'Risco criminal: atestado falso tipifica art. 302 CP (crime próprio do médico).',
      'Risco cível: documento médico sem forma mínima perde eficácia perante órgãos públicos e judiciário.',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'prontuario':
      return 'prontuário médico';
    case 'segredo':
      return 'segredo médico';
    case 'telemedicina':
      return 'telemedicina';
    case 'documento_medico':
      return 'documento médico (atestado/receita/laudo/declaração)';
    case 'alteracao_retroativa':
      return 'alteração retroativa de registro';
  }
}

export function criarEticaMedicaProntuario(
  opcoes: OpcoesEticaMedicaProntuario,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'etica-medica-prontuario',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema de ética médica ou prontuário foi reconhecido no fato_juridico (temas cobertos: prontuário, segredo, telemedicina, documento médico, alteração retroativa).',
    mensagemDelegacao:
      'Resoluções CFM mudam com frequência; para corte temporal recente, orquestrador deve acionar pesquisa-normativa como nó irmão (não há chamada direta entre especialistas).',
  });
}
