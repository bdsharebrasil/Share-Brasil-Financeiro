import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calcularIndicadoresViagemCombustivel,
  categoriaIndicadorDespesa,
} from "../src/lib/indicadores-despesas-cotista.ts";

test("categorias reais de combustível e viagem são reconhecidas com e sem acento", () => {
  for (const nome of ["COMBUSTÍVEIS", "combustivel", "ABASTECIMENTO"]) {
    assert.equal(categoriaIndicadorDespesa(nome), "combustivel");
  }
  for (const nome of ["DESPESAS DE VIAGEM", "Despesa de viagem", "RELATÓRIO DE VIAGEM"]) {
    assert.equal(categoriaIndicadorDespesa(nome), "viagens");
  }
  assert.equal(categoriaIndicadorDespesa("TAXAS AEROPORTUÁRIAS E NAVEGAÇÃO AÉREA"), null);
});

test("ticket médio usa custo atribuído e quantidade de lançamentos, sem contar o mesmo ID duas vezes", () => {
  const resultado = calcularIndicadoresViagemCombustivel([
    { id: "fuel-1", categoria: "COMBUSTÍVEIS", suaParteCentavos: 13000 },
    { id: "fuel-1", categoria: "COMBUSTÍVEIS", suaParteCentavos: 2000 },
    { id: "fuel-2", categoria: "COMBUSTÍVEIS", suaParteCentavos: 5000 },
    { id: "trip-1", categoria: "DESPESAS DE VIAGEM", suaParteCentavos: 12000 },
    { id: "trip-2", categoria: "DESPESAS DE VIAGEM", suaParteCentavos: 8000 },
    { id: "tax-1", categoria: "TAXAS AEROPORTUÁRIAS", suaParteCentavos: 9000 },
  ]);
  assert.deepEqual(resultado.combustivel, {
    totalCentavos: 20000, quantidade: 2, ticketMedioCentavos: 10000,
  });
  assert.deepEqual(resultado.viagens, {
    totalCentavos: 20000, quantidade: 2, ticketMedioCentavos: 10000,
  });
});

test("um cotista sem combustível ou despesa de viagem não recebe ticket artificial de zero", () => {
  const resultado = calcularIndicadoresViagemCombustivel([
    { id: "adm-1", categoria: "ADM E TRIP SHARE BRASIL", suaParteCentavos: 1500000 },
  ]);
  for (const indicador of [resultado.combustivel, resultado.viagens]) {
    assert.equal(indicador.totalCentavos, 0);
    assert.equal(indicador.quantidade, 0);
    assert.equal(indicador.ticketMedioCentavos, null);
  }
});

test("valores de cotistas são proporcionais ao rateio; total consolidado não duplica lançamentos", () => {
  const cotistaA = [
    { id: "fuel-1", categoria: "COMBUSTÍVEIS", suaParteCentavos: 30000 },
    { id: "trip-1", categoria: "DESPESAS DE VIAGEM", suaParteCentavos: 10000 },
  ];
  const cotistaB = [
    { id: "fuel-1", categoria: "COMBUSTÍVEIS", suaParteCentavos: 20000 },
    { id: "trip-1", categoria: "DESPESAS DE VIAGEM", suaParteCentavos: 10000 },
  ];
  assert.equal(calcularIndicadoresViagemCombustivel(cotistaA).combustivel.totalCentavos, 30000);
  assert.equal(calcularIndicadoresViagemCombustivel(cotistaB).combustivel.totalCentavos, 20000);
  const consolidado = calcularIndicadoresViagemCombustivel([...cotistaA, ...cotistaB]);
  assert.deepEqual(consolidado.combustivel, { totalCentavos: 50000, quantidade: 1, ticketMedioCentavos: 50000 });
  assert.deepEqual(consolidado.viagens, { totalCentavos: 20000, quantidade: 1, ticketMedioCentavos: 20000 });
});

test("o PDF consolidado emite todas as páginas A4 em orientação paisagem", async () => {
  const code = await readFile(new URL("../src/components/FinanceiroCotista/BalancoClientePdf.tsx", import.meta.url), "utf8");
  const pages = [...code.matchAll(/<Page\b[^>]*\bsize="A4"[^>]*>/g)].map((match) => match[0]);
  assert.equal(pages.length, 6);
  for (const page of pages) {
    assert.match(page, /orientation="landscape"/, `página sem orientação horizontal: ${page}`);
  }
  assert.match(code, /projecaoRows\.slice\(inicio, inicio \+ 15\)/);
  assert.match(code, /Math\.min\(inicio \+ 15, 45\)/);
});

test("indicadores da aba balanço e do PDF vêm do mesmo cálculo atribuído", async () => {
  const tela = await readFile(new URL("../src/components/FinanceiroCotista/FechamentoBalancoReferencia.tsx", import.meta.url), "utf8");
  const pdf = await readFile(new URL("../src/components/FinanceiroCotista/BalancoClientePdf.tsx", import.meta.url), "utf8");
  assert.match(tela, /calcularIndicadoresViagemCombustivel\(/);
  assert.match(pdf, /calcularIndicadoresViagemCombustivel\(participante\.lancamentos\)/);
  for (const titulo of ["Despesas de viagem", "Combustível", "Ticket médio"]) {
    assert.ok(tela.includes(titulo) && pdf.includes(titulo), `Indicador ausente: ${titulo}`);
  }
});
