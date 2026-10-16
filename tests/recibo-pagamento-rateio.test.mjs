import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/pages/EmissaoRecibo.tsx", import.meta.url), "utf8");
const receiptAgent = await readFile(new URL("../worker/financeiro/reciboAgents.ts", import.meta.url), "utf8");
const financeKernel = await readFile(new URL("../worker/financeiro/FinanceiroKernel.ts", import.meta.url), "utf8");
const rateioDialog = await readFile(new URL("../src/components/financeiro-share/ProgramarContaAPagarDialog.tsx", import.meta.url), "utf8");

test("falha ao atualizar status não impede a criação do rateio após o envio", () => {
  const inicio = source.indexOf("const emailEnviado = async () => {");
  const fim = source.indexOf("\n  };", inicio);
  const handler = source.slice(inicio, fim);

  assert.notEqual(inicio, -1);
  assert.match(handler, /if \(!rateioPendente\) throw cause;[\s\S]*erroStatus = cause;/);
  assert.ok(handler.indexOf("await enviarDespesaRateioRecibo(") > handler.indexOf("erroStatus = cause;"));
});

test("falha ao gravar rateio informa que o email já foi enviado", () => {
  assert.match(source, /EMAIL ENVIADO, MAS O RATEIO NÃO FOI GRAVADO:/);
});

test("subcategorias não são inseridas na tabela recibos e seguem para a criação financeira", () => {
  const insert = receiptAgent.match(/INSERT INTO recibos \(([\s\S]*?)\) VALUES/);
  assert.ok(insert);
  assert.doesNotMatch(insert[1], /subcategoria_[1-4]/);
  assert.match(source, /const reciboCriado: ReciboFinanceiro = \{[\s\S]*?subcategoria_4: payload\.subcategoria_4/);
  assert.match(rateioDialog, /\.\.\.subcategoriasPayload/);
  assert.match(financeKernel, /subcategoria_1: body\.subcategoria_1,[\s\S]*?subcategoria_4: body\.subcategoria_4,/);
});

test("preview do recibo permite continuar para envio e rateio em desktop e mobile", () => {
  assert.match(source, /Continuar para envio e rateio/);
  assert.match(source, /const continuarFluxoPdf = \(\) => \{[\s\S]{0,250}programarEmail\(recibo\);/);
  assert.doesNotMatch(source, /sm:hidden[\s\S]{0,200}Fechar e continuar/);
});

test("criação de fornecedor favorito usa somente colunas do schema", () => {
  const insert = financeKernel.match(/INSERT INTO fornecedores_favoritos \(([^)]*)\)\s*VALUES/);
  assert.ok(insert);
  assert.deepEqual(insert[1].split(",").map((column) => column.trim()), ["id", "nome_completo", "apelido"]);
});

test("recibo pago diretamente mantém o rateio aberto até a baixa", () => {
  assert.match(financeKernel, /deferir_baixa_rateio: true/);
  assert.match(financeKernel, /status: command\.deferir_baixa_rateio === true[\s\S]{0,110}'EM_ABERTO'/);
});

test("rateio de recibo recebe fornecedor, periodicidade e metadados de envio", () => {
  assert.match(financeKernel, /fornecedor_id: fornecedorResolvido\?\.id \?\? null,[\s\S]{0,250}periodicidade: text\(body\.periodicidade\)/);
  assert.match(financeKernel, /numero_recibo: receipt\.numero_recibo,[\s\S]{0,100}url_recibo: receipt\.url_recibo,[\s\S]{0,100}email_enviado_em: emailInfo\?\.email_enviado_em/);
  assert.match(financeKernel, /email_enviado_em: nullableText\(command\.email_enviado_em\)/);
});

test("repetir envio completa metadados do rateio existente sem duplicá-lo", () => {
  assert.match(financeKernel, /if \(rateioExistente && \['cotista_aeronave', 'cliente'\]/);
  assert.match(financeKernel, /status = CASE WHEN status = 'PAGO_DIRETAMENTE' THEN 'EM_ABERTO'/);
  assert.match(financeKernel, /email_enviado_em = COALESCE\(\?, email_enviado_em\)/);
});