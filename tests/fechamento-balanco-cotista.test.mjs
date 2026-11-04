import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../src/components/FinanceiroCotista/", import.meta.url);
const [financeiro, dashboard, pdf, calculo, referencia] = await Promise.all([
  readFile(new URL("FinanceiroCotista.tsx", base), "utf8"),
  readFile(new URL("FechamentoBalancoDashboardCotista.tsx", base), "utf8"),
  readFile(new URL("BalancoClientePdf.tsx", base), "utf8"),
  readFile(new URL("../../lib/balanco-cotista.ts", base), "utf8"),
  readFile(new URL("FechamentoBalancoReferencia.tsx", base), "utf8"),
]);

test("aba Fechamento Balanço usa dados do dashboard e transmite cotista e competências selecionados", () => {
  assert.match(financeiro, /abaAtiva === "fechamento-balanco"[\s\S]*?<FechamentoBalancoReferencia/);
  assert.match(financeiro, /cotistaId=\{cotistaVisaoId\}/);
  assert.match(financeiro, /mesesSelecionados=\{mesesAplicados\}/);
  assert.doesNotMatch(financeiro, /<FechamentoBalancoCotista\s*\/>/);
});

test("fechamento segue as quatro seções da referência com valores derivados do dashboard", () => {
  for (const aba of ["Balanço", "Lançamentos", "Custo por hora", "Diário de bordo"]) {
    assert.ok(referencia.includes(`nome: "${aba}"`), `aba ausente: ${aba}`);
  }
  assert.match(referencia, /montarBalanco\(d, cotistas, mesesSelecionados\)/);
  assert.match(referencia, /projetarCustos\(total, totalHoras, b\.meses\.length/);
  assert.match(referencia, /d\?\.lancamentos/);
  assert.match(referencia, /balanco_operacional\?\.voos/);
  assert.doesNotMatch(referencia, /\["08\/01\/2026"|CF\s*=\s*17226\.49|5000\]/);
});

test("PDF deriva custos mensais e categorias do cotista selecionado no dashboard", () => {
  assert.match(dashboard, /montarBalanco\(d, cotistas, mesesSelecionados\)/);
  assert.match(dashboard, /lancamentos=\{participante\.lancamentos\}/);
  assert.match(dashboard, /Baixar balanço em PDF/);
  assert.match(calculo, /export function montarBalanco/);
  assert.match(calculo, /const acertos = new Map/);
  assert.match(calculo, /export function destaques/);
  assert.match(pdf, /categoriasDoParticipante\(b, p\)/);
  assert.match(pdf, /destaques\(b, p\)/);
  assert.match(pdf, /lancamentos\.map/);
});

test("lançamentos prioriza demonstrativo e mostra números de recibo e NF na expansão", () => {
  assert.match(financeiro, /lancamento\.numeroDemonstrativo \|\|\s+lancamento\.documentoNumero/);
  assert.match(financeiro, /\["Número do recibo", lancamento\.numeroRecibo \|\|/);
  assert.match(financeiro, /\["Número da NF", lancamento\.numeroNf \|\|/);
});
