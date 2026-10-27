import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagina = await readFile(new URL("../src/pages/EnviarPagamento.tsx", import.meta.url), "utf8");
const campo = await readFile(new URL("../src/components/ui/AnexosDinamicosField.tsx", import.meta.url), "utf8");

test("anexo sem cotista individual fica compartilhado com todos os cotistas da aeronave", () => {
  assert.match(campo, /id: "__todos__", label: "Todos os cotistas da aeronave"/);
  assert.match(campo, /value=\{a\.cotista_id \|\| "__todos__"\}/);
  assert.match(pagina, /function anexoAplicaAoCotista\(anexo: AnexoLinha, cotistaId: string\)[\s\S]*return !anexo\.cotista_id \|\| anexo\.cotista_id === cotistaId/);
  assert.match(pagina, /form\.anexos\.some\(\(anexo\) => !anexo\.cotista_id\) \? cotistas : cotistasSelecionados/);
  assert.match(pagina, /anexoAplicaAoCotista\(anexo, cotistaAlvo!\.id\)/);
});
