import test from "node:test";
import assert from "node:assert/strict";
import { vincularPlanejamentos } from "../src/components/agendamento/planejamentoAgendamento.ts";
import { filtrarOperacoes } from "../src/components/agendamento/operacoesPainelModel.ts";

const original = {
  id: "sol-1", numero_voo: "TST-001", status: "em_solo", jornadas_encerradas: 2,
  data_agendada: "2026-11-19", data_fim: "2026-11-19", origem: "SBBH", destino: "SBGR",
};
const planejada = {
  id: "p1", solicitacao_origem_id: "sol-1", numero_voo: "TST-001", status: "aprovada",
  data_agendada: "2026-11-24", data_fim: "2026-11-24", origem: "SBGR", destino: "SBRJ", numero_passageiros: 0,
};

test("cada perna confirmada usa o ID gravado e é agrupada na solicitação original", () => {
  const realizada = { ...planejada, id: "p2", status: "concluida" };
  const agenda = vincularPlanejamentos([original, planejada, realizada]);
  assert.deepEqual(agenda.map(item => item.id), ["sol-1", "p1", "p2"]);
  assert.equal(agenda[1], planejada);
  assert.deepEqual(agenda[0].pernas_planejadas.map(perna => perna.id), ["p1"]);
  assert.equal(agenda[0].pernas_planejadas[0].numero_passageiros, 0);
});

test("confirmados inclui perna futura e o filtro ativo mostra apenas a operação original", () => {
  const acionada = { ...planejada, id: "p2", status: "acionado" };
  const agenda = vincularPlanejamentos([original, planejada, acionada]);
  assert.deepEqual(filtrarOperacoes(agenda, "confirmados", "2026-11-24").map(voo => voo.id), ["p1"]);
  assert.deepEqual(filtrarOperacoes(agenda, "operacao", "2026-11-24").map(voo => voo.id), ["sol-1"]);
});
