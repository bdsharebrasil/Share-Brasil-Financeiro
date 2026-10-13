import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componente = await readFile(
  new URL("../src/components/agendamento/ChecklistPreVoo.tsx", import.meta.url),
  "utf8",
);

test("checklist pré-voo sinaliza visualmente progresso vazio, parcial e concluído", () => {
  assert.match(componente, /progresso === 0 \? "#facc15"/);
  assert.match(componente, /progresso === 100 \? "#34d399"/);
  assert.match(componente, /: "#f87171"/);
  assert.match(componente, /progresso === 0 \? "border-yellow-400" : "border-red-400"/);
  assert.match(componente, /conic-gradient\(\$\{corChecklist\}/);
});

test("checklist concluído oferece visualização sem alterar o fluxo de abertura", () => {
  assert.match(componente, /checklistConcluido \? "Visualizar checklist" : "Abrir checklist"/);
  assert.match(componente, /checklistConcluido \? "pointer-events-none opacity-80"/);
});
