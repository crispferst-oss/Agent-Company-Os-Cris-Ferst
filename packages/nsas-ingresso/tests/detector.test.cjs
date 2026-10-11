const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');

test('MIME DICOM é recusado como DC-1 na borda (fail-closed)', () => {
  const resultado = api.avaliarIngressoAdministrativo({
    texto: 'segue exame do paciente',
    anexos: [{ nome: 'exame.dcm', mime: 'application/dicom' }],
  });
  assert.equal(resultado.aceito, false);
  assert.match(resultado.motivoRecusa, /canal administrativo/i);
  assert.ok(resultado.orientacao.includes('Canal Clínico Segregado'));
  assert.equal(resultado.veredictos.length, 1);
  assert.equal(resultado.veredictos[0].classe, 'DC-1');
  assert.equal(resultado.veredictos[0].acao, 'recusa_dura');
});

test('nome com extensão clínica (ex: laudo-tc.pdf) é recusado mesmo sem MIME suspeito', () => {
  const resultado = api.avaliarIngressoAdministrativo({
    anexos: [{ nome: 'laudo-tc.pdf', mime: 'application/pdf' }],
  });
  assert.equal(resultado.aceito, false);
  assert.equal(resultado.veredictos[0].classe, 'DC-1');
  assert.ok(resultado.veredictos[0].confianca >= 0.9);
});

test('anexo sem indício clínico passa (classe limpo, aceito=true)', () => {
  const resultado = api.avaliarIngressoAdministrativo({
    texto: 'pergunta sobre honorários',
    anexos: [{ nome: 'proposta-comercial.pdf', mime: 'application/pdf' }],
  });
  assert.equal(resultado.aceito, true);
  assert.equal(resultado.veredictos[0].classe, 'limpo');
  assert.equal(resultado.veredictos[0].acao, 'aceita');
});

test('mensagem sem anexos passa (texto puro vai adiante na Fase A)', () => {
  const resultado = api.avaliarIngressoAdministrativo({
    texto: 'médico pergunta sobre atualização do CEM',
  });
  assert.equal(resultado.aceito, true);
  assert.equal(resultado.veredictos.length, 0);
});

test('múltiplos anexos: um bloqueante basta para recusar o conjunto', () => {
  const resultado = api.avaliarIngressoAdministrativo({
    anexos: [
      { nome: 'contrato.pdf', mime: 'application/pdf' },
      { nome: 'exame.dcm', mime: 'application/dicom' },
    ],
  });
  assert.equal(resultado.aceito, false);
  assert.equal(resultado.veredictos.length, 2);
  assert.equal(resultado.veredictos[0].classe, 'limpo');
  assert.equal(resultado.veredictos[1].classe, 'DC-1');
});

test('classificarAnexoDC1 isolado: FHIR também recusa', () => {
  const veredicto = api.classificarAnexoDC1({ nome: 'bundle.json', mime: 'application/fhir+json' });
  assert.equal(veredicto.classe, 'DC-1');
  assert.equal(veredicto.acao, 'recusa_dura');
});
