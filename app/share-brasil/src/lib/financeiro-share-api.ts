import { apiFetch } from "@/lib/api";

export type CategoriaCaixaShare = {
  id: string;
  nome: string;
  tipo: string | null;
  grupo: string | null;
  classificacao: string | null;
  empresa_id: string | null;
  reembolsavel: boolean;
};

export type ContaBancaria = { id: string; banco: string; numero_conta: string | null; tipo_conta: string | null };
export type EmpresaShare = { id: string; razao_social: string | null; cnpj: string | null };

export type LancamentoShare = {
  id: string;
  descricao: string;
  fluxo: string | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  grupo_categoria: string | null;
  valor_total: number | null;
  valor_pago_real: number | null;
  data_emissao: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  status: string | null;
  forma_pagamento: string | null;
  conta_bancaria: string | null;
  fornecedor_nome: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  observacoes: string | null;
  periodicidade: string | null;
  criado_em: string | null;
};

export type ResumoShare = {
  entradas: number;
  saidas: number;
  saldo: number;
  total_lancamentos: number;
  pendentes: number;
  valor_pendente: number;
};

export type GrupoShare = { grupo: string; valor: number };

export type FiltrosLancamentos = { mes?: string; busca?: string; categoria_id?: string; status?: string };

export async function buscarOpcoesFinanceiroShare() {
  return (await apiFetch("/api/interno/financeiro-share/opcoes")) as {
    categorias: CategoriaCaixaShare[];
    contas_bancarias: ContaBancaria[];
    empresas: EmpresaShare[];
  };
}

export async function buscarLancamentosShare(filtros: FiltrosLancamentos) {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => { if (valor) parametros.set(chave, valor); });
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  return (await apiFetch(`/api/interno/financeiro-share/movimentacoes${sufixo}`)) as {
    lancamentos: LancamentoShare[];
    resumo: ResumoShare;
    grupos: GrupoShare[];
  };
}

export async function criarLancamentoShare(dados: Record<string, unknown>) {
  return (await apiFetch("/api/interno/financeiro-share/movimentacoes", {
    method: "POST",
    body: JSON.stringify(dados),
  })) as { lancamento: LancamentoShare };
}

export async function atualizarLancamentoShare(id: string, dados: Record<string, unknown>) {
  return (await apiFetch(`/api/interno/financeiro-share/movimentacoes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  })) as { lancamento: LancamentoShare };
}

export async function excluirLancamentoShare(id: string) {
  return (await apiFetch(`/api/interno/financeiro-share/movimentacoes/${id}`, { method: "DELETE" })) as { ok: boolean };
}

export function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = valor.slice(0, 10).split("-");
  if (data.length !== 3) return valor;
  return `${data[2]}/${data[1]}/${data[0]}`;
}
