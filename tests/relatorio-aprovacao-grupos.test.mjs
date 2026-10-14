import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/components/relatorio-viagem/AprovacaoRelatorioViagem.tsx", import.meta.url),
  "utf8",
);

test("aprovar relatório não depende da revisão de todos os grupos", () => {
  const inicioDecisao = source.indexOf("const decidir = async (aprovado: boolean) => {");
  const fimDecisao = source.indexOf("\n  };", inicioDecisao);
  assert.notEqual(inicioDecisao, -1, "handler de decisão deve existir");
  assert.notEqual(fimDecisao, -1, "handler de decisão deve estar completo");
  const handler = source.slice(inicioDecisao, fimDecisao);

  assert.doesNotMatch(handler, /relatorioRevisado|filtrosPendentes/);
  assert.match(source, /disabled=\{enviando\}/);
  assert.doesNotMatch(source, /disabled=\{enviando \|\| \(!podeReprocessarFinanceiro && !relatorioRevisado\)\}/);
  assert.match(source, /A revisão dos grupos é opcional/);
});
