// Camada de acesso à API do Worker Hono (backend-share) usada pelo módulo
// Financeiro Share. Centraliza a URL base e o tratamento de erro — os
// ganchos (hooks) de cada aba chamam só as funções daqui, nunca `fetch`
// diretamente.
//
// AJUSTE NECESSÁRIO: troque `BASE_URL` pela env var real do projeto
// (ex.: import.meta.env.VITE_API_URL) se o nome for diferente.

import type {
  CategoriaMovimentacaoShare,
  ContaAPagar,
  ContaAReceber,
  FiltrosCaixaEmpresa,
  FiltrosContasAPagar,
  FiltrosContasAReceber,
  FornecedorFavorito,
  Lancamento,
} from '../components/financeiro-share/tipos';
import { API_BASE } from './api';
import { supabase } from './supabase';

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error('sessao_expirada');
  if (!session?.access_token) throw new Error('sessao_nao_encontrada');
  const headers = new Headers(opcoes.headers);
  if (opcoes.body && !headers.has('Content-Type') && !(opcoes.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const resposta = await fetch(`${API_BASE}${caminho}`, { ...opcoes, headers, credentials: 'omit' });
  const corpo = await resposta.json().catch(() => null) as { error?: string } | null;
  if (!resposta.ok) throw new Error(corpo?.error || `api_${resposta.status}`);
  return corpo as T;
}

function paraQueryString(filtros: Record<string, string | undefined>): string {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor) parametros.set(chave, valor);
  });
  const query = parametros.toString();
  return query ? `?${query}` : '';
}

// ---------- Caixa da empresa (lancamentos, caixa='SHARE') ----------

function normalizarLancamento(row: any): Lancamento {
  return {
    id: String(row.id ?? ''), aeronaveId: row.aeronaveId ?? row.aeronave_id ?? null,
    data: String(row.data ?? row.data_emissao ?? row.criado_em ?? '').slice(0, 10),
    descricao: String(row.descricao ?? ''), documento: row.documento ?? row.numero_doc ?? null,
    fornecedor: row.fornecedor ?? row.fornecedor_nome ?? null, fornecedorId: row.fornecedorId ?? row.fornecedor_id ?? null,
    categoria: String(row.categoria ?? row.categoria_nome ?? 'SEM CATEGORIA'), categoriaId: row.categoriaId ?? row.categoria_id ?? null,
    grupoCategoria: String(row.grupoCategoria ?? row.grupo_categoria ?? ''), tipo: row.tipo ?? row.tipo_despesa ?? null,
    prazo: row.prazo ?? row.data_vencimento ?? null, fluxo: String(row.fluxo ?? 'SAIDA').toUpperCase() === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
    valorCentavos: Number(row.valorCentavos ?? Math.round(Number(row.valor_total ?? row.valor ?? 0) * 100)),
    pagoPor: String(row.pagoPor ?? row.pago_por ?? ''), caixa: String(row.caixa ?? row.tipo_caixa ?? 'SHARE').toUpperCase() === 'CLIENTE' ? 'CLIENTE' : 'SHARE',
    pagoDiretamente: Boolean(row.pagoDiretamente ?? row.pago_diretamente), reembolsavel: Boolean(row.reembolsavel),
    reembolsoQuitado: Boolean(row.reembolsoQuitado ?? row.reembolso_quitado), status: String(row.status ?? 'PENDENTE').toUpperCase() as Lancamento['status'],
    observacoes: row.observacoes ?? null, criadoPor: row.criadoPor ?? row.criado_por ?? null,
    criadoEm: String(row.criadoEm ?? row.criado_em ?? ''), atualizadoEm: String(row.atualizadoEm ?? row.atualizado_em ?? ''),
  };
}

function periodoCompetencia(competencia?: string) {
  if (!competencia) return { inicio: undefined, fim: undefined };
  const [ano, mes] = competencia.split('-').map(Number);
  if (!ano || !mes) return { inicio: undefined, fim: undefined };
  return { inicio: `${competencia}-01`, fim: new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10) };
}

export async function buscarCaixaEmpresa(filtros: FiltrosCaixaEmpresa = {}): Promise<Lancamento[]> {
  const periodo = periodoCompetencia(filtros.competencia);
  const resposta = await requisitar<{ lancamentos?: unknown[] }>(`/api/lancamentos${paraQueryString({ caixa: 'SHARE', inicio: periodo.inicio, fim: periodo.fim })}`);
  return (resposta.lancamentos ?? []).map(normalizarLancamento).filter((item) =>
    (!filtros.fluxo || item.fluxo === filtros.fluxo) && (!filtros.status || item.status === filtros.status) && (!filtros.categoriaId || item.categoriaId === filtros.categoriaId));
}

