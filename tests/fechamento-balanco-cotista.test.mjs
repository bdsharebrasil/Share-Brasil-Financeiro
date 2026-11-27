import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CabecalhoRateioCotista, CelulaRateioCotista } from "../src/components/FinanceiroCotista/RateioCotistaTableCells.tsx";

const base = new URL("../src/components/FinanceiroCotista/", import.meta.url);
const [financeiro, dashboard, pdf, calculo, referencia, acertoResumo, acertoHelper] = await Promise.all([
  readFile(new URL("FinanceiroCotista.tsx", base), "utf8"),
  readFile(new URL("FechamentoBalancoDashboardCotista.tsx", base), "utf8"),
  readFile(new URL("BalancoClientePdf.tsx", base), "utf8"),
  readFile(new URL("../../lib/balanco-cotista.ts", base), "utf8"),
  readFile(new URL("FechamentoBalancoReferencia.tsx", base), "utf8"),
  readFile(new URL("AcertoContasCotistasResumo.tsx", base), "utf8"),
  readFile(new URL("../../lib/acerto-contas-cotistas.ts", base), "utf8"),
]);
const lancamentosUi = await import("../src/lib/financeiro-cotista-lancamentos.ts");

test("aba Fechamento Balanço usa dados do dashboard e transmite cotista e competências selecionados", () => {
  assert.match(financeiro, /abaAtiva === "fechamento-balanco"[\s\S]*?<FechamentoBalancoReferencia/);
  assert.match(financeiro, /cotistaId=\{cotistaVisaoId\}/);
  assert.match(financeiro, /fornecedores=\{fornecedoresEdicao\}/);
  assert.match(financeiro, /mesesSelecionados=\{mesesAplicados\}/);
  assert.doesNotMatch(financeiro, /<FechamentoBalancoCotista\s*\/>/);
});

