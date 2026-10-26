import type { LancamentoUnificadoApi } from "@/lib/financeiro-share-api";

export type FluxoUnificado = "ENTRADA" | "SAIDA";
export type SituacaoUnificada = "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";
export type LancamentoUnificado = {
  id: string;
  codigo: string;
  fluxo: FluxoUnificado;
  natureza: string;
  caixa: "SHARE" | "CLIENTE";
  descricao: string;
  categoria: string;
  favorecido: string;
  contaBancaria: string;
  dataLancamento: string;
  dataVencimento: string | null;
  dataPagamento: string | null;
  situacao: SituacaoUnificada;
  valor: number;
  reembolsavel: boolean;
  cotistaId: string | null;
  origem: string;
  origemId: string;
  lancamentoId: string | null;
  documentoUrl: string | null;
  raw: LancamentoUnificadoApi;
};

const texto = (value: unknown, fallback = "—") => {
  const result = String(value ?? "").trim();
  return result || fallback;
};
const flag = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

export function normalizarLancamentoUnificado(row: LancamentoUnificadoApi): LancamentoUnificado {
  const status = String(row.situacao ?? row.status ?? "PENDENTE").toUpperCase();
  const situacao: SituacaoUnificada = status === "ATRASADO" ? "ATRASADO" : status === "PAGO" || status === "RECEBIDO" ? "PAGO" : status === "CANCELADO" ? "CANCELADO" : "PENDENTE";
  const cents = Number(row.valor_centavos ?? 0);
  const valor = Number(row.valor ?? (Number.isFinite(cents) ? cents / 100 : 0));
  const id = String(row.id ?? "");
  return {
    id,
    codigo: texto(row.numero_documento, id.slice(-8).toUpperCase()),
    fluxo: String(row.fluxo).toUpperCase() === "ENTRADA" ? "ENTRADA" : "SAIDA",
    natureza: texto(row.natureza, texto(row.categoria, "OUTROS")),
    caixa: String(row.caixa).toUpperCase() === "CLIENTE" ? "CLIENTE" : "SHARE",
    descricao: texto(row.descricao),
    categoria: texto(row.categoria),
    favorecido: texto(row.favorecido),
    contaBancaria: texto(row.conta_bancaria_nome ?? row.conta_bancaria_id),
    dataLancamento: String(row.data_lancamento ?? row.criado_em ?? "").slice(0, 10),
    dataVencimento: row.data_vencimento ? String(row.data_vencimento).slice(0, 10) : null,
    dataPagamento: row.data_pagamento ? String(row.data_pagamento).slice(0, 10) : null,
    situacao,
    valor: Number.isFinite(valor) ? valor : 0,
    reembolsavel: flag(row.reembolsavel),
    cotistaId: row.cotista_id ? String(row.cotista_id) : null,
    origem: texto(row.origem_tipo, "lancamentos"),
    origemId: String(row.origem_id ?? row.lancamento_id ?? id),
    lancamentoId: row.lancamento_id ? String(row.lancamento_id) : null,
    documentoUrl: row.comprovante_url ? String(row.comprovante_url) : row.nf_url ? String(row.nf_url) : row.boleto_url ? String(row.boleto_url) : null,
    raw: row,
  };
}
