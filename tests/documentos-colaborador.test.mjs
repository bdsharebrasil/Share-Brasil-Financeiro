import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agruparPastasDocumentos,
  criarCacheDocumentos,
  pastaDoDocumento,
  tamanhoDocumento,
  tipoDocumento,
} from "../src/lib/documentos-colaborador.ts";

test("agrupa arquivos existentes em pastas por categoria sem alterar os registros", () => {
  const documentos = [
    { id: "1", categoria: "documentos" },
    { id: "2", categoria: "Documentos pessoais" },
    { id: "3", categoria: "exame_admissional" },
    { id: "4", categoria: "contratos" },
    { id: "5", categoria: "CONTRATOS" },
  ];
  const original = JSON.stringify(documentos);
  const pastas = agruparPastasDocumentos(documentos);
  assert.equal(pastas.length, 3);
  assert.equal(pastas[0].nome, "Documentos pessoais");
  assert.equal(pastas[0].documentos.length, 2);
  assert.equal(
    pastas.find((p) => p.chave === "contratos").documentos.length,
    2,
  );
  assert.equal(
    pastas.find((p) => p.chave === "exame_admissional").nome,
    "Exame admissional",
  );
  assert.equal(JSON.stringify(documentos), original);
});
test("classifica formatos e apresenta nomes e tamanhos legíveis", () => {
  assert.equal(pastaDoDocumento({}).nome, "Documentos pessoais");
  assert.equal(tipoDocumento({ nome_arquivo: "RG.PDF" }), "pdf");
  assert.equal(tipoDocumento({ tipo_arquivo: "image/jpeg" }), "imagem");
  assert.equal(tipoDocumento({ nome_arquivo: "documento.txt" }), "arquivo");
  assert.equal(tamanhoDocumento(1048576), "1 MB");
  assert.equal(tamanhoDocumento(null), "");
});
test("miniatura e visualizador compartilham a mesma busca e liberam URLs na invalidação", async () => {
  const criar = URL.createObjectURL;
  const revogar = URL.revokeObjectURL;
  const revogados = [];
  let criados = 0,
    buscas = 0;
  URL.createObjectURL = () => `blob:privado-${++criados}`;
  URL.revokeObjectURL = (url) => revogados.push(url);
  try {
    const cache = criarCacheDocumentos(async () => {
      buscas++;
      return new Blob(["pdf"], { type: "application/pdf" });
    });
    const [thumb, modal] = await Promise.all([
      cache.carregar("1"),
      cache.carregar("1"),
    ]);
    assert.equal(buscas, 1);
    assert.equal(thumb.url, modal.url);
    cache.invalidar("1");
    assert.deepEqual(revogados, ["blob:privado-1"]);
    await cache.carregar("1");
    assert.equal(buscas, 2);
    cache.limpar();
    assert.deepEqual(revogados, ["blob:privado-1", "blob:privado-2"]);
  } finally {
    URL.createObjectURL = criar;
    URL.revokeObjectURL = revogar;
  }
});
test("cancelamento pendente não cria URL e falhas permitem uma nova tentativa", async () => {
  let concluir;
  const cache = criarCacheDocumentos(
    () =>
      new Promise((resolve) => {
        concluir = resolve;
      }),
  );
  const pendente = cache.carregar("1");
  cache.limpar();
  concluir(new Blob(["doc"]));
  await assert.rejects(pendente, /carregamento_cancelado/);
  let tentativas = 0;
  const retentativa = criarCacheDocumentos(async () => {
    if (++tentativas === 1) throw new Error("falha");
    return new Blob(["doc"]);
  });
  await assert.rejects(retentativa.carregar("1"), /falha/);
  await retentativa.carregar("1");
  assert.equal(tentativas, 2);
  retentativa.limpar();
});
