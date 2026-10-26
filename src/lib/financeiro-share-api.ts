import type {
  ParticipanteBalanco,
  RateioBalanco,
  PagamentoBalanco,
  AjusteBalanco,
} from "./balanco-cotistas";

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

import { formatCentavos, formatReais, parseReaisToCentavos } from "@/lib/money";

const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

async function financeiroRequest<T>(path: string, init: RequestInit = {}): Promise<T> {

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) throw new Error("sessao_expirada");

  if (!session?.access_token) throw new Error("sessao_nao_encontrada");

  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (supabasePublishableKey) headers.set("apikey", supabasePublishableKey);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit", cache: "no-store" });

  const data = await response.json().catch(() => null) as T & { error?: string } | null;

  if (!response.ok) throw new Error(data?.error || `api_${response.status}`);

  return data as T;

}

export async function buscarDocumentoFinanceiro(path: string): Promise<Blob> {

  if (!path.startsWith("/api/financeiro/")) throw new Error("url_financeira_invalida");

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) throw new Error("sessao_expirada");

  if (!session?.access_token) throw new Error("sessao_nao_encontrada");

  const headers = new Headers({ Authorization: `Bearer ${session.access_token}` });

  if (supabasePublishableKey) headers.set("apikey", supabasePublishableKey);

  const response = await fetch(`${API_BASE}${path}`, { headers, credentials: "omit", cache: "no-store" });

  if (!response.ok) {

    const data = await response.json().catch(() => null) as { error?: string } | null;

    throw new Error(data?.error || `api_${response.status}`);

  }

  return response.blob();

}

export type AcessoPortalCliente = {

  cotista_aeronave_id: string;

  cliente_id: string | null;

  socio_id: string | null;

  codigo_cliente: string | null;

  percentual_sociedade: number | null;

  nome: string;

  matricula_registro: string | null;

  possui_acesso: number | boolean;

  login: string | null;

};

export function buscarAcessosPortalCliente(aeronaveId: string) {

  return financeiroRequest<{ cotistas: AcessoPortalCliente[] }>(`/api/financeiro/cotista/portal-cliente?aeronave_id=${encodeURIComponent(aeronaveId)}`);

}

export function criarAcessoPortalCliente(cotistaAeronaveId: string, senha: string) {

	  return financeiroRequest<{ success: boolean; login: string }>(`/api/financeiro/cotista/portal-cliente/${encodeURIComponent(cotistaAeronaveId)}/credenciais`, { method: "POST", body: JSON.stringify({ senha }) });

}

export function atualizarCredenciaisPortalCliente(cotistaAeronaveId: string, credenciais: { login: string; senha: string }) {

  return financeiroRequest<{ success: boolean; login: string }>(`/api/financeiro/cotista/portal-cliente/${encodeURIComponent(cotistaAeronaveId)}/credenciais`, {

    method: "PUT",

    body: JSON.stringify(credenciais),

  });

}

export function enviarAcessoPortalCliente(cotistaAeronaveId: string, dados: { senha: string; destinatario: string }) {

	  return financeiroRequest<{ success: boolean; destinatario: string }>(`/api/financeiro/cotista/portal-cliente/${encodeURIComponent(cotistaAeronaveId)}/enviar-acesso`, { method: "POST", body: JSON.stringify(dados) });

}

function paraQueryString(filtros: Record<string, string | undefined>): string {

  const parametros = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => { if (valor) parametros.set(chave, valor); });

  const query = parametros.toString();

  return query ? `?${query}` : "";

}

function resolverUrlDocumento(url: unknown): string | null {

  const valor = String(url ?? "").trim();

  if (!valor) return null;

  if (/^(?:https?:|data:|blob:)/i.test(valor)) return valor;

  return valor.startsWith("/") ? `${API_BASE}${valor}` : valor;

}

function flagFinanceira(valor: unknown): boolean {

  return valor === true || valor === 1 || valor === "1" || valor === "true";

}

export function enviarComprovanteReembolso(id: string, arquivo: File): Promise<{ url: string }> {

  const body = new FormData();

  body.append("arquivo", arquivo, arquivo.name);

  return financeiroRequest<{ url: string }>(`/api/financeiro/contas-apagar/${encodeURIComponent(id)}/comprovante-upload`, { method: "POST", body });

}

// Nome genérico para o mesmo endpoint; mantém compatibilidade com os consumidores antigos.

export const enviarComprovantePagamento = enviarComprovanteReembolso;

/** Busca documentos privados com autenticação apenas no backend conhecido. */

export async function carregarDocumentoFinanceiro(valor: string, signal?: AbortSignal): Promise<Blob> {

  const base = new URL(API_BASE || "/", window.location.origin);

  const resolvida = resolverUrlDocumento(valor);

  if (!resolvida) throw new Error("documento_sem_url");

  const url = new URL(resolvida, window.location.origin);

  if (!["https:", "http:"].includes(url.protocol)) throw new Error("url_documento_invalida");

  const headers = new Headers();

  const privado = url.origin === base.origin && url.pathname.startsWith("/api/");

  if (privado) {

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.access_token) throw new Error("sessao_expirada");

    headers.set("Authorization", `Bearer ${session.access_token}`);

    if (supabasePublishableKey) headers.set("apikey", supabasePublishableKey);

  }

  const response = await fetch(url.href, { headers, signal, credentials: "omit", redirect: privado ? "error" : "follow" });

  if (!response.ok) throw new Error(`Não foi possível abrir o documento (${response.status}).`);

  const blob = await response.blob();

  if (!blob.size) throw new Error("O documento está vazio.");

  return blob;

}

