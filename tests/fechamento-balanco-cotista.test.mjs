import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../src/components/FinanceiroCotista/", import.meta.url);
const [financeiro, dashboard, pdf] = await Promise.all([
  readFile(new URL("FinanceiroCotista.tsx", base), "utf8"),
  readFile(new URL("FechamentoBalancoDashboardCotista.tsx", base), "utf8"),
  readFile(new URL("balancoCotistaPdf.ts", base), "utf8"),
]);

test("aba Fechamento Balanço usa dados do dashboard e transmite cotista e competências selecionados", () => {
  assert.match(financeiro, /abaAtiva === "fechamento-balanco"[\s\S]*?<FechamentoBalancoDashboardCotista/);
  assert.match(financeiro, /cotistaId=\{cotistaVisaoId\}/);
  assert.match(financeiro, /mesesSelecionados=\{mesesAplicados\}/);
  assert.doesNotMatch(financeiro, /<FechamentoBalancoCotista\s*\/>/);
});

test("PDF deriva custos mensais e categorias do cotista selecionado no dashboard", () => {
  assert.match(dashboard, /meses: cotistaSelecionado\.mensal/);
  assert.match(dashboard, /c\.cotistas\.get\(cotistaSelecionado\.id\)/);
  assert.match(dashboard, /Baixar balanço em PDF/);
  assert.match(pdf, /balanco-\$\{slug\(dados\.aeronave\)\}-\$\{slug\(dados\.cotista\)\}-\$\{sufixo\}\.pdf/);
  assert.match(pdf, /dados\.meses/);
});
