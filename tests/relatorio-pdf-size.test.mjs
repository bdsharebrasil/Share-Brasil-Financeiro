import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const generator = await readFile(new URL("../src/lib/relatorioViagemPdf.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/pages/RelatorioDespesaViagem.tsx", import.meta.url), "utf8");

test("PDF rasteriza páginas em resolução adequada e JPEG de alta qualidade", () => {
  assert.match(generator, /const ESCALA_COMPROVANTE = 2/);
  assert.match(generator, /const ESCALA_RELATORIO = 2/);
  assert.match(generator, /adicionarCanvasAoPdf\(pdf, canvas, "JPEG", 0\.92, 4\)/);
  assert.match(generator, /adicionarCanvasAoPdf\(pdf, pagina, "JPEG", 0\.92, 0\.5\)/);
});

test("upload avisa antes do envio quando o PDF excede o limite do Worker", () => {
  assert.match(page, /const LIMITE_PDF_RELATORIO_BYTES = 25 \* 1024 \* 1024/);
  assert.match(page, /pdfBlob\.size > LIMITE_PDF_RELATORIO_BYTES/);
  assert.match(page, /O PDF ainda excede 25 MB após a compressão/);
});