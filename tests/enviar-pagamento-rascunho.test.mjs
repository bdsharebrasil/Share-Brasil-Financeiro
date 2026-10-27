import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagina = await readFile(new URL("../src/pages/EnviarPagamento.tsx", import.meta.url), "utf8");

test("excluir rascunho ativo impede autosaves pendentes e cleanup de recriá-lo", () => {
  assert.match(pagina, /const rascunhosExcluidosRef = useRef\(new Set<string>\(\)\)/);
  assert.match(pagina, /if \(rascunhosExcluidosRef\.current\.has\(id\)\) return null/);
  assert.match(pagina, /rascunhosExcluidosRef\.current\.add\(rascunho\.id\);\s*try \{\s*await filaSalvamento\.current;\s*await excluirRascunhoEnvioPagamento/);
  assert.match(pagina, /setEnvioRecemCriado\(null\)/);
  assert.match(pagina, /rascunhosExcluidosRef\.current\.delete\(rascunho\.id\)/);
});
