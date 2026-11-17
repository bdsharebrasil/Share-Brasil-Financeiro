import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dataBr,
  hojeLocal,
  inativo,
  mensagemGestao,
  normalizar,
  validarArquivo,
} from "../src/lib/gestao-colaboradores.ts";

test("busca ignora acentos e situação aceita valores legados", () => {
  assert.equal(normalizar("  Operações  "), "operacoes");
  assert.equal(inativo("INATIVO"), true);
  assert.equal(inativo("inactive"), true);
  assert.equal(inativo("ativo"), false);
});
test("mensagens não expõem erros internos e identificam sessão e e-mail duplicado", () => {
  assert.equal(
    mensagemGestao(new Error("D1_ERROR: table user_profiles")),
    "Não foi possível concluir a ação. Tente novamente.",
  );
  assert.match(
    mensagemGestao(new Error("sessao_nao_encontrada")),
    /Entre novamente/,
  );
  assert.match(
    mensagemGestao(
      new Error("A user with this email address has already been registered"),
    ),
    /e-mail já está cadastrado/,
  );
  assert.match(
    mensagemGestao(new Error("canac_obrigatorio_para_tripulante")),
    /CANAC/,
  );
});
test("arquivos são validados por tipo, tamanho e conteúdo vazio antes do envio", () => {
  assert.equal(
    validarArquivo(
      new File(["pdf"], "exame.pdf", { type: "application/pdf" }),
      true,
    ),
    null,
  );
  assert.match(
    validarArquivo(
      new File(["imagem"], "exame.png", { type: "image/png" }),
      true,
    ),
    /PDF/,
  );
  assert.match(
    validarArquivo(new File([], "vazio.pdf", { type: "application/pdf" })),
    /vazio/,
  );
  assert.match(
    validarArquivo({ size: 10 * 1024 * 1024 + 1, type: "application/pdf" }),
    /10 MB/,
  );
});
test("datas de calendário são exibidas sem deslocamento de fuso", () => {
  assert.equal(dataBr("2026-11-17"), "17/11/2026");
  assert.equal(dataBr("invalida"), "—");
  const now = new Date();
  assert.equal(
    hojeLocal(),
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  );
});
