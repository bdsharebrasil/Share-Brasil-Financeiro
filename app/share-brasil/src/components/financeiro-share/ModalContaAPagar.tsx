import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContaAPagar } from './tipos';

interface DadosBaixa {
  dataPagamento: string;
  bancoPagamento: string;
  comprovantePagamentoUrl?: string;
}

interface ModalContaAPagarProps {
  conta: ContaAPagar;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: DadosBaixa) => Promise<void>;
}

export function ModalContaAPagar({ conta, aberto, onFechar, onConfirmar }: ModalContaAPagarProps) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [bancoPagamento, setBancoPagamento] = useState('');
  const [comprovanteUrl, setComprovanteUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!bancoPagamento.trim()) {
      setErro('Informe o banco usado no pagamento.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar({
        dataPagamento,
        bancoPagamento,
        comprovantePagamentoUrl: comprovanteUrl || undefined,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao dar baixa na conta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa — {conta.descricao ?? conta.categoriaNome ?? 'Conta a pagar'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="data-pagamento">Data do pagamento</Label>
            <Input
              id="data-pagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="banco-pagamento">Banco usado no pagamento</Label>
            <Input
              id="banco-pagamento"
              placeholder="Ex.: DGA - BRADESCO 1868-6"
              value={bancoPagamento}
              onChange={(e) => setBancoPagamento(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="comprovante">Comprovante (URL, opcional)</Label>
            <Input
              id="comprovante"
              placeholder="https://…"
              value={comprovanteUrl}
              onChange={(e) => setComprovanteUrl(e.target.value)}
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? 'Confirmando…' : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
