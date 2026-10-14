import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../src/lib/colaborador-api.ts", import.meta.url), "utf8");
const emailAttachments = await readFile(new URL("../src/components/email/AnexosEmail.tsx", import.meta.url), "utf8");
const travelReport = await readFile(new URL("../src/pages/RelatorioDespesaViagem.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/DashboardFinanceiro.tsx", import.meta.url), "utf8");

test("card de despesas não enviadas conta e filtra somente despesas sem e-mail enviado", () => {
  assert.match(api, /pendencia: booleanoFinanceiro\(registro\.pendencia\) \?\? false/);
  assert.match(api, /fluxo: textoFinanceiro\(registro\.fluxo\)/);
  assert.match(dashboard, /const operacoes = useMemo\(\(\) => agruparOperacoes\(dados\?\.movimentacoes \?\? \[\]\)/);
  assert.match(dashboard, /const operacoesNaoEnviadas = operacoes\.filter/);
  assert.match(dashboard, /String\(item\.fluxo \|\| ""\)\.toUpperCase\(\) === "SAIDA" && statusEmail\(item\) !== "ENVIADO"/);
  assert.match(dashboard, /function ehRelevante\(item: MovimentacaoFinanceira\)/);
  assert.match(dashboard, /Number\(item\.valor\) \|\| 0\) <= 0/);
  assert.match(dashboard, /CANCELADO/);
  assert.match(dashboard, /di\[aá\]rio de bordo/);
  assert.match(dashboard, /function CartaoOperacao/);
  assert.match(dashboard, /label="Despesas não enviadas"/);
});

test("relatório de viagem não aparece como anexo no e-mail genérico e mantém envio dentro do relatório", () => {
  assert.doesNotMatch(emailAttachments, /relatorio_despesa_viagem/);
  assert.match(travelReport, /<EnviarEmailClienteDialog/);
  assert.match(travelReport, /programarDepoisDoEmail\(emailId\)/);
  assert.match(dashboard, /texto\.includes\("despesas de viagem"\).*RELATORIO_DESPESA_VIAGEM/s);
  assert.match(api, /referencia === `relatorio_pdf:\$\{idRelatorio\}`/);
});
