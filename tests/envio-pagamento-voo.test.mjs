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
  assert.match(source, /const ids = id === "__todos__"[\s\S]{0,250}cotista_ids\.filter/);
});

test("envio direto sem voo serializa numero_voo como null e mantém o rateio obrigatório", () => {
  assert.match(source, /numero_voo: form\.numero_voo \|\| null/);
  assert.match(source, /const validarRateio = \(\) => \{[\s\S]*?if \(!form\.aeronave_id\) return false;/);
  assert.doesNotMatch(source, /validarRateio[\s\S]{0,300}if \(!form\.numero_voo\)/);
});

test("envio direto inclui o nome da categoria selecionada no payload do rateio", () => {
  assert.match(source, /categoria_id: form\.categoria_id, categoria_cliente_id: tipo === "cliente" \? form\.categoria_id : undefined, categoria_nome: form\.categoria_nome/);
  assert.match(source, /onChange=\{\(id, label\) => setForm\(\(atual\) => \(\{ \.\.\.atual, categoria_id: id, categoria_nome: label/);
});

test("no modo com voo, a lista de cotistas permite multisseleção e retirar cada cotista", () => {
  assert.match(source, /onChange=\{atualizarSelecaoCotistas\} placeholder="Selecione cotistas \(adicione ou remova\)"/);
  assert.doesNotMatch(source, /onChange=\{\(\) => undefined\} placeholder="Cotistas preenchidos pelo voo"/);
  assert.match(source, /aria-label=\{`Retirar \$\{cotista\.nome\} do rateio`\}/);
  assert.match(source, /const atualizarSelecaoCotistas = \(id: string\) => setForm/);
  assert.match(source, /100 - somaPercentuais/);
});