export function enviarComprovanteRecebimento(id: string, arquivo: File): Promise<{ url: string }> {

  const body = new FormData();

  body.append("arquivo", arquivo, arquivo.name);

  return financeiroRequest<{ url: string }>(`/api/financeiro/contas-areceber/${encodeURIComponent(id)}/comprovante-upload`, { method: "POST", body });

}

function normalizarContaFinanceira<T extends ContaAPagar | ContaAReceber>(row: any): T {

  return {

    ...row,

    id: String(row.id ?? ""),

    dataEmissao: row.dataEmissao ?? row.lancamento_data_emissao ?? row.data_emissao ?? row.data ?? null,

    dataVencimento: row.dataVencimento ?? row.data_vencimento ?? "",

    valor: Number(row.valor ?? Number(row.valor_centavos ?? 0) / 100),

    categoriaId: row.categoriaId ?? row.categoria_share_id ?? row.categoria_id ?? null,

    categoriaNome: row.categoriaNome ?? row.categoria_nome ?? null,

    descricao: row.descricao ?? null,

    criadoPor: row.criadoPor ?? row.criado_por ?? null,

    aeronaveId: row.aeronaveId ?? row.aeronave_id ?? null,

    aeronaveMatricula: row.aeronaveMatricula ?? row.aeronave_matricula ?? null,

    fornecedor: row.fornecedor ?? row.fornecedor_nome ?? null,

    fornecedorId: row.fornecedorId ?? row.fornecedor_id ?? row.fornecedores_favoritos_id ?? null,

    cotistaId: row.cotistaId ?? row.cotista_id ?? null,

    cotistaNome: row.cotistaNome ?? row.cotista_nome ?? null,

    cotista: row.cotista ?? row.cotistaNome ?? row.cotista_nome ?? (Array.isArray(row.rateios) ? row.rateios.map((rateio: { cotista_nome?: string | null }) => rateio.cotista_nome).filter(Boolean).join(", ") || null : null),

    holdingId: row.holdingId ?? row.holding_id ?? null,

    holdingNome: row.holdingNome ?? row.holding_nome ?? null,

    boletoUrl: row.boletoUrl ?? row.boleto_url ?? null,

    nfUrl: row.nfUrl ?? row.nf_url ?? null,

    nfSaidaId: row.nfSaidaId ?? row.nf_saida_id ?? null,

    dataPagamento: row.dataPagamento ?? row.data_pagamento ?? null,

    bancoPagamento: row.bancoPagamento ?? row.banco_pagamento ?? null,

    comprovantePagamentoUrl: row.comprovantePagamentoUrl ?? row.comprovante_pagamento_url ?? null,

    dataRecebimento: row.dataRecebimento ?? row.data_recebimento ?? null,

    email_enviado_em: row.email_enviado_em ?? null,

    bancoRecebimento: row.bancoRecebimento ?? row.banco_recebimento ?? null,

    comprovanteRecebimentoUrl: row.comprovanteRecebimentoUrl ?? row.comprovante_recebimento_url ?? null,

    documento: row.documento ?? row.numero_nf ?? row.numero_recibo ?? row.numero_doc ?? row.numero_demonstrativo ?? null,

    documentoUrl: resolverUrlDocumento(row.documentoUrl || row.url_doc || row.relatorio_pdf_url || row.url_demonstrativo || row.url_nf || row.url_recibo || row.url_boleto),

    lancamentoId: row.lancamentoId ?? row.lancamento_id ?? row.lancamentos_id ?? null,

    status: String(row.status ?? "EM_ABERTO").toUpperCase(),

    criadoEm: row.criadoEm ?? row.criado_em ?? "",

    atualizadoEm: row.atualizadoEm ?? row.atualizado_em ?? "",

  } as T;

}

