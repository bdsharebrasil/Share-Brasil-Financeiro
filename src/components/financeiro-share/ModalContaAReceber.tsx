import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContaAReceber } from './tipos';

type TipoPagador = 'COTISTA' | 'SHARE' | 'HOLDING';
type RateioInput = { rateio_id: string; valor_centavos: number };

type PagamentoForm = {
  id: string;
  idempotency_key: string;
  tipo_pagador: TipoPagador;
  pagadorId: string;
  valor: string;
  data_pagamento: string;
  conta_bancaria_id: string;
  forma_pagamento: string;
  comprovante_url: string;
  rateios: Record<string, string>;
};

export type DadosBaixaReceber = {
  dataRecebimento?: string;
  bancoRecebimento?: string;
  formaPagamento?: string;
  comprovanteRecebimentoUrl?: string;
  pagamentos: Array<{
    idempotency_key: string;
    data_pagamento: string;
    conta_bancaria_id: string;
    comprovante_url?: string | null;
    forma_pagamento?: string | null;
    tipo_pagador: TipoPagador;
    pagador_cotista_id?: string;
    pagador_holding_id?: string;
    valor_centavos: number;
    rateios: RateioInput[];
  }>;
};

interface ModalContaAReceberProps {
  conta: ContaAReceber;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: DadosBaixaReceber) => Promise<void>;
}

const cents = (value: string) => Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100);
const money = (value: number) => (value / 100).toFixed(2).replace('.', ',');

