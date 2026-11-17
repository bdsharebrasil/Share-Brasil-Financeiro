import { normalizar } from "./gestao-colaboradores.ts";

export type DocumentoColaborador = {
  id?: string;
  nome_arquivo?: string;
  categoria?: string;
  tipo_arquivo?: string;
  mime_type?: string;
  criado_em?: string;
  tamanho_arquivo?: number;
  tamanho_bytes?: number;
  [key: string]: unknown;
};
export type PastaColaborador = {
  chave: string;
  nome: string;
  categoria: string;
  documentos: DocumentoColaborador[];
};
export function pastaDoDocumento(documento: DocumentoColaborador) {
  const categoria = String(documento.categoria || "").trim() || "documentos";
  const chave = normalizar(categoria).replace(/[\s_]+/g, "_");
  if (
    ["documentos", "documentos_pessoais", "pessoal", "pessoais"].includes(chave)
  )
    return { chave: "documentos", nome: "Documentos pessoais", categoria };
  const texto = categoria.replace(/_/g, " ").replace(/\s+/g, " ");
  return {
    chave,
    categoria,
    nome: texto.charAt(0).toUpperCase() + texto.slice(1),
  };
}
export function agruparPastasDocumentos(
  documentos: DocumentoColaborador[],
): PastaColaborador[] {
  const pastas = new Map<string, PastaColaborador>();
  for (const documento of documentos) {
    const pasta = pastaDoDocumento(documento);
    if (!pastas.has(pasta.chave))
      pastas.set(pasta.chave, { ...pasta, documentos: [] });
    pastas.get(pasta.chave)!.documentos.push(documento);
  }
  return [...pastas.values()].sort((a, b) =>
    a.chave === "documentos"
      ? -1
      : b.chave === "documentos"
        ? 1
        : a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
export function tipoDocumento(documento: DocumentoColaborador, blob?: Blob) {
  const mime = String(
    blob?.type || documento.tipo_arquivo || documento.mime_type || "",
  ).toLowerCase();
  if (
    mime === "application/pdf" ||
    /\.pdf$/i.test(documento.nome_arquivo || "")
  )
    return "pdf";
  if (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|webp)$/i.test(documento.nome_arquivo || "")
  )
    return "imagem";
  return "arquivo";
}
export function tamanhoDocumento(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export type ArquivoDocumento = {
  blob: Blob;
  url: string;
  miniaturaPdf?: Promise<string>;
};
/** URLs privadas reutilizadas entre miniatura e visualização; invalidação após editar/excluir. */
export function criarCacheDocumentos(buscar: (id: string) => Promise<Blob>) {
  type Entrada = {
    valido: boolean;
    url?: string;
    promise: Promise<ArquivoDocumento>;
  };
  const arquivos = new Map<string, Entrada>();
  const invalidar = (id: string) => {
    const entrada = arquivos.get(id);
    if (entrada) {
      entrada.valido = false;
      if (entrada.url) URL.revokeObjectURL(entrada.url);
      arquivos.delete(id);
    }
  };
  return {
    carregar(id: string): Promise<ArquivoDocumento> {
      const atual = arquivos.get(id);
      if (atual) return atual.promise;
      const entrada: Entrada = {
        valido: true,
        promise: Promise.resolve(null!),
      };
      entrada.promise = buscar(id)
        .then((blob) => {
          if (!entrada.valido) throw new Error("carregamento_cancelado");
          const url = URL.createObjectURL(blob);
          entrada.url = url;
          return { blob, url };
        })
        .catch((cause) => {
          if (arquivos.get(id) === entrada) arquivos.delete(id);
          throw cause;
        });
      arquivos.set(id, entrada);
      return entrada.promise;
    },
    invalidar,
    limpar() {
      for (const id of arquivos.keys()) invalidar(id);
    },
  };
}
