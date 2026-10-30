import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagina = await readFile(new URL("../src/pages/EmissaoRecibo.tsx", import.meta.url), "utf8");

 test("PDF do recibo inclui a matrícula vinculada ao ID da aeronave", () => {
  assert.match(pagina, /aeronaves\.find\(\s*\(aeronave\) => aeronave\.id === recibo\.aeronave_id/);
  assert.match(pagina, /`Aeronave: \$\{matriculaAeronave\}`/);
  assert.match(pagina, /gerarPdfRecibo\(recibo, colaborador, opcoes\.aeronaves\)/);
  assert.match(pagina, /colaboradorSelecionado,\s*opcoes\.aeronaves/);
});
