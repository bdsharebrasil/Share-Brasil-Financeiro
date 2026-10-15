import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/pages/PlanoDeVoo.tsx", import.meta.url), "utf8");
const folder = await readFile(new URL("../src/components/plano/PlanosVooSalvos.tsx", import.meta.url), "utf8");

test("plano de voo possui aba separada para planos salvos e botão de salvar não é fixo", () => {
  assert.match(page, /Planos salvos/);
  assert.match(page, /<PlanosVooSalvos/);
  assert.doesNotMatch(page, /className="sticky bottom-3/);
});

test("planos salvos agrupam por matrícula e depois por mês com busca", () => {
  assert.match(folder, /matriculaPlano/);
  assert.match(folder, /chaveMes/);
  assert.match(folder, /Buscar matrícula, voo, rota ou ICAO/);
  assert.match(folder, /Aeronave não identificada/);
});
