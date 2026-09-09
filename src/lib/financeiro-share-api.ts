import { API_BASE } from "./api";
import { supabase } from "./supabase";
import type {
  CategoriaMovimentacaoShare,
  ContaAPagar,
  ContaAReceber,
  FiltrosCaixaEmpresa,
  FiltrosContasAPagar,
  FiltrosContasAReceber,
  FornecedorFavorito,
  Lancamento,
} from "@/components/financeiro-share/tipos";

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

function paraQueryString(filtros: Record<string, string | undefined>): string {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => { if (valor) parametros.set(chave, valor); });
  const query = parametros.toString();
  return query ? `?${query}` : "";
}

function normalizarLancamentoCaixa(row: any): Lancamento {
  return {
    id: String(row.id ?? ""), aeronaveId: row.aeronaveId ?? row.aeronave_id ?? null,
    data: String(row.data ?? row.data_emissao ?? row.criado_em ?? "").slice(0, 10),
    descricao: String(row.descricao ?? ""), documento: row.documento ?? row.numero_doc ?? null,
    fornecedor: row.fornecedor ?? row.fornecedor_nome ?? null, fornecedorId: row.fornecedorId ?? row.fornecedor_id ?? row.fornecedores_favoritos_id ?? null,
    categoria: String(row.categoria ?? row.categoria_nome ?? "SEM CATEGORIA"), categoriaId: row.categoriaId ?? row.categoria_id ?? null,
    grupoCategoria: String(row.grupoCategoria ?? row.grupo_categoria ?? ""), tipo: row.tipo ?? row.tipo_despesa ?? null,
    prazo: row.prazo ?? row.data_vencimento ?? null, fluxo: ["ENTRADA", "RECEITA"].includes(String(row.fluxo ?? "SAIDA").toUpperCase()) ? "ENTRADA" : "SAIDA",
    valorCentavos: Number(row.valorCentavos ?? row.valor_centavos ?? Math.round(Number(row.valor_total ?? row.valor ?? 0) * 100)),
    pagoPor: String(row.pagoPor ?? row.pago_por ?? ""), caixa: String(row.caixa ?? row.tipo_caixa ?? "SHARE").toUpperCase() === "CLIENTE" ? "CLIENTE" : "SHARE",
    pagoDiretamente: Boolean(row.pagoDiretamente ?? row.pago_diretamente), reembolsavel: Boolean(row.reembolsavel),
    reembolsoQuitado: Boolean(row.reembolsoQuitado ?? row.reembolso_quitado), status: String(row.status ?? "EM_ABERTO").toUpperCase() as Lancamento["status"],
    observacoes: row.observacoes ?? null, criadoPor: row.criadoPor ?? row.criado_por ?? null,
    criadoEm: String(row.criadoEm ?? row.criado_em ?? ""), atualizadoEm: String(row.atualizadoEm ?? row.atualizado_em ?? ""),
  };
}

function periodoCompetencia(competencia?: string) {
  if (!competencia) return { inicio: undefined, fim: undefined };
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return { inicio: undefined, fim: undefined };
  return { inicio: `${competencia}-01`, fim: new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10) };
}

export async function buscarCaixaEmpresa(filtros: FiltrosCaixaEmpresa = {}): Promise<Lancamento[]> {
  const periodo = periodoCompetencia(filtros.competencia);
  const resposta = await financeiroRequest<{ lancamentos?: unknown[] }>(`/api/financeiro/lancamentos${paraQueryString({ caixa: "SHARE", inicio: periodo.inicio, fim: periodo.fim })}`);
  return (resposta.lancamentos ?? []).map(normalizarLancamentoCaixa).filter((item) =>
    (!filtros.fluxo || item.fluxo === filtros.fluxo) && (!filtros.status || item.status === filtros.status) && (!filtros.categoriaId || item.categoriaId === filtros.categoriaId));
}

function valorCentavosDoPayload(payload: Record<string, unknown>): number {
  if (Number.isFinite(Number(payload.valorCentavos))) return Math.round(Number(payload.valorCentavos));
  const bruto = payload.valor_total ?? payload.valor ?? 0;
  const valor = typeof bruto === "number" ? bruto : Number(String(bruto).replace(/\./g, "").replace(",", "."));
  return Math.round((Number.isFinite(valor) ? valor : 0) * 100);
}

async function criarLancamentoPeloKernel(payload: Record<string, unknown>, fluxo: "SAIDA" | "ENTRADA"): Promise<Lancamento> {
  const data = String(payload.data ?? payload.data_emissao ?? new Date().toISOString().slice(0, 10));
  const valorCentavos = valorCentavosDoPayload(payload);
  const camposPermitidos = new Set(["idempotency_key", "idempotencyKey", "reference_id", "valor_centavos", "valorCentavos", "descricao", "descricao_servico", "fluxo", "data", "data_emissao", "data_vencimento", "vencimento", "aeronave_id", "cotista_aeronave_id", "cotista_id", "socio_id", "holding_id", "categoria_id", "categoria_nome", "categoria", "fornecedor_id", "fornecedor", "tipo_caixa", "forma_pagamento", "conta_bancaria_id", "observacoes", "pago_diretamente", "pagoDiretamente", "pago_por", "rateio_linhas", "rateios", "tipo_rateio", "reembolsavel", "colaborador_id", "motivo", "valor"]);
  const contrato = Object.fromEntries(Object.entries(payload).filter(([campo]) => camposPermitidos.has(campo)));
  const resposta = await financeiroRequest<unknown>(fluxo === "ENTRADA" ? "/api/financeiro/lancamentos/receita" : "/api/financeiro/lancamentos/despesa", {
    method: "POST",
    body: JSON.stringify({ ...contrato, fluxo, valorCentavos, data, data_emissao: payload.data_emissao ?? data, idempotencyKey: payload.idempotencyKey ?? `ui:${fluxo}:${data}:${payload.descricao ?? ""}:${valorCentavos}` }),
  });
  return normalizarLancamentoCaixa(resposta);
}

