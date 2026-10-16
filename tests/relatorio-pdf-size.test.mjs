import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const generator = await readFile(new URL("../src/lib/relatorioViagemPdf.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/pages/RelatorioDespesaViagem.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/worker.ts", import.meta.url), "utf8");

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

test("anexos mantêm vínculo estável com a despesa quando a lista muda", () => {
  assert.match(page, /id: despesa\.id \|\| `\$\{item\.id\}-despesa-\$\{index\}`/);
  assert.match(page, /despesas: despesas\.map\(\(\{ id, \.\.\.item \}\) => \(\{\s*id,/);
  assert.match(worker, /SELECT id, status, despesas, numero_relatorio/);
  assert.match(worker, /despesaIdPorIndiceAntigo\.get\(Number\(anexo\.indice_despesa\)\)/);
  assert.match(worker, /novoIndicePorDespesaId\.get\(despesaId\)/);
  assert.match(worker, /const indiceDestino = novoIndice \?\? -1/);
  assert.match(worker, /SET indice_despesa = \?1 WHERE id = \?2 AND relatorio_despesa_viagem_id = \?3/);
  assert.match(page, /const uploadAnexo = async \(arquivo: File, indiceDespesa = 0\) => \{[\s\S]{0,180}const relatorioAtual = await salvar\(true\)/);
});