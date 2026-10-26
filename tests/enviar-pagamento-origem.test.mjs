import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagina = await readFile(new URL("../src/pages/EnviarPagamento.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/lib/colaborador-api.ts", import.meta.url), "utf8");

test("envio direto oferece origens de despesa após a seleção do cotista", () => {
  assert.match(pagina, /Deseja vincular uma despesa existente\?/);
  assert.match(pagina, /ABASTECIMENTOS/);
  assert.match(pagina, /RECIBOS/);
  assert.match(pagina, /RELATÓRIO DE VIAGEM/);
  assert.match(pagina, /form\.cotista_ids\.length > 0/);
});

test("seleção de despesa preenche valor, descrição, categoria e anexos", () => {
  assert.match(pagina, /descricao: String\(item\.descricao/);
  assert.match(pagina, /valor: item\.valor == null/);
  assert.match(pagina, /grupo_categoria:/);
  assert.match(pagina, /anexos: documentos\.length/);
  assert.match(api, /numeroVoo: string \| undefined/);
});
