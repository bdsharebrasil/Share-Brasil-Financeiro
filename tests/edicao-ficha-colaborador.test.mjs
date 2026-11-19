import assert from "node:assert/strict";
import { test } from "node:test";
import { montarAlteracoesFicha } from "../src/lib/edicao-ficha-colaborador.ts";

test("edição pessoal limita o payload aos dados da aba Dados pessoais", () => {
  const alteracoes = montarAlteracoesFicha(
    "pessoal",
    {
      nome_completo: "Ana Silva",
      telefone: "11999990000",
      departamento: "Operações",
      data_admissao: "2020-01-01",
      status: "ativo",
      exame_admissional_realizado: 0,
      email: "ana@share-brasil.com",
    },
    {
      nome_completo: "Ana Souza",
      telefone: "11999990000",
      departamento: "Financeiro",
      data_admissao: "2021-01-01",
      status: "inativo",
      exame_admissional_realizado: true,
      email: "outra@share-brasil.com",
    },
  );

  assert.deepEqual(alteracoes, { nome_completo: "Ana Souza" });
  assert.equal("departamento" in alteracoes, false);
  assert.equal("email" in alteracoes, false);
});

test("edição profissional limita o payload e mantém departamento sincronizado", () => {
  const alteracoes = montarAlteracoesFicha(
    "profissional",
    {
      nome_completo: "Ana Silva",
      telefone: "11999990000",
      departamento: "Operações",
      data_admissao: "2020-01-01",
      status: "ativo",
      canac: "123456",
      exame_admissional_realizado: 0,
      email: "ana@share-brasil.com",
    },
    {
      nome_completo: "Outro nome",
      telefone: "11888887777",
      departamento: "Tripulante",
      departamentos_email: "Operações",
      data_admissao: "2020-01-01",
      status: "ativo",
      canac: "654321",
      exame_admissional_realizado: false,
      email: "outra@share-brasil.com",
    },
  );

  assert.deepEqual(alteracoes, {
    departamento: "Tripulante",
    canac: "654321",
    departamentos_email: "Tripulante",
  });
  assert.equal("nome_completo" in alteracoes, false);
  assert.equal("telefone" in alteracoes, false);
  assert.equal("email" in alteracoes, false);
});

test("valores vazios nulos e estado do exame 0/false não geram atualizações indevidas", () => {
  assert.deepEqual(
    montarAlteracoesFicha(
      "profissional",
      {
        departamento: null,
        exame_admissional_prazo: null,
        exame_admissional_realizado: 0,
      },
      {
        departamento: "",
        exame_admissional_prazo: "",
        exame_admissional_realizado: false,
      },
    ),
    {},
  );
});
