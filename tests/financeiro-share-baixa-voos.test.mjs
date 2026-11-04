import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [api, fechamento] = await Promise.all([
  readFile(new URL("../src/lib/financeiro-share-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/FinanceiroCotista/FechamentoBalancoReferencia.tsx", import.meta.url), "utf8"),
]);

test("baixa de conta a pagar envia a conta bancária selecionada por ID", () => {
  assert.match(api, /conta_bancaria_id:\s*dados\.contaBancariaId\s*\|\|\s*dados\.bancoPagamento/);
  assert.match(api, /contaBancariaId\?: string/);
});

test("Seu período em voo recupera voos vinculados pelos IDs cliente/sócio quando o cálculo não os associou", () => {
  assert.match(fechamento, /voosDoParticipante\.length\s*\?\s*voosDoParticipante\s*:\s*voosDoCadastroCotista/);
  assert.match(fechamento, /voo\.clienteId === clienteId/);
  assert.match(fechamento, /voo\.socioId === socioId/);
  assert.match(fechamento, /voo\.clienteTomadorId === clienteId/);
  assert.match(fechamento, /voo\.socioTomadorId === socioId/);
});