function normalizarLancamentoCaixa(row: any): Lancamento {

  const anexos = (() => {

    const valor = row.anexos ?? row.anexos_json;

    if (Array.isArray(valor)) return valor;

    try { return valor ? JSON.parse(String(valor)) : []; } catch { return []; }

  })();

  return {

    id: String(row.id ?? ""), aeronaveId: row.aeronaveId ?? row.aeronave_id ?? null, cotistaId: row.cotistaId ?? row.cotista_aeronave_id ?? row.cotista_id ?? null,

    data: String(row.data ?? row.data_emissao ?? row.criado_em ?? "").slice(0, 10),

    descricao: String(row.descricao ?? ""), documento: row.documento ?? row.numero_doc ?? null, documentoUrl: row.documentoUrl ?? row.url_doc ?? null,

    fornecedor: row.fornecedor ?? row.fornecedor_nome ?? null, fornecedorId: row.fornecedorId ?? row.fornecedor_id ?? row.fornecedores_favoritos_id ?? null,

    categoria: String(row.categoria ?? row.categoria_nome ?? "SEM CATEGORIA"), categoriaId: row.categoriaId ?? row.categoria_share_id ?? row.categoria_id ?? null,

    grupoCategoria: String(row.grupoCategoria ?? row.grupo_categoria ?? ""), tipo: row.tipo ?? row.tipo_despesa ?? null,

    prazo: row.prazo ?? row.data_vencimento ?? null, fluxo: ["ENTRADA", "RECEITA"].includes(String(row.fluxo ?? "SAIDA").toUpperCase()) ? "ENTRADA" : "SAIDA",

    valorCentavos: Number(row.valorCentavos ?? row.valor_centavos ?? Math.round(Number(row.valor_total ?? row.valor ?? 0) * 100)),

    pagoPor: String(row.pagoPor ?? row.pago_por ?? row.pago_por_cotista_id ?? ""), caixa: ((String(row.caixa ?? row.tipo_caixa ?? "SHARE").toUpperCase() === "CLIENTE" || String(row.caixa ?? row.tipo_caixa ?? "SHARE").toUpperCase() === "HOLDING") ? String(row.caixa ?? row.tipo_caixa ?? "SHARE").toUpperCase() : "SHARE") as "CLIENTE" | "HOLDING" | "SHARE",

    pagoDiretamente: flagFinanceira(row.pagoDiretamente ?? row.pago_diretamente), reembolsavel: flagFinanceira(row.reembolsavel),

    reembolsoQuitado: flagFinanceira(row.reembolsoQuitado ?? row.reembolso_quitado), status: String(row.status ?? "EM_ABERTO").toUpperCase() as Lancamento["status"],

    observacoes: row.observacoes ?? null, criadoPor: row.criadoPor ?? row.criado_por ?? null,

    criadoEm: String(row.criadoEm ?? row.criado_em ?? ""), atualizadoEm: String(row.atualizadoEm ?? row.atualizado_em ?? ""),

    anexos: anexos.filter((item: any) => item && item.url).map((item: any) => ({ id: String(item.id ?? crypto.randomUUID()), nome: String(item.nome ?? "Documento"), url: String(item.url), tipo: item.tipo ?? null, numero: item.numero ?? null })),

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

  const resposta = await financeiroRequest<{ lancamentos?: unknown[] }>(`/api/financeiro/lancamentos${paraQueryString({ caixa: filtros.caixa || "SHARE", inicio: periodo.inicio, fim: periodo.fim })}`);

  return (resposta.lancamentos ?? []).map(normalizarLancamentoCaixa).filter((item) =>

    (!filtros.fluxo || item.fluxo === filtros.fluxo) && (!filtros.status || item.status === filtros.status) && (!filtros.categoriaId || item.categoriaId === filtros.categoriaId));

}

export type SolicitacaoCompraFinanceira = {
  id: string;
  numero_solicitacao?: string | null;
  descricao: string;
  status: string;
  data_solicitacao?: string | null;
  data_necessaria?: string | null;
  envio_id?: string | null;
  envio_status?: string | null;
  valor?: number | null;
  vencimento?: string | null;
  tipo_caixa?: string | null;
  lancamento_id?: string | null;
  solicitante_nome?: string | null;
};

export async function buscarSolicitacoesCompraFinanceiras(): Promise<SolicitacaoCompraFinanceira[]> {
  const resposta = await financeiroRequest<{ solicitacoes?: SolicitacaoCompraFinanceira[] }>("/api/financeiro/solicitacoes-compra");
  return resposta.solicitacoes ?? [];
}

function valorCentavosDoPayload(payload: Record<string, unknown>): number {

  const centavosInformados = payload.valorCentavos ?? payload.valor_centavos;

  if (centavosInformados !== undefined && centavosInformados !== null && centavosInformados !== "") {

    const centavos = Number(centavosInformados);

    if (Number.isFinite(centavos)) return Math.round(centavos);

  }

  const bruto = payload.valor_total ?? payload.valor ?? 0;

  const valor = typeof bruto === "number" ? bruto : Number(String(bruto).replace(/\./g, "").replace(",", "."));

  return Math.round((Number.isFinite(valor) ? valor : 0) * 100);

}

async function criarLancamentoPeloKernel(payload: Record<string, unknown>, fluxo: "SAIDA" | "ENTRADA"): Promise<Lancamento> {

  const data = String(payload.data ?? payload.data_emissao ?? new Date().toISOString().slice(0, 10));

  const valorCentavos = valorCentavosDoPayload(payload);

  const camposPermitidos = new Set(["idempotency_key", "idempotencyKey", "reference_id", "valor_centavos", "valorCentavos", "descricao", "descricao_servico", "fluxo", "data", "data_emissao", "data_vencimento", "vencimento", "aeronave_id", "cotista_aeronave_id", "cotista_id", "socio_id", "holding_id", "categoria_id", "categoria_nome", "categoria", "fornecedor_id", "fornecedor", "tipo_caixa", "forma_pagamento", "conta_bancaria_id", "observacoes", "numero_doc", "pago_diretamente", "pagoDiretamente", "pago_por", "rateio_linhas", "rateios", "tipo_rateio", "reembolsavel", "colaborador_id", "motivo", "valor"]);

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

export async function darBaixaContaAPagar(id: string, dados: { dataPagamento: string; bancoPagamento: string; comprovantePagamentoUrl?: string; formaPagamento?: string; observacoes?: string }): Promise<ContaAPagar> {

  const resposta = await financeiroRequest<Record<string, unknown>>(`/api/financeiro/contas-apagar/${encodeURIComponent(id)}/baixa`, {

    method: "POST",

    body: JSON.stringify({ data_pagamento: dados.dataPagamento, banco_pagamento: dados.bancoPagamento, comprovante_pagamento_url: dados.comprovantePagamentoUrl, forma_pagamento: dados.formaPagamento, motivo: dados.observacoes }),

  });

  return normalizarContaFinanceira<ContaAPagar>(resposta);

}

export function buscarContasAReceber(filtros: FiltrosContasAReceber = {}): Promise<ContaAReceber[]> {

  return financeiroRequest<ContaAReceber[]>(`/api/financeiro/contas-areceber${paraQueryString({ status: filtros.status, vencidasAte: filtros.vencidasAte, cotistaId: filtros.cotistaId })}`);

}

export async function darBaixaContaAReceber(id: string, dados: { dataRecebimento?: string; bancoRecebimento?: string; formaPagamento?: string; comprovanteRecebimentoUrl?: string; pagamentos: Array<{ idempotency_key?: string; data_pagamento?: string; conta_bancaria_id?: string; comprovante_url?: string | null; forma_pagamento?: string | null; tipo_pagador: "COTISTA" | "SHARE" | "HOLDING"; pagador_cotista_id?: string; pagador_holding_id?: string; valor_centavos: number; rateios: Array<{ rateio_id: string; valor_centavos: number }> }> }): Promise<ContaAReceber> {

  const resposta = await financeiroRequest<Record<string, unknown>>(`/api/financeiro/contas-areceber/${encodeURIComponent(id)}/baixa`, {

    method: "POST",

    body: JSON.stringify({ data_recebimento: dados.dataRecebimento, banco_recebimento: dados.bancoRecebimento, forma_pagamento: dados.formaPagamento, pagamentos: dados.pagamentos }),

  });

  return normalizarContaFinanceira<ContaAReceber>(resposta);

}

export function buscarFornecedoresFavoritos(): Promise<FornecedorFavorito[]> { return financeiroRequest<FornecedorFavorito[]>("/api/financeiro/fornecedores-favoritos"); }

export async function buscarCategoriasShare(): Promise<CategoriaMovimentacaoShare[]> {

  const resposta = await financeiroRequest<{ categorias?: any[] }>("/api/financeiro/share/opcoes");

  return (resposta.categorias ?? []).map((categoria) => ({ id: String(categoria.id), nome: String(categoria.nome ?? categoria.descricao ?? ""), tipo: categoria.tipo ?? null, reembolsavel: Boolean(categoria.reembolsavel), grupoCategoria: categoria.grupoCategoria ?? categoria.grupo_categoria ?? categoria.grupo ?? null, tipoDespesa: categoria.tipoDespesa ?? categoria.tipo_despesa ?? categoria.classificacao ?? null, categoriaClienteId: categoria.categoriaClienteId ?? categoria.categoria_cliente_id ?? null }));

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

export type ContaBancaria = { id: string; banco: string; numero_conta: string | null; tipo_conta: string | null; holding_id?: string | null; tipo_caixa?: string | null; ativo?: number | boolean | null };

export type SolicitacaoBaixaPortal = {
  id: string;
  rateio_id: string;
  valor_centavos: number;
  data_pagamento: string;
  data_vencimento: string | null;
  observacoes: string | null;
  criado_em: string;
  descricao_despesa: string | null;
  valor_rateado_centavos: number;
  valor_pago_real_centavos: number;
  status_rateio: string;
  lancamento_id: string | null;
  nome_cotista: string | null;
  aeronave: string | null;
  natureza: "RECEBIMENTO_SHARE" | "PAGAMENTO_DIRETO" | null;
  erro_contexto?: string;
  comprovante_path: string;
};

export function buscarSolicitacoesBaixaPortal() {
  return financeiroRequest<{ solicitacoes: SolicitacaoBaixaPortal[] }>("/api/financeiro/solicitacoes-baixa-portal");
}

export function aprovarSolicitacaoBaixaPortal(id: string, dados: { data_pagamento: string; conta_bancaria_id?: string }) {
  return financeiroRequest<{ success: boolean }>(`/api/financeiro/solicitacoes-baixa-portal/${encodeURIComponent(id)}/aprovar`, { method: "POST", body: JSON.stringify(dados) });
}

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

export type DocumentoVinculado = {

  id?: string;

  nome: string;

  url: string;

  numero?: string | null;

  tipo?: string | null;

};

export type RateioEconomico = {

  id?: string;

  cotistaId?: string | null;

  cotista: string;

  percentual: number;

  valorCentavos: number;

  percentualSociedade?: number | null;

  valorPagoRealCentavos?: number;

  dataVencimento?: string | null;

  dataPagamento?: string | null;

  subcategorias?: string[];

  tipoRateio?: string | null;

  periodicidade?: string | null;

  pagoPor?: string | null;

  pagoDiretamente?: boolean;

  status?: string;

  documentos?: DocumentoVinculado[];

};

export type LancamentoEconomico = {

  id: string;

  aeronaveId?: string | null;

  participanteId?: string | null;

  participanteNome?: string | null;

  data: string;

  dataEmissao?: string | null;

  descricao: string;

  documento: string | null;

  documentoNumero?: string | null;

  numeroNf?: string | null;

  numeroRecibo?: string | null;

  numeroDemonstrativo?: string | null;

  numeroDoc?: string | null;

  urlDoc?: string | null;

  urlDemonstrativo?: string | null;

  urlNf?: string | null;

  urlRecibo?: string | null;

  urlBoleto?: string | null;

  dataPagamento?: string | null;

  percentualSociedade?: number | null;

  percentualUso?: number | null;

  valorRateadoCentavos?: number;

  valorPagoRealCentavos?: number;

  emailEnviadoEm?: string | null;

  aeronaveNome?: string | null;

  fornecedor: string | null;

  categoria: string;

  grupoCategoria: string;

  tipo: string | null;

  tipoRateio?: string | null;

  prazo: string | null;

  fluxo: "ENTRADA" | "SAIDA";

  valorCentavos: number;

  valorPagoCentavos?: number;

  pagoPor: string;

  caixa: string;

  pagoDiretamente: boolean;

  reembolsavel: boolean;

  reembolsoQuitado: boolean;

  status: string;

  observacoes: string | null;

  local?: string | null;

  periodicidade?: string | null;

  numeroVoo?: string | null;

  subcategorias?: string[];

  documentos?: DocumentoVinculado[];

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

  nome: string;

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

  saldoContaCentavos: number;

  socios: HoldingSocioResumo[];

};

export type MovimentoHoldingExtrato = {

  id: string;

  holdingId: string | null;

  holdingNome: string | null;

  socioId: string | null;

  socioNome: string | null;

  aeronaveId: string | null;

  data: string;

  dataPagamento: string | null;

  descricao: string;

  categoria: string | null;

  fluxo: string;

  valorCentavos: number;

  status: string;

  contaBancaria: string | null;

  diretamentePago: boolean;

};

export type BalancoEconomico = {

  lancamentos: LancamentoEconomico[];

  movimentos_holding: MovimentoHoldingExtrato[];

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

export type MediasCotista = {

  horas_voadas: number;

  total_voos: number;

  total_pousos: number;

  custo_por_hora_centavos: number;

  dia_mais_utilizado: string | null;

  media_mensal_horas: number;

  custo_medio_por_voo_centavos: number;

};

export type MediasCotistaMensais = MediasCotista & { mes: string };

type CotistaOperacionalBalanco = { id: string; nome: string; clienteId: string | null; socioId: string | null; holdingId: string | null; percentualSociedade: number | null };
type VooOperacionalBalanco = { id: string; data: string; numero: string | null; clienteId: string | null; socioId: string | null; horas: number | null; horasVoo: number | null; pousos: number | null; origem: string | null; destino: string | null; consumoEstimadoLitros: number | null; emprestado: boolean; clienteTomadorId: string | null; socioTomadorId: string | null; natureza: string | null };
type ViagemOperacionalBalanco = { id: string; data: string; numero: string | null; rota: string | null; clienteId: string | null; socioId: string | null; valorCentavos: number | null };
export type BalancoOperacionalCotista = {
  versao: 1; aeronaveId: string; inicio: string | null; fim: string | null;
  fontes: { voos: boolean; abastecimentos: boolean; viagens: boolean; cotistas: boolean };
  cotistas: CotistaOperacionalBalanco[]; voos: VooOperacionalBalanco[];
  abastecimentos: { id: string; data: string; litros: number | null; clienteId: string | null; socioId: string | null }[];
  viagens: ViagemOperacionalBalanco[];
};

export type FontesBalancoCotista = {
  versao: 1;
  aeronaveId: string;
  participantes: ParticipanteBalanco[];
  rateios: RateioBalanco[];
  pagamentos: PagamentoBalanco[];
  ajustes: AjusteBalanco[];
};

export type DashboardCotista = BalancoEconomico & {
  balanco_fontes?: FontesBalancoCotista | null;
  balanco_detalhado_erro?: string | null;
  balanco_operacional?: BalancoOperacionalCotista | null;
  balanco_escopo?: "aeronave" | "cotista" | "geral";
  emprestimos_aeronave?: EmprestimoAeronave[];


  medias: MediasCotista;

  medias_mensais: MediasCotistaMensais[];

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

export type CamposLancamento = {

  numero_nf?: string | null;

  numero_recibo?: string | null;

  numero_doc?: string | null;

  numero_demonstrativo?: string | null;

  data_emissao?: string | null;

  aeronave_id?: string | null;

  aeronave_matricula?: string | null;

  matricula_registro?: string | null;

  cotista_aeronave_id?: string | null;

  cliente_razao_social?: string | null;

  cliente_nome?: string | null;

  descricao?: string | null;

  categoria_nome?: string | null;

  lancamento_categoria_nome?: string | null;

  grupo_categoria?: string | null;

  fornecedor?: string | null;

  fornecedor_nome?: string | null;

  lancamento_fornecedor_nome?: string | null;

  tipo_caixa?: string | null;

  fluxo?: string | null;

  data_vencimento?: string | null;

  data_pagamento?: string | null;

  pago_por?: string | null;

  pago_diretamente?: number | boolean | null;

  reembolsavel?: number | boolean | null;

  reembolso_quitado?: number | boolean | null;

  observacoes?: string | null;

  valor_centavos?: number | null;

  aeronave?: string | null;

  numero_boleto?: string | null;

  email_enviado_em?: string | null;

  numero_voo?: string | null;

  numero_voo_exibicao?: string | null;

  url_demonstrativo?: string | null;

  url_nf?: string | null;

  url_recibo?: string | null;

  url_boleto?: string | null;

  url_doc?: string | null;

  comprovante_url?: string | null;

};

export type SolicitacaoPagamento = CamposLancamento & {

  id: string;

  tipo: string;

  descricao: string;

  valor: number;

  data_despesa: string | null;

  vencimento: string | null;

  status: string;

  criado_por: string | null;

  criado_em: string;

  fornecedor?: string | null;

  fornecedor_id?: string | null;

  fornecedor_nome?: string | null;

  solicitante_nome: string | null;

  cliente_razao_social?: string | null;

  cliente_nome?: string | null;

  razao_social?: string | null;

  socio_nome?: string | null;

  hold_socios_nome?: string | null;

  hold_socios?: { nome?: string | null } | null;

  holding_nome?: string | null;

  cotista_nome?: string | null;

  lancamento_id?: string | null;

  conta_a_pagar_id?: string | null;

  conta_a_pagar_status?: string | null;

};

export type ReembolsoColaborador = CamposLancamento & {

  id: string;

  dataEmissao?: string | null;

  dataVencimento: string;

  valor: number;

  descricao: string | null;

  categoriaNome?: string | null;

  aeronaveId: string | null;

  documento?: string | null;

  documentoUrl?: string | null;

  fornecedor?: string | null;

  numeroVoo?: string | null;

  cotistaNome?: string | null;

  fornecedorId: string | null;

  status: string;

  lancamentoId: string | null;

  solicitanteNome?: string | null;

  nome_completo?: string | null;

  user_profiles?: { nome_completo?: string | null } | null;

  tipoCaixa?: "SHARE" | "HOLDING" | string | null;

  holdingId?: string | null;

  movimentoHoldingId?: string | null;

};

export type MovimentoHoldingPendente = {

  id: string;

  holding_id: string | null;

  holding_nome: string | null;

  socio_id: string | null;

  socio_nome: string | null;

  aeronave_id: string | null;

  aeronave: string | null;

  data_emissao: string | null;

  data_vencimento: string | null;

  descricao: string;

  categoria_nome: string | null;

  valor_centavos: number;

  status: string;

  fornecedor_nome: string | null;

  rateado_centavos: number;

  pago_centavos: number;

};

export async function buscarSolicitacoesPagamento() {

  return financeiroRequest<{ envios: SolicitacaoPagamento[]; reembolsos: ReembolsoColaborador[] }>("/api/financeiro/solicitacoes-pagamento");

}

export async function buscarMovimentosHoldingPendentes() {

  const resposta = await financeiroRequest<{ movimentos?: MovimentoHoldingPendente[] }>("/api/financeiro/movimentos-holding/pendentes");

  return resposta.movimentos ?? [];

}

export function darBaixaMovimentoHolding(id: string, dados: { dataPagamento: string; contaBancariaId: string; formaPagamento?: string; comprovanteUrl?: string }) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/movimentos-holding/${encodeURIComponent(id)}/baixa`, {

    method: "POST",

    body: JSON.stringify({ data_pagamento: dados.dataPagamento, conta_bancaria_id: dados.contaBancariaId, forma_pagamento: dados.formaPagamento, comprovante_url: dados.comprovanteUrl }),

  });

}

export async function buscarContasBancariasHolding() {

  const resposta = await financeiroRequest<{ contas_bancarias?: ContaBancaria[] }>("/api/financeiro/share/opcoes?tipo_caixa=HOLDING");

  return resposta.contas_bancarias ?? [];

}

export async function buscarEnviosCompraShare() {

  const resposta = await financeiroRequest<{ envios?: SolicitacaoPagamento[] }>("/api/financeiro/envios-pagamento?tipo=share");

  return resposta.envios ?? [];

}

export function aprovarEnvioCompra(id: string) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/envios-pagamento/${encodeURIComponent(id)}/aprovar`, { method: "POST" });

}

export function converterEnvioCompra(id: string) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/envios-pagamento/${encodeURIComponent(id)}/converter`, { method: "POST" });

}

function normalizarOpcoesLancamento(payload: Partial<OpcoesLancamento> | null | undefined): OpcoesLancamento {

  return {

    categorias: Array.isArray(payload?.categorias) ? payload.categorias.map((categoria) => ({

      ...categoria,

      grupo: categoria.grupo ?? (categoria as CategoriaCaixaShare & { grupo_categoria?: string | null }).grupo_categoria ?? null,

      classificacao: categoria.classificacao ?? (categoria as CategoriaCaixaShare & { tipo_despesa?: string | null }).tipo_despesa ?? null,

      reembolsavel: categoria.reembolsavel ?? false,

    })) : [],

    contas_bancarias: Array.isArray(payload?.contas_bancarias) ? payload.contas_bancarias : [],

    cotistas: Array.isArray(payload?.cotistas) ? payload.cotistas : [],

    holdings: Array.isArray(payload?.holdings) ? payload.holdings : [],

    pagadores: Array.isArray(payload?.pagadores) ? payload.pagadores : [],

  };

}

function normalizarBalanco(payload: Partial<BalancoEconomico> | null | undefined): BalancoEconomico {

  return {

    lancamentos: Array.isArray(payload?.lancamentos) ? payload.lancamentos.map((item) => ({

      ...item,

      dataEmissao: item.dataEmissao ?? (item as LancamentoEconomico & { data_emissao?: string | null }).data_emissao ?? item.data,

      documentoNumero: item.documentoNumero ?? (item as LancamentoEconomico & { documento_numero?: string | null }).documento_numero ?? null,

      reembolsavel: flagFinanceira(item.reembolsavel),

      reembolsoQuitado: flagFinanceira(item.reembolsoQuitado),

      rateios: Array.isArray(item.rateios) ? item.rateios : [],

    })) : [],

    movimentos_holding: Array.isArray(payload?.movimentos_holding) ? payload.movimentos_holding : [],

    saldos: Array.isArray(payload?.saldos) ? payload.saldos : [],

    matrizCompensacao: payload?.matrizCompensacao && typeof payload.matrizCompensacao === "object" ? payload.matrizCompensacao : {},

    holdings: Array.isArray(payload?.holdings) ? payload.holdings.map((holding) => ({ ...holding, saldoContaCentavos: Number(holding.saldoContaCentavos ?? 0), socios: Array.isArray(holding.socios) ? holding.socios : [] })) : [],

  };

}

function normalizarMediasCotista(medias: Partial<MediasCotista> | null | undefined): MediasCotista {

  return {

    horas_voadas: Number(medias?.horas_voadas ?? 0),

    total_voos: Number(medias?.total_voos ?? 0),

    total_pousos: Number(medias?.total_pousos ?? 0),

    custo_por_hora_centavos: Number(medias?.custo_por_hora_centavos ?? 0),

    dia_mais_utilizado: medias?.dia_mais_utilizado ? String(medias.dia_mais_utilizado) : null,

    media_mensal_horas: Number(medias?.media_mensal_horas ?? 0),

    custo_medio_por_voo_centavos: Number(medias?.custo_medio_por_voo_centavos ?? 0),

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

export type VooEmprestimo = {

  id: string;

  numero_voo: string | null;

  data: string | null;

  trecho: string | null;

  local: string | null;

  local_icao: string | null;

  litros: number | null;

  valor_total: number | null;

  status: string | null;

  numero_comanda: string | null;

  numero_nf: string | null;

  aeronave_id: string;

  matricula_registro: string | null;

  fabricante: string | null;

  modelo: string | null;

};

export type EmprestimoAeronave = {
  id: string;
  numero_voo: string | null;
  data: string | null;
  trecho: string | null;
  local: string | null;
  local_icao: string | null;
  litros: number | null;
  valor_total: number | null;
  numero_comanda: string | null;
  numero_nf: string | null;
  aeronave_id: string;
  matricula_registro: string | null;
  lancamento_id: string | null;
  status_abastecimento: string | null;
  status_lancamento: string | null;
  status_reembolso: string | null;
  tomador_nome: string | null;
  emprestador_nome: string | null;
  emprestador_cliente_id: string | null;
  emprestador_socio_id: string | null;
};

export async function buscarVoosEmprestimos(cotistaId: string, tipo: "cliente" | "socio", aeronaveAtualId?: string, inicio?: string, fim?: string, meses?: string[]) {

  const query = paraQueryString({ cotista_id: cotistaId, tipo, excluir_aeronave_id: aeronaveAtualId, inicio, fim, meses: meses ? (meses.length ? meses.join(",") : "__nenhum__") : undefined });

  const payload = await financeiroRequest<{ voos_emprestimos?: VooEmprestimo[] }>(`/api/financeiro/cotista/voos-emprestimos${query}`);

  return Array.isArray(payload.voos_emprestimos) ? payload.voos_emprestimos : [];

}

export async function buscarDashboardCotista(inicio?: string, fim?: string, aeronaveId?: string, cotistaId?: string, meses?: string[]) {

  const parametros = new URLSearchParams();

  if (inicio) parametros.set("inicio", inicio);

  if (fim) parametros.set("fim", fim);

  if (aeronaveId) parametros.set("aeronave_id", aeronaveId);

  if (cotistaId) parametros.set("cotista_id", cotistaId);

  if (meses) parametros.set("meses", meses.length ? meses.join(",") : "__nenhum__");

  const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";

  const payload = await financeiroRequest<Partial<DashboardCotista>>(`/api/financeiro/cotista/dashboard${sufixo}`);

  return {

    ...normalizarBalanco(payload),
    // A normalização legada seleciona os campos; preserve as extensões do balanço.
    balanco_fontes: payload.balanco_fontes ?? null,
    balanco_detalhado_erro: payload.balanco_detalhado_erro ?? null,
    balanco_operacional: payload.balanco_operacional ?? null,
    balanco_escopo: payload.balanco_escopo,
    emprestimos_aeronave: Array.isArray(payload.emprestimos_aeronave) ? payload.emprestimos_aeronave : [],

    medias: normalizarMediasCotista(payload.medias),

    medias_mensais: Array.isArray(payload.medias_mensais)

      ? payload.medias_mensais.map((item) => ({ mes: String(item.mes ?? ''), ...normalizarMediasCotista(item) })).filter((item) => /^\d{4}-\d{2}$/.test(item.mes))

      : [],

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

  const fluxo = String(dados.fluxo || "SAIDA").toUpperCase() === "ENTRADA" ? "ENTRADA" : "SAIDA";

  const contrato: Record<string, unknown> = { ...dados, fluxo };

  contrato.grupo_categoria ??= dados.grupoCategoria;

  contrato.pago_por ??= dados.pagoPor;

  const caixa = String(dados.tipo_caixa ?? dados.caixa ?? "").toUpperCase();

  if (caixa) contrato.tipo_caixa = caixa === "COTISTA" ? "CLIENTE" : caixa;

  delete contrato.grupoCategoria;

  delete contrato.pagoPor;

  delete contrato.caixa;

  delete contrato.status;

  if (Array.isArray(dados.rateios)) {

    contrato.rateios = dados.rateios.map((linha) => {

      if (!linha || typeof linha !== "object") return linha;

      const item = linha as Record<string, unknown>;

      const { cotista, cotistaAeronaveId, pagoPor, ...campos } = item;

      return {

        ...campos,

        cotista_id: item.cotista_id ?? cotista ?? cotistaAeronaveId,

        pago_por: item.pago_por ?? pagoPor,

      };

    });

  }

  return (await financeiroRequest(`/api/financeiro/lancamentos/${fluxo === "ENTRADA" ? "receita" : "despesa"}`, {

    method: "POST",

    body: JSON.stringify(contrato),

  })) as { id: string };

}

export function parseValorReais(valor: string): number {

  return parseReaisToCentavos(valor);

}

export function formatarMoeda(valor: number | null | undefined) {

  return formatReais(valor);

}

export function formatarCentavos(valorCentavos: number | null | undefined) {

  return formatCentavos(valorCentavos);

}

export function formatarData(valor: string | null | undefined) {

  if (!valor) return "—";

  const data = valor.slice(0, 10).split("-");

  if (data.length !== 3) return valor;

  return `${data[2]}/${data[1]}/${data[0]}`;

}

export type DashboardShare = {

  live?: boolean;

  kpis: Array<{ label: string; value: string; delta: string; helper: string; tone?: string }>;

  cashFlow: Array<{ mes: string; entradas: number; saidas: number; saldo: number }>;

  categories: Array<{ name: string; value: number; fill: string }>;

  payables: unknown[];

  receivables: unknown[];

  reimbursements: unknown[];

  salaries: unknown[];

};

export type DashboardCotistaRequest = { periodo?: string; visao?: string; cotista?: string; aeronave?: string };

export function buscarDashboardShare(periodo?: string, aeronave?: string): Promise<DashboardShare> {

  const query = paraQueryString({ periodo, aeronave });

  return financeiroRequest<DashboardShare>(`/api/financeiro/share${query}`);

}

export async function buscarDashboardCotistaReal(filtros: DashboardCotistaRequest = {}) {

  const query = paraQueryString({ inicio: filtros.periodo?.match(/^\d{4}-\d{2}$/) ? `${filtros.periodo}-01` : undefined, aeronave_id: filtros.aeronave && filtros.aeronave !== "Todas as aeronaves" ? filtros.aeronave : undefined, cotista_id: filtros.cotista && filtros.cotista !== "Todos os cotistas" ? filtros.cotista : undefined });

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/cotista/dashboard${query}`);

}

export const getShareFinance = buscarDashboardShare;

export const getCotistaFinance = (periodo: string, visao: string, cotista: string, aeronave: string) => financeiroRequest<Record<string, unknown>>(`/api/financeiro/cotista${paraQueryString({ periodo, visao, cotista, aeronave })}`);

export function editarLancamento(id: string, dados: Record<string, unknown>) {

  return financeiroRequest<Lancamento>(`/api/financeiro/lancamentos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(dados) });

}

export function darBaixaLancamento(id: string, dados: { dataPagamento?: string; valorPagoRealCentavos?: number; pagoPor?: string | null } = {}) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/lancamentos/${encodeURIComponent(id)}/baixa`, {

    method: "POST",

    body: JSON.stringify({ data_pagamento: dados.dataPagamento, valor_pago_real_centavos: dados.valorPagoRealCentavos, pago_por: dados.pagoPor }),

  });

}

export function excluirLancamento(id: string) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/lancamentos/${encodeURIComponent(id)}`, { method: "DELETE" });

}

export function alterarStatusLancamento(id: string, status: "PAGO" | "RECEBIDO" | "CANCELADO") {

  return status === "CANCELADO" ? excluirLancamento(id) : darBaixaLancamento(id, { dataPagamento: new Date().toISOString().slice(0, 10) });

}

export function duplicarLancamento(id: string, dados: Record<string, unknown> = {}) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/lancamentos/${encodeURIComponent(id)}/duplicar`, { method: "POST", body: JSON.stringify(dados) });

}

