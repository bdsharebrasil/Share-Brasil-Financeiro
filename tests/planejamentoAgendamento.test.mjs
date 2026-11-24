import test from "node:test";
import assert from "node:assert/strict";
import { agendamentosComPernasPlanejadas } from "../src/components/agendamento/planejamentoAgendamento.ts";
import { filtrarOperacoes } from "../src/components/agendamento/operacoesPainelModel.ts";

const operacao = {
  id: "sol-1", numero_voo: "TST-001", status: "em_solo", jornadas_encerradas: 2, jornadas_abertas: 0,
  data_agendada: "2026-11-19", data_fim: "2026-11-19", origem: "SBBH", destino: "SBGR",
  pernas_planejadas: [
    { id: "p1", solicitacao_id: "sol-1", data_prevista: "2026-11-24", origem: "SBGR", destino: "SBRJ", numero_passageiros: 5, status: "PLANEJADA", horario_previsto: null },
    { id: "p2", solicitacao_id: "sol-1", data_prevista: "2026-11-25", origem: "SBRJ", destino: "SBBH", numero_passageiros: 0, status: "PLANEJADA", horario_previsto: "2026-11-25T14:00:00Z" },
    { id: "cancelada", status: "CANCELADA" }, { id: "iniciada", status: "INICIADA" },
  ],
};

test("calendário mostra futuras pernas com o número da mesma solicitação e datas próprias", () => {
  const agenda = agendamentosComPernasPlanejadas([operacao]);
  assert.equal(agenda.length, 3);
  assert.equal(agenda[0], operacao);
  assert.equal(new Set(agenda.map(item => item.id)).size, 3);
  assert.equal(agenda[1].solicitacao_id, operacao.id);
  assert.equal(agenda[1].numero_voo, operacao.numero_voo);
  assert.equal(agenda[1].data_agendada, "2026-11-24");
  assert.equal(agenda[1].origem, "SBGR");
  assert.equal(agenda[2].numero_passageiros, 0);
  assert.equal(operacao.data_agendada, "2026-11-19");
});

test("confirmados do dia inclui perna planejada de operação já iniciada", () => {
  const agenda = agendamentosComPernasPlanejadas([operacao]);
  const dia = filtrarOperacoes(agenda, "confirmados", "2026-11-24");
  assert.equal(dia.length, 1);
  assert.equal(dia[0].perna_planejada_id, "p1");
  assert.equal(filtrarOperacoes(agenda, "confirmados", "2026-11-26").length, 0);
  assert.equal(filtrarOperacoes([operacao], "operacao", "2026-11-24").length, 1);
});
