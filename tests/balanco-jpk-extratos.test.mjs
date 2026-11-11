import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { montarBalanco, horas, projetarCustos } from '../src/lib/balanco-cotista.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/jpk-fechamento-2026.json', import.meta.url), 'utf8'));
const meses = Array.from({ length: 9 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
const dashboard = () => ({
  lancamentos: fixture.custos.map((c, index) => ({
    id: `custo-${index}`, data: c.data, dataEmissao: c.data, documentoNumero: c.documento,
    fluxo: 'SAIDA', status: 'PAGO', tipoRateio: "FIXO", categoria: c.categoria, valorCentavos: c.valorCentavos,
    rateios: [{ cotistaId: 'santa-rosa', valorCentavos: c.valorCentavos }],
  })),
  balanco_operacional: {
    versao: 1, fontes: { voos: true, cotistas: true, viagens: false, abastecimentos: false },
    cotistas: [{ id: 'santa-rosa', nome: 'Santa Rosa', clienteId: 'cliente-santa-rosa', socioId: null, holdingId: null, percentualSociedade: 100 }],
    voos: structuredClone(fixture.voos), viagens: [], abastecimentos: [],
  },
});

test('conciliação dos extratos: 27 despesas, seis etapas, R$ 92.098,40 e 2h54 atribuídas', () => {
  const d = dashboard();
  const b = montarBalanco(d, [], meses);
  const p = b.participantes.find((p) => p.id === 'santa-rosa');
  assert.equal(d.lancamentos.length, 27);
  assert.equal(b.total.total, 9209840);
  assert.equal(b.totalVoos, 6);
  assert.equal(b.voosSemVinculo.length, 0);
  assert.equal(horas(b.totalHoras), '2h54');
  assert.equal(horas(p.horas), '2h54');
  assert.equal(p.voos.length, 6);
  assert.equal(Math.round(b.custoHora), 3175807);
  assert.equal(b.mensais[0].voos, 2);
  assert.equal(horas(b.mensais[0].horas), '1h10');
  assert.equal(Math.round(b.mensais.reduce((s, m) => s + m.horasVoo, 0) * 60), 110);
  assert.equal(b.mensais.reduce((s, m) => s + m.distanciaNm, 0), 59);
  assert.equal(d.balanco_operacional.voos[4].horas, 0.42, 'não modifica os decimais recebidos');
});

test('agosto mantém rateio FIXO, custo/hora realizado e projeção histórica sem presumir natureza', () => {
  const b = montarBalanco(dashboard(), [], ['2026-08']);
  const p = b.participantes.find((p) => p.id === 'santa-rosa');
  assert.equal(b.total.total, 1559658);
  assert.equal(b.total.fixos, 0);
  assert.equal(b.total.variaveis, 0);
  assert.equal(b.total.extras, 0);
  assert.equal(b.total.naoClassificados, 1559658);
  assert.ok(dashboard().lancamentos.every((c) => c.tipoRateio === "FIXO"));
  assert.equal(p.horas, 25 / 60);
  assert.equal(Math.round(p.custoHora), 3743179);
  assert.equal(Math.round(b.custoHora), 3743179);
  assert.equal(horas(p.horas), '0h25');
  const projecao = projetarCustos(p.custo, p.horas, 1, 10);
  assert.equal(projecao.metodo, "media_historica");
  assert.equal(projecao.fixoHora, null);
  assert.equal(Math.round(projecao.custoHora), 3743179);
});

test('servidor anterior ou horários ausentes preservam os tempos decimais registrados', () => {
  const d = dashboard();
  for (const v of d.balanco_operacional.voos) { delete v.minutosTotal; delete v.minutosVoo; }
  const b = montarBalanco(d, [], ['2026-08']);
  assert.equal(b.totalHoras, 0.42);
  assert.equal(Math.round(b.custoHora), 3713471);
});

test('minutos ausentes/inválidos não apagam o tempo registrado; zero confirmado continua zero', () => {
  for (const minutos of [null, undefined, -1, NaN, Infinity]) {
    const d = dashboard();
    d.balanco_operacional.voos[4].minutosTotal = minutos;
    assert.equal(montarBalanco(d, [], ['2026-08']).totalHoras, 0.42);
  }
  const d = dashboard();
  d.balanco_operacional.voos[4].minutosTotal = 0;
  assert.equal(montarBalanco(d, [], ['2026-08']).totalHoras, 0);
});
