import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componente = await readFile(new URL("../src/components/financeiro-share/NFSaidaTab.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/lib/nfSaidaApi.ts", import.meta.url), "utf8");

const abrir = componente.slice(componente.indexOf("const openBaixa ="), componente.indexOf("const uploadComprovante ="));
const confirmar = componente.slice(componente.indexOf("const confirmBaixa ="), componente.indexOf("useEffect(() => { setPage(1)"));
const baixaApi = api.slice(api.indexOf("export function darBaixaNotaOuReciboSaida"), api.indexOf("export function enviarAnexoDocumentoSaida"));

test("modal gera chave nova por operação e limpa somente ao fechar/concluir", () => {
  assert.match(componente, /const baixaIdempotencyKey = useRef<string \| null>\(null\)/);
  assert.match(abrir, /baixaIdempotencyKey\.current = crypto\.randomUUID\(\)/);
  assert.match(abrir, /baixaIdempotencyKey\.current = null/);
  assert.match(confirmar, /const chavePagamento = baixaIdempotencyKey\.current \?\? crypto\.randomUUID\(\)/);
  assert.match(confirmar, /baixaIdempotencyKey\.current = chavePagamento/);
  assert.match(confirmar, /idempotency_key: chavePagamento/);
  assert.doesNotMatch(confirmar.slice(confirmar.indexOf("} catch"), confirmar.indexOf("} finally")), /baixaIdempotencyKey\.current = null/, "a mesma operação pode ser reenviada após falha");
});

test("API exige a chave por pagamento antes do POST, tanto para NF quanto para recibo", () => {
  const contrato = api.slice(api.indexOf("export interface BaixaDocumentoSaidaPayload"), api.indexOf("export interface OpcoesNotasSaida"));
  assert.match(contrato, /pagamentos: Array<\{/);
  assert.match(contrato, /idempotency_key: string/);
  assert.match(baixaApi, /payload\.pagamentos\.some\(\(pagamento\) => !pagamento\.idempotency_key\?\.trim\(\)\)/);
  assert.match(baixaApi, /payload\.origem === "nf_saida" \? "notas-saida" : "recibos-saida"/);
  assert.match(baixaApi, /JSON\.stringify\(payload\)/);
});

test("dados reais da baixa seguem no pagamento; banco selecionado é obrigatório", () => {
  assert.match(confirmar, /!baixaForm\.conta_bancaria/);
  for (const campo of ["valor_centavos", "tipo_pagador", "pagador_cotista_id", "pagador_holding_id", "data_pagamento", "conta_bancaria_id", "forma_pagamento", "comprovante_url"]) {
    assert.match(confirmar, new RegExp(campo + ":"));
  }
});

test("baixa de hold_socios oferece as duas saídas e envia o pagador compatível", () => {
  assert.match(componente, /Saída do pagamento/);
  assert.match(componente, /DGA_BRADESCO/);
  assert.match(componente, /CONTA_COTISTA/);
  assert.match(confirmar, /baixaTarget\.socio_id/);
  assert.match(confirmar, /pagador_cotista_id: baixaTarget\.socio_id && baixaForm\.saida_pagamento === "DGA_BRADESCO" \? null : baixaTarget\.cotista_aeronave_id/);
  assert.match(confirmar, /saida_pagamento: baixaForm\.saida_pagamento/);
});
