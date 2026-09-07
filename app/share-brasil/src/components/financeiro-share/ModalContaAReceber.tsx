import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContaAReceber } from './tipos';

interface DadosBaixa {
  dataRecebimento: string;
  bancoRecebimento: string;
  comprovanteRecebimentoUrl?: string;
}

interface ModalContaAReceberProps {
  conta: ContaAReceber;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: DadosBaixa) => Promise<void>;
}

export function ModalContaAReceber({ conta, aberto, onFechar, onConfirmar }: ModalContaAReceberProps) {
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().slice(0, 10));
  const [bancoRecebimento, setBancoRecebimento] = useState('');
  const [comprovanteUrl, setComprovanteUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!bancoRecebimento.trim()) {
      setErro('Informe o banco em que o valor foi recebido.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar({
        dataRecebimento,
        bancoRecebimento,
        comprovanteRecebimentoUrl: comprovanteUrl || undefined,
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
          <DialogTitle>Dar baixa — {conta.descricao ?? conta.categoriaNome ?? 'Conta a receber'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="data-recebimento">Data do recebimento</Label>
            <Input
              id="data-recebimento"
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="banco-recebimento">Banco em que caiu o valor</Label>
            <Input
              id="banco-recebimento"
              placeholder="Ex.: DGA - BRADESCO 1868-6"
              value={bancoRecebimento}
              onChange={(e) => setBancoRecebimento(e.target.value)}
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
            {enviando ? 'Confirmando…' : 'Confirmar recebimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
