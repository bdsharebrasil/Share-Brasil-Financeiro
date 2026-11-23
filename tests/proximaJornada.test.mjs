import assert from "node:assert/strict";
import test from "node:test";
import { prepararProximaJornada } from "../src/components/agendamento/proximaJornada.ts";

const perna = (numero, destino, horario_pouso, numero_passageiros = 4) => ({ numero, destino, horario_pouso, numero_passageiros });
const jornada = (id, data, numero_jornada, pernas, status = "encerrada") => ({ id, data, numero_jornada, pernas, status });

test("próxima jornada parte do último pouso da última jornada encerrada, mesmo com histórico fora de ordem", () => {
  const antiga = jornada("antiga", "2026-11-21", 1, [perna(1, "SBBH", "2026-11-21T10:00:00Z")]);
  const ultima = jornada("ultima", "2026-11-23", 3, [
    perna(2, " sbrj ", "2026-11-23T16:00:00Z", 3),
    perna(3, "SBSP", null), // Destino planejado não substitui o último pouso real.
    perna(1, "SBGR", "2026-11-23T14:00:00Z"),
  ]);
  const principal = { ...antiga, historico: [ultima, antiga] };
  assert.deepEqual(prepararProximaJornada(principal, { numero_passageiros: 7 }, "2026-11-23"), {
    origem: "SBRJ", destino: "", numero_passageiros: "3", data: "2026-11-24",
  });
});

test("preserva zero passageiros e usa o valor do voo quando a perna não possui quantidade", () => {
  const registro = jornada("j1", "2026-11-23", 1, [perna(1, "SBRJ", "2026-11-23T14:00:00Z", 0)]);
  assert.equal(prepararProximaJornada(registro, { numero_passageiros: 5 }, "2026-11-23").numero_passageiros, "0");
  registro.pernas[0].numero_passageiros = null;
  assert.equal(prepararProximaJornada(registro, { numero_passageiros: 5 }, "2026-11-23").numero_passageiros, "5");
});

test("não inventa origem quando a última jornada encerrada não tem pouso registrado", () => {
  const antiga = jornada("antiga", "2026-11-22", 1, [perna(1, "SBBH", "2026-11-22T10:00:00Z")]);
  const ultima = { ...jornada("ultima", "2026-11-23", 2, [perna(1, "SBGR", null)]), historico: [antiga] };
  assert.equal(prepararProximaJornada(ultima, { numero_passageiros: 2 }, "2026-11-23"), null);
  assert.equal(prepararProximaJornada(jornada("aberta", "2026-11-23", 1, [], "em_rota"), { numero_passageiros: 2 }, "2026-11-23"), null);
});

test("data sugerida respeita o último corte após a meia-noite e nunca retrocede para antes de hoje", () => {
  const registro = jornada("j1", "2026-11-23", 1, [{ ...perna(1, "SBRJ", "2026-11-23T23:55:00Z"), horario_corte: "2026-11-24T00:05:00Z" }]);
  assert.equal(prepararProximaJornada(registro, { numero_passageiros: 2 }, "2026-11-23").data, "2026-11-25");
  assert.equal(prepararProximaJornada(registro, { numero_passageiros: 2 }, "2026-11-27").data, "2026-11-27");
});