export function ModalContaAReceber({ conta, aberto, onFechar, onConfirmar }: ModalContaAReceberProps) {
  const hoje = new Date().toISOString().slice(0, 10);
  const rateios = conta.rateios ?? [];
  const esperado = Number(conta.valor || 0) * 100;
  const recebido = rateios.reduce((sum, r) => sum + Number(r.valor_pago_real_centavos || 0), 0);
  const saldo = Math.max(0, esperado - recebido);
  const novoPagamento = (): PagamentoForm => ({
    id: crypto.randomUUID(), idempotency_key: `recebimento-${conta.id}-${crypto.randomUUID()}`,
    tipo_pagador: 'COTISTA', pagadorId: conta.cotistaId ?? '', valor: money(saldo || esperado),
    data_pagamento: hoje, conta_bancaria_id: '', forma_pagamento: 'PIX', comprovante_url: '',
    rateios: Object.fromEntries(rateios.map((r) => [r.id, money(Math.max(0, Number(r.valor_rateado_centavos) - Number(r.valor_pago_real_centavos || 0)))])),
  });
  const [pagamentos, setPagamentos] = useState<PagamentoForm[]>(() => [novoPagamento()]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const totalInformado = useMemo(() => pagamentos.reduce((sum, p) => sum + cents(p.valor), 0), [pagamentos]);
  const quitadoPorRateio = useMemo(() => Object.fromEntries(rateios.map((rateio) => [
    rateio.id,
    Number(rateio.valor_pago_real_centavos || 0) + pagamentos.reduce((sum, pagamento) => sum + cents(pagamento.rateios[rateio.id] ?? '0'), 0),
  ])), [pagamentos, rateios]);

  function atualizar(id: string, patch: Partial<PagamentoForm>) {
    setPagamentos((current) => current.map((p) => p.id === id ? { ...p, ...patch } : p));
  }
  function atualizarRateio(id: string, rateioId: string, value: string) {
    setPagamentos((current) => current.map((p) => p.id === id ? { ...p, rateios: { ...p.rateios, [rateioId]: value } } : p));
  }
  function adicionarPagamento() { setPagamentos((current) => [...current, novoPagamento()]); }

  async function confirmar() {
    const payload: DadosBaixaReceber['pagamentos'] = [];
    for (const pagamento of pagamentos) {
      const valorCentavos = cents(pagamento.valor);
      const distribuicao = rateios.map((r) => ({ rateio_id: r.id, valor_centavos: cents(pagamento.rateios[r.id] ?? '0') })).filter((r) => r.valor_centavos > 0);
      if (!pagamento.conta_bancaria_id.trim() || valorCentavos <= 0 || !pagamento.data_pagamento || (rateios.length > 0 && !distribuicao.length)) {
        setErro('Cada pagamento precisa de data, conta bancária, valor positivo e, quando disponível, ao menos um rateio.'); return;
      }
      if ((pagamento.tipo_pagador === 'COTISTA' || pagamento.tipo_pagador === 'HOLDING') && !pagamento.pagadorId.trim()) {
        setErro('Informe o identificador de cada pagador real.'); return;
      }
      if (rateios.length > 0 && distribuicao.reduce((sum, r) => sum + r.valor_centavos, 0) !== valorCentavos) {
        setErro('O valor de cada pagamento deve ser exatamente igual à soma dos seus rateios.'); return;
      }
      payload.push({ idempotency_key: pagamento.idempotency_key, data_pagamento: pagamento.data_pagamento, conta_bancaria_id: pagamento.conta_bancaria_id, comprovante_url: pagamento.comprovante_url || null, forma_pagamento: pagamento.forma_pagamento || null, tipo_pagador: pagamento.tipo_pagador, ...(pagamento.tipo_pagador === 'COTISTA' ? { pagador_cotista_id: pagamento.pagadorId } : {}), ...(pagamento.tipo_pagador === 'HOLDING' ? { pagador_holding_id: pagamento.pagadorId } : {}), valor_centavos: valorCentavos, rateios: distribuicao });
    }
    if (totalInformado > saldo) { setErro('A soma dos novos pagamentos não pode exceder o saldo restante da conta.'); return; }
    setEnviando(true); setErro(null);
    try {
      const primeiro = payload[0];
      await onConfirmar({
        dataRecebimento: primeiro?.data_pagamento,
        bancoRecebimento: primeiro?.conta_bancaria_id,
        formaPagamento: primeiro?.forma_pagamento ?? undefined,
        comprovanteRecebimentoUrl: primeiro?.comprovante_url ?? undefined,
        pagamentos: payload,
      });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao dar baixa na conta.'); } finally { setEnviando(false); }
  }

  return <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Receber conta — {conta.descricao ?? conta.categoriaNome ?? 'Conta a receber'}</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Saldo total da conta</span><strong className="block">R$ {money(esperado)}</strong></div><div><span className="text-muted-foreground">Saldo já recebido</span><strong className="block">R$ {money(recebido)}</strong></div><div><span className="text-muted-foreground">Saldo restante</span><strong className="block">R$ {money(saldo)}</strong></div></div>
        {pagamentos.map((p, index) => <section key={p.id} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Pagamento {index + 1}</h3>{pagamentos.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setPagamentos((all) => all.filter((item) => item.id !== p.id))}>Remover</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label>Pagador real</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.tipo_pagador} onChange={(e) => atualizar(p.id, { tipo_pagador: e.target.value as TipoPagador })}><option value="COTISTA">Cotista</option><option value="SHARE">Share</option><option value="HOLDING">Holding</option></select></div><div className="space-y-1"><Label>{p.tipo_pagador === 'SHARE' ? 'Pagador' : 'ID do pagador real'}</Label><Input value={p.pagadorId} disabled={p.tipo_pagador === 'SHARE'} onChange={(e) => atualizar(p.id, { pagadorId: e.target.value })} placeholder={p.tipo_pagador === 'SHARE' ? 'Share Brasil' : 'ID real'} /></div><div className="space-y-1"><Label>Valor deste pagamento (R$)</Label><Input value={p.valor} onChange={(e) => atualizar(p.id, { valor: e.target.value })} /></div></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label>Data do pagamento</Label><Input type="date" value={p.data_pagamento} onChange={(e) => atualizar(p.id, { data_pagamento: e.target.value })} /></div><div className="space-y-1"><Label>Conta bancária</Label><Input value={p.conta_bancaria_id} onChange={(e) => atualizar(p.id, { conta_bancaria_id: e.target.value })} placeholder="ID ou nome da conta" /></div><div className="space-y-1"><Label>Forma de pagamento</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.forma_pagamento} onChange={(e) => atualizar(p.id, { forma_pagamento: e.target.value })}><option>PIX</option><option>Transferência</option><option>Boleto</option><option>Dinheiro</option><option>Cartão</option></select></div></div>
          <div className="space-y-2"><Label>Rateios esperados e valor quitado por rateio</Label>{rateios.length ? rateios.map((r) => <div key={r.id} className="grid gap-2 rounded border p-2 text-sm sm:grid-cols-[1fr_140px_140px]"><span>Rateio {r.id.slice(0, 8)}{r.cotista_id ? ` · ${r.cotista_id}` : ''}<small className="block text-muted-foreground">Esperado: R$ {money(Number(r.valor_rateado_centavos))} · já quitado: R$ {money(Number(r.valor_pago_real_centavos || 0))}</small></span><span className="self-center text-muted-foreground">Nesta baixa: R$ {money(cents(p.rateios[r.id] ?? '0'))}</span><Input value={p.rateios[r.id] ?? '0,00'} onChange={(e) => atualizarRateio(p.id, r.id, e.target.value)} aria-label={`Valor no rateio ${r.id}`} /></div>) : <p className="text-sm text-muted-foreground">O rateio será criado automaticamente ao confirmar esta baixa.</p>}</div>
          <p className="text-right text-xs text-muted-foreground">Total deste pagamento: <strong>R$ {money(cents(p.valor))}</strong> · rateios: <strong>R$ {money(rateios.reduce((sum, r) => sum + cents(p.rateios[r.id] ?? '0'), 0))}</strong></p>
          <div className="space-y-1"><Label>Comprovante (URL, opcional)</Label><Input value={p.comprovante_url} onChange={(e) => atualizar(p.id, { comprovante_url: e.target.value })} placeholder="https://…" /></div>
        </section>)}
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"><p>Quitado por rateio após esta baixa:</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{rateios.map((r) => <span key={r.id}>Rateio {r.id.slice(0, 8)}: <strong>R$ {money(quitadoPorRateio[r.id] ?? 0)}</strong> / R$ {money(Number(r.valor_rateado_centavos))}</span>)}</div></div>
        <Button type="button" variant="outline" onClick={adicionarPagamento}>Adicionar outro pagamento</Button>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onFechar} disabled={enviando}>Cancelar</Button><Button onClick={confirmar} disabled={enviando}>{enviando ? 'Confirmando…' : 'Confirmar recebimentos'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
