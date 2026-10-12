const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

test('classificador padrão expõe os 5 domínios com regra ativa', () => {
  const c = api.criarClassificadorNsasPadrao();
  assert.ok(c.dominios.includes('etica-medica-prontuario'));
  assert.ok(c.dominios.includes('comunicacao-medico-paciente'));
  assert.ok(c.dominios.includes('juridico-saude-suplementar'));
  assert.ok(c.dominios.includes('compliance-regulatorio-lgpd'));
  assert.ok(c.dominios.includes('operacional-dh-aps'));
});

test('fato vazio cai no fallback (pesquisa-normativa)', () => {
  const c = api.criarClassificadorNsasPadrao();
  assert.deepEqual(c.classificar(''), ['pesquisa-normativa']);
  assert.deepEqual(c.classificar('   '), ['pesquisa-normativa']);
});

test('WhatsApp roteia para comunicação médico-paciente', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('médico envia foto de lesão por WhatsApp');
  assert.ok(d.includes('comunicacao-medico-paciente'));
});

test('glosa de operadora roteia para saúde suplementar', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('operadora aplicou glosa sem fundamentação');
  assert.ok(d.includes('juridico-saude-suplementar'));
});

test('vazamento de dados roteia para compliance-regulatorio-lgpd', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('clínica sofreu vazamento de dados sensíveis');
  assert.ok(d.includes('compliance-regulatorio-lgpd'));
});

test('abandono de paciente roteia para operacional-dh-aps', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('médico quer encerrar vínculo sem continuidade do cuidado');
  assert.ok(d.includes('operacional-dh-aps'));
});

test('prontuário roteia para ética médica', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('alteração retroativa de prontuário médico');
  assert.ok(d.includes('etica-medica-prontuario'));
});

test('multi-domínio: WhatsApp + glosa dispara 2 domínios', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('operadora glosou procedimento após médico orientar paciente por WhatsApp');
  assert.ok(d.includes('comunicacao-medico-paciente'));
  assert.ok(d.includes('juridico-saude-suplementar'));
});

test('fato totalmente fora de escopo cai no fallback', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('discussão sobre reajuste do aluguel comercial do consultório');
  assert.deepEqual(d, ['pesquisa-normativa']);
});

test('classificação não produz domínios duplicados', () => {
  const c = api.criarClassificadorNsasPadrao();
  const d = c.classificar('WhatsApp e Instagram do médico — publicidade com antes e depois');
  const dedup = new Set(d);
  assert.equal(d.length, dedup.size);
});

test('regras customizadas substituem o padrão', () => {
  const c = api.criarClassificadorNsasPadrao({
    regras: [{ dominio: 'especialista-x', regex: /gatilho-x/i }],
    fallback: ['nenhum'],
  });
  assert.deepEqual(c.classificar('gatilho-x presente'), ['especialista-x']);
  assert.deepEqual(c.classificar('sem gatilho'), ['nenhum']);
});

test('integração: classificador → roteador consulta apenas domínios casados', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const classificador = api.criarClassificadorNsasPadrao();
  const roteador = api.criarRoteadorEspecialistas({ mapa });

  const fato = 'operadora negou autorização prévia e clínica teve vazamento de dados';
  const dominios = classificador.classificar(fato);

  assert.ok(dominios.includes('juridico-saude-suplementar'));
  assert.ok(dominios.includes('compliance-regulatorio-lgpd'));

  const pacote = await roteador.consultarDominios(dominios, {
    caso_id: '00000000-0000-0000-0000-0000000000aa',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: { tradutor_v: '1.0', detectores: [], predicados_verificados: [] },
  });

  assert.equal(pacote.pareceres.length, dominios.length);
  assert.equal(pacote.erros.length, 0);
});
