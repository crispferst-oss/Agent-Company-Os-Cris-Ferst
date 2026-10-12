const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('..');

const CAMINHO_MAPA = path.resolve(__dirname, '..', '..', '..', '.claude', 'references', 'mapa-normativo-v1.md');

function casoDe(fato) {
  return {
    caso_id: '00000000-0000-0000-0000-000000000005',
    titular_ref: 'hmac-fake',
    fato_juridico: fato,
    refs_clinicas: [],
    documentos_opaco: [],
    predicados: [],
    tradutor_v: '1.0',
    selo: { tradutor_v: '1.0', detectores: [], predicados_verificados: [] },
  };
}

function novoAdapter() {
  const mapa = api.carregarMapaNormativo(CAMINHO_MAPA);
  return { adapter: api.criarComplianceRegulatorioLgpd({ mapa }), mapa };
}

test('adapter recusa caso sem fato_juridico', async () => {
  const { adapter } = novoAdapter();
  await assert.rejects(
    () => adapter.consultar(casoDe('   ')),
    (err) => err instanceof api.ErroConsultaEspecialista && err.motivo === 'caso_invalido',
  );
});

test('incidente de segurança: aciona art. 48 e Res. ANPD 15/2024', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica sofreu vazamento de dados de pacientes'),
  );
  assert.equal(parecer.especialista, 'compliance-regulatorio-lgpd');
  assert.ok(parecer.fatos.some((f) => /incidente/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*48|ANPD 15\/2024/i.test(r)));
});

test('DPO: aciona art. 41 e Res. ANPD 2/2022', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('consultório não designou encarregado DPO'),
  );
  assert.ok(parecer.fatos.some((f) => /encarregado|DPO/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*41|pequeno porte/i.test(r)));
});

test('RIPD: aciona art. 38 e dado sensível em escala', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica vai implantar PEP sem relatório de impacto RIPD'),
  );
  assert.ok(parecer.fatos.some((f) => /RIPD|relat[óo]rio de impacto/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /art\.\s*38|dosimetria/i.test(r)));
});

test('direitos do titular: aciona art. 18 e conflito com Lei 13.787', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('paciente pediu eliminação de dados mas prontuário tem guarda obrigatória'),
  );
  assert.ok(parecer.fatos.some((f) => /elimina[çc][ãa]o|titular/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /13\.787|20 anos|art\.\s*18/i.test(r)));
});

test('transferência internacional: aciona arts. 33-36', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica usa SaaS com servidor nos EUA para armazenar prontuário'),
  );
  assert.ok(parecer.fatos.some((f) => /transfer[êe]ncia internacional|nuvem/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /33-36|adequa[çc][ãa]o ANPD/i.test(r)));
});

test('RSS: aciona RDC 222 e PGRSS obrigatório', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('consultório não tem PGRSS para resíduos de serviços de saúde'),
  );
  assert.ok(parecer.fatos.some((f) => /RSS|res[íi]duos/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /RDC 222|VISA/i.test(r)));
});

test('segurança do paciente: aciona RDC 36 e evento adverso', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica teve evento adverso em procedimento ambulatorial'),
  );
  assert.ok(parecer.fatos.some((f) => /seguran[çc]a do paciente|evento adverso/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /RDC 36|Nagep|VISA/i.test(r)));
});

test('CNES: aciona Portaria 1.646/2015', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('consultório não possui cadastro CNES ativo'),
  );
  assert.ok(parecer.fatos.some((f) => /CNES/i.test(f)));
  assert.ok(parecer.riscos.some((r) => /1\.646|cadastro/i.test(r)));
});

test('múltiplos temas: incidente + direitos do titular sem duplicar norma', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica teve vazamento e paciente exige portabilidade dos dados'),
  );
  assert.ok(parecer.fatos.length >= 2);
  const normas = parecer.fundamentos.map((f) => f.norma);
  const dedup = new Set(normas);
  assert.equal(normas.length, dedup.size, 'não pode duplicar norma na mesma consulta');
});

test('fato sem tema reconhecido retorna lacuna', async () => {
  const { adapter, mapa } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('discussão sobre contratação de recepcionista freelancer'),
  );
  assert.equal(parecer.fatos.length, 1);
  assert.match(parecer.fatos[0], /Nenhum tema/i);
  assert.ok(parecer.fontes[0].includes(mapa.versao));
});

test('adapter sinaliza delegação a pesquisa-normativa (recursão zero)', async () => {
  const { adapter } = novoAdapter();
  const parecer = await adapter.consultar(
    casoDe('clínica teve incidente de segurança'),
  );
  assert.ok(
    parecer.riscos.some((r) => /pesquisa-normativa.*n[óo] irm[ãa]o/i.test(r)),
  );
});

test('adapter carimba versão com a versão do mapa', () => {
  const { adapter, mapa } = novoAdapter();
  assert.equal(adapter.dominio, 'compliance-regulatorio-lgpd');
  assert.match(adapter.versao, /^compliance-regulatorio-lgpd@/);
  assert.ok(adapter.versao.includes(mapa.versao));
});
