import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../src/lib/colaborador-api.ts", import.meta.url), "utf8");
const movements = await readFile(new URL("../src/components/dashboard/financeiro/MovimentacoesFinanceiras.tsx", import.meta.url), "utf8");
const control = await readFile(new URL("../src/pages/ControleAbastecimento.tsx", import.meta.url), "utf8");

test("movimentações oferecem uma aba de abastecimentos pendentes e acionam a edição existente", () => {
  assert.match(api, /abastecimentos_pendentes: AbastecimentoPendenteFinanceiro\[\]/);
  assert.match(movements, /Abastecimentos pendentes/);
  assert.match(movements, /TabelaAbastecimentosPendentes abastecimentos=\{abastecimentosPendentes\}/);
  assert.match(movements, /initialRecordId=\{abastecimentoEmEdicao\}/);
  assert.match(control, /initialRecordId\?: string/);
});

test("edição preserva e mostra o número de voo existente e busca opções por aeronave", () => {
  assert.match(control, /buscarNumerosVooAeronave\(form\.aeronave_id\)/);
  assert.match(control, /if \(form\.numero_voo\.trim\(\) && !voosUnicos\.has\(form\.numero_voo\.trim\(\)\)\)/);
  assert.match(control, /value=\{form\.numero_voo\}/);
  assert.match(control, /setField\("numero_voo", value\)/);
});
