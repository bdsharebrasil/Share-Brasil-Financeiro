import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pagina = ler("../src/pages/DashboardFinanceiro.tsx");
const cotista = ler("../src/components/FinanceiroCotista/FinanceiroCotista.tsx");
const fechamento = ler("../src/components/FinanceiroCotista/FechamentoBalancoReferencia.tsx");
const estilos = ler("../src/components/FinanceiroCotista/fechamento-balanco.css");
const compacto = ler("../src/components/FinanceiroCotista/fechamento-compacto.css");
const geral = ler("../src/components/FinanceiroCotista/financeiro-cotista.css");

test("retorno ao dashboard usa a mesma linha do contexto da aeronave", () => {
  assert.match(pagina, /<FinanceiroCotista modoFechamento aoVoltarDashboard=/);
  assert.doesNotMatch(pagina, /mb-3 flex justify-end[\s\S]{0,160}Dashboard financeiro/);
  assert.match(cotista, /cotista-contexto-acoes/);
  assert.match(cotista, /onClick=\{aoVoltarDashboard\}/);
});

test("fechamento tem abas e exportação PDF na mesma barra", () => {
  assert.match(fechamento, /className="fb-commandbar"/);
  assert.match(fechamento, /className="fb-button fb-export"\s+onClick=\{abrirDialogPdf\}/);
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
  assert.match(fechamento, /cotistas\.map\(\(cotista\) =>\s*\(?\s*<col/);
  assert.match(fechamento, /"--fb-table-min-width"/);
  assert.match(estilos, /min-width: var\(--fb-table-min-width, 1080px\)/);
  assert.match(estilos, /table-layout: fixed/);
  assert.match(estilos, /overflow: auto/);
});

test("a tabela usa rolagem própria com cabeçalho fixo e limite responsivo", () => {
  assert.match(estilos, /\.fb \.fb-ledger\s*\{[^}]*max-height: 68vh/);
  assert.match(estilos, /\.fb \.fb-ledger-table thead th\s*\{[^}]*position: sticky/);
  assert.match(compacto, /\.app-main-scroll main:has\(\.balanco-cotista-workspace\)/);
});

test("o CSS compacto é isolado do restante do Financeiro Cotista", () => {
  assert.match(cotista, /import "\.\/fechamento-compacto\.css"/);
  assert.match(cotista, /modoFechamento \? "financeiro-fechamento-compacto space-y-2"/);
  assert.match(compacto, /\.financeiro-profissional\.financeiro-fechamento-compacto/);
  assert.doesNotMatch(compacto, /\.fb(?:[-\s.{])/);
  assert.doesNotMatch(geral, /\.fb(?:[-\s.{])/);
});

test("balanço tem uma faixa de quatro indicadores, uma legenda e acerto independente", () => {
  const painel = fechamento.split('{aba === "balanco" && (')[1].split('{aba === "acerto" && (')[0];
  assert.equal((painel.match(/<Kpi\b/g) || []).length, 4);
  assert.match(painel, /Custo atribuído ao cotista/);
  assert.match(painel, /money\(b\.total\.total\)/);
  assert.match(painel, /fb-grid fb-g2 fb-analysis/);
  assert.equal((painel.match(/className="fb-methodology"/g) || []).length, 1);
  assert.doesNotMatch(painel, /<Legend\b/);
  assert.match(fechamento, /id="fb-panel-acerto"[\s\S]*?<AcertoContasCotistasResumo/);
});
