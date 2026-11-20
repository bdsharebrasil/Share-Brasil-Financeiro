import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pagina = ler("../src/pages/DashboardFinanceiro.tsx");
const cotista = ler("../src/components/FinanceiroCotista/FinanceiroCotista.tsx");
const fechamento = ler("../src/components/FinanceiroCotista/FechamentoBalancoReferencia.tsx");
const estilos = ler("../src/components/FinanceiroCotista/fechamento-compacto.css");

test("retorno ao dashboard usa a mesma linha do contexto da aeronave", () => {
  assert.match(pagina, /<FinanceiroCotista modoFechamento aoVoltarDashboard=/);
  assert.doesNotMatch(pagina, /mb-3 flex justify-end[\s\S]{0,160}Dashboard financeiro/);
  assert.match(cotista, /cotista-contexto-acoes/);
  assert.match(cotista, /onClick=\{aoVoltarDashboard\}/);
});

test("fechamento tem abas e exportação PDF na mesma barra", () => {
  assert.match(fechamento, /className="fb-commandbar"/);
  assert.match(fechamento, /className="fb-button fb-export" onClick=\{abrirDialogPdf\}/);
  assert.doesNotMatch(fechamento, /className="fb-page-actions"/);
});

test("tabela possui controle de tamanho de 80 a 120%, com padrão compacto persistido", () => {
  assert.match(fechamento, /const ZOOMS_TABELA = \[80, 90, 100, 110, 120\]/);
  assert.match(fechamento, /const ZOOM_PADRAO_TABELA = 90/);
  assert.match(fechamento, /share:fechamento:zoom-tabela/);
  assert.match(fechamento, /aria-label="Diminuir tabela"/);
  assert.match(fechamento, /aria-label="Aumentar tabela"/);
  assert.match(fechamento, /aria-label="Restaurar tamanho padrão da tabela"/);
});

test("larguras de colunas são calculadas sem ocultar dados, com rolagem horizontal como fallback", () => {
  assert.match(fechamento, /<colgroup>/);
  assert.match(fechamento, /PESOS_COLUNAS_TABELA\.map/);
  assert.match(fechamento, /cotistas\.map\(\(cotista\) => <col/);
  assert.match(fechamento, /"--fb-table-min-width"/);
  assert.match(estilos, /min-width: var\(--fb-table-min-width, 930px\)/);
  assert.match(estilos, /table-layout: fixed/);
  assert.match(estilos, /overflow: auto/);
});

test("a tabela não prende os lançamentos em uma área vertical com altura fixa", () => {
  assert.match(estilos, /\.fb \.fb-ledger\s*\{[\s\S]*?max-height: none/);
  assert.match(estilos, /\.fb \.fb-ledger\s*\{[\s\S]*?min-height: 0/);
  assert.match(estilos, /\.app-main-scroll main:has\(\.balanco-cotista-workspace\)/);
});

test("o CSS compacto é isolado do restante do Financeiro Cotista", () => {
  assert.match(cotista, /import "\.\/fechamento-compacto\.css"/);
  assert.match(cotista, /modoFechamento \? "financeiro-fechamento-compacto space-y-2"/);
  assert.match(estilos, /\.financeiro-profissional\.financeiro-fechamento-compacto/);
});
