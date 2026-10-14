import test from "node:test";
import assert from "node:assert/strict";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "../src/components/agendamento/agendamentoCardFlow.ts";

const aprovado = { status: "aprovada", checklist_status: null, checklist_itens_respondidos: 0 };

test("agendamento aprovado sem checklist mostra iniciar voo, não jornada, e usa amarelo", () => {
  const acoes = obterAcoesAgendamento(aprovado, calcularProgressoChecklist(aprovado));
  assert.equal(acoes.checklistLabel, "INICIAR VOO");
  assert.equal(acoes.corChecklist, "yellow");
  assert.equal(acoes.mostrarJornada, false);
});

test("checklist em andamento mostra concluir checklist e acompanha progresso parcial em vermelho", () => {
  const item = { ...aprovado, checklist_status: "rascunho", checklist_itens_respondidos: 5 };
  const progresso = calcularProgressoChecklist(item);
  const acoes = obterAcoesAgendamento(item, progresso);
  assert.ok(progresso > 0 && progresso < 100);
  assert.equal(acoes.checklistLabel, "CONCLUIR CHECKLIST");
  assert.equal(acoes.corChecklist, "red");
  assert.equal(acoes.mostrarJornada, false);
});

test("checklist concluído oferece visualização e libera iniciar jornada em verde", () => {
  const item = { ...aprovado, checklist_status: "concluido", checklist_itens_respondidos: 37 };
  const acoes = obterAcoesAgendamento(item, calcularProgressoChecklist(item));
  assert.equal(acoes.checklistLabel, "VER CHECKLIST");
  assert.equal(acoes.corChecklist, "green");
  assert.equal(acoes.mostrarJornada, true);
  assert.equal(acoes.jornadaLabel, "INICIAR JORNADA");
});

test("depois de criada uma jornada o card mostra ver jornada, mesmo que ela já esteja encerrada", () => {
  const item = { ...aprovado, jornadas_abertas: 1 };
  const acoes = obterAcoesAgendamento(item, 0);
  assert.equal(acoes.mostrarJornada, true);
  assert.equal(acoes.jornadaLabel, "VER JORNADA");
});

test("operação concluída mantém o estado histórico e oculta ações operacionais", () => {
  const acoes = obterAcoesAgendamento({ ...aprovado, status: "encerrada", jornadas_encerradas: 1 }, 100);
  assert.equal(acoes.historico, true);
  assert.equal(acoes.mostrarChecklist, false);
  assert.equal(acoes.mostrarJornada, false);
  assert.equal(acoes.podeFinalizar, false);
});
