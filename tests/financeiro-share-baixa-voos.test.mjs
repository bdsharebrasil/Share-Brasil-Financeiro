import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { voosDoCotistaComFallback } from "../src/lib/balanco-cotista.ts";

const [api, fechamento, saidas, tipos] = await Promise.all([
  readFile(new URL("../src/lib/financeiro-share-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/FinanceiroCotista/FechamentoBalancoReferencia.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/financeiro-share/LancamentosUnificados.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/financeiro-share/tipos.ts", import.meta.url), "utf8"),
]);

test("baixa de conta a pagar envia a conta bancária selecionada por ID", () => {
  assert.match(api, /conta_bancaria_id:\s*dados\.contaBancariaId\s*\|\|\s*dados\.bancoPagamento/);
  assert.match(api, /contaBancariaId\?: string/);
});

test("Registrar Saída carrega a obrigação Share reembolsável para permitir abrir o modal de baixa", () => {
  assert.match(api, /incluirReembolsos: filtros\.incluirReembolsos \? "true" : undefined/);
  assert.match(tipos, /incluirReembolsos\?: boolean/);
  assert.match(saidas, /useContasAPagar\(\{ incluirLancamentos: fluxo === "SAIDA", incluirReembolsos: fluxo === "SAIDA" \}\)/);
});

test("fechamento busca voos comuns e emprestados pelos IDs corretos do cotista e limita os meses", () => {
  assert.match(fechamento, /voosDoCotistaComFallback/);
  const voo = (id, data, campos = {}) => ({
    id,
    data,
    clienteId: null,
    socioId: null,
    emprestado: false,
    clienteTomadorId: null,
    socioTomadorId: null,
    ...campos,
  });
  const voos = [
    voo("cliente-comum", "2026-10-03", { clienteId: "cliente-1" }),
    voo("socio-comum", "2026-10-04", { socioId: "socio-1" }),
    voo("cliente-emprestado", "2026-10-05", { emprestado: true, clienteTomadorId: "cliente-1" }),
    voo("socio-emprestado", "2026-10-06", { emprestado: true, socioTomadorId: "socio-1" }),
    voo("dono-emprestado-nao-e-tomador", "2026-10-07", { emprestado: true, clienteId: "cliente-1" }),
    voo("tomador-em-voo-comum", "2026-10-08", { clienteTomadorId: "cliente-1" }),
    voo("fora-do-mes", "2026-09-30", { clienteId: "cliente-1" }),
  ];
  const resultado = voosDoCotistaComFallback([], voos, { clienteId: "cliente-1", socioId: "socio-1" }, ["2026-10"]);
  assert.deepEqual(resultado.map((item) => item.id), [
    "cliente-comum",
    "socio-comum",
    "cliente-emprestado",
    "socio-emprestado",
  ]);
});

test("voos já associados ao participante têm preferência e não são duplicados pelo fallback", () => {
  const associado = {
    id: "associado",
    data: "2026-10-03",
    clienteId: "outro-cliente",
    socioId: null,
    emprestado: false,
    clienteTomadorId: null,
    socioTomadorId: null,
  };
  const resultado = voosDoCotistaComFallback(
    [associado],
    [associado, { ...associado, id: "fallback-extra", clienteId: "cliente-1" }],
    { clienteId: "cliente-1", socioId: null },
    ["2026-10"],
  );
  assert.deepEqual(resultado.map((item) => item.id), ["associado"]);
});
