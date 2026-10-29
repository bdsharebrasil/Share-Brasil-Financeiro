import assert from "node:assert/strict";
import test from "node:test";
import { agruparHistoricoPorAeronave, agruparHistoricoPorMes, prepararHistorico } from "../src/components/envio-pagamento/historico/history-model.ts";

const item = (id, criadoEm, valorCentavos = 100, situacao = "pendente") => ({
  id,
  criadoEm,
  atualizadoEm: "",
  valorCentavos,
  situacao,
});

test("agrupa histórico por mês/ano em ordem decrescente", () => {
  const grupos = agruparHistoricoPorMes([
    item("jan", "2025-01-04"),
    item("dez", "2024-12-30"),
    item("jan-2", "2025-01-19", 250, "cancelado"),
  ]);

  assert.deepEqual(grupos.map(grupo => grupo.id), ["mes:2025-01", "mes:2024-12"]);
  assert.equal(grupos[0].itens.length, 2);
  assert.equal(grupos[0].totalCentavos, 100);
  assert.equal(grupos[0].pendentes, 1);
});

test("mantém itens sem data em um grupo no fim", () => {
  const grupos = agruparHistoricoPorMes([item("sem-data", ""), item("com-data", "2025-01-04")]);

  assert.deepEqual(grupos.map(grupo => grupo.id), ["mes:2025-01", "mes:0000-00"]);
  assert.equal(grupos[1].nome, "Data não informada");
});

test("agrupa histórico pela aeronave mesmo com clientes diferentes", () => {
  const grupos = agruparHistoricoPorAeronave([
    { ...item("cliente-a", "2025-01-04"), aeronaveGrupoId: "aeronave:1", aeronave: "PR-ABC", cliente: "Cliente A" },
    { ...item("cliente-b", "2025-02-04"), aeronaveGrupoId: "aeronave:1", aeronave: "PR-ABC", cliente: "Cliente B" },
    { ...item("sem-aeronave", "2025-03-04"), aeronaveGrupoId: "aeronave:sem-vinculo", aeronave: "" },
  ]);

  assert.deepEqual(grupos.map(grupo => grupo.id), ["aeronave:1", "aeronave:sem-vinculo"]);
  assert.equal(grupos[0].itens.length, 2);
  assert.equal(grupos[0].nome, "PR-ABC");
  assert.equal(grupos[1].nome, "Sem aeronave vinculada");
});

test("identifica matrícula brasileira mencionada na descrição quando falta vínculo explícito", () => {
  const { historico } = prepararHistorico([
    { id: "envio-1", tipo: "share", descricao: "Mensalidade do plano Starlink para aeronave PR-GJM", valor: 704, status: "pendente" },
  ], []);
  const grupos = agruparHistoricoPorAeronave(historico);

  assert.equal(historico[0].aeronave, "PR-GJM");
  assert.equal(grupos[0].id, "matricula:prgjm");
  assert.equal(grupos[0].nome, "PR-GJM");
});

test("resolve matrícula do envio_despesas pelo aeronave_id", () => {
  const { historico } = prepararHistorico([
    { id: "envio-2", tipo: "share", aeronave_id: "aeronave-1", descricao: "Plano de dados para PR-XYZ", valor: 704, status: "pendente" },
  ], [], {}, { "aeronave-1": "PR-GJM" });
  const grupos = agruparHistoricoPorAeronave(historico);

  assert.equal(historico[0].aeronave, "PR-GJM");
  assert.equal(grupos[0].id, "aeronave:aeronave-1");
  assert.equal(grupos[0].nome, "PR-GJM");
});