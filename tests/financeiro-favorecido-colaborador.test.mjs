import test from "node:test";
import assert from "node:assert/strict";
import { linhasDeContasAPagar } from "../src/components/financeiro-share/linhas-contas.ts";

const contaBase = {
  id: "conta-1",
  fornecedor: "Fornecedor Exemplo",
  fornecedorId: "fornecedor-1",
  dataEmissao: "2026-11-25",
  dataVencimento: "2026-11-30",
  categoriaNome: "Serviços",
  descricao: "Despesa de colaborador",
  valor: 125,
  status: "PAGO",
};

test("colaborador associado prevalece sobre fornecedor como favorecido", () => {
  const [linha] = linhasDeContasAPagar([{
    ...contaBase,
    colaboradorId: "colaborador-1",
    colaboradorNome: "Ana Souza",
  }]);

  assert.equal(linha.favorecido, "Ana Souza");
});

test("fornecedor continua como favorecido quando não há colaborador vinculado", () => {
  const [linha] = linhasDeContasAPagar([contaBase]);
  assert.equal(linha.favorecido, "Fornecedor Exemplo");
});

test("não exibe o fornecedor como beneficiário se o vínculo de colaborador não tem nome resolvido", () => {
  const [linha] = linhasDeContasAPagar([{
    ...contaBase,
    colaboradorId: "colaborador-sem-perfil",
  }]);

  assert.equal(linha.favorecido, "Colaborador");
});