export function agendarContaAPagar(id: string, dados: { observacoes?: string } = {}) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/contas-apagar/${encodeURIComponent(id)}/agendar`, { method: "POST", body: JSON.stringify(dados) });

}

export function anexarDocumentoLancamento(id: string, dados: { nome: string; url: string; tipo?: string; numero?: string }) {

  return financeiroRequest<Record<string, unknown>>(`/api/financeiro/lancamentos/${encodeURIComponent(id)}/anexos`, { method: "POST", body: JSON.stringify(dados) });

}

export function gerarReembolso(dados: Record<string, unknown>) {

  return financeiroRequest<Record<string, unknown>>("/api/financeiro/reembolsos", { method: "POST", body: JSON.stringify(dados) });

}

export type ResumoSalarios = { disponivel: boolean; folha: Record<string, unknown> | null; itens: Array<Record<string, unknown>>; resumo: { folha_mes: number; salarios_pagos: number; salarios_pendentes: number; beneficios: number; encargos: number; impostos: number; total_folha: number } };

export function buscarResumoSalarios() { return financeiroRequest<ResumoSalarios>("/api/financeiro/salarios/resumo"); }


/** Modelo de resposta do livro financeiro canônico (API /lancamentos-unificados). */
export type LancamentoUnificadoApi = {
  id: string;
  fluxo: "ENTRADA" | "SAIDA";
  caixa: "SHARE" | "CLIENTE";
  natureza?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  categoria_id?: string | null;
  favorecido?: string | null;
  conta_bancaria_id?: string | null;
  conta_bancaria_nome?: string | null;
  data_lancamento?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: string | null;
  situacao?: string | null;
  valor?: number | null;
  valor_centavos?: number | null;
  reembolsavel?: boolean | number | null;
  cotista_id?: string | null;
  origem_tipo?: string | null;
  origem_id?: string | null;
  lancamento_id?: string | null;
  numero_documento?: string | null;
  comprovante_url?: string | null;
  nf_url?: string | null;
  boleto_url?: string | null;
  criado_em?: string | null;
  [key: string]: unknown;
};

const LANCAMENTOS_UNIFICADOS_URL = "/api/financeiro/lancamentos-unificados";

export async function buscarLancamentosUnificados(): Promise<LancamentoUnificadoApi[]> {
  const paginaLimite = 200;
  const primeiras = await financeiroRequest<{ lancamentos?: LancamentoUnificadoApi[]; total?: number }>(`${LANCAMENTOS_UNIFICADOS_URL}?pagina=1&limite=${paginaLimite}`);
  const linhas = primeiras.lancamentos ?? [];
  const total = Number(primeiras.total ?? linhas.length);
  const paginas = Math.ceil(total / paginaLimite);
  if (paginas < 2) return linhas;
  const demais = await Promise.all(Array.from({ length: paginas - 1 }, (_, index) =>
    financeiroRequest<{ lancamentos?: LancamentoUnificadoApi[] }>(`${LANCAMENTOS_UNIFICADOS_URL}?pagina=${index + 2}&limite=${paginaLimite}`),
  ));
  return [...linhas, ...demais.flatMap((pagina) => pagina.lancamentos ?? [])];
}

export type NovoLancamentoUnificadoPayload = {
  fluxo: "ENTRADA" | "SAIDA";
  caixa: "SHARE" | "CLIENTE";
  natureza?: string;
  descricao: string;
  categoria_id?: string | null;
  categoria?: string | null;
  favorecido?: string | null;
  valor_centavos: number;
  data_lancamento?: string | null;
  data_vencimento?: string | null;
  cotista_id?: string | null;
  reembolsavel?: boolean;
  numero_documento?: string | null;
  observacoes?: string | null;
  conta_bancaria_id?: string | null;
  [key: string]: unknown;
};

export function criarLancamentoUnificado(payload: NovoLancamentoUnificadoPayload) {
  return financeiroRequest<{ id?: string; lancamento_id?: string; lancamento_unificado?: LancamentoUnificadoApi }>(LANCAMENTOS_UNIFICADOS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelarLancamentoUnificado(id: string) {
  return financeiroRequest<LancamentoUnificadoApi>(`${LANCAMENTOS_UNIFICADOS_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