export function criarDespesa(payload: Record<string, unknown>): Promise<Lancamento> { return criarLancamentoPeloKernel(payload, "SAIDA"); }
export function emitirReceita(payload: Record<string, unknown>): Promise<Lancamento> { return criarLancamentoPeloKernel(payload, "ENTRADA"); }

export function buscarContasAPagar(filtros: FiltrosContasAPagar = {}): Promise<ContaAPagar[]> {
  return financeiroRequest<ContaAPagar[]>(`/api/financeiro/contas-apagar${paraQueryString({ status: filtros.status, vencidasAte: filtros.vencidasAte, fornecedorId: filtros.fornecedorId })}`);
}

export function darBaixaContaAPagar(id: string, dados: { dataPagamento: string; bancoPagamento: string; comprovantePagamentoUrl?: string }): Promise<ContaAPagar> {
  return financeiroRequest<ContaAPagar>(`/api/financeiro/contas-apagar/${encodeURIComponent(id)}/baixa`, { method: "POST", body: JSON.stringify(dados) });
}

export function buscarContasAReceber(filtros: FiltrosContasAReceber = {}): Promise<ContaAReceber[]> {
  return financeiroRequest<ContaAReceber[]>(`/api/financeiro/contas-areceber${paraQueryString({ status: filtros.status, vencidasAte: filtros.vencidasAte, cotistaId: filtros.cotistaId })}`);
}

export function darBaixaContaAReceber(id: string, dados: { dataRecebimento: string; bancoRecebimento: string; formaPagamento?: string; comprovanteRecebimentoUrl?: string; pagamentos: Array<{ idempotency_key?: string; data_pagamento?: string; conta_bancaria_id?: string; comprovante_url?: string | null; forma_pagamento?: string | null; tipo_pagador: "COTISTA" | "SHARE" | "HOLDING"; pagador_cotista_id?: string; pagador_holding_id?: string; valor_centavos: number; rateios: Array<{ rateio_id: string; valor_centavos: number }> }> }): Promise<ContaAReceber> {
  return financeiroRequest<ContaAReceber>(`/api/financeiro/contas-areceber/${encodeURIComponent(id)}/baixa`, { method: "POST", body: JSON.stringify(dados) });
}

export function buscarFornecedoresFavoritos(): Promise<FornecedorFavorito[]> { return financeiroRequest<FornecedorFavorito[]>("/api/financeiro/fornecedores-favoritos"); }

export async function buscarCategoriasShare(): Promise<CategoriaMovimentacaoShare[]> {
  const resposta = await financeiroRequest<{ categorias?: any[] }>("/api/financeiro/lancamentos/opcoes");
  return (resposta.categorias ?? []).map((categoria) => ({ id: String(categoria.id), nome: String(categoria.nome ?? categoria.descricao ?? ""), tipo: categoria.tipo ?? null, reembolsavel: Boolean(categoria.reembolsavel), grupoCategoria: categoria.grupoCategoria ?? categoria.grupo ?? null, tipoDespesa: categoria.tipoDespesa ?? categoria.classificacao ?? null, categoriaClienteId: categoria.categoriaClienteId ?? null }));
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
  return (await financeiroRequest("/api/financeiro/share/opcoes")) as {
    categorias: CategoriaCaixaShare[];
    contas_bancarias: ContaBancaria[];
    empresas: EmpresaShare[];
  };
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
  return normalizarOpcoesLancamento(await financeiroRequest<Partial<OpcoesLancamento>>("/api/financeiro/lancamentos/opcoes"));
}

export async function buscarBalancoEconomico(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  return normalizarBalanco(await financeiroRequest<Partial<BalancoEconomico>>(`/api/financeiro/balanco${sufixo}`));
}

export async function buscarDashboardCotista(inicio?: string, fim?: string) {
  const parametros = new URLSearchParams();
  if (inicio) parametros.set("inicio", inicio);
  if (fim) parametros.set("fim", fim);
  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";
  const payload = await financeiroRequest<Partial<DashboardCotista>>(`/api/financeiro/cotista/dashboard${sufixo}`);
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
  const resposta = await financeiroRequest<{ lancamentos?: LancamentoEconomico[] }>(`/api/financeiro/lancamentos${sufixo}`);
  return { lancamentos: Array.isArray(resposta?.lancamentos) ? resposta.lancamentos : [] };
}

export async function criarLancamentoEconomico(dados: Record<string, unknown>) {
  const fluxo = String(dados.fluxo || "SAIDA").toUpperCase() === "ENTRADA" ? "receita" : "despesa";
  return (await financeiroRequest(`/api/financeiro/lancamentos/${fluxo}`, {
    method: "POST",
    body: JSON.stringify(dados),
  })) as { id: string };
}

export function parseValorReais(valor: string): number {
  const limpo = String(valor || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3},)/g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
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