test("fechamento segue as seis abas solicitadas com valores derivados do dashboard", () => {
  const blocoAbas = /const ABAS:[\s\S]*?;\n/.exec(referencia)?.[0];
  assert.ok(blocoAbas, "lista principal de abas não encontrada");
  assert.deepEqual(
    [...blocoAbas.matchAll(/nome: "([^"]+)"/g)].map(([, nome]) => nome),
    ["Balanço", "Acerto de contas", "Lançamentos", "Custo por hora", "Diário de bordo", "Seu período em voo"],
  );
  assert.match(referencia, /montarBalanco\(d, cotistas, mesesSelecionados\)/);
  assert.match(referencia, /projetarCustos\(total, totalHoras, b\.meses\.length/);
  assert.match(referencia, /d\?\.lancamentos/);
  assert.match(referencia, /voosDoCotistaComFallback/);
  assert.doesNotMatch(referencia, /\["08\/01\/2026"|CF\s*=\s*17226\.49|5000\]/);
});

test("BALANÇO COTISTA abre direto o fechamento, sem navegação de módulos externos", async () => {
  const dashboardFinanceiro = await readFile(new URL("../src/pages/DashboardFinanceiro.tsx", import.meta.url), "utf8");
  assert.match(dashboardFinanceiro, /label="BALANÇO COTISTA"/);
  assert.match(dashboardFinanceiro, /<FinanceiroCotista modoFechamento aoVoltarDashboard=/);
  assert.match(financeiro, /export default function FinanceiroCotista\(\{ modoFechamento = false, aoVoltarDashboard \}/);
  assert.match(financeiro, /setPaginaAberta\(modoFechamento\)/);
  assert.match(financeiro, /aeronaveSelecionada && paginaAberta && !modoFechamento/);
  assert.match(financeiro, /modoFechamento \? \[\{[\s\S]*?id: "fechamento-balanco"/);
  assert.doesNotMatch(financeiro, /rotulo: "Voos empréstimo"/);
});

test("voos empréstimo são uma subaba do Diário de bordo e respeitam cotista e meses selecionados", () => {
  assert.match(referencia, /aria-label="Diário de bordo e voos empréstimo"/);
  assert.match(referencia, /id="fb-subtab-emprestimos"[\s\S]*?>Voos empréstimo/);
  assert.match(referencia, /dashboard\?\.emprestimos_aeronave/);
  assert.match(referencia, /b\?\.meses\.includes\(String\(voo\.data/);
  assert.match(referencia, /Filtrar voos empréstimo por cotista/);
});

test("Gráficos e Fechamento usam o mesmo resumo de acerto baseado no ledger detalhado", () => {
  assert.match(dashboard, /<AcertoContasCotistasResumo/);
  assert.match(referencia, /<AcertoContasCotistasResumo/);
  assert.match(referencia, /resultado=\{acerto\}/);
  assert.match(acertoHelper, /calcularBalancoMensal\(/);
  assert.match(acertoHelper, /fontes\.pagamentos/);
  assert.match(acertoHelper, /"2000-01-01"/);
  assert.match(acertoResumo, /compensacao\.deId/);
  assert.match(acertoResumo, /compensacao\.paraId/);
  assert.match(acertoResumo, /QUEM PAGA/);
  assert.match(acertoResumo, /QUEM RECEBE/);
  assert.match(acertoResumo, /Nenhum pagamento pessoal confirmado/);
  assert.doesNotMatch(referencia, /const compensacoes = \(b\?\.compensacoes/);
});

test("Custo por hora mostra valores efetivos da aeronave e do cotista além da projeção", () => {
  assert.match(referencia, /Custo\/hora da aeronave no período/);
  assert.match(referencia, /money\(b\.custoHora\)/);
  assert.match(referencia, /Custo\/hora do cotista selecionado/);
  assert.match(referencia, /money\(participante\?\.custoHora \?\? null\)/);
  assert.match(referencia, /Projeção por hora/);
});

test("diário lista voos operacionais da aeronave e identifica para quem foram", () => {
  assert.match(referencia, /const voos = voosOperacionais\s*\.slice\(\)/);
  assert.match(referencia, /b\?\.fonteVoos \|\| voosOperacionais\.length/);
  assert.match(referencia, /voos\.map\(\(voo, index\) =>\s*\(?\s*<tr/);
  assert.match(referencia, /destinoVoo\(voo, cotistas\)/);
});

test("lançamentos incluem despesas da aeronave e exibem uma coluna rateio por cotista", () => {
  assert.match(referencia, /d\?\.lancamentos \?\?/);
  assert.match(referencia, /numerosDocumentosDoLancamento\(lancamento\)/);
  assert.match(referencia, /<td className="fb-doc">\{numeroDocLancamento\(origem\) \|\| "—"\}<\/td>/);
  assert.match(referencia, /cotistas\.map\(\(cotista, i\) =>\s*\(?\s*<CabecalhoRateioCotista/);
  assert.match(referencia, /cotistas\.map\(\(cotista, i\) =>\s*\(?\s*<CelulaRateioCotista/);
  assert.match(referencia, /total rateado por cotista/);

  const cotista = { id: "cotista-1", cliente_id: null, socio_id: null, cotista_ids: [], nome: "Marina Costa", percentual_sociedade: 50 };
  const lancamento = {
    id: "lancamento-rateado",
    valorCentavos: 10000,
    rateios: [{ cotistaId: cotista.id, cotista: cotista.nome, percentual: 50, valorCentavos: 5000 }],
  };
  const markup = renderToStaticMarkup(createElement("table", null,
    createElement("thead", null, createElement("tr", null,
      createElement(CabecalhoRateioCotista, { cotista, indice: 0 }))),
    createElement("tbody", null, createElement("tr", null,
      createElement(CelulaRateioCotista, { lancamento, cotista, cotistas: [cotista], indice: 0 }))),
  ));
  assert.match(markup, /Marina Costa/);
  assert.match(markup, /50%/);
  assert.ok(markup.replace(/\s/g, "").includes("R$50,00"), `valor do rateio não renderizado: ${markup}`);
});

test("tabela de lançamentos resolve fornecedor/pagador, normaliza tipo e não tem expansão", () => {
  assert.match(referencia, /<th>Tipo Rateio<\/th>/);
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
  assert.match(pdf, /export function BalancoClientePdf/);
  assert.match(pdf, /participantLaunchRows\(participante, balanco, dashboard, cotistas, fornecedores, lancamentos\)/);
  assert.match(pdf, /participante\.custo\.total/);
  assert.match(pdf, /rows: linhas\.map/);
});

test("fechamento usa um único PDF consolidado, com seleção de cotistas e quatro seções", async () => {
  const [atual, legado, gerador] = await Promise.all([
    readFile(new URL("FechamentoBalancoReferencia.tsx", base), "utf8"),
    readFile(new URL("FechamentoBalancoDashboardCotista.tsx", base), "utf8"),
    readFile(new URL("BalancoClientePdf.tsx", base), "utf8"),
  ]);
  assert.match(atual, /<DialogTitle(?:\s[^>]*)?>Gerar relatório do fechamento/);
  assert.match(atual, /Selecionar todos os cotistas/);
  assert.match(atual, /Incluir \$\{item\.nome\} no PDF/);
  assert.match(atual, /pdf\(\s*<BalancoClientePdf/);
  assert.match(legado, /pdf\(\s*<BalancoClientePdf/);
  assert.doesNotMatch(atual, /window\.print\(\)/);
  assert.doesNotMatch(legado, /window\.print\(\)/);
  assert.doesNotMatch(atual, /RelatorioFechamentoPdf/);
  for (const secao of ["01 · Balanço", "02 · Lançamentos", "03 · Custo por hora", "04 · Diário de bordo"]) {
    assert.ok(gerador.includes(secao), `seção ausente do PDF: ${secao}`);
  }
  assert.match(gerador, /Balanço financeiro/);
  assert.match(gerador, /orientation="landscape"/);
  assert.match(gerador, /render=\{\(\{ pageNumber, totalPages \}\)/);
});

test("aba Holdings mantém a baixa e dispõe de busca, tabela desktop e cartões para mobile", async () => {
  const holding = await readFile(new URL("../src/components/financeiro-share/AbaMovimentosHolding.tsx", import.meta.url), "utf8");
  assert.match(holding, /darBaixaMovimentoHolding\(alvo\.id/);
  assert.match(holding, /type="search"/);
  assert.match(holding, /hidden overflow-x-auto md:block/);
  assert.match(holding, /divide-y divide-border md:hidden/);
  assert.match(holding, /Holding \/ cotista/);
  assert.match(holding, /Aeronave/);
  assert.match(holding, /Vencimento/);
  assert.match(holding, /Valor/);
});
