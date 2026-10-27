import type { ContaAPagar, ContaAReceber, StatusContaFinanceira } from "./tipos";

export type FluxoLinha = "ENTRADA" | "SAIDA";
export type SituacaoLinha = "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";

export type LinhaConta = {
  id: string;
  documento: string | null;
  fluxo: FluxoLinha;
  natureza: string;
  caixa: "SHARE" | "CLIENTE";
  descricao: string;
  categoria: string;
  favorecido: string;
  favorecidoPessoa: string | null;
  fornecedor: string | null;
  contaBancaria: string;
  dataLancamento: string;
  dataVencimento: string | null;
  situacao: SituacaoLinha;
  valor: number;
  raw: ContaAPagar | ContaAReceber;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

function situacaoDaConta(status: StatusContaFinanceira, vencimento: string | null): SituacaoLinha {
  if (status === "CANCELADO") return "CANCELADO";
  if (status === "PAGO" || status === "RECEBIDO") return "PAGO";
  if (vencimento && vencimento.slice(0, 10) < hojeISO()) return "ATRASADO";
  return "PENDENTE";
}

export function linhasDeContasAPagar(contas: ContaAPagar[]): LinhaConta[] {
  return contas.map((c) => ({
    id: c.id,
    documento: c.documento || null,
    fluxo: "SAIDA",
    natureza: "DESPESA",
    caixa: "SHARE",
    descricao: c.descricao || "—",
    categoria: c.categoriaNome || "—",
    favorecido: c.fornecedor || "—",
    favorecidoPessoa: null,
    fornecedor: c.fornecedorId ? c.fornecedor : null,
    contaBancaria: c.bancoPagamento || "—",
    dataLancamento: c.dataEmissao || c.criadoEm || "",
    dataVencimento: c.dataVencimento || null,
    situacao: situacaoDaConta(c.status, c.dataVencimento),
    valor: Number(c.valor || 0),
    raw: c,
  }));
}

export function linhasDeContasAReceber(contas: ContaAReceber[]): LinhaConta[] {
  return contas.map((c) => ({
    id: c.id,
    documento: c.documento || null,
    fluxo: "ENTRADA",
    natureza: "RECEITA",
    caixa: c.cotistaId ? "CLIENTE" : "SHARE",
    descricao: c.descricao || "—",
    categoria: c.categoriaNome || "—",
    favorecido: c.cotistaNome || c.cotista || c.fornecedor || "—",
    favorecidoPessoa: c.cotistaNome || c.cotista || null,
    fornecedor: c.fornecedorId ? c.fornecedor : null,
    contaBancaria: c.bancoRecebimento || "—",
    dataLancamento: c.dataEmissao || c.criadoEm || "",
    dataVencimento: c.dataVencimento || null,
    situacao: situacaoDaConta(c.status, c.dataVencimento),
    valor: Number(c.valor || 0),
    raw: c,
  }));
}
