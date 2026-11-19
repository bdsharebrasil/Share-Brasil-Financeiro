import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { consolidarHorasVoadas, formatarHorasVoadas } from "../src/lib/horas-voadas-operacionais.ts";

const dados = {
  ano: 2026,
  aeronaves: [
    { id: "lrm", matricula_registro: "PR-LRM", fabricante: "PIPER", modelo: "PA-46" },
    { id: "abc", matricula_registro: "PR-ABC", fabricante: "CIRRUS", modelo: "SR20" },
  ],
  dias: [
    { aeronave_id: "lrm", data: "2026-10-15", minutos: 745, trechos: 10 },
    { aeronave_id: "abc", data: "2026-11-18", minutos: 70, trechos: 1 },
    { aeronave_id: "ina", data: "2026-11-18", minutos: 999, trechos: 5 },
  ],
};

test("card e modal somam apenas novembro das aeronaves ativas", () => {
  const resumo = consolidarHorasVoadas(dados, 2026, 11);
  assert.equal(resumo.totalMes.minutos, 70);
  assert.equal(formatarHorasVoadas(resumo.totalMes.minutos), "1h 10m");
  assert.equal(resumo.totalMes.minutos, resumo.porAeronave.reduce((total, item) => total + item.minutos, 0));
  assert.equal(resumo.porAeronave.length, 2);
  assert.equal(resumo.porAeronave.find((item) => item.matricula_registro === "PR-LRM").minutos, 0);
  assert.equal(resumo.porAeronave.find((item) => item.matricula_registro === "PR-ABC").minutos, 70);
  assert.equal(resumo.porMes[9].minutos, 745);
  assert.equal(resumo.porMes[10].minutos, 70);
  assert.deepEqual(resumo.porDia.map(item => item.minutos), [70]);
  assert.equal(resumo.porAno.find((item) => item.ano === 2026).minutos, 815);
});

test("mês sem diário mostra zero em vez de 1 hora fictícia", () => {
  const resumo = consolidarHorasVoadas(dados, 2026, 12);
  assert.equal(resumo.totalMes.minutos, 0);
  assert.equal(formatarHorasVoadas(resumo.totalMes.minutos), "0h");
  assert.ok(resumo.porAeronave.every((item) => item.minutos === 0));
});

test("visualizações usam dados reais comuns, sem fallback de agendamentos", async () => {
  const pagina = await readFile(new URL("../src/pages/Agendamentos.tsx", import.meta.url), "utf8");
  const modal = await readFile(new URL("../src/components/agendamento/ModalHorasVoadas.tsx", import.meta.url), "utf8");
  assert.match(pagina, /buscarHorasVoadasOperacionais\(anoHoras\)/);
  assert.match(pagina, /resumoHorasVoadas\.totalMes\.minutos/);
  assert.match(modal, /consolidarHorasVoadas\(dados, ano, mes\)/);
  assert.match(modal, /resumo\.porAeronave/);
  assert.doesNotMatch(modal, /return 75|\|\| 60|\|\| 2480|baseVoos/);
});
