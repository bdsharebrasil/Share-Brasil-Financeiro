import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/financeiro-share/ProgramarContaAPagarDialog.tsx", import.meta.url), "utf8");

test("fornecedor mostra somente o nome cadastrado e não aceita texto livre", () => {
  assert.match(source, /fornecedoresDisponiveis\.map\(\(item\) => \(\{ id: item\.id, label: item\.nome \}\)\)/);
  assert.doesNotMatch(source, /item\.origem ===/);
  assert.doesNotMatch(source, /allowFreeText/);
  assert.match(source, /Nenhum fornecedor correspondente encontrado/);
});

test("lista de fornecedores é deduplicada por nome ignorando acentos e caixa", () => {
  assert.match(source, /nomesVistos\.has\(chave\)/);
  assert.match(source, /normalize\("NFD"\)/);
  assert.match(source, /toLocaleLowerCase\("pt-BR"\)/);
});

test("tipos de rateio exibem rótulos amigáveis sem alterar os valores enviados à API", () => {
  assert.match(source, /VARIAVEL_POR_VOO: "Variável por voo"/);
  assert.match(source, /VARIAVEL_POR_HORA: "Variável por hora"/);
  assert.match(source, /value=\{tipo\}>\{rotulosTipoRateio\[tipo\]\}/);
  assert.match(source, /tipo_rateio: tipoRateio/);
});

test("programação exige categoria presente na lista antes de enviar a requisição", () => {
  assert.match(source, /if \(!categoriaSelecionada\) \{[\s\S]{0,160}Selecione uma categoria de cliente válida/);
});
