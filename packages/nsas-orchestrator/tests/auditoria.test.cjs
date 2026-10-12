const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { AncoraArquivo } = require('../dist/auditoria');

function temporario(t, fechar = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsas-audit-'));
  t.after(() => { fechar(); fs.rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

test('âncora externa persiste checkpoint e não permite reinicialização', t => {
  const arquivo = path.join(temporario(t), 'ancora.json');
  const ancora = new AncoraArquivo(arquivo);
  assert.equal(ancora.ler(), null);
  ancora.inicializar();
  assert.deepEqual(ancora.ler(), { quantidade: 0, ultimo_hash: '' });
  const checkpoint = { quantidade: 1, ultimo_hash: 'A'.repeat(43) };
  ancora.gravar(checkpoint);
  assert.deepEqual(new AncoraArquivo(arquivo).ler(), checkpoint);
  assert.throws(() => ancora.inicializar(), /âncora/i);
});

test('auditoria encadeada sobrevive à reabertura e detecta truncamento da cauda', async t => {
  const { BancoNsasSqlite } = require('../dist/persistencia');
  const { AuditSqliteRepository } = require('../dist/auditoria');
  let banco;
  const dir = temporario(t, () => banco?.close());
  const caminho = path.join(dir, 'dados.sqlite');
  const ancora = new AncoraArquivo(path.join(dir, 'ancora.json'));
  banco = new BancoNsasSqlite(caminho);
  let audit = new AuditSqliteRepository(banco, ancora);
  audit.inicializar();
  await audit.anexar({ tipo: 'iniciado', horario: '2026-10-12T12:00:00.000Z', payload: { estado: 'iniciado' } });
  await audit.anexar({ tipo: 'classificado', horario: '2026-10-12T12:00:01.000Z', payload: { estado: 'classificado' } });
  assert.deepEqual(await audit.verificar(), { ok: true });
  assert.equal(ancora.ler().quantidade, 2);
  banco.close();
  banco = new BancoNsasSqlite(caminho);
  audit = new AuditSqliteRepository(banco, ancora);
  assert.deepEqual(await audit.verificar(), { ok: true });
  // Simula invasor com acesso SQL direto, ultrapassando o adapter append-only.
  banco.db.exec('DROP TRIGGER auditoria_sem_delete; DELETE FROM auditoria WHERE id = 2');
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 2, motivo: 'cadeia_quebrada' });
  await assert.rejects(audit.anexar({ tipo: 'novo', horario: '2026-10-12T12:00:02.000Z', payload: {} }), { motivo: 'auditoria_corrompida' });
});

async function historico(t) {
  const { BancoNsasSqlite } = require('../dist/persistencia');
  const { AuditSqliteRepository } = require('../dist/auditoria');
  let banco;
  const dir = temporario(t, () => banco?.close());
  banco = new BancoNsasSqlite(path.join(dir, 'dados.sqlite'));
  const ancora = new AncoraArquivo(path.join(dir, 'ancora.json'));
  const audit = new AuditSqliteRepository(banco, ancora);
  audit.inicializar();
  for (const tipo of ['iniciado', 'classificado', 'rascunho']) {
    await audit.anexar({ tipo, horario: '2026-10-12T12:00:00.000Z', payload: { estado: tipo } });
  }
  return { banco, ancora, audit };
}

test('triggers bloqueiam UPDATE e DELETE e não alteram a cadeia', async t => {
  const { banco, audit } = await historico(t);
  assert.throws(() => banco.db.exec("UPDATE auditoria SET hash='inválido' WHERE id=1"), /imutavel/);
  assert.throws(() => banco.db.exec('DELETE FROM auditoria WHERE id=3'), /imutavel/);
  assert.deepEqual(await audit.verificar(), { ok: true });
});

test('remoção no meio e remoção total são detectadas pela cadeia e pela âncora', async t => {
  const { banco, audit } = await historico(t);
  banco.db.exec('DROP TRIGGER auditoria_sem_delete; DELETE FROM auditoria WHERE id=2');
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 2, motivo: 'cadeia_quebrada' });
  banco.db.exec('DELETE FROM auditoria');
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 1, motivo: 'cadeia_quebrada' });
});

test('alteração do payload com JSON válido diverge do hash e JSON inválido é identificado', async t => {
  const { banco, audit } = await historico(t);
  banco.db.exec('DROP TRIGGER auditoria_sem_update');
  banco.db.prepare('UPDATE auditoria SET payload_canonico=? WHERE id=2').run('{"horario":"2026-10-12T12:00:00.000Z","payload":{},"tipo":"alterado"}');
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 2, motivo: 'hash_divergente' });
  banco.db.prepare('UPDATE auditoria SET payload_canonico=? WHERE id=2').run('{');
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 2, motivo: 'payload_adulterado' });
});

