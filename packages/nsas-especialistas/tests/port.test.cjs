const test = require('node:test');
const assert = require('node:assert/strict');
const { ErroConsultaEspecialista } = require('..');

test('ErroConsultaEspecialista estende Error e carrega nome fixo', () => {
  const erro = new ErroConsultaEspecialista('pesquisa-normativa', 'interno', 'falha');
  assert.ok(erro instanceof Error);
  assert.ok(erro instanceof ErroConsultaEspecialista);
  assert.equal(erro.name, 'ErroConsultaEspecialista');
});

test('ErroConsultaEspecialista expõe dominio, motivo e message', () => {
  const erro = new ErroConsultaEspecialista('etica-medica-prontuario', 'timeout', 'tempo excedido');
  assert.equal(erro.dominio, 'etica-medica-prontuario');
  assert.equal(erro.motivo, 'timeout');
  assert.equal(erro.message, 'tempo excedido');
});

test('ErroConsultaEspecialista aceita os quatro motivos declarados', () => {
  const motivos = ['fonte_indisponivel', 'caso_invalido', 'timeout', 'interno'];
  for (const motivo of motivos) {
    const erro = new ErroConsultaEspecialista('dominio-x', motivo, `motivo=${motivo}`);
    assert.equal(erro.motivo, motivo);
    assert.equal(erro.name, 'ErroConsultaEspecialista');
    assert.equal(erro.dominio, 'dominio-x');
  }
});
