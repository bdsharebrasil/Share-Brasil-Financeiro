import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/pages/EnviarPagamento.tsx", import.meta.url), "utf8");

test("envio direto ao cliente usa os IDs persistidos como única fonte dos anexos", () => {
  assert.match(source, /anexos:\s*grupo\.anexos\.map\(\(anexo\) => anexo\.id\)/);
  assert.match(source, /arquivos:\s*envioPorCotista \? \[\] : arquivosNovos/);
  assert.match(source, /arquivos_persistidos:\s*envioPorCotista \? \[\] : arquivosPersistidos\.map/);
});

test("envio direto mostra feedback centralizado e fecha o modal em sucesso ou falha", () => {
  assert.match(source, /position:\s*"top-center"/);
  assert.match(source, /top:\s*"50%"[\s\S]*left:\s*"50%"[\s\S]*translate\(-50%, -50%\)/);
  assert.match(source, /notificarEnvioCliente\("success", mensagemSucesso\);\s*fecharModalEmail\(\)/);
  assert.match(source, /notificarEnvioCliente\("error",[\s\S]*?\);\s*}\s*fecharModalEmail\(\)/);
});
