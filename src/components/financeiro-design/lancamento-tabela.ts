import type { ContaAPagar, ContaAReceber } from "@/components/financeiro-share/tipos";

export type FluxoTabela = "ENTRADA" | "SAIDA";

export interface LancamentoTabela {
  id: string;
  descricao: string;
  fornecedor: string;
  categoriaNome: string;
  grupoCategoria: string;
  aeronaveId: string | null;
  aeronavePrefixo: string | null;
  dataVencimento: string;
  dataPagamento: string | null;
  valor: number;
  fluxo: FluxoTabela;
  status: string;
  documento: string | null;
}

export interface FiltrosTabela {
  busca: string;
  status: string;
  aeronaveId: string;
  grupo: string;
}

export const FILTROS_VAZIOS: FiltrosTabela = {
  busca: "",
  status: "TODOS",
  aeronaveId: "TODOS",
  grupo: "TODOS",
};

function statusTabela(status: string): string {
  const s = status.toUpperCase();
  if (["EM_ABERTO", "PENDENTE"].includes(s)) return "EM_ABERTO";
  if (["EM_ATRASO", "ATRASADO"].includes(s)) return "EM_ATRASO";
  return s;
}

export function mapearContaAPagar(conta: ContaAPagar): LancamentoTabela {
  const vencida = conta.status === "PENDENTE" && new Date(conta.dataVencimento) < new Date();
  return {
    id: conta.id,
    descricao: conta.descricao ?? conta.categoriaNome ?? "Conta a pagar",
    fornecedor: conta.fornecedorId ?? "—",
    categoriaNome: conta.categoriaNome ?? "Sem categoria",
    grupoCategoria: "DESPESA",
    aeronaveId: conta.aeronaveId,
    aeronavePrefixo: null,
    dataVencimento: conta.dataVencimento,
    dataPagamento: conta.dataPagamento,
    valor: conta.valor,
    fluxo: "SAIDA",
    status: vencida ? "EM_ATRASO" : statusTabela(conta.status),
    documento: null,
  };
}

export function mapearContaAReceber(conta: ContaAReceber): LancamentoTabela {
  const vencida = ["PENDENTE", "EM_ABERTO", "ATRASADO", "EM_ATRASO"].includes(conta.status) && new Date(conta.dataVencimento) < new Date();
  return {
    id: conta.id,
    descricao: conta.descricao ?? conta.categoriaNome ?? "Conta a receber",
    fornecedor: conta.fornecedor ?? "—",
    categoriaNome: conta.categoriaNome ?? "Sem categoria",
    grupoCategoria: "RECEITA",
    aeronaveId: conta.aeronaveId,
    aeronavePrefixo: null,
    dataVencimento: conta.dataVencimento,
    dataPagamento: conta.dataRecebimento,
    valor: conta.valor,
    fluxo: "ENTRADA",
    status: vencida ? "EM_ATRASO" : statusTabela(conta.status),
    documento: null,
  };
}

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const partes = iso.slice(0, 10).split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}
