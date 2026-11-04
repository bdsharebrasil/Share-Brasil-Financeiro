import test from "node:test";
import assert from "node:assert/strict";
import { calcularAcertoContasCotistas } from "../src/lib/acerto-contas-cotistas.ts";

const fontes = {
  versao: 1,
  aeronaveId: "aeronave-1",
  participantes: [
    { id: "a", nome: "Cotista A", dominio: "CLIENTES" },
    { id: "b", nome: "Cotista B", dominio: "CLIENTES" },
  ],
  rateios: [
    {
      id: "CLIENTE:rateio-a",
      participanteId: "a",
      dominio: "CLIENTES",
      origemChave: "CLIENTE:lancamento-1",
      competencia: "2026-08-01",
      categoria: "Hangaragem",
      descricao: "Hangaragem",
      tipo: "FIXO",
      devido: 500_000,
      pagoReal: 500_000,
      pagadorId: "a",
      direto: true,
      dataPagamento: "2026-08-10",
      status: "PAGO_DIRETAMENTE",
    },
    {
      id: "CLIENTE:rateio-b",
      participanteId: "b",
      dominio: "CLIENTES",
      origemChave: "CLIENTE:lancamento-1",
      competencia: "2026-08-01",
      categoria: "Hangaragem",
      descricao: "Hangaragem",
      tipo: "FIXO",
      devido: 500_000,
      pagoReal: 500_000,
      pagadorId: "a",
      direto: true,
      dataPagamento: "2026-08-10",
      status: "PAGO_DIRETAMENTE",
    },
  ],
  pagamentos: [
    { id: "pagamento-a", rateioId: "CLIENTE:rateio-a", pagadorId: "a", valor: 500_000, data: "2026-08-10", status: "CONFIRMADO", tipoPagador: "COTISTA" },
    { id: "pagamento-b", rateioId: "CLIENTE:rateio-b", pagadorId: "a", valor: 500_000, data: "2026-08-10", status: "CONFIRMADO", tipoPagador: "COTISTA" },
    { id: "pagamento-fora-do-corte", rateioId: "CLIENTE:rateio-b", pagadorId: "b", valor: 1, data: "2026-11-01", status: "CONFIRMADO", tipoPagador: "COTISTA" },
  ],
  ajustes: [],
};

test("acerto acumulado identifica quem pagou a parcela do outro cotista", () => {
  const resultado = calcularAcertoContasCotistas(fontes, ["2026-09", "2026-10"]);
  assert.equal(resultado.erro, null);
  assert.equal(resultado.fim, "2026-10-31");
  assert.ok(resultado.balanco);
  assert.equal(resultado.balanco.saldos.find((item) => item.id === "a")?.saldoCentavos, 500_000);
  assert.equal(resultado.balanco.saldos.find((item) => item.id === "b")?.saldoCentavos, -500_000);
  assert.deepEqual(resultado.balanco.compensacoes, [
    { deId: "b", paraId: "a", valorCentavos: 500_000 },
  ]);
});

test("sem fontes detalhadas não apresenta a matriz legada como resultado confiável", () => {
  const resultado = calcularAcertoContasCotistas(null, ["2026-10"]);
  assert.equal(resultado.balanco, null);
  assert.match(resultado.erro, /fonte detalhada/i);
});
