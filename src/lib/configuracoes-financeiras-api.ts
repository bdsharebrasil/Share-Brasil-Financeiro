import { API_BASE } from './api';
import { supabase } from './supabase';

export type ConfiguracoesFinanceiras = {
  fornecedores: any[];
  contas_bancarias: any[];
  categorias_share: any[];
  categorias_cliente: any[];
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('sessao_nao_encontrada');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'omit' });
  const payload = await response.json().catch(() => null) as { error?: string; item?: T } | T | null;
  if (!response.ok) throw new Error((payload as { error?: string } | null)?.error || `api_${response.status}`);
  return payload as T;
}

export function buscarConfiguracoesFinanceiras() { return request<ConfiguracoesFinanceiras>('/api/financeiro/configuracoes'); }
export function salvarConfiguracao(tipo: string, dados: Record<string, unknown>) { return request<{ item: any }>(`/api/financeiro/configuracoes/${tipo}`, { method: 'POST', body: JSON.stringify(dados) }); }
export function excluirConfiguracao(tipo: string, id: string) { return request<{ ok: boolean }>(`/api/financeiro/configuracoes/${tipo}/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
