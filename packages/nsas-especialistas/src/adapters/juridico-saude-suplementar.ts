import type { MapaNormativo } from '../mapa-normativo';
import type { ConsultarEspecialista } from '../port';
import { criarAdapterTemas, type EntradaTema } from './_tema-based';

export interface OpcoesJuridicoSaudeSuplementar {
  readonly mapa: MapaNormativo;
}

type Tema =
  | 'glosa_auditoria'
  | 'autorizacao_previa'
  | 'cobertura_fora_rol'
  | 'reembolso_livre_escolha'
  | 'laudo_para_operadora'
  | 'tutela_urgencia_cobertura'
  | 'credenciamento';

const TEMAS: ReadonlyArray<EntradaTema<Tema>> = [
  {
    tema: 'glosa_auditoria',
    regex: /glosa|auditoria (?:m[ée]dica|da operadora)|recurso de glosa|auditor da operadora/i,
    eixos: [9],
    riscos: [
      'Risco contratual: glosa sem fundamentação técnica individualizada afronta Lei 9.656/98 e RN ANS; médico deve exigir motivação por escrito antes de aceitar o débito.',
      'Risco probatório: ausência de prontuário detalhado (CFM Res. 2.228/19) enfraquece o recurso de glosa — a defesa técnica depende do registro clínico contemporâneo.',
      'Risco de prazo: recurso administrativo contra glosa tem prazo contratual curto; silêncio é aceitação tácita.',
    ],
  },
  {
    tema: 'autorizacao_previa',
    regex: /autoriza[çc][ãa]o pr[ée]via|nega(?:tiva|ção) de autoriza|prazo (?:da|de) opera|OPME|senha da operadora/i,
    eixos: [9],
    riscos: [
      'Risco regulatório: operadora deve observar os prazos máximos da RN ANS 259/2011 para autorização; descumprimento é infração administrativa e fundamenta tutela de urgência.',
      'Risco ao paciente: negativa sem motivação técnica escrita viola CDC art. 6º III (dever de informar) e Lei 9.656/98; cabe denúncia à ANS.',
      'Risco ao médico: pedido mal fundamentado tecnicamente (CID, justificativa, alternativas descartadas) é a principal porta de entrada da glosa — a autorização começa no laudo.',
    ],
  },
  {
    tema: 'cobertura_fora_rol',
    regex: /fora do rol|rol da ANS|rol taxativo|rol exemplificativo|cobertura negada|procedimento n[ãa]o coberto/i,
    eixos: [9],
    riscos: [
      'Risco de tese: após Lei 14.454/22, o rol é exemplificativo — negativa de cobertura fora do rol exige demonstração de ineficácia das alternativas e evidência científica (art. 10 §§12-13 da Lei 9.656/98).',
      'Risco de atualização: RN ANS 465/21 é atualizada por PROCADI/COSAÚDE com frequência; antes de citar procedimento específico, revalidar vigência (invariante do mapa).',
      'Risco de prova: cabe ao médico instruir o pedido com evidência (diretriz de sociedade médica, estudo, parecer) — não é ônus do paciente.',
    ],
  },
  {
    tema: 'reembolso_livre_escolha',
    regex: /reembolso|livre escolha|fora da rede|m[ée]dico n[ãa]o credenciado|tabela de reembolso/i,
    eixos: [9],
    riscos: [
      'Risco contratual: reembolso é direito previsto no art. 12 VI da Lei 9.656/98 quando o contrato prevê livre escolha; cláusula de limitação deve ser clara e proporcional.',
      'Risco de abusividade: tabela de reembolso aviltante que esvazia a livre escolha pode ser revista judicialmente (CDC art. 51 IV; jurisprudência STJ).',
      'Risco documental: paciente deve ter recibo com CRM, CPF, descrição do ato e CID — a falha no recibo é a defesa mais usada pela operadora.',
    ],
  },
  {
    tema: 'laudo_para_operadora',
    regex: /laudo (?:para|a[ao]) operadora|justificativa cl[íi]nica|parecer t[ée]cnico para plano|relat[óo]rio m[ée]dico para auditoria/i,
    eixos: [9],
    riscos: [
      'Risco de glosa: laudo sem CID, sem alternativas descartadas e sem evidência científica é causa frequente de negativa — a autorização começa pela qualidade do laudo.',
      'Risco ético (CFM): laudo deve refletir fielmente o estado clínico; adulteração para forçar cobertura configura infração ética (CFM Res. 2.217/18).',
      'Risco LGPD: compartilhamento de dado clínico com auditor da operadora deve ter base legal (execução de contrato / tutela de saúde — LGPD art. 11 II f) e registro de operação.',
    ],
  },
  {
    tema: 'tutela_urgencia_cobertura',
    regex: /tutela de urg[êe]ncia|liminar.*plano|liminar.*opera|perigo de dano|antecipa[çc][ãa]o de tutela/i,
    eixos: [9],
    riscos: [
      'Risco de rito: tutela de urgência (CPC art. 300) exige probabilidade do direito + perigo de dano; em medicamento/procedimento, Tema 106/STJ orienta critérios análogos para plano.',
      'Risco de evidência: havendo tese firmada (STJ Tema 990 e correlatos) e prova documental, cabe tutela de evidência (CPC art. 311) — mais rápida que a de urgência.',
      'Risco de execução: pedir astreintes (CPC art. 537) desde a inicial para pressionar o cumprimento pela operadora.',
    ],
  },
  {
    tema: 'credenciamento',
    regex: /credenciamento|descredenciamento|rede credenciada|contrato com operadora|rescis[ãa]o unilateral da operadora/i,
    eixos: [9],
    riscos: [
      'Risco contratual: descredenciamento unilateral exige aviso prévio e substituição equivalente (Lei 9.656/98 art. 17); pacientes em tratamento têm direito à continuidade.',
      'Risco concorrencial: cláusulas de exclusividade ou de tabela imposta podem configurar prática abusiva — avaliar denúncia ao CADE/ANS conforme o caso.',
      'Risco patrimonial: antes de aceitar credenciamento, revisar tabela, prazos de pagamento, política de glosa e cláusula de reajuste — o contrato é o chão da relação.',
    ],
  },
];

function rotuloTema(tema: Tema): string {
  switch (tema) {
    case 'glosa_auditoria':
      return 'glosa e auditoria da operadora';
    case 'autorizacao_previa':
      return 'autorização prévia';
    case 'cobertura_fora_rol':
      return 'cobertura fora do rol';
    case 'reembolso_livre_escolha':
      return 'reembolso e livre escolha';
    case 'laudo_para_operadora':
      return 'laudo técnico para operadora';
    case 'tutela_urgencia_cobertura':
      return 'tutela de urgência contra operadora';
    case 'credenciamento':
      return 'credenciamento/descredenciamento';
  }
}

export function criarJuridicoSaudeSuplementar(
  opcoes: OpcoesJuridicoSaudeSuplementar,
): ConsultarEspecialista {
  return criarAdapterTemas<Tema>({
    dominio: 'juridico-saude-suplementar',
    mapa: opcoes.mapa,
    temas: TEMAS,
    rotuloTema,
    mensagemLacuna:
      'Nenhum tema de saúde suplementar foi reconhecido no fato_juridico (temas cobertos: glosa, autorização prévia, cobertura fora do rol, reembolso, laudo para operadora, tutela de urgência, credenciamento).',
    mensagemDelegacao:
      'RN ANS (259/11, 465/21) e teses do STJ sobre cobertura mudam com frequência; para corte temporal recente, orquestrador deve acionar pesquisa-normativa como nó irmão (recursão zero, invariante #6).',
  });
}
