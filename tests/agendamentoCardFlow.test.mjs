import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  obterAcoesAgendamento,
  statusPermiteAbrirJornada,
  statusPermiteChecklist,
} from "../src/components/agendamento/agendamentoCardFlow.ts";

const paginaAgendamentos = readFileSync(new URL("../src/components/agendamento/FichaAgendaOperacional.tsx", import.meta.url), "utf8");

test("status acionado e decolado mantêm a jornada acessível", () => {
  for (const status of ["acionado", "decolado"]) {
    assert.equal(statusPermiteAbrirJornada(status), true);
    assert.equal(statusPermiteChecklist(status), true);
    assert.equal(obterAcoesAgendamento({ status, jornadas_abertas: 1 }, 100).mostrarJornada, true);
  }
});

test("a abertura da jornada preserva o histórico encerrado e bloqueia solicitações pendentes", () => {
  assert.equal(statusPermiteAbrirJornada("encerrada"), true);
  assert.equal(statusPermiteAbrirJornada("concluida"), true);
  assert.equal(statusPermiteAbrirJornada("pendente"), false);
});

test("a ficha usa a regra compartilhada e valida o vínculo antes de renderizar a jornada", () => {
  assert.match(paginaAgendamentos, /statusPermiteAbrirJornada\(operacao\.status\)\s*&&\s*vinculoValido/);
  assert.match(paginaAgendamentos, /acao === "horarios" && \(podeHorarios/);
});
