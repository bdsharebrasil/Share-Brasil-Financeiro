import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../src/lib/financeiro-share-api.ts", import.meta.url), "utf8");
const linhas = await readFile(new URL("../src/components/financeiro-share/linhas-contas.ts", import.meta.url), "utf8");
const tabela = await readFile(new URL("../src/components/financeiro-share/LancamentosUnificados.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/DashboardFinanceiro.tsx", import.meta.url), "utf8");

test("o banco associado ao lançamento é exibido e ordenado na coluna Conta", () => {
  assert.match(api, /contaBancaria: row\.contaBancaria \?\? row\.banco_pagamento_nome \?\? null/);
  assert.match(linhas, /contaBancaria: c\.bancoPagamento \|\| "—"/);
  assert.match(tabela, /\{ label: "Conta", key: "contaBancaria" \}/);
  assert.match(tabela, /ordenacao\.chave === "contaBancaria" \? a\.contaBancaria\.localeCompare\(b\.contaBancaria/);
});

test("despesas do caixa cliente não recebem rótulo de reembolso", () => {
  assert.match(dashboard, /cliente: "Despesa Cliente"/);
  assert.doesNotMatch(dashboard, /cliente: "Caixa Cliente · a reembolsar"/);
});
