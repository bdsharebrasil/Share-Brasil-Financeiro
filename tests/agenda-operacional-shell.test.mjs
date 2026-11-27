import assert from "node:assert/strict";
import test from "node:test";
import { filtrarAgenda, agruparHistoricoAgenda, proximoAgenda, emVooAgenda, horaAgenda, instanteAgenda, duracaoAgenda } from "../src/components/agendamento/agendaOperacionalModel.ts";

const voo = (id, overrides = {}) => ({
  id, status: "aprovada", aeronave_id: "a1", cliente_id: "c1", cliente_razao_social: "Cliente A",
  origem: "SBGR", destino: "SBRJ", data_agendada: "2026-11-27", data_fim: "2026-11-27",
  horario_previsto_agendamento: "14:00", ...overrides,
});
test("lista inicial não mistura histórico com agenda e filtros respeitam status reais", () => {
  const itens = [voo("p",{status:"PENDENTE"}),voo("f",{data_agendada:"2026-11-28",data_fim:"2026-11-28"}),voo("c"),voo("h",{status:"encerrada"}),voo("o",{status:"em_voo"})];
  assert.deepEqual(filtrarAgenda(itens,"todos","2026-11-27").map(v=>v.id),["c","o","p","f"]);
  assert.deepEqual(filtrarAgenda(itens,"dia","2026-11-27").map(v=>v.id),["c","o"]);
  assert.deepEqual(filtrarAgenda(itens,"confirmados","2026-11-27").map(v=>v.id),["c","f"]);
  assert.deepEqual(filtrarAgenda(itens,"pendentes","2026-11-27").map(v=>v.id),["p"]);
  assert.equal(emVooAgenda(voo("h",{status:"encerrada",perna_atual_status:"em_voo"})),false);
});
test("próximo agendamento usa a aeronave e ordem temporal, sem incluir pendências ou voo anterior", () => {
  const atual = voo("atual");
  const seguinte = voo("seguinte",{horario_previsto_agendamento:"17:00",solicitacao_origem_id:"atual"});
  const itens = [atual,voo("cedo",{horario_previsto_agendamento:"12:00"}),voo("outra",{aeronave_id:"a2",horario_previsto_agendamento:"15:00"}),voo("p",{status:"pendente",horario_previsto_agendamento:"15:30"}),seguinte,voo("tarde",{horario_previsto_agendamento:"19:00"})];
  assert.equal(proximoAgenda(atual,itens)?.id,"seguinte");
  assert.equal(proximoAgenda(voo("sem",{aeronave_id:null}),itens),null);
  const futuroSemHora=voo("amanha",{data_agendada:"2026-11-28",data_fim:"2026-11-28",horario_previsto_agendamento:null});
  assert.equal(proximoAgenda(voo("sem-hora",{horario_previsto_agendamento:null}),[seguinte,futuroSemHora])?.id,"amanha");
});
test("histórico agrupa pelo ID real de cliente e vínculo do sócio", () => {
  const grupos = agruparHistoricoAgenda([voo("a",{status:"concluida"}),voo("b",{status:"encerrada",cliente_id:null,socio_id:"s1"}),voo("c",{status:"cancelada",cliente_id:"c2",cliente_razao_social:"Cliente A"}),voo("ativo")],[{id:"c1",nome:"Cliente A"},{id:"c2",nome:"Cliente A"}],[{id:"s1",cliente_id:"c1"}]);
  assert.deepEqual(grupos.find(([id])=>id==="cliente:c1")[1].voos.map(v=>v.id),["a","b"]);
  assert.equal(grupos.find(([id])=>id==="cliente:c2")[1].voos.length,1);
  assert.equal(grupos.length,2);
});
test("UTC e duração sem dados permanecem explícitos", () => {
  assert.equal(horaAgenda("2026-11-27T14:00:00-03:00"),"17:00Z");
  assert.equal(instanteAgenda("2026-11-27","14:00"),Date.parse("2026-11-27T14:00:00Z"));
  assert.equal(instanteAgenda("2026-11-27",null),null);
  assert.equal(duracaoAgenda(null),"—");
  assert.equal(duracaoAgenda(65),"1h 05min");
});
