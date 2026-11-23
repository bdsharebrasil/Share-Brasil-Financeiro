import assert from "node:assert/strict";
import test from "node:test";
import { filtrarOperacoes, operacaoIniciada, selecionarOperacao } from "../src/components/agendamento/operacoesPainelModel.ts";

const hoje = "2026-11-23";
const voo = (id, status, dados = {}) => ({ id, status, data_agendada: hoje, data_fim: hoje, ...dados });

test("confirmados reúne apenas voos do dia ainda sem operação iniciada", () => {
  const voos = [
    voo("hoje", "APROVADA"),
    voo("varios-dias", "aprovada", { data_agendada: "2026-11-22", data_fim: "2026-11-24" }),
    voo("amanha", "aprovada", { data_agendada: "2026-11-24", data_fim: "2026-11-24" }),
    voo("pendente", "pendente"), voo("encerrado", "encerrada"),
    voo("iniciado", "aprovada", { jornadas_abertas: 1 }),
  ];
  assert.deepEqual(filtrarOperacoes(voos, "confirmados", hoje).map((item) => item.id), ["hoje", "varios-dias"]);
});

test("operações não dependem da data, de sinal ADS-B ou de horários já preenchidos", () => {
  const voos = ["acionado", "decolado", "em_voo", "em_rota", "em_solo"].map((status) => voo(status, status, { data_agendada: "2026-11-20", data_fim: "2026-11-20" }));
  voos.push(voo("programado-sem-horarios", "aprovada", { jornada_id: "j1", jornadas_abertas: "1" }));
  voos.push(voo("entre-jornadas", "aprovada", { jornadas_encerradas: "1" }));
  assert.equal(filtrarOperacoes(voos, "operacao", hoje).length, 7);
  assert.ok(voos.every(operacaoIniciada));
});

test("jornadas antigas não recolocam operações encerradas na lista ativa", () => {
  for (const status of ["encerrada", "CONCLUIDA", "cancelada", "reprovada", "pendente"]) {
    assert.equal(operacaoIniciada(voo(status, status, { jornada_id: "j1", jornadas_abertas: 1, jornadas_encerradas: 1 })), false);
  }
});

test("trocar filtro, remover ou encerrar um voo reconcilia a seleção com a lista visível", () => {
  const primeiro = voo("primeiro", "em_voo");
  const segundo = voo("segundo", "em_solo");
  assert.equal(selecionarOperacao([primeiro, segundo], "segundo"), segundo);
  assert.equal(selecionarOperacao([primeiro], "segundo"), primeiro);
  assert.equal(selecionarOperacao([], "segundo"), null);
});
