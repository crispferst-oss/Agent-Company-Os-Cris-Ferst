const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000001',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: {
      tradutor_v: '1.0',
      detectores: [],
      predicados_verificados: [],
    },
  };
}

test('loader rejeita mapa malformado (fail-fast)', () => {
  assert.throws(
    () => api.parsearMapaNormativo('# vazio\nsem tabela'),
    /Mapa normativo malformado/,
  );
});

test('loader lê o mapa canônico e extrai versão, data e entradas', () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  assert.ok(mapa.versao.length > 0, 'versão deve estar presente');
  assert.ok(mapa.dataConsulta.length > 0, 'data de consulta deve estar presente');
  assert.ok(mapa.entradas.length >= 10, 'mapa deve conter várias normas');
  assert.ok(mapa.entradas.some((e) => e.eixo === 1), 'eixo 1 presente');
  assert.ok(mapa.entradas.some((e) => e.eixo === 12), 'eixo 12 presente');
});

test('adapter recusa caso sem fato_juridico', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = new api.PesquisaNormativaAdapter({ mapa });
  await assert.rejects(
    () => adapter.consultar(casoDe('   ')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('adapter encontra normas de prontuário por termos do fato', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = new api.PesquisaNormativaAdapter({ mapa });
  const parecer = await adapter.consultar(
    casoDe('médico pergunta sobre guarda de prontuário eletrônico e digitalização'),
  );

  assert.equal(parecer.especialista, 'pesquisa-normativa');
  assert.ok(parecer.fatos.length > 0, 'deve retornar fatos');
  assert.ok(
    parecer.fatos.some((f) => /prontu[áa]rio|digitaliza/i.test(f)),
    'deve citar norma de prontuário',
  );
  assert.ok(parecer.fontes.length > 0, 'deve citar fonte');
  assert.ok(parecer.fontes[0].includes('.claude/references/mapa-normativo'));
});

test('adapter sinaliza risco quando norma consta revogada', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = new api.PesquisaNormativaAdapter({ mapa });
  const parecer = await adapter.consultar(
    casoDe('publicidade médica em redes sociais e histórico de normas revogadas'),
  );
  assert.ok(
    parecer.riscos.some((r) => /revogada/i.test(r)),
    'risco de citar norma revogada deve ser sinalizado',
  );
});

test('adapter sem correspondência devolve lacuna com risco explícito', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = new api.PesquisaNormativaAdapter({ mapa });
  const parecer = await adapter.consultar(
    casoDe('xyzzy foobar inexistente nenhum termo mapeado aqui'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhuma norma/i);
  assert.ok(parecer.riscos.some((r) => /lacuna/i.test(r)));
});

test('adapter respeita restrição por eixo', async () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = new api.PesquisaNormativaAdapter({
    mapa,
    eixosRestricao: [3],
  });
  const parecer = await adapter.consultar(
    casoDe('telemedicina teleconsulta prescrição eletrônica'),
  );
  assert.ok(parecer.fatos.length > 0);
  assert.ok(
    parecer.fatos.every((f) => /eixo 3/i.test(f)),
    'todas as normas devem vir do eixo 3',
  );
});

test('adapter carimba versão com a versão do mapa (invariante #8 do orquestrador)', () => {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  const adapter = new api.PesquisaNormativaAdapter({ mapa });
  assert.equal(adapter.dominio, 'pesquisa-normativa');
  assert.match(adapter.versao, /^pesquisa-normativa@/);
  assert.ok(adapter.versao.includes(mapa.versao));
});
