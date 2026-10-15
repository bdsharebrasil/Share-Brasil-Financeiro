import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/relatorio-viagem/AprovacaoRelatorioViagem.tsx", import.meta.url), "utf8");

test("aprovação pública oferece visualização do relatório em PDF", () => {
  assert.match(source, /\/api\/public\/relatorios-despesa-viagem\/aprovacao\/\$\{encodeURIComponent\(token\)\}\/pdf/);
  assert.match(source, />\s*Visualizar relatório\s*</);
  assert.match(source, /target="_blank"/);
});