export async function criarLancamentoShare(lancamento: Omit<Lancamento, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Lancamento> {
  const payload = {
    descricao: lancamento.descricao, fluxo: lancamento.fluxo, categoria: lancamento.categoria, categoria_id: lancamento.categoriaId,
    categoria_nome: lancamento.categoria, grupo_categoria: lancamento.grupoCategoria, valorCentavos: lancamento.valorCentavos,
    data: lancamento.data, data_vencimento: lancamento.prazo, aeronave_id: lancamento.aeronaveId,
    fornecedor: lancamento.fornecedor, fornecedor_id: lancamento.fornecedorId, documento: lancamento.documento,
    pago_por: lancamento.pagoPor, tipo_caixa: lancamento.caixa, pago_diretamente: lancamento.pagoDiretamente,
    observacoes: lancamento.observacoes, idempotencyKey: `ui:${lancamento.data}:${lancamento.descricao}:${lancamento.valorCentavos}`,
  };
  const resposta = await requisitar<{ lancamento: unknown }>('/api/lancamentos', { method: 'POST', body: JSON.stringify(payload) });
  return normalizarLancamento(resposta.lancamento);
}

// ---------- Contas a pagar ----------

export function buscarContasAPagar(filtros: FiltrosContasAPagar = {}): Promise<ContaAPagar[]> {
  const query = paraQueryString({
    status: filtros.status,
    vencidasAte: filtros.vencidasAte,
    fornecedorId: filtros.fornecedorId,
  });
  return requisitar<ContaAPagar[]>(`/api/contas-apagar${query}`);
}

/**
 * Dá baixa numa conta a pagar: marca como PAGO e cria o `lancamento`
 * (SAIDA, caixa='SHARE') correspondente, gravando `lancamentoId` de volta —
 * mesma regra que evita o bug de "conta virtual" já corrigido no Supabase.
 */
export function darBaixaContaAPagar(
  id: string,
  dados: { dataPagamento: string; bancoPagamento: string; comprovantePagamentoUrl?: string }
): Promise<ContaAPagar> {
  return requisitar<ContaAPagar>(`/api/contas-apagar/${encodeURIComponent(id)}/dar-baixa`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

// ---------- Contas a receber ----------

export function buscarContasAReceber(filtros: FiltrosContasAReceber = {}): Promise<ContaAReceber[]> {
  const query = paraQueryString({
    status: filtros.status,
    vencidasAte: filtros.vencidasAte,
    cotistaId: filtros.cotistaId,
  });
  return requisitar<ContaAReceber[]>(`/api/contas-areceber${query}`);
}

/**
 * Dá baixa numa conta a receber: marca como PAGO (recebido) e cria o
 * `lancamento` (ENTRADA, caixa='SHARE') correspondente, gravando
 * `lancamentoId` de volta na própria conta a receber — para não repetir o
 * bug de "conta virtual sem correspondência" já corrigido no Supabase
 * (ContasReceber.tsx).
 */
export async function darBaixaContaAReceber(
  id: string,
  dados: { dataRecebimento: string; bancoRecebimento: string; comprovanteRecebimentoUrl?: string }
): Promise<ContaAReceber> {
  const conta = await requisitar<ContaAReceber>(`/api/contas-areceber/${encodeURIComponent(id)}/dar-baixa`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  return { ...conta, status: conta.status === 'RECEBIDO' ? 'PAGO' : conta.status };
}

// ---------- Catálogos (fornecedores e categorias) ----------

export function buscarFornecedoresFavoritos(): Promise<FornecedorFavorito[]> {
  return requisitar<FornecedorFavorito[]>('/api/fornecedores-favoritos');
}

export async function buscarCategoriasShare(): Promise<CategoriaMovimentacaoShare[]> {
  const resposta = await requisitar<{ categorias?: any[] }>('/api/lancamentos/opcoes');
  return (resposta.categorias ?? []).map((categoria) => ({
    id: String(categoria.id), nome: String(categoria.nome ?? categoria.descricao ?? ''), tipo: categoria.tipo ?? null,
    reembolsavel: Boolean(categoria.reembolsavel), grupoCategoria: categoria.grupoCategoria ?? categoria.grupo ?? null,
    tipoDespesa: categoria.tipoDespesa ?? categoria.classificacao ?? null, categoriaClienteId: categoria.categoriaClienteId ?? null,
  }));
}
