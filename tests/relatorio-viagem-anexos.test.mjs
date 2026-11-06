import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { anexosComDespesa } from "../src/lib/relatorio-viagem-anexos.ts";

const page = await readFile(new URL("../src/pages/RelatorioDespesaViagem.tsx", import.meta.url), "utf8");
const pdfGenerator = await readFile(new URL("../src/lib/relatorioViagemPdf.ts", import.meta.url), "utf8");

test("mantém comprovantes da despesa 9 e ignora cópias sem identificação de item", () => {
  const anexos = [
    { id: "legado-a", nome_arquivo: "hospedagem-duplicada.pdf", indice_despesa: null },
    { id: "legado-b", nome_arquivo: "nota-duplicada.pdf", indice_despesa: "" },
    { id: "item-9", nome_arquivo: "nota-item-9.pdf", indice_despesa: 8 },
    { id: "fora-da-faixa", nome_arquivo: "anexo-obsoleto.pdf", indice_despesa: 99 },
  ];

  assert.deepEqual(anexosComDespesa(anexos, 16), [
    { anexo: anexos[2], indiceOriginal: 8 },
  ]);
});

test("aceita índice numérico em string e conserva anexos múltiplos da mesma despesa", () => {
  const anexos = [
    { id: "item-1-a", indice_despesa: "0" },
    { id: "item-1-b", indice_despesa: 0 },
  ];

  assert.deepEqual(anexosComDespesa(anexos, 1).map(({ anexo, indiceOriginal }) => [anexo.id, indiceOriginal]), [
    ["item-1-a", 0],
    ["item-1-b", 0],
  ]);
});

test("rascunho lista os anexos existentes com ação de visualização e mantém upload separado", () => {
  assert.match(page, /anexosDaDespesa\(index\)\.map/);
  assert.match(page, /onClick=\{\(\) => void visualizarAnexo\(anexo\)\}/);
  assert.match(page, /label=\{anexosDaDespesa\(index\)\.length \? "Adicionar outro comprovante" : "Comprovante"\}/);
  assert.match(page, /baixarAnexoRelatorio\(relatorio\.id, anexo\.id\)/);
});

test("geração de PDF ignora comprovantes órfãos antes do download e da montagem", () => {
  assert.match(page, /anexosComDespesa\(item\.anexos \|\| \[\], despesasDoRelatorio\.length\)/);
  assert.match(pdfGenerator, /anexosComDespesa\(anexos, despesas\.length\)/);
  assert.doesNotMatch(pdfGenerator, /Item não identificado/);
});
