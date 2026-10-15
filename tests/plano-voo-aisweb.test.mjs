import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/hooks/usarPlanoVoo.ts", import.meta.url), "utf8");

test("consulta AISWEB usa aeronave selecionada e coordenadas retornadas pelo backend", () => {
  assert.match(source, /aircraftId: contexto\?\.aeronave\?\.id/);
  assert.match(source, /dados\.departure\.lat/);
  assert.match(source, /dados\.destination\.lat/);
  assert.match(source, /setCarregando\(true\)/);
  assert.match(source, /setCarregando\(false\)/);
});
