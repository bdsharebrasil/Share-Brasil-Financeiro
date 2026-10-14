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

test("abastecimento permite informar trecho manual quando não há trecho anterior", () => {
  assert.match(componente, /Não há trecho anterior registrado para esta aeronave\. Informe o trecho manualmente/);
  assert.match(componente, /label="Trecho manual"><input value=\{manualTrecho\} onChange=\{\(e\) => \{ setManualTrecho\(e\.target\.value\); setTrechoManualAberto\(true\); \}\}/);
  assert.match(componente, /trechoConfirmado \? Boolean\(trechoId\) : Boolean\(manualTrecho\.trim\(\)\)/);
});

test("abastecimento vincula o último lançamento diário e ignora IDs mensais antigos", () => {
  assert.match(componente, /const ultimo = opcoes\.ultimo_trecho/);
  assert.doesNotMatch(componente, /const ultimo = opcoes\.diarios\?\.\[0\]/);
  assert.match(componente, /setTrechoId\(ultimo\.id\)/);
  assert.match(componente, /opcoes\.ultimo_trecho === undefined \|\| !trechoConfirmado/);
});
