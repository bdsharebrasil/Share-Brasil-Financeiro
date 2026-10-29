import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../src/lib/financeiro-share-api.ts", import.meta.url), "utf8");
const linhas = await readFile(new URL("../src/components/financeiro-share/linhas-contas.ts", import.meta.url), "utf8");
const hookPagar = await readFile(new URL("../src/hooks/useContasAPagar.ts", import.meta.url), "utf8");
const hookReceber = await readFile(new URL("../src/hooks/useContasAReceber.ts", import.meta.url), "utf8");
const tabela = await readFile(new URL("../src/components/financeiro-share/LancamentosUnificados.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/DashboardFinanceiro.tsx", import.meta.url), "utf8");

test("o ID e o nome da conta bancária são exibidos e ordenados na coluna Conta", () => {
  assert.match(api, /contaBancariaId: row\.contaBancariaId \?\? row\.conta_bancaria_id \?\? null/);
  assert.match(api, /buscarContasBancariasPorLancamento/);
  assert.match(api, /conta\.nome\?\.trim\(\)/);
  assert.match(linhas, /contaBancaria: c\.bancoPagamento \|\| c\.contaBancariaId \|\| "—"/);
  assert.match(linhas, /contaBancaria: c\.bancoRecebimento \|\| c\.contaBancariaId \|\| "—"/);
  assert.match(hookPagar, /contasPorLancamento\.get\(conta\.lancamentoId\)/);
  assert.match(hookReceber, /contasPorLancamento\.get\(conta\.lancamentoId\)/);
  assert.match(tabela, /\{ chave: "contaBancaria", rotulo: "Conta", largura: 153 \}/);
  assert.match(tabela, /"fornecedor" \| "contaBancaria" \| "data"/);
  assert.match(tabela, /String\(chave === "data" \? a\.dataLancamento \?\? "" : a\[chave\] \?\? ""\)\.localeCompare\(/);
  assert.match(tabela, /<td title=\{linha\.contaBancaria\}>\{linha\.contaBancaria \|\| "—"\}<\/td>/);
});

test("despesas do caixa cliente não recebem rótulo de reembolso", () => {
  assert.match(dashboard, /cliente: "Despesa Cliente"/);
  assert.doesNotMatch(dashboard, /cliente: "Caixa Cliente · a reembolsar"/);
});
