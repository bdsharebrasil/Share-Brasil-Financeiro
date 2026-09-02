import { API_BASE } from "./api";
import { supabase } from "./supabase";

async function financeiroRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("sessao_expirada");
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit" });
  const data = await response.json().catch(() => null) as T & { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || `api_${response.status}`);
  return data as T;
}

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
  tipo: string | null;
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
export type FiltrosLancamentos = { mes?: string; inicio?: string; fim?: string; busca?: string; categoria_id?: string; status?: string };

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

export type FechamentoMensalCotista = {
  mes: string;
  entradas: number;
  saidas: number;
  custoRateado: number;
  lancamentos: number;
  saldo: number;
  mediaPorLancamento: number;
};

export type RankingGastoCotista = { categoria: string; grupo: string; valor: number; quantidade: number };
export type RankingCotista = { cotista: string; devido: number; pago: number; quantidade: number };

export type DashboardCotista = BalancoEconomico & {
  resumo: {
    entradas: number;
    saidas: number;
    saldo: number;
    custo_rateado: number;
    pendentes: number;
    media_mensal: number;
    media_lancamento: number;
  };
  fechamento_mensal: FechamentoMensalCotista[];
  ranking_gastos: RankingGastoCotista[];
  ranking_cotistas: RankingCotista[];
};

export type OpcoesLancamento = {
  categorias: CategoriaCaixaShare[];
  contas_bancarias: ContaBancaria[];
  cotistas: Array<{ id: string; nome: string; aeronave_id?: string | null; percentual_sociedade?: number | null }>;
  holdings: Array<{ id: string; nome: string; conta_bancaria: string | null }>;
  pagadores: Array<{ id: string; nome: string }>;
};

export async function buscarOpcoesFinanceiroShare() {
  return (await financeiroRequest("/api/interno/financeiro-share/opcoes")) as {
    categorias: CategoriaCaixaShare[];
    contas_bancarias: ContaBancaria[];
    empresas: EmpresaShare[];
  };
}

export async function buscarLancamentosShare(filtros: FiltrosLancamentos) {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => { if (valor) parametros.set(chave, valor); });
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  return (await financeiroRequest(`/api/interno/financeiro-share/lancamentos${sufixo}`)) as {
    lancamentos: LancamentoShare[];
    resumo: ResumoShare;
    grupos: GrupoShare[];
  };
}

export async function criarLancamentoShare(dados: Record<string, unknown>) {
  return (await financeiroRequest("/api/interno/financeiro-share/lancamentos", {
    method: "POST",
    body: JSON.stringify(dados),
  })) as { lancamento: LancamentoShare };
}

export async function atualizarLancamentoShare(id: string, dados: Record<string, unknown>) {
  return (await financeiroRequest(`/api/interno/financeiro-share/lancamentos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  })) as { lancamento: LancamentoShare };
}

export async function excluirLancamentoShare(id: string) {
  return (await financeiroRequest(`/api/interno/financeiro-share/lancamentos/${id}`, { method: "DELETE" })) as { ok: boolean };
}

function normalizarOpcoesLancamento(payload: Partial<OpcoesLancamento> | null | undefined): OpcoesLancamento {
  return {
    categorias: Array.isArray(payload?.categorias) ? payload.categorias : [],
    contas_bancarias: Array.isArray(payload?.contas_bancarias) ? payload.contas_bancarias : [],
    cotistas: Array.isArray(payload?.cotistas) ? payload.cotistas : [],
    holdings: Array.isArray(payload?.holdings) ? payload.holdings : [],
    pagadores: Array.isArray(payload?.pagadores) ? payload.pagadores : [],
  };
}

function normalizarBalanco(payload: Partial<BalancoEconomico> | null | undefined): BalancoEconomico {
  return {
    lancamentos: Array.isArray(payload?.lancamentos) ? payload.lancamentos.map((item) => ({ ...item, rateios: Array.isArray(item.rateios) ? item.rateios : [] })) : [],
    saldos: Array.isArray(payload?.saldos) ? payload.saldos : [],
    matrizCompensacao: payload?.matrizCompensacao && typeof payload.matrizCompensacao === "object" ? payload.matrizCompensacao : {},
    holdings: Array.isArray(payload?.holdings) ? payload.holdings.map((holding) => ({ ...holding, socios: Array.isArray(holding.socios) ? holding.socios : [] })) : [],
  };
}

export async function buscarOpcoesLancamento() {
  return normalizarOpcoesLancamento(await financeiroRequest<Partial<OpcoesLancamento>>("/api/lancamentos/opcoes"));
}

export async function buscarBalancoEconomico(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  return normalizarBalanco(await financeiroRequest<Partial<BalancoEconomico>>(`/api/balanco${sufixo}`));
}

export async function buscarDashboardCotista(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  const payload = await financeiroRequest<Partial<DashboardCotista>>(`/api/interno/financeiro-cotista/dashboard${sufixo}`);
  return {
    ...normalizarBalanco(payload),
    resumo: {
      entradas: Number(payload.resumo?.entradas ?? 0),
      saidas: Number(payload.resumo?.saidas ?? 0),
      saldo: Number(payload.resumo?.saldo ?? 0),
      custo_rateado: Number(payload.resumo?.custo_rateado ?? 0),
      pendentes: Number(payload.resumo?.pendentes ?? 0),
      media_mensal: Number(payload.resumo?.media_mensal ?? 0),
      media_lancamento: Number(payload.resumo?.media_lancamento ?? 0),
    },
    fechamento_mensal: Array.isArray(payload.fechamento_mensal) ? payload.fechamento_mensal : [],
    ranking_gastos: Array.isArray(payload.ranking_gastos) ? payload.ranking_gastos : [],
    ranking_cotistas: Array.isArray(payload.ranking_cotistas) ? payload.ranking_cotistas : [],
  } as DashboardCotista;
}

export async function buscarLancamentosEconomicos(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  const resposta = await financeiroRequest<{ lancamentos?: LancamentoEconomico[] }>(`/api/lancamentos${sufixo}`);
  return { lancamentos: Array.isArray(resposta?.lancamentos) ? resposta.lancamentos : [] };
}

export async function criarLancamentoEconomico(dados: Record<string, unknown>) {
  return (await financeiroRequest("/api/lancamentos", {
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