test('elo modificado e representação não canônica são recusados', async t => {
  const { banco, audit } = await historico(t);
  banco.db.exec("DROP TRIGGER auditoria_sem_update; UPDATE auditoria SET prev_hash='x' WHERE id=1");
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 1, motivo: 'cadeia_quebrada' });
  banco.db.exec("UPDATE auditoria SET prev_hash='', payload_canonico='{}' WHERE id=1");
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 1, motivo: 'payload_adulterado' });
});

test('âncora perdida ou corrompida bloqueia verificação e reinicialização', async t => {
  const { banco, ancora, audit } = await historico(t);
  fs.writeFileSync(ancora.caminho, 'não JSON');
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 0, motivo: 'cadeia_quebrada' });
  fs.unlinkSync(ancora.caminho);
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 0, motivo: 'cadeia_quebrada' });
  assert.throws(() => audit.inicializar());
  assert.equal(banco.db.prepare('SELECT count(*) AS n FROM auditoria').get().n, 3);
});

test('âncora divergente detecta cauda reescrita mesmo quando cadeia está coerente', async t => {
  const { ancora, audit } = await historico(t);
  ancora.gravar({ quantidade: 3, ultimo_hash: 'A'.repeat(43) });
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 3, motivo: 'hash_divergente' });
});

test('falha de gravação da âncora reverte SQL; falha após gravação permanece fail-closed', async t => {
  const { banco, ancora, audit } = await historico(t);
  const { AuditSqliteRepository } = require('../dist/auditoria');
  const evento = { tipo: 'novo', horario: '2026-10-12T12:00:00.000Z', payload: {} };
  const indisponivel = new AuditSqliteRepository(banco, {
    ler: () => ancora.ler(), inicializar: () => ancora.inicializar(),
    gravar: () => { throw new Error('falha simulada do armazenamento externo'); },
  });
  await assert.rejects(indisponivel.anexar(evento));
  assert.deepEqual(await audit.verificar(), { ok: true });
  const interrompido = new AuditSqliteRepository(banco, {
    ler: () => ancora.ler(), inicializar: () => ancora.inicializar(),
    gravar: checkpoint => { ancora.gravar(checkpoint); throw new Error('interrupção simulada após âncora'); },
  });
  await assert.rejects(interrompido.anexar(evento));
  assert.deepEqual(await audit.verificar(), { ok: false, indice: 4, motivo: 'cadeia_quebrada' });
});

test('âncora não pode sobrescrever o banco e evento inválido não é persistido', async t => {
  const { banco, audit } = await historico(t);
  const { AuditSqliteRepository } = require('../dist/auditoria');
  assert.throws(() => new AuditSqliteRepository(banco, new AncoraArquivo(banco.caminho)), /fora/);
  await assert.rejects(audit.anexar({ tipo: 'novo', horario: 'inválido', payload: {} }));
  assert.deepEqual(await audit.verificar(), { ok: true });
  assert.throws(() => audit.inicializar());
});

test('escritores concorrentes mantêm cadeia e âncora coerentes em conexões independentes', async t => {
  const { banco, ancora, audit } = await historico(t);
  const storage = require.resolve('../dist/persistencia');
  const auditing = require.resolve('../dist/auditoria');
  await Promise.all(Array.from({ length: 4 }, (_, i) => new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { workerData } = require('node:worker_threads');
      const { BancoNsasSqlite } = require(workerData.storage);
      const { AncoraArquivo, AuditSqliteRepository } = require(workerData.auditing);
      const banco = new BancoNsasSqlite(workerData.db);
      const audit = new AuditSqliteRepository(banco, new AncoraArquivo(workerData.anchor));
      audit.anexar({ tipo: 'worker-' + workerData.i, horario: '2026-10-12T12:00:00.000Z', payload: {} })
        .then(() => banco.close(), erro => { banco.close(); throw erro; });
    `, { eval: true, workerData: { storage, auditing, db: banco.caminho, anchor: ancora.caminho, i } });
    worker.once('error', reject);
    worker.once('exit', code => code === 0 ? resolve() : reject(new Error('worker falhou')));
  })));
  assert.deepEqual(await audit.verificar(), { ok: true });
  assert.equal(ancora.ler().quantidade, 7);
});

test('âncora exige provisionamento explícito e recusa formatos inválidos', t => {
  const arquivo = path.join(temporario(t), 'ancora.json');
  const ancora = new AncoraArquivo(arquivo);
  assert.throws(() => ancora.gravar({ quantidade: 1, ultimo_hash: 'A'.repeat(43) }), /ausente/);
  ancora.inicializar();
  assert.throws(() => ancora.gravar({ quantidade: -1, ultimo_hash: '' }));
  fs.writeFileSync(arquivo, JSON.stringify({ quantidade: 1, ultimo_hash: '' }));
  assert.throws(() => ancora.ler(), /âncora/);
});
