import { apiFetch } from "./api";

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

export type RateioEconomico = {
  cotista: string;
  percentual: number;
  valorCentavos: number;
};

export type LancamentoEconomico = {
  id: string;
  data: string;
  descricao: string;
  documento: string | null;
  fornecedor: string | null;
  categoria: string;
  grupoCategoria: string;
  tipo: string | null;
  prazo: string | null;
  fluxo: "ENTRADA" | "SAIDA";
  valorCentavos: number;
  pagoPor: string;
  caixa: string;
  pagoDiretamente: boolean;
  reembolsavel: boolean;
  reembolsoQuitado: boolean;
  status: string;
  observacoes: string | null;
  rateios: RateioEconomico[];
};

export type SaldoCotista = {
  cotista: string;
  totalPagoCentavos: number;
  totalDevidoCentavos: number;
  saldoCentavos: number;
};

export type HoldingSocioResumo = {
  cotistaId: string;
  percentual: number;
  totalDepositadoCentavos: number;
  totalConsumidoCentavos: number;
  despesasPagasDiretamenteCentavos: number;
  saldoCentavos: number;
};

export type HoldingResumo = {
  id: string;
  nome: string;
  contaBancaria: string | null;
  socios: HoldingSocioResumo[];
};

export type BalancoEconomico = {
  lancamentos: LancamentoEconomico[];
  saldos: SaldoCotista[];
  matrizCompensacao: Record<string, Record<string, number>>;
  holdings: HoldingResumo[];
};

export type OpcoesLancamento = {
  categorias: CategoriaCaixaShare[];
  contas_bancarias: ContaBancaria[];
  cotistas: Array<{ id: string; nome: string; aeronave_id?: string | null; percentual_sociedade?: number | null }>;
  holdings: Array<{ id: string; nome: string; conta_bancaria: string | null }>;
  pagadores: Array<{ id: string; nome: string }>;
};

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
  return (await apiFetch(`/api/interno/financeiro-share/lancamentos${sufixo}`)) as {
    lancamentos: LancamentoShare[];
    resumo: ResumoShare;
    grupos: GrupoShare[];
  };
}

export async function criarLancamentoShare(dados: Record<string, unknown>) {
  return (await apiFetch("/api/interno/financeiro-share/lancamentos", {
    method: "POST",
    body: JSON.stringify(dados),
  })) as { lancamento: LancamentoShare };
}

export async function atualizarLancamentoShare(id: string, dados: Record<string, unknown>) {
  return (await apiFetch(`/api/interno/financeiro-share/lancamentos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  })) as { lancamento: LancamentoShare };
}

export async function excluirLancamentoShare(id: string) {
  return (await apiFetch(`/api/interno/financeiro-share/lancamentos/${id}`, { method: "DELETE" })) as { ok: boolean };
}

export async function buscarOpcoesLancamento() {
  return (await apiFetch("/api/lancamentos/opcoes")) as OpcoesLancamento;
}

export async function buscarBalancoEconomico(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  return (await apiFetch(`/api/balanco${sufixo}`)) as BalancoEconomico;
}

export async function buscarLancamentosEconomicos(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  return (await apiFetch(`/api/lancamentos${sufixo}`)) as { lancamentos: LancamentoEconomico[] };
}

export async function criarLancamentoEconomico(dados: Record<string, unknown>) {
  return (await apiFetch("/api/lancamentos", {
    method: "POST",
    body: JSON.stringify(dados),
  })) as { id: string };
}

export function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
}

export function formatarCentavos(valorCentavos: number | null | undefined) {
  return formatarMoeda(Number(valorCentavos || 0) / 100);
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = valor.slice(0, 10).split("-");
  if (data.length !== 3) return valor;
  return `${data[2]}/${data[1]}/${data[0]}`;
}
