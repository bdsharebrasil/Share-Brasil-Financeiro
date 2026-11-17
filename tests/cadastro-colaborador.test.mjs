import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatarCpf,
  formatarTelefone,
  aplicarMascara,
} from "../src/lib/cadastro-colaborador.ts";
test("CPF recebe separadores e preserva zeros durante digitação e colagem", () => {
  assert.equal(formatarCpf("12345678910"), "123.456.789-10");
  assert.equal(formatarCpf("123.456.789-10"), "123.456.789-10");
  assert.equal(formatarCpf("01234567890"), "012.345.678-90");
  assert.equal(formatarCpf("1234"), "123.4");
  assert.equal(formatarCpf(""), "");
});
test("telefone admite fixo, celular e colagem com código do Brasil", () => {
  assert.equal(formatarTelefone("6533221100"), "(65)3322-1100");
  assert.equal(formatarTelefone("65987654321"), "(65)98765-4321");
  assert.equal(formatarTelefone("+55 (65) 98765-4321"), "(65)98765-4321");
  assert.equal(formatarTelefone("(65)3322-1100"), "(65)3322-1100");
  assert.equal(formatarTelefone(""), "");
});
test("edição mantém o cursor em relação à sequência de dígitos", () => {
  let cursor;
  const input = {
    value: "12345678910",
    selectionStart: 5,
    setSelectionRange: (inicio) => (cursor = inicio),
  };
  aplicarMascara(input, formatarCpf);
  assert.equal(input.value, "123.456.789-10");
  assert.equal(cursor, 6);
});
