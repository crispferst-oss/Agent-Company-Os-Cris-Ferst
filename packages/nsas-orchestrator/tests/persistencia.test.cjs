const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { BancoNsasSqlite, CasoSqliteRepository, AprovacaoSqliteRepository } = require('../dist/persistencia');
const id = 'e7a6f0ee-9f91-4cb6-8912-b611f89de293';
const horario = '2026-10-12T12:00:00.000Z';
const clock = { agora: () => '2026-10-12T13:00:00.000Z' };
const caso = { caso_id: id, estado: 'iniciado', criado_em: horario, atualizado_em: horario };
function ambiente(t) {
  const dir = mkdtempSync(join(tmpdir(), 'nsas-db-'));
  const path = join(dir, 'casos.sqlite');
  const banco = new BancoNsasSqlite(path);
  t.after(() => { banco.close(); rmSync(dir, { recursive: true, force: true }); });
  return { banco, path, repo: new CasoSqliteRepository(banco, clock) };
}
test('operação repetida devolve snapshot original após mudança de estado e reabertura', async t => {
  const { banco, path, repo } = ambiente(t);
  assert.equal(await repo.obter(id), null);
  assert.deepEqual(await repo.salvarIdempotente(caso, 'iniciar'), caso);
  await repo.atualizarEstado(id, 'classificado');
  assert.deepEqual(await repo.salvarIdempotente({ ...caso, estado: 'abortado' }, 'iniciar'), caso);
  banco.close();
  const outro = new BancoNsasSqlite(path);
  try {
    const recuperado = new CasoSqliteRepository(outro, clock);
    assert.equal((await recuperado.obter(id)).estado, 'classificado');
    assert.deepEqual(await recuperado.salvarIdempotente(caso, 'iniciar'), caso);
  } finally { outro.close(); }
});
test('falha de constraint desfaz caso e operação e não revela conteúdo do erro', async t => {
  const { banco, repo } = ambiente(t);
  banco.db.exec("CREATE TRIGGER falha BEFORE INSERT ON operacao BEGIN SELECT RAISE(ABORT,'segredo-clinico'); END");
  await assert.rejects(repo.salvarIdempotente(caso, 'iniciar'), erro => erro.message === 'Falha na persistência NSAS.' && !erro.cause);
  assert.equal(await repo.obter(id), null);
  banco.db.exec('DROP TRIGGER falha');
  assert.deepEqual(await repo.salvarIdempotente(caso, 'iniciar'), caso);
});
test('rascunho e decisão são imutáveis e aprovação exige hash persistido', async t => {
  const { banco, repo } = ambiente(t);
  const aprovacoes = new AprovacaoSqliteRepository(banco);
  const hash = 'A'.repeat(43);
  const aprovacao = { caso_id: id, rascunho_hash: hash, decisao: 'aprovado', justificativa: 'Validado', horario, oab_kid: 'test-only', assinatura_ed25519: 'A'.repeat(86) };
  assert.equal(await repo.obterRascunho(id), null);
  assert.equal(await aprovacoes.obterPorHash(id, hash), null);
  await repo.salvarIdempotente(caso, 'iniciar');
  await assert.rejects(aprovacoes.registrar(aprovacao));
  await repo.salvarRascunho(id, hash, 'Nota pseudonimizada');
  await repo.salvarRascunho(id, hash, 'Nota pseudonimizada');
  await assert.rejects(repo.salvarRascunho(id, hash, 'Alterado'));
  assert.deepEqual(await repo.obterRascunho(id), { hash, conteudo: 'Nota pseudonimizada' });
  await aprovacoes.registrar(aprovacao);
  await aprovacoes.registrar(aprovacao);
  await assert.rejects(aprovacoes.registrar({ ...aprovacao, decisao: 'rejeitado' }));
  assert.deepEqual(await aprovacoes.obterPorHash(id, hash), aprovacao);
});
test('schema futuro é recusado e auditoria não permite update ou delete', t => {
  const { banco, path } = ambiente(t);
  banco.db.exec("INSERT INTO auditoria(prev_hash,payload_canonico,hash) VALUES ('','{}','a')");
  assert.throws(() => banco.db.exec("UPDATE auditoria SET hash='b'"));
  assert.throws(() => banco.db.exec('DELETE FROM auditoria'));
  banco.db.exec('PRAGMA user_version=99');
  assert.throws(() => new BancoNsasSqlite(path), /Falha na persistência/);
});
test('entradas inválidas e caso ausente falham sem criar estado parcial', async t => {
  const { repo } = ambiente(t);
  await assert.rejects(repo.atualizarEstado(id, 'rascunho'));
  await assert.rejects(repo.salvarIdempotente({ ...caso, segredo: 'privado' }, 'iniciar'));
  await assert.rejects(repo.salvarIdempotente(caso, ''));
  assert.equal(await repo.obter(id), null);
});
test('conexões independentes disputam a mesma operação e recebem snapshot único', async t => {
  const { Worker } = require('node:worker_threads');
  const { path } = ambiente(t);
  const modulo = require.resolve('../dist/persistencia');
  const results = await Promise.all(Array.from({ length: 4 }, (_, indice) => new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { workerData, parentPort } = require('node:worker_threads');
      const { BancoNsasSqlite, CasoSqliteRepository } = require(workerData.modulo);
      const banco = new BancoNsasSqlite(workerData.path);
      const repo = new CasoSqliteRepository(banco, { agora: () => workerData.caso.atualizado_em });
      repo.salvarIdempotente(workerData.caso, 'concorrente').then(resultado => {
        banco.close(); parentPort.postMessage(resultado);
      }).catch(erro => { banco.close(); throw erro; });
    `, { eval: true, workerData: { path, modulo, caso: { ...caso, estado: indice % 2 ? 'classificado' : 'iniciado' } } });
    worker.once('message', resolve); worker.once('error', reject);
    worker.once('exit', codigo => { if (codigo) reject(new Error('Worker falhou')); });
  })));
  results.forEach(resultado => assert.deepEqual(resultado, results[0]));
});
test('plano persistido, relógio injetado e repetição não alteram snapshot', async t => {
  const { repo } = ambiente(t);
  const plano = { versao: 'v1', nos: [{ id: 'n1', dominio: 'civil', depende_de: [], politica: 'abortar', timeout_ms: 100 }] };
  const original = { ...caso, plano };
  assert.deepEqual(await repo.salvarIdempotente(original, 'iniciar'), original);
  await repo.atualizarEstado(id, 'executando');
  const atual = await repo.obter(id);
  assert.equal(atual.atualizado_em, clock.agora());
  assert.deepEqual(atual.plano, plano);
  assert.deepEqual(await repo.salvarIdempotente({ ...caso, plano: { ...plano, versao: 'v2' } }, 'iniciar'), original);
  assert.deepEqual((await repo.obter(id)).plano, plano);
});
test('transação recusa callback assíncrono e desfaz escrita anterior', async t => {
  const { banco, repo } = ambiente(t);
  assert.throws(() => banco.transacao(() => {
    banco.db.prepare('INSERT INTO caso VALUES (?,?,?,?)').run(id, 'iniciado', horario, horario);
    return Promise.resolve();
  }), /Falha na persistência/);
  assert.equal(await repo.obter(id), null);
});
test('transação preserva erro de domínio após rollback', async t => {
  const { ErroOrquestrador } = require('../dist/contratos');
  const { banco, repo } = ambiente(t);
  const erro = new ErroOrquestrador('auditoria_corrompida', 'Auditoria inválida.');
  assert.throws(() => banco.transacao(() => {
    banco.db.prepare('INSERT INTO caso VALUES (?,?,?,?)').run(id, 'iniciado', horario, horario);
    throw erro;
  }), resultado => resultado === erro);
  assert.equal(await repo.obter(id), null);
});
