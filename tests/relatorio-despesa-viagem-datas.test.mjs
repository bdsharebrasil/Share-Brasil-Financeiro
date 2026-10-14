import test from "node:test";
import assert from "node:assert/strict";
import { dataProximaDespesa } from "../src/lib/relatorioViagemDatas.ts";

test("primeira despesa usa a data de início do relatório", () => {
  assert.equal(dataProximaDespesa([], "2026-10-14", "2026-10-16"), "2026-10-14");
});

test("próxima despesa avança um dia após a última despesa lançada", () => {
  assert.equal(
    dataProximaDespesa([{ data: "2026-10-14" }], "2026-10-14", "2026-10-16"),
    "2026-10-15",
  );
});

test("próxima despesa não ultrapassa o fim da viagem", () => {
  assert.equal(
    dataProximaDespesa([{ data: "2026-10-16" }], "2026-10-14", "2026-10-16"),
    "2026-10-16",
  );
});

test("datas avançam corretamente em ano bissexto", () => {
  assert.equal(
    dataProximaDespesa([{ data: "2024-02-28" }], "2024-02-28", "2024-03-01"),
    "2024-02-29",
  );
});
