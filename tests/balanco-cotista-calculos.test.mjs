import test from "node:test";
import assert from "node:assert/strict";
import { montarBalanco, projetarCustos, horasAtribuidas } from "../src/lib/balanco-cotista.ts";

const cotista = (id, quota = 100, extra = {}) => ({
  id, nome: id, clienteId: `cliente-${id}`, socioId: null, holdingId: null, percentualSociedade: quota, ...extra,
});
const voo = (extra = {}) => ({
  id: "voo-1", data: "2026-08-28", numero: null, numeroSequencial: 1,
  trecho: "STO ANTONIO LEVERGER X STO ANTONIO LEVERGER", tempoDep: "10:00", tempoPou: "10:14",
  clienteId: null, socioId: null, horas: 0.42, horasVoo: 0.23, pousos: 1,
  origem: "SWLV", destino: "SWLV", consumoEstimadoLitros: 20,
  emprestado: false, clienteTomadorId: null, socioTomadorId: null, natureza: "VT - Voo Teste", ...extra,
});
const despesa = (valor, natureza, extra = {}) => ({
  id: `custo-${valor}`, data: "2026-08-21", dataEmissao: "2026-08-21", status: "PAGO", fluxo: "SAIDA",
  valorCentavos: valor, tipoRateio: "FIXO", naturezaCusto: natureza, descricao: "Despesa", categoria: "Manutenção", aeronaveNome: "PT-JPK",
  rateios: [{ cotistaId: "santa-rosa", cotista: "santa-rosa", valorCentavos: valor }], ...extra,
});
const dashboard = (cotistas, voos, lancamentos = []) => ({
  lancamentos,
  balanco_escopo: "aeronave",
  balanco_operacional: {
    versao: 1, aeronaveId: "pt-jpk", inicio: "2026-08-01", fim: "2026-08-31",
    fontes: { voos: true, cotistas: true, abastecimentos: true, viagens: true },
    cotistas, voos, abastecimentos: [], viagens: [],
  },
});
const montar = (d, meses = ["2026-08"]) => montarBalanco(d, [], meses);
const near = (atual, esperado) => assert.ok(Math.abs(atual - esperado) < 1e-7, `${atual} != ${esperado}`);

test("regressão PT-JPK: etapa compartilhada entra no balanço, custo/hora e projeção da Santa Rosa", () => {
  const d = dashboard([cotista("santa-rosa")], [voo()], [
    despesa(500000, "FIXO"), despesa(350000, "FIXO"), despesa(141525, "FIXO"),
    despesa(561000, "VARIAVEL_POR_HORA"), despesa(7133, "VARIAVEL_POR_VOO"),
  ]);
  const b = montar(d);
  const p = b.participantes.find((p) => p.id === "santa-rosa");
  assert.equal(p.custo.total, 1559658);
  assert.equal(p.voos.length, 1);
  near(p.horas, 0.42);
  near(p.horasCompartilhadas, 0.42);
  assert.equal(p.horasParticulares, 0);
  near(p.custoHora, b.custoHora);
  assert.equal(Math.round(p.custoHora), 3713471);
  assert.ok(projetarCustos(p.custo, p.horas, 1, 10));
  assert.equal(b.voosSemVinculo.length, 0);
  assert.equal(d.balanco_operacional.voos[0].percentualAtribuido, undefined, "não modifica dados do dashboard");
});

test("TR/VT são divididos igualmente sem duplicar horas da aeronave ou alterar duração física", () => {
  const b = montar(dashboard([cotista("a", 60), cotista("b", 40)], [voo({ horas: 1, natureza: "TR - Traslado" })]));
  const ps = b.participantes.filter((p) => p.confirmado);
  assert.equal(b.totalHoras, 1);
  assert.equal(b.totalVoos, 1);
  assert.equal(ps.reduce((s, p) => s + p.horas, 0), 1);
  for (const p of ps) {
    assert.equal(p.horas, 0.5);
    assert.equal(p.voos[0].horas, 1);
    assert.equal(horasAtribuidas(p.voos[0]), 0.5);
    assert.equal(p.voos[0].percentualAtribuido, 50);
  }
});

test("cotas inativas (quota nula) e cotas zeradas não recebem horas compartilhadas", () => {
  const b = montar(dashboard([cotista("a"), cotista("inativo", null), cotista("zero", 0)], [voo()]));
  assert.equal(b.participantes.find((p) => p.id === "a").horas, 0.42);
  assert.equal(b.participantes.find((p) => p.id === "inativo").horas, 0);
  assert.equal(b.participantes.find((p) => p.id === "zero").horas, 0);
});

test("voo particular mantém titular direto; voo sem titular fica pendente mesmo com cota de 100%", () => {
  const b = montar(dashboard([cotista("a")], [voo({ natureza: "VP - Voo Particular", clienteId: "cliente-a" }), voo({ id: "sem-titular", natureza: "VP - Voo Particular" })]));
  assert.equal(b.participantes.find((p) => p.id === "a").horas, 0.42);
  assert.equal(b.voosSemVinculo.length, 1);
  assert.equal(b.totalHoras, 0.84);
});

