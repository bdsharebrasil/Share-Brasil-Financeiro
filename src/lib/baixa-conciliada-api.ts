import { API_BASE } from './api';
import { supabase } from './supabase';
export interface RateioBaixa { id: string; cotista_id?: string; socio_id?: string; valor_rateado_centavos: number; valor_pago_real_centavos: number; status: string }
export interface ContextoBaixa { natureza: 'RECEBIMENTO_SHARE' | 'PAGAMENTO_DIRETO'; conta_id: string | null; cotista_id: string | null; lancamento: { descricao: string; aeronave_id: string }; rateios: RateioBaixa[] }
export interface PagamentoConciliado { idempotency_key: string; tipo_pagador: 'COTISTA' | 'HOLDING'; pagador_cotista_id?: string; pagador_holding_id?: string; valor_centavos: number; data_pagamento: string; conta_bancaria_id?: string | null; forma_pagamento: string; comprovante_url?: string | null; observacoes?: string; rateios: {rateio_id: string; valor_centavos: number}[] }
async function request<T>(path: string, body?: unknown): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Sessão expirada. Entre novamente.');
  const headers: Record<string,string> = {Authorization: `Bearer ${session.access_token}`};
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key) headers.apikey = key;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', credentials: 'omit' });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Não foi possível concluir a operação.');
  return result as T;
}
export const buscarContextoBaixa = (id: string) => request<ContextoBaixa>(`/api/financeiro/lancamentos/${encodeURIComponent(id)}/contexto-baixa`);
export const confirmarBaixaConciliada = (id: string, pagamento: PagamentoConciliado) => request(`/api/financeiro/lancamentos/${encodeURIComponent(id)}/baixa-conciliada`, { pagamentos: [pagamento] });
export function avisarAtualizacaoFinanceiro() {
  window.dispatchEvent(new Event('financeiro-atualizado'));
  try { localStorage.setItem('financeiro-atualizado', `${Date.now()}-${crypto.randomUUID()}`); } catch { /* Same-tab refresh still works. */ }
}
