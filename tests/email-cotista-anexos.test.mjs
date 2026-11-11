import test from "node:test";
import assert from "node:assert/strict";
import { anexosSelecionadosDoCotista } from "../src/components/envio-pagamento/email-cotista.ts";

const documentos = [
  { id: "compartilhado", cotista_id: undefined },
  { id: "boleto-a", cotista_id: "a" },
  { id: "boleto-b", cotista_id: "b" },
];
const iniciais = documentos.map((item) => item.id);
const ids = (itens) => itens.map((item) => item.id);

test("cada cotista recebe somente seus documentos e os compartilhados", () => {
  assert.deepEqual(ids(anexosSelecionadosDoCotista(documentos, "a", iniciais, {})), ["compartilhado", "boleto-a"]);
  assert.deepEqual(ids(anexosSelecionadosDoCotista(documentos, "b", iniciais, {})), ["compartilhado", "boleto-b"]);
});

test("desmarcar compartilhado em um e-mail não remove o documento de outro cotista", () => {
  const selecoes = { a: ["boleto-a"] };
  assert.deepEqual(ids(anexosSelecionadosDoCotista(documentos, "a", iniciais, selecoes)), ["boleto-a"]);
  assert.deepEqual(ids(anexosSelecionadosDoCotista(documentos, "b", iniciais, selecoes)), ["compartilhado", "boleto-b"]);
  assert.deepEqual(iniciais, ["compartilhado", "boleto-a", "boleto-b"]);
});

test("seleção restaurada não pode incluir documento exclusivo de outro cotista", () => {
  assert.deepEqual(ids(anexosSelecionadosDoCotista(documentos, "a", iniciais, { a: ["boleto-b", "compartilhado"] })), ["compartilhado"]);
});

test("rascunho preserva a seleção vazia e mantém compatibilidade com seleção antiga", () => {
  assert.deepEqual(anexosSelecionadosDoCotista(documentos, "a", iniciais, { a: [] }), []);
  assert.deepEqual(ids(anexosSelecionadosDoCotista(documentos, "a", ["boleto-a"], {})), ["boleto-a"]);
});
