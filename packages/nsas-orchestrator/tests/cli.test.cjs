const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } = require('node:fs');
const { generateKeyPairSync, sign } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const api = require('..');

const KID_CCS = 'ccs-teste-01';
const KID_OAB = 'cristhiane-oab-66462';
const CASO_ID = '00000000-0000-4000-8000-000000000007';

function parEd25519(passphrase) {
  const par = generateKeyPairSync('ed25519');
  const privadaPem = par.privateKey
    .export(passphrase ? { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase } : { type: 'pkcs8', format: 'pem' })
    .toString();
  const publicaPem = par.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return { privada: par.privateKey, privadaPem, publicaPem };
}

function montarJws(caso, chavePrivada) {
  const payload = api.criarPayloadSelo(caso);
  const header = { alg: 'EdDSA', kid: KID_CCS, typ: 'JWT' };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const headerB64 = b64(header);
  const payloadB64 = b64(payload);
  const sig = sign(null, Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'), chavePrivada).toString('base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

function casoComSeloValido(ccs) {
  const agora = Date.now();
  const base = {
    caso_id: CASO_ID,
    titular_ref: 'hmac:ferst',
    fato_juridico: 'operadora negou cobertura; preciso de parecer',
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: {
      v: '1.0',
      policy_v: 'teste@1',
      caso_id: CASO_ID,
      issued_at: new Date(agora - 1000),
      expires_at: new Date(agora + 60_000),
      canal_origem: 'profissional_autenticado',
      detectores: [],
      predicados_verificados: [],
      custodia_chave: [],
      sig: 'placeholder',
    },
  };
  const jws = montarJws(base, ccs.privada);
  return { ...base, selo: { ...base.selo, sig: jws } };
}

function adapterOk(dominio) {
  return {
    dominio,
    versao: `${dominio}@test-1`,
    async consultar() {
      return { especialista: dominio, fatos: ['Tema detectado: cobertura'], fundamentos: [{ norma: 'Lei 9.656/98', aplicacao: 'cobertura mínima' }], riscos: ['glosa'], fontes: [] };
    },
  };
}

function redatorStub() {
  return {
    redigir(pacote, metadados) {
      return [
        '# Nota Técnica NSAS',
        '',
        '[RASCUNHO — PENDENTE DE APROVAÇÃO OAB]',
        '',
        `Caso: ${metadados.numero}/${metadados.ano}`,
        `Pareceres: ${pacote.pareceres.length}`,
        `Carimbo: ${pacote.carimbo_versoes.join(', ')}`,
      ].join('\n');
    },
  };
}

function cenario() {
  const dir = mkdtempSync(join(tmpdir(), 'nsas-cli-'));
  const dbPath = join(dir, 'nsas.sqlite');
  const ancoraPath = join(dir, 'auditoria.json');
  const oabPem = join(dir, 'oab.pem');
  const saida = join(dir, 'emissoes');
  const passphrase = 'ph-teste';

  const ccs = parEd25519();
  const oab = parEd25519(passphrase);
  writeFileSync(oabPem, oab.privadaPem);

  const banco = new api.BancoNsasSqlite(dbPath);
  const ancora = new api.AncoraArquivo(ancoraPath);
  const auditRepo = new api.AuditSqliteRepository(banco, ancora);
  auditRepo.inicializar();

  const relogio = { agora: () => new Date().toISOString() };
  const casoRepo = new api.CasoSqliteRepository(banco, relogio);
  const aprovacaoRepo = new api.AprovacaoSqliteRepository(banco);
  const alerta = { disparos: [], async disparar(ev) { this.disparos.push(ev); } };

  const seloVerifier = new api.SeloCcsVerifier({ chavePublica: ccs.publicaPem, kid: KID_CCS, relogio, alerta });
  const assinadorOab = new api.AssinadorOabEd25519({ kid: KID_OAB, caminhoChavePrivada: oabPem, chavePublica: oab.publicaPem });

  const executor = {
    adapters: new Map([
      ['juridico-saude-suplementar', adapterOk('juridico-saude-suplementar')],
      ['etica-medica-prontuario', adapterOk('etica-medica-prontuario')],
    ]),
    relogio,
  };

  const ctx = {
    casoRepository: casoRepo, aprovacaoRepository: aprovacaoRepo, auditLogRepository: auditRepo,
    seloVerifier, assinadorOab, executor, relogio, redator: redatorStub(),
  };

  return { dir, saida, ccs, oab, passphrase, banco, ctx, alerta, ancoraPath, dbPath,
    limpar() { banco.close(); rmSync(dir, { recursive: true, force: true }); } };
}

const planoFeliz = {
  versao: '1',
  nos: [
    { id: 'n1', dominio: 'juridico-saude-suplementar', depende_de: [], politica: 'abortar', timeout_ms: 2000 },
    { id: 'n2', dominio: 'etica-medica-prontuario', depende_de: [], politica: 'abortar', timeout_ms: 2000 },
  ],
};

const metadadosBase = {
  numero: '001', ano: 2026, data: '2026-10-12', destinatario: 'Dra. X',
  assunto: 'Glosa', encaminhamento: 'Operadora Y', tema: 'glosa',
  fatoJuridico: 'operadora negou cobertura',
};

test('E2E fluxo feliz: iniciar → aprovar → emitir produz artefato e manifesto assinado', async () => {
  const cen = cenario();
  try {
    const caso = casoComSeloValido(cen.ccs);
    const iniciado = await api.comandoIniciar(cen.ctx, {
      caso, plano: planoFeliz, metadados: metadadosBase, chaveOperacao: 'iniciar-1',
    });
    assert.equal(iniciado.estado, 'rascunho');
    assert.equal(iniciado.abortado, false);
    assert.ok(iniciado.rascunho_hash);

    const aprovacao = await api.comandoAprovar(cen.ctx, {
      caso_id: CASO_ID, rascunho_hash_atual: iniciado.rascunho_hash,
      decisao: 'aprovado', justificativa: 'Fundamento verificado.', passphrase: cen.passphrase,
    });
    assert.equal(aprovacao.decisao, 'aprovado');

    const manifesto = await api.comandoEmitir(cen.ctx, {
      caso_id: CASO_ID, diretorioSaida: cen.saida,
      carimboVersoes: ['executor-nsas@1'], passphrase: cen.passphrase,
    });
    assert.ok(manifesto.manifesto_hash);
    assert.ok(manifesto.assinatura_ed25519);
    assert.equal(manifesto.aprovacao.decisao, 'aprovado');
    assert.ok(existsSync(join(cen.saida, `${CASO_ID}.md`)));
    assert.ok(existsSync(join(cen.saida, `${CASO_ID}.manifesto.json`)));

    const auditoria = await api.comandoAuditoriaVerificar(cen.ctx);
    assert.equal(auditoria.ok, true);
  } finally { cen.limpar(); }
});

test('emissao sem aprovacao falha fechada (invariante #1)', async () => {
  const cen = cenario();
  try {
    const caso = casoComSeloValido(cen.ccs);
    await api.comandoIniciar(cen.ctx, { caso, plano: planoFeliz, metadados: metadadosBase, chaveOperacao: 'iniciar-1' });
    await assert.rejects(() => api.comandoEmitir(cen.ctx, {
      caso_id: CASO_ID, diretorioSaida: cen.saida,
      carimboVersoes: ['executor-nsas@1'], passphrase: cen.passphrase,
    }), (e) => e.motivo === 'aprovacao_ausente');
  } finally { cen.limpar(); }
});

test('rejeicao bloqueia emissao mesmo com rascunho persistido', async () => {
  const cen = cenario();
  try {
    const caso = casoComSeloValido(cen.ccs);
    const iniciado = await api.comandoIniciar(cen.ctx, { caso, plano: planoFeliz, metadados: metadadosBase, chaveOperacao: 'iniciar-1' });
    await api.comandoRejeitar(cen.ctx, {
      caso_id: CASO_ID, rascunho_hash_atual: iniciado.rascunho_hash,
      decisao: 'rejeitado', justificativa: 'Lacuna normativa.', passphrase: cen.passphrase,
    });
    await assert.rejects(() => api.comandoEmitir(cen.ctx, {
      caso_id: CASO_ID, diretorioSaida: cen.saida,
      carimboVersoes: ['executor-nsas@1'], passphrase: cen.passphrase,
    }), (e) => e.motivo === 'aprovacao_rejeitada');
  } finally { cen.limpar(); }
});

test('status nao expoe fato_juridico — so metadados estruturais', async () => {
  const cen = cenario();
  try {
    const caso = casoComSeloValido(cen.ccs);
    const iniciado = await api.comandoIniciar(cen.ctx, { caso, plano: planoFeliz, metadados: metadadosBase, chaveOperacao: 'iniciar-1' });
    const status = await api.comandoStatus(cen.ctx, CASO_ID);
    assert.equal(status.estado, 'rascunho');
    assert.equal(status.rascunho_hash, iniciado.rascunho_hash);
    assert.equal(status.tem_aprovacao, false);
    const serializado = JSON.stringify(status);
    assert.ok(!serializado.includes('operadora'));
    assert.ok(!serializado.includes('fato'));
  } finally { cen.limpar(); }
});

test('selo invalido aborta antes de qualquer execucao e alerta sincrono dispara (invariante #2)', async () => {
  const cen = cenario();
  try {
    const caso = casoComSeloValido(cen.ccs);
    const ultimo = caso.selo.sig.slice(-1);
    caso.selo = { ...caso.selo, sig: caso.selo.sig.slice(0, -1) + (ultimo === 'A' ? 'B' : 'A') };
    await assert.rejects(() => api.comandoIniciar(cen.ctx, {
      caso, plano: planoFeliz, metadados: metadadosBase, chaveOperacao: 'iniciar-1',
    }), (e) => e.motivo === 'selo_invalido');
    assert.ok(cen.alerta.disparos.some((d) => d.tipo === 'selo_invalido'));
    const status = await api.comandoStatus(cen.ctx, CASO_ID);
    assert.equal(status, null, 'caso nao deve ter sido criado');
  } finally { cen.limpar(); }
});

test('auditoria verificar detecta divergencia quando a ancora e adulterada', async () => {
  const cen = cenario();
  try {
    const caso = casoComSeloValido(cen.ccs);
    await api.comandoIniciar(cen.ctx, { caso, plano: planoFeliz, metadados: metadadosBase, chaveOperacao: 'iniciar-1' });
    const original = JSON.parse(readFileSync(cen.ancoraPath, 'utf8'));
    writeFileSync(cen.ancoraPath, JSON.stringify({ ...original, ultimo_hash: 'A'.repeat(42) + 'A' }));
    const resultado = await api.comandoAuditoriaVerificar(cen.ctx);
    assert.equal(resultado.ok, false);
    assert.ok(['hash_divergente', 'cadeia_quebrada'].includes(resultado.motivo));
  } finally { cen.limpar(); }
});
