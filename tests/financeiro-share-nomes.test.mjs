import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../src/components/financeiro-share/", import.meta.url);
const [resumo, solicitacoes] = await Promise.all([
  readFile(new URL("AbaResumoFinanceiro.tsx", base), "utf8"),
  readFile(new URL("AbaSolicitacoesPagamento.tsx", base), "utf8"),
]);

test("prioridades financeiras exibem nomes de fornecedor e cotista, não seus IDs", () => {
  assert.match(resumo, /responsavel: conta\.fornecedor \?\? "Share Brasil"/);
  assert.match(resumo, /responsavel: conta\.cotistaNome \?\? conta\.fornecedor \?\? "Cliente"/);
  assert.doesNotMatch(resumo, /responsavel: conta\.(?:fornecedorId|cotistaId)/);
});

test("coluna Fornecedor das solicitações não mostra o nome de quem criou o envio", () => {
  assert.match(solicitacoes, /item\.fornecedor_nome \?\? item\.fornecedor \?\? "—"/);
  assert.doesNotMatch(solicitacoes, /item\.solicitante_nome \?\? item\.criado_por/);
});

test("linha de reembolso mostra documento, data de emissão e nome da categoria em vez do ID da aeronave", () => {
  assert.match(solicitacoes, /principal: item\.documento \|\| item\.descricao/);
  assert.match(solicitacoes, /dataLegivel\(item\.dataEmissao \?\? null\)/);
  assert.match(solicitacoes, /categoria: item\.categoriaNome/);
  assert.doesNotMatch(solicitacoes, /categoria: item\.aeronaveId/);
});

test("detalhe do reembolso oferece o documento anexado e seus dados complementares", () => {
  assert.match(solicitacoes, /href=\{item\.documentoUrl\}/);
  assert.match(solicitacoes, /item\.fornecedor/);
  assert.match(solicitacoes, /item\.numeroVoo/);
  assert.match(solicitacoes, /item\.cotistaNome/);
});
