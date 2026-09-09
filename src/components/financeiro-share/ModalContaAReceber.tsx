import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContaAReceber } from './tipos';

export type DadosBaixaReceber = {
  dataRecebimento: string;
  bancoRecebimento: string;
  formaPagamento: string;
  comprovanteRecebimentoUrl?: string;
  pagamentos: Array<{
    tipo_pagador: 'COTISTA' | 'SHARE' | 'HOLDING';
    pagador_cotista_id?: string;
    pagador_holding_id?: string;
    valor_centavos: number;
    rateios: Array<{ rateio_id: string; valor_centavos: number }>;
  }>;
};

interface ModalContaAReceberProps {
  conta: ContaAReceber;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: DadosBaixaReceber) => Promise<void>;
}

export function ModalContaAReceber({ conta, aberto, onFechar, onConfirmar }: ModalContaAReceberProps) {
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().slice(0, 10));
  const [bancoRecebimento, setBancoRecebimento] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [comprovanteUrl, setComprovanteUrl] = useState('');
  const [tipoPagador, setTipoPagador] = useState<'COTISTA' | 'SHARE' | 'HOLDING'>('COTISTA');
  const [pagadorId, setPagadorId] = useState(conta.cotistaId ?? '');
  const [rateioId, setRateioId] = useState(conta.rateios?.[0]?.id ?? '');
  const [valor, setValor] = useState((Number(conta.valor || 0)).toFixed(2).replace('.', ','));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valorCentavos = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100);

  async function confirmar() {
    if (!bancoRecebimento.trim() || !rateioId.trim() || !Number.isInteger(valorCentavos) || valorCentavos <= 0) {
      setErro('Informe banco, valor, rateio e um valor positivo.');
      return;
    }
    if ((tipoPagador === 'COTISTA' || tipoPagador === 'HOLDING') && !pagadorId.trim()) {
      setErro('Informe o identificador do pagador real.');
      return;
    }
    setEnviando(true); setErro(null);
    try {
      await onConfirmar({
        dataRecebimento, bancoRecebimento, formaPagamento,
        comprovanteRecebimentoUrl: comprovanteUrl || undefined,
        pagamentos: [{
          idempotency_key: `recebimento-${conta.id}-${dataRecebimento}`,
          data_pagamento: dataRecebimento,
          conta_bancaria_id: bancoRecebimento || undefined,
          comprovante_url: comprovanteUrl || null,
          forma_pagamento: formaPagamento || null,
          tipo_pagador: tipoPagador,
          ...(tipoPagador === 'COTISTA' ? { pagador_cotista_id: pagadorId } : {}),
          ...(tipoPagador === 'HOLDING' ? { pagador_holding_id: pagadorId } : {}),
          valor_centavos: valorCentavos,
          rateios: [{ rateio_id: rateioId, valor_centavos: valorCentavos }],
        }],
      });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao dar baixa na conta.'); }
    finally { setEnviando(false); }
  }

  return <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Dar baixa — {conta.descricao ?? conta.categoriaNome ?? 'Conta a receber'}</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Data do recebimento</Label><Input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} /></div>
          <div className="space-y-1"><Label>Forma de pagamento</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}><option>PIX</option><option>Transferência</option><option>Boleto</option><option>Dinheiro</option><option>Cartão</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Pagador real</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={tipoPagador} onChange={(e) => setTipoPagador(e.target.value as typeof tipoPagador)}><option value="COTISTA">Cotista</option><option value="SHARE">Share</option><option value="HOLDING">Holding</option></select></div>
          <div className="space-y-1"><Label>ID do pagador</Label><Input value={pagadorId} onChange={(e) => setPagadorId(e.target.value)} placeholder="ID real" disabled={tipoPagador === 'SHARE'} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Valor pago (R$)</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div className="space-y-1"><Label>Rateio quitado</Label>{conta.rateios?.length ? <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={rateioId} onChange={(e) => setRateioId(e.target.value)}>{conta.rateios.map((rateio) => <option key={rateio.id} value={rateio.id}>{rateio.id} — R$ {(Number(rateio.valor_rateado_centavos) / 100).toFixed(2)}</option>)}</select> : <Input value={rateioId} onChange={(e) => setRateioId(e.target.value)} placeholder="rateio_despesas.id" />}</div>
        </div>
        <div className="space-y-1"><Label>Conta bancária</Label><Input value={bancoRecebimento} onChange={(e) => setBancoRecebimento(e.target.value)} placeholder="ID ou banco - conta" /></div>
        <div className="space-y-1"><Label>Comprovante (URL, opcional)</Label><Input value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} placeholder="https://…" /></div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onFechar} disabled={enviando}>Cancelar</Button><Button onClick={confirmar} disabled={enviando}>{enviando ? 'Confirmando…' : 'Confirmar recebimento'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
