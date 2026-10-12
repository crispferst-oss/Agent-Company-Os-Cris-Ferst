const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { generateKeyPairSync, verify } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const api = require('..');

function parEd25519(passphrase) {
  const par = generateKeyPairSync('ed25519');
  const privadaPem = par.privateKey.export({
    type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase,
  }).toString();
  const publicaPem = par.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return { privadaPem, publicaPem };
}

function cenario() {
  const dir = mkdtempSync(join(tmpdir(), 'nsas-aprovacao-'));
  const pemPath = join(dir, 'oab.pem');
  const dbPath = join(dir, 'nsas.sqlite');
  const ancoraPath = join(dir, 'auditoria.json');
  const passphrase = 'passphrase-teste';
  const { privadaPem, publicaPem } = parEd25519(passphrase);
  writeFileSync(pemPath, privadaPem);
  const banco = new api.BancoNsasSqlite(dbPath);
  const relogio = { agora: () => '2026-10-12T15:00:00.000Z' };
  const casoRepo = new api.CasoSqliteRepository(banco, relogio);
  const aprovacaoRepo = new api.AprovacaoSqliteRepository(banco);
  const assinador = new api.AssinadorOabEd25519({
    kid: 'cristhiane-oab-66462', caminhoChavePrivada: pemPath, chavePublica: publicaPem,
  });
  return { dir, pemPath, dbPath, ancoraPath, passphrase, publicaPem, banco, relogio, casoRepo, aprovacaoRepo, assinador,
    limpar() { banco.close(); rmSync(dir, { recursive: true, force: true }); } };
}

const casoId = '00000000-0000-4000-8000-000000000005';

async function preparar(cen, conteudo = '# Rascunho\n\n[RASCUNHO — PENDENTE DE APROVAÇÃO OAB]\n') {
  await cen.casoRepo.salvarIdempotente({
    caso_id: casoId, estado: 'rascunho',
    criado_em: '2026-10-12T14:00:00.000Z', atualizado_em: '2026-10-12T14:00:00.000Z',
  }, 'op-1');
  const hash = api.sha256Base64url(api.canonicalJson({ caso_id: casoId, conteudo }));
  await cen.casoRepo.salvarRascunho(casoId, hash, conteudo);
  return { conteudo, hash };
}

test('AssinadorOabEd25519 gera assinatura verificável pela chave pública', async () => {
  const cen = cenario();
  try {
    const aprov = await cen.assinador.assinar({
      caso_id: casoId, rascunho_hash: 'A'.repeat(43),
      decisao: 'aprovado', justificativa: 'ok', horario: cen.relogio.agora(),
    }, cen.passphrase);
    const canonico = api.canonicalJson({
      caso_id: aprov.caso_id, rascunho_hash: aprov.rascunho_hash, decisao: aprov.decisao,
      justificativa: aprov.justificativa, horario: aprov.horario, oab_kid: aprov.oab_kid,
    });
    const ok = verify(null, Buffer.from(canonico, 'utf8'),
      require('node:crypto').createPublicKey(cen.publicaPem),
      Buffer.from(aprov.assinatura_ed25519, 'base64url'));
    assert.ok(ok);
    assert.ok(api.AprovacaoAssinadaSchema.safeParse(aprov).success);
  } finally { cen.limpar(); }
});

test('passphrase errada falha com motivo tipado e sem vazar causa', async () => {
  const cen = cenario();
  try {
    await assert.rejects(() => cen.assinador.assinar({
      caso_id: casoId, rascunho_hash: 'A'.repeat(43),
      decisao: 'aprovado', justificativa: 'ok', horario: cen.relogio.agora(),
    }, 'passphrase-errada'), (e) => e.motivo === 'passphrase_invalida');
  } finally { cen.limpar(); }
});

test('passphrase vazia é rejeitada antes de tocar o arquivo PEM', async () => {
  const cen = cenario();
  try {
    await assert.rejects(() => cen.assinador.assinar({
      caso_id: casoId, rascunho_hash: 'A'.repeat(43),
      decisao: 'aprovado', justificativa: 'ok', horario: cen.relogio.agora(),
    }, ''), (e) => e.motivo === 'passphrase_invalida');
  } finally { cen.limpar(); }
});

test('submeterAprovacaoOAB persiste aprovação válida contra o hash corrente', async () => {
  const cen = cenario();
  try {
    const { hash } = await preparar(cen);
    const aprov = await api.submeterAprovacaoOAB(
      { casoRepository: cen.casoRepo, aprovacaoRepository: cen.aprovacaoRepo,
        assinador: cen.assinador, relogio: cen.relogio },
      { caso_id: casoId, rascunho_hash_atual: hash, decisao: 'aprovado',
        justificativa: 'Revisado e assinado.', passphrase: cen.passphrase },
    );
    assert.equal(aprov.decisao, 'aprovado');
    assert.equal(aprov.rascunho_hash, hash);
    const persistida = await cen.aprovacaoRepo.obterPorHash(casoId, hash);
    assert.deepEqual(persistida, aprov);
  } finally { cen.limpar(); }
});

test('aprovação sobre hash H1 não valida rascunho H2 (invariante #1 operacional)', async () => {
  const cen = cenario();
  try {
    await preparar(cen);
    await assert.rejects(() => api.submeterAprovacaoOAB(
      { casoRepository: cen.casoRepo, aprovacaoRepository: cen.aprovacaoRepo,
        assinador: cen.assinador, relogio: cen.relogio },
      { caso_id: casoId, rascunho_hash_atual: 'B'.repeat(42) + 'A',
        decisao: 'aprovado', justificativa: 'tentativa', passphrase: cen.passphrase },
    ), (e) => e.motivo === 'aprovacao_hash_divergente');
  } finally { cen.limpar(); }
});

test('submeter sobre caso sem rascunho falha fechado', async () => {
  const cen = cenario();
  try {
    await cen.casoRepo.salvarIdempotente({
      caso_id: casoId, estado: 'iniciado',
      criado_em: '2026-10-12T14:00:00.000Z', atualizado_em: '2026-10-12T14:00:00.000Z',
    }, 'op-x');
    await assert.rejects(() => api.submeterAprovacaoOAB(
      { casoRepository: cen.casoRepo, aprovacaoRepository: cen.aprovacaoRepo,
        assinador: cen.assinador, relogio: cen.relogio },
      { caso_id: casoId, rascunho_hash_atual: 'A'.repeat(43),
        decisao: 'aprovado', justificativa: 'ok', passphrase: cen.passphrase },
    ), (e) => e.motivo === 'aprovacao_ausente');
  } finally { cen.limpar(); }
});

test('rejeição também é assinada e persistida (trilhabilidade)', async () => {
  const cen = cenario();
  try {
    const { hash } = await preparar(cen);
    const aprov = await api.submeterAprovacaoOAB(
      { casoRepository: cen.casoRepo, aprovacaoRepository: cen.aprovacaoRepo,
        assinador: cen.assinador, relogio: cen.relogio },
      { caso_id: casoId, rascunho_hash_atual: hash, decisao: 'rejeitado',
        justificativa: 'Fundamento insuficiente.', passphrase: cen.passphrase },
    );
    assert.equal(aprov.decisao, 'rejeitado');
    assert.equal(aprov.horario, cen.relogio.agora());
    const persistida = await cen.aprovacaoRepo.obterPorHash(casoId, hash);
    assert.equal(persistida.decisao, 'rejeitado');
  } finally { cen.limpar(); }
});
