import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/pages/EnviarPagamento.tsx", import.meta.url), "utf8");

test("envio direto exige escolha explícita entre voo e sem voo", () => {
  assert.match(source, /\["com_voo", "Com número de voo"\]/);
  assert.match(source, /\["sem_voo", "Sem número de voo"\]/);
  assert.match(source, /modoVooValido = tipo !== "cliente" \|\| Boolean\(modoNumeroVooCliente\)/);
});

test("sem número de voo carrega cotistas da aeronave e permite selecionar um ou todos", () => {
  assert.match(source, /modo === "sem_voo" && form\.aeronave_id\) void carregarCotistas\(form\.aeronave_id\)/);
  assert.match(source, /modoNumeroVooCliente === "sem_voo" && <Campo label="Cotista\(s\) da aeronave" obrigatorio>/);
  assert.match(source, /placeholder="Selecione um cotista ou todos"/);
  assert.match(source, /id === "__todos__" \? \(todosSelecionados \? \[\] : cotistas\.map/);
});

test("envio direto sem voo serializa numero_voo como null e mantém o rateio obrigatório", () => {
  assert.match(source, /numero_voo: form\.numero_voo \|\| null/);
  assert.match(source, /const validarRateio = \(\) => \{[\s\S]*?if \(!form\.aeronave_id\) return false;/);
  assert.doesNotMatch(source, /validarRateio[\s\S]{0,300}if \(!form\.numero_voo\)/);
});
