import type { ContaAPagar, ContaAReceber } from "./tipos";

export type FluxoLinha =
  | "ESTORNO"
  | "RECEITA"
  | "DESPESA"
  | "SAIDA REEMBOLSO"
  | "ENTRADA REEMBOLSO"
  | "SAIDA"
  | "ENTRADA";
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
  statusOriginal: string;
  valor: number;
  raw: ContaAPagar | ContaAReceber;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const FLUXOS = new Set<FluxoLinha>([
  "ESTORNO", "RECEITA", "DESPESA", "SAIDA REEMBOLSO",
  "ENTRADA REEMBOLSO", "SAIDA", "ENTRADA",
]);

function statusOriginal(conta: ContaAPagar | ContaAReceber): string {
  const status = (conta as unknown as Record<string, unknown>).status;
  return String(status ?? "EM_ABERTO").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function fluxoDaConta(conta: ContaAPagar | ContaAReceber, fallback: FluxoLinha): FluxoLinha {
  const dados = conta as unknown as Record<string, unknown>;
  const fluxo = [dados.fluxo, dados.tipo_fluxo, dados.natureza]
    .find((valor): valor is string => typeof valor === "string" && Boolean(valor.trim()));
  const normalizado = fluxo?.trim().toUpperCase().replace(/_/g, " ") as FluxoLinha | undefined;
  return normalizado && FLUXOS.has(normalizado) ? normalizado : fallback;
}

function situacaoDaConta(status: string, vencimento: string | null): SituacaoLinha {
  if (status === "CANCELADO") return "CANCELADO";
  if (["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(status)) return "PAGO";
  if (["ATRASADO", "EM_ATRASO"].includes(status)) return "ATRASADO";
  if (vencimento && vencimento.slice(0, 10) < hojeISO()) return "ATRASADO";
  return "PENDENTE";
}

export function linhasDeContasAPagar(contas: ContaAPagar[]): LinhaConta[] {
  return contas.map((c) => ({
    id: c.id,
    documento: c.documento || null,
    fluxo: fluxoDaConta(c, "SAIDA"),
    natureza: "DESPESA",
    caixa: "SHARE",
    descricao: c.descricao || "—",
    categoria: c.categoriaNome || "—",
    favorecido: c.fornecedor || "—",
    favorecidoPessoa: null,
    fornecedor: c.fornecedorId ? c.fornecedor : null,
    contaBancaria: c.bancoPagamento || c.contaBancariaId || "—",
    dataLancamento: c.dataEmissao || c.criadoEm || "",
    dataVencimento: c.dataVencimento || null,
    situacao: situacaoDaConta(statusOriginal(c), c.dataVencimento),
    statusOriginal: statusOriginal(c),
    valor: Number(c.valor || 0),
    raw: c,
  }));
}

export function linhasDeContasAReceber(contas: ContaAReceber[]): LinhaConta[] {
  return contas.map((c) => ({
    id: c.id,
    documento: c.documento || null,
    fluxo: fluxoDaConta(c, "ENTRADA"),
    natureza: "RECEITA",
    caixa: c.cotistaId ? "CLIENTE" : "SHARE",
    descricao: c.descricao || "—",
    categoria: c.categoriaNome || "—",
    favorecido: c.cotistaNome || c.cotista || c.fornecedor || "—",
    favorecidoPessoa: c.cotistaNome || c.cotista || null,
    fornecedor: c.fornecedorId ? c.fornecedor : null,
    contaBancaria: c.bancoRecebimento || c.contaBancariaId || "—",
    dataLancamento: c.dataEmissao || c.criadoEm || "",
    dataVencimento: c.dataVencimento || null,
    situacao: situacaoDaConta(statusOriginal(c), c.dataVencimento),
    statusOriginal: statusOriginal(c),
    valor: Number(c.valor || 0),
    raw: c,
  }));
}
