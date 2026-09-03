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
import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_URL as string;

async function requisitar<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(opcoes?.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...opcoes,
    headers,
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new Error(
      `Falha ao chamar ${caminho} (status ${resposta.status}): ${corpo || resposta.statusText}`
    );
  }

  return resposta.json() as Promise<T>;
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

export function buscarCaixaEmpresa(filtros: FiltrosCaixaEmpresa = {}): Promise<Lancamento[]> {
  const query = paraQueryString({
    caixa: 'SHARE',
    competencia: filtros.competencia,
    fluxo: filtros.fluxo,
    status: filtros.status,
    categoriaId: filtros.categoriaId,
  });
  return requisitar<Lancamento[] | { lancamentos?: Lancamento[] }>(`/api/lancamentos${query}`)
    .then((resposta) => Array.isArray(resposta) ? resposta : resposta.lancamentos ?? []);
}

export function criarLancamentoShare(
  lancamento: Omit<Lancamento, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<Lancamento> {
  return requisitar<Lancamento>('/api/lancamentos', {
    method: 'POST',
    body: JSON.stringify(lancamento),
  });
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
  return requisitar<ContaAPagar>(`/api/contas-apagar/${id}/dar-baixa`, {
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
export function darBaixaContaAReceber(
  id: string,
  dados: { dataRecebimento: string; bancoRecebimento: string; comprovanteRecebimentoUrl?: string }
): Promise<ContaAReceber> {
  return requisitar<ContaAReceber>(`/api/contas-areceber/${id}/dar-baixa`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

// ---------- Catálogos (fornecedores e categorias) ----------

export function buscarFornecedoresFavoritos(): Promise<FornecedorFavorito[]> {
  return requisitar<FornecedorFavorito[]>('/api/fornecedores-favoritos');
}

export function buscarCategoriasShare(): Promise<CategoriaMovimentacaoShare[]> {
  return requisitar<CategoriaMovimentacaoShare[]>('/api/categorias-movimentacao-share');
}
