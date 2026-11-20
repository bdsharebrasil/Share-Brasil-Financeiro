import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const form = await readFile(new URL("../src/components/diario/DiarioLancamentoForm.tsx", import.meta.url), "utf8");
const controle = await readFile(new URL("../src/pages/ControleAbastecimento.tsx", import.meta.url), "utf8");
const shareBrasil = await readFile(new URL("../src/pages/ShareBrasil.tsx", import.meta.url), "utf8");

test("edição do abastecimento vinculado mantém os dados e converte para atualização do vínculo atual", () => {
  assert.match(form, /function dadosAbastecimento\(item: Abastecimento\): FormValues[\s\S]*abastecimento_fornecedor_id: item\.fornecedor_id/);
  assert.match(form, /const editarAbastecimentoVinculado = \(\) => \{\s*setForm\(\(current\) => \(\{ \.\.\.current, abastecimento_id: "", abastecido: true \}\)\);\s*setAbastecimentoModo\("novo"\);/);
  assert.match(form, /Editar dados deste abastecimento/);
  assert.match(form, /!value\("abastecimento_id"\)[\s\S]*fornecedor_id: value\("abastecimento_fornecedor_id"\)/);
});

test("seletor de trechos usa registros do Diário e mês da data atual do abastecimento", () => {
  assert.match(controle, /options\?\.trechos_diario/);
  assert.match(controle, /useState\(\(\) => form\.data\.slice\(0, 7\)/);
});

test("formulários do Share Brasil são remontados ao trocar entre novo e edição", () => {
  assert.match(shareBrasil, /<FormularioCadastroContato\s+key=\{editingContact\?\.id \|\| "novo-contato"\}/);
  assert.match(shareBrasil, /<FormularioCadastroContato key=\{hangarEditor \? hangarEditor\.id : "novo-hangar"\}/);
});

test("Documentos usa cards apenas no nível atual e oferece cards para subpastas", () => {
  assert.match(shareBrasil, /const visibleFolders = folders\.filter\(/);
  assert.match(shareBrasil, /const subfolders = folders\.filter\(/);
  assert.match(shareBrasil, /Pastas nesta pasta/);
});
