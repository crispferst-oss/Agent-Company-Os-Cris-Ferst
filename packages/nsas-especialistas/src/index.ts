export { ErroConsultaEspecialista, type ConsultarEspecialista } from './port';
export {
  carregarMapaNormativo,
  parsearMapaNormativo,
  type EntradaNormativa,
  type MapaNormativo,
} from './mapa-normativo';
export {
  criarAdapterTemas,
  type ConfigAdapterTemas,
  type EntradaTema,
} from './adapters/_tema-based';
export {
  PesquisaNormativaAdapter,
  type OpcoesPesquisaNormativa,
} from './adapters/pesquisa-normativa';
export {
  criarEticaMedicaProntuario,
  type OpcoesEticaMedicaProntuario,
} from './adapters/etica-medica-prontuario';
export {
  criarComunicacaoMedicoPaciente,
  type OpcoesComunicacaoMedicoPaciente,
} from './adapters/comunicacao-medico-paciente';
export {
  criarJuridicoSaudeSuplementar,
  type OpcoesJuridicoSaudeSuplementar,
} from './adapters/juridico-saude-suplementar';
export {
  criarComplianceRegulatorioLgpd,
  type OpcoesComplianceRegulatorioLgpd,
} from './adapters/compliance-regulatorio-lgpd';
export {
  criarOperacionalDhAps,
  type OpcoesOperacionalDhAps,
} from './adapters/operacional-dh-aps';
export {
  criarConsultoriaOrganizacional,
  type OpcoesConsultoriaOrganizacional,
} from './adapters/consultoria-organizacional';
export {
  criarIntegracaoSistemasMedico,
  type OpcoesIntegracaoSistemasMedico,
} from './adapters/integracao-sistemas-medico';
export {
  criarRoteadorEspecialistas,
  adaptersPadrao,
  DOMINIOS_NSAS_PADRAO,
  type RoteadorEspecialistas,
  type PacoteConsultaEspecialistas,
  type ErroPacoteEspecialistas,
  type OpcoesRoteador,
} from './roteador';
export {
  criarClassificadorNsasPadrao,
  REGRAS_CLASSIFICACAO_PADRAO,
  type ClassificadorDominio,
  type RegraClassificacao,
  type OpcoesClassificador,
} from './classificador';
export {
  criarRedatorNotaTecnica,
  type RedatorNotaTecnica,
  type MetadadosNotaTecnica,
  type OpcoesRedacao,
} from './redator';
export {
  ErroMemoriaInstitucional,
  type StatusValidacao,
  type NotaInstitucional,
  type FiltroMemoria,
  type RegistrarMemoriaInstitucional,
  type ConsultarMemoriaInstitucional,
  type ContextoMemoriaInstitucional,
} from './memoria';
export {
  MemoriaSqliteAdapter,
  validarAntesDeGravar,
  calcularHuella,
  type OpcoesMemoriaSqlite,
} from './adapters/memoria-sqlite';
export {
  consultarMemoriaParaPacote,
  dominiosDoPacote,
  type OpcoesIntegracao,
} from './integracao-memoria';
