import assert from "node:assert/strict";
import test from "node:test";
import { abaExibeLista, obterFiltroDaAba } from "../src/components/agendamento/agendamentoNavigationModel.ts";

test("cada seção de lista aplica seu filtro específico sem alterar o filtro geral", () => {
  assert.equal(obterFiltroDaAba("cronograma", "todos"), "todos");
  assert.equal(obterFiltroDaAba("pendentes", "todos"), "pendente");
  assert.equal(obterFiltroDaAba("aprovados", "todos"), "aprovada");
  assert.equal(obterFiltroDaAba("historico", "todos"), "encerrada");
  assert.equal(obterFiltroDaAba("cronograma", "em_voo"), "em_voo");
});

test("somente visão geral, pendentes, aprovados e histórico usam o cronograma", () => {
  for (const aba of ["cronograma", "pendentes", "aprovados", "historico"]) assert.equal(abaExibeLista(aba), true);
  for (const aba of ["calendario", "escala", "voos-hoje"]) assert.equal(abaExibeLista(aba), false);
});
