import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Landmark } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
'../ui/Dialog';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Badge } from '../ui/Badge';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { DateField } from '../ui/DateField';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CampoFormulario } from './CampoFormulario';
import { StatusBadge } from './StatusBadge';
import { opcoesConta, opcoesFormaPagamento } from '../../data/opcoes';
import type { DadosBaixa, Lancamento } from '../../types/financeiro';
import { formatBRL, formatData, hoje } from '../../utils/format';

interface DarBaixaDialogProps {
  lancamento: Lancamento | null;
  onFechar: () => void;
  onConfirmar: (id: string, dados: DadosBaixa) => void;
}

export function DarBaixaDialog({ lancamento, onFechar, onConfirmar }: DarBaixaDialogProps) {
  const [dados, setDados] = useState<DadosBaixa>({
    dataPagamento: hoje(),
    valorPago: 0,
    formaPagamento: opcoesFormaPagamento[0].id,
    contaBancaria: opcoesConta[0].id,
    observacoes: ''
  });
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (lancamento) {
      setDados({
        dataPagamento: hoje(),
        valorPago: lancamento.valor,
        formaPagamento: opcoesFormaPagamento[0].id,
        contaBancaria: opcoesConta[0].id,
        observacoes: ''
      });
      setErro('');
    }
  }, [lancamento]);

  if (!lancamento) return null;

  const diferenca = dados.valorPago - lancamento.valor;
  const novoStatus =
  lancamento.fluxo === 'RECEITA' ?
  'RECEBIDO' :
  lancamento.fluxo === 'REEMBOLSO' ?
  'REEMBOLSADO' :
  'PAGO';

  function confirmar() {
    if (dados.valorPago <= 0) {
      setErro('Informe um valor pago maior que zero.');
      return;
    }
    onConfirmar(lancamento!.id, dados);
    onFechar();
  }

  return (
    <Dialog open={!!lancamento} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dar baixa no lançamento</DialogTitle>
          <DialogDescription>
            Confirme os dados do pagamento para liquidar o título e atualizar o rateio dos cotistas.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-card-foreground">{lancamento.descricao}</p>
              <p className="num mt-1 text-xs text-muted-foreground">
                {lancamento.id} · {lancamento.fornecedor}
              </p>
            </div>
            <StatusBadge status={lancamento.status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Vencimento
              </dt>
              <dd className="num text-sm font-semibold text-card-foreground">
                {formatData(lancamento.dataVencimento)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Categoria
              </dt>
              <dd className="text-sm font-semibold text-card-foreground">
                {lancamento.categoriaNome}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Valor do título
              </dt>
              <dd className="num text-sm font-semibold text-card-foreground">
                {formatBRL(lancamento.valor)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFormulario
            rotulo="Data do pagamento"
            dica="Data em que o valor saiu ou entrou na conta.">
            
            <DateField
              value={dados.dataPagamento}
              onChange={(iso) => setDados({ ...dados, dataPagamento: iso })}
              ariaLabel="Data do pagamento" />
            
          </CampoFormulario>

          <CampoFormulario
            id="valorPago"
            rotulo="Valor pago"
            erro={erro}
            dica={
            diferenca === 0 ?
            'Igual ao valor do título.' :
            `${diferenca > 0 ? 'Acréscimo' : 'Desconto'} de ${formatBRL(Math.abs(diferenca))} em relação ao título.`
            }>
            
            <CurrencyInput
              id="valorPago"
              value={dados.valorPago}
              onChange={(v) => setDados({ ...dados, valorPago: v })}
              ariaLabel="Valor pago"
              invalido={!!erro} />
            
          </CampoFormulario>

          <CampoFormulario
            rotulo="Forma de pagamento"
            dica={
            opcoesFormaPagamento.find((f) => f.id === dados.formaPagamento)?.descricao
            }>
            
            <SearchableCombobox
              items={opcoesFormaPagamento}
              value={dados.formaPagamento}
              onChange={(id) => setDados({ ...dados, formaPagamento: id })}
              ariaLabel="Forma de pagamento"
              searchPlaceholder="Buscar forma de pagamento…"
              icon={<Banknote className="h-4 w-4" />} />
            
          </CampoFormulario>

          <CampoFormulario
            rotulo="Conta bancária"
            dica={opcoesConta.find((c) => c.id === dados.contaBancaria)?.descricao}>
            
            <SearchableCombobox
              items={opcoesConta}
              value={dados.contaBancaria}
              onChange={(id) => setDados({ ...dados, contaBancaria: id })}
              ariaLabel="Conta bancária"
              searchPlaceholder="Buscar conta…"
              icon={<Landmark className="h-4 w-4" />} />
            
          </CampoFormulario>

          <CampoFormulario
            id="obsBaixa"
            rotulo="Observações da baixa"
            dica="Número do comprovante, transação ou justificativa da diferença."
            className="sm:col-span-2">
            
            <Textarea
              id="obsBaixa"
              rows={2}
              value={dados.observacoes}
              onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
              placeholder="Comprovante, número da transação…"
              className="rounded-xl" />
            
          </CampoFormulario>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/40 bg-success-soft/50 p-3.5 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span className="text-card-foreground">
            Após confirmar, o título passa a{' '}
            <Badge variant="outline" className="ml-0.5 align-middle">
              {novoStatus === 'RECEBIDO' ?
              'Recebido' :
              novoStatus === 'REEMBOLSADO' ?
              'Reembolsado' :
              'Pago'}
            </Badge>{' '}
            com baixa em{' '}
            <strong className="num">{formatData(dados.dataPagamento)}</strong>.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Confirmar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}