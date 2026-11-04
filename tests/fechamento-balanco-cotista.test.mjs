import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../src/components/FinanceiroCotista/", import.meta.url);
const [financeiro, dashboard, pdf, calculo, referencia] = await Promise.all([
  readFile(new URL("FinanceiroCotista.tsx", base), "utf8"),
  readFile(new URL("FechamentoBalancoDashboardCotista.tsx", base), "utf8"),
  readFile(new URL("BalancoClientePdf.tsx", base), "utf8"),
  readFile(new URL("../../lib/balanco-cotista.ts", base), "utf8"),
  readFile(new URL("FechamentoBalancoReferencia.tsx", base), "utf8"),
]);
const [lancamentosUi, lancamentosUiSource] = await Promise.all([
  import("../src/lib/financeiro-cotista-lancamentos.ts"),
  readFile(new URL("../src/lib/financeiro-cotista-lancamentos.ts", import.meta.url), "utf8"),
]);

test("aba Fechamento Balanço usa dados do dashboard e transmite cotista e competências selecionados", () => {
  assert.match(financeiro, /abaAtiva === "fechamento-balanco"[\s\S]*?<FechamentoBalancoReferencia/);
  assert.match(financeiro, /cotistaId=\{cotistaVisaoId\}/);
  assert.match(financeiro, /fornecedores=\{fornecedoresEdicao\}/);
  assert.match(financeiro, /mesesSelecionados=\{mesesAplicados\}/);
  assert.doesNotMatch(financeiro, /<FechamentoBalancoCotista\s*\/>/);
});

test("fechamento segue as quatro seções da referência com valores derivados do dashboard", () => {
  for (const aba of ["Balanço", "Lançamentos", "Custo por hora", "Diário de bordo"]) {
    assert.ok(referencia.includes(`nome: "${aba}"`), `aba ausente: ${aba}`);
  }
  assert.match(referencia, /montarBalanco\(d, cotistas, mesesSelecionados\)/);
  assert.match(referencia, /projetarCustos\(total, totalHoras, b\.meses\.length/);
  assert.match(referencia, /d\?\.lancamentos/);
  assert.match(referencia, /balanco_operacional\?\.voos/);
  assert.doesNotMatch(referencia, /\["08\/01\/2026"|CF\s*=\s*17226\.49|5000\]/);
});

test("diário usa os voos da aeronave quando a lista do cotista está vazia ou a flag da fonte falha", () => {
  assert.match(referencia, /voosDoParticipante\.length \? voosDoParticipante : voosOperacionais/);
  assert.match(referencia, /b\?\.fonteVoos \|\| voosOperacionais\.length/);
  assert.match(referencia, /voos\.map\(\(voo\) => <tr/);
  assert.match(referencia, /cotistaDoVoo\(voo, cotistas\)/);
});

test("lançamentos incluem despesas da aeronave e exibem uma coluna rateio por cotista", () => {
  assert.match(referencia, /d\?\.lancamentos \?\?/);
  assert.match(referencia, /cotistas\.map\(\(cotista\) => <th className="fb-num fb-share-header"/);
  assert.match(referencia, /Rateio · % \/ valor/);
  assert.match(referencia, /rateioDoCotista\(origem, cotista, cotistas\)/);
  assert.match(referencia, /formatarCentavos\(rateio\.valorCentavos\)/);
  assert.match(referencia, /total rateado por cotista/);
});

test("tabela de lançamentos resolve fornecedor/pagador, normaliza tipo e não tem expansão", () => {
  assert.match(referencia, /<th>TIPO RATEIO<\/th>/);
  assert.match(referencia, /nomeFornecedorLancamento\(origem, fornecedores\)/);
  assert.match(referencia, /nomePagadoresDoLancamento\(origem, cotistas\)/);
  assert.match(referencia, /valorPagoLancamento\(origem\)/);
  assert.doesNotMatch(referencia, /aria-expanded|expandidos|LancamentoExpandido/);

  const uuidFornecedor = "71dc1815-86bd-48a7-82aa-b59e7aa7c341";
  const uuidCotista = "9bac2d07-e847-4f74-8c64-7c654de5d58c";
  const lancamento = {
    id: "lancamento-1",
    fornecedor: uuidFornecedor,
    fornecedorId: `agenda:${uuidFornecedor}`,
    pagoPor: uuidCotista,
    rateios: [{ pagoPor: uuidCotista }],
    tipoRateio: "VARIAVEL_POR_HORA",
    tipo: null,
    status: "PAGO",
    valorCentavos: 10000,
    valorPagoCentavos: 0,
  };
  assert.equal(
    lancamentosUi.nomeFornecedorLancamento(lancamento, [{ id: `agenda:${uuidFornecedor}`, label: "Oficina Central" }]),
    "Oficina Central",
  );
  assert.equal(
    lancamentosUi.nomePagadoresDoLancamento(lancamento, [{
      id: uuidCotista,
      cliente_id: null,
      socio_id: null,
      cotista_ids: [],
      nome: "Marina Costa",
    }]),
    "Marina Costa",
  );
  assert.equal(lancamentosUi.tipoRateioLancamento(lancamento), "VARIAVEL POR HORA");
  assert.equal(lancamentosUi.valorPagoLancamento(lancamento), 10000);

  const cotista = { id: uuidCotista, cliente_id: null, socio_id: null, cotista_ids: [], nome: "Marina Costa", percentual_sociedade: 50 };
  const lancamentoRateado = {
    ...lancamento,
    rateios: [{ cotistaId: uuidCotista, cotista: "Marina Costa", percentual: 50, valorCentavos: 5000 }],
  };
  const rateio = lancamentosUi.rateioDoCotista(lancamentoRateado, cotista, [cotista]);
  assert.equal(rateio?.percentual, 50);
  assert.equal(rateio?.valorCentavos, 5000);
});

test("PDF deriva custos mensais e categorias do cotista selecionado no dashboard", () => {
  assert.match(dashboard, /montarBalanco\(d, cotistas, mesesSelecionados\)/);
  assert.match(dashboard, /lancamentos=\{participante\.lancamentos\}/);
  assert.match(dashboard, /Baixar balanço em PDF/);
  assert.match(calculo, /export function montarBalanco/);
  assert.match(calculo, /const acertos = new Map/);
  assert.match(calculo, /export function destaques/);
  assert.match(pdf, /categoriasDoParticipante\(b, p\)/);
  assert.match(pdf, /destaques\(b, p\)/);
  assert.match(pdf, /lancamentos\.map/);
});

test("lançamentos prioriza demonstrativo e mostra números de recibo e NF na expansão", () => {
  assert.match(lancamentosUiSource, /lancamento\.numeroDemonstrativo \|\|\s+lancamento\.documentoNumero/);
  assert.match(financeiro, /\["Número do recibo", lancamento\.numeroRecibo \|\|/);
  assert.match(financeiro, /\["Número da NF", lancamento\.numeroNf \|\|/);
});
