import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [pagina, api] = await Promise.all([
  readFile(new URL("../src/pages/EmissaoRecibo.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/colaborador-api.ts", import.meta.url), "utf8"),
]);

test("recibo de reembolso oferece a seleção e envia o abastecimento associado", () => {
  assert.match(pagina, /Abastecimento vinculado \(opcional\)/);
  assert.match(pagina, /abastecimentos_id:\s*form\.tipo === "recibo_reembolso"/);
  assert.match(api, /abastecimentos_id\?: string \| null/);
  assert.match(api, /abastecimentos: Array\.isArray\(resposta\.abastecimentos\)/);
});
