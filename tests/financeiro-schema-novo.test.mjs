import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const api = await readFile(new URL("../src/lib/financeiro-share-api.ts", import.meta.url), "utf8");

test("normalização do caixa aceita as colunas novas de lancamentos", () => {
  assert.match(api, /row\.categoria_share_id \?\? row\.categoria_id/);
  assert.match(api, /row\.pago_por_cotista_id/);
});