test("empréstimo atribui só ao tomador e nunca usa a natureza compartilhada como fallback", () => {
  const b = montar(dashboard([cotista("dono", 50), cotista("tomador", 50)], [voo({ emprestado: true, clienteId: "cliente-dono", clienteTomadorId: "cliente-tomador" })]));
  assert.equal(b.participantes.find((p) => p.id === "dono").horas, 0);
  assert.equal(b.participantes.find((p) => p.id === "tomador").horas, 0.42);
  const sem = montar(dashboard([cotista("dono")], [voo({ emprestado: true, clienteId: "cliente-dono" })]));
  assert.equal(sem.voosSemVinculo.length, 1);
  assert.equal(sem.participantes.find((p) => p.id === "dono").horas, 0);
});

test("holding única resolve titular; holding com vários sócios não inventa atribuição individual", () => {
  const vs = [voo({ natureza: "VP - Voo Particular", holdingId: "holding-1" })];
  const unico = montar(dashboard([cotista("a", 100, { holdingId: "holding-1" })], vs));
  assert.equal(unico.participantes.find((p) => p.id === "a").horas, 0.42);
  const ambiguo = montar(dashboard([cotista("a", 50, { holdingId: "holding-1" }), cotista("b", 50, { holdingId: "holding-1" })], vs));
  assert.equal(ambiguo.voosSemVinculo.length, 1);
});

test("horas ausentes continuam indisponíveis e não viram zero", () => {
  const p = montar(dashboard([cotista("a")], [voo({ horas: null })])).participantes.find((p) => p.id === "a");
  assert.equal(p.horas, null);
  assert.equal(p.custoHora, null);
  assert.equal(projetarCustos(p.custo, p.horas, 1, 10), null);
});

test("custos usam emissão como a tabela/PDF e excluem cancelamentos femininos", () => {
  const b = montar(dashboard([cotista("santa-rosa")], [], [
    despesa(1000, "FIXO", { data: "2026-09-01", dataEmissao: "2026-08-31" }),
    despesa(2000, "FIXO", { status: "CANCELADA" }),
  ]));
  assert.equal(b.total.total, 1000);
});

test("projeção usa todos os meses selecionados e aplica fator só à parcela fixa", () => {
  const custo = { total: 60000, fixos: 40000, variaveis: 15000, extras: 5000, naoClassificados: 0 };
  const base = projetarCustos(custo, 10, 2, 5);
  const dobro = projetarCustos(custo, 10, 2, 5, 2);
  assert.deepEqual(base, { metodo: "natureza_custo", fixoHora: 4000, variavelHora: 1500, extraHora: 500, custoHora: 6000, custoMensal: 30000 });
  assert.equal(dobro.fixoHora, 8000);
  assert.equal(dobro.variavelHora, base.variavelHora);
  assert.equal(dobro.extraHora, base.extraHora);
  assert.equal(dobro.custoMensal, dobro.custoHora * 5);
});

test("projeção valida denominadores e usa média histórica sem natureza econômica", () => {
  const custo = { total: 100, fixos: 100, variaveis: 0, extras: 0, naoClassificados: 0 };
  for (const h of [null, 0, -1, NaN, Infinity]) assert.equal(projetarCustos(custo, h, 1, 10), null);
  assert.equal(projetarCustos({ ...custo, naoClassificados: 1 }, 1, 1, 10).metodo, "media_historica");
  assert.equal(projetarCustos(custo, 1, 0, 10), null);
  assert.equal(projetarCustos(custo, 1, 1, 10, 0), null);
});

test("seleção de meses descontínuos não inclui voos intermediários", () => {
  const b = montar(dashboard([cotista("a")], [voo(), voo({ id: "set", data: "2026-09-01" }), voo({ id: "out", data: "2026-10-01" })]), ["2026-08", "2026-10"]);
  assert.equal(b.totalVoos, 2);
  assert.equal(b.participantes.find((p) => p.id === "a").voos.length, 2);
});

test("três cotistas conservam horas e consumo compartilhado sem arredondar cada parcela", () => {
  const b = montar(dashboard([cotista("a", 33.33), cotista("b", 33.33), cotista("c", 33.34)], [voo({ horas: 1, consumoEstimadoLitros: 60 })]));
  near(b.participantes.reduce((s, p) => s + p.horas, 0), 1);
  for (const p of b.participantes) near(p.consumoHora, 60);
});

test("resumo mensal distingue tempo de voo, total e distância atribuída", () => {
  const b = montar(dashboard([cotista("a", 50), cotista("b", 50)], [voo({ horas: 1, horasVoo: 0.5, distanciaNm: 40 })]));
  assert.equal(b.mensais[0].horasVoo, 0.5);
  assert.equal(b.mensais[0].distanciaNm, 40);
  const p = b.participantes.find((p) => p.id === "a");
  assert.equal(p.mensal[0].horas, 0.5);
  assert.equal(p.mensal[0].horasVoo, 0.25);
  assert.equal(p.mensal[0].distanciaNm, 20);
  assert.equal(p.mensal[0].diasVoo, 1);
});

test("alterar apenas a forma de rateio não muda natureza, valores atribuídos ou projeção", () => {
  const apurar = (tipoRateio) => {
    const d = dashboard([cotista("santa-rosa")], [voo()], [despesa(141525, "EXTRA", { tipoRateio })]);
    const b = montar(d);
    assert.equal(d.lancamentos[0].tipoRateio, tipoRateio);
    return { custo: b.total, custoHora: b.custoHora, projecao: b.projecao, parte: b.participantes[0].lancamentos[0].suaParteCentavos };
  };
  assert.deepEqual(apurar("FIXO"), apurar("VARIAVEL_POR_HORA"));
  assert.deepEqual(apurar("FIXO"), apurar("VARIAVEL_POR_VOO"));
});
