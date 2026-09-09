import React from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from './SectionCard';
import { StatusBadge } from './StatusBadge';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { contasEmAberto } from '../../data/financeiro';
import { formatBRL, formatData } from '../../utils/format';

export function ContasEmAberto() {
  const total = contasEmAberto.reduce((s, c) => s + c.valor, 0);
  const atrasadas = contasEmAberto.filter((c) => c.diasAtraso > 0);

  return (
    <SectionCard
      titulo="Cotistas com contas em aberto"
      descricao={`${contasEmAberto.length} títulos pendentes · ${atrasadas.length} em atraso`}
      Icon={AlertCircle}
      acoes={
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
        toast.info('Cobrança enviada', {
          description: `${contasEmAberto.length} cotistas notificados por e-mail.`
        })
        }>
        
          <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Cobrar todos
        </Button>
      }
      semPadding>
      
      <ul className="divide-y divide-border">
        {contasEmAberto.map((c) =>
        <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback
              className={
              c.diasAtraso > 0 ?
              'bg-danger-soft text-xs text-danger' :
              'bg-brand-soft text-xs text-brand'
              }>
              
                {c.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-card-foreground">{c.nome}</p>
              <p className="num text-xs text-muted-foreground">
                {c.aeronave} · {c.competencia} · venc. {formatData(c.vencimento)}
              </p>
            </div>
            <div className="text-right">
              <p className="num text-sm font-semibold text-card-foreground">{formatBRL(c.valor)}</p>
              <p
              className={`num text-xs ${c.diasAtraso > 0 ? 'text-danger' : 'text-muted-foreground'}`}>
              
                {c.diasAtraso > 0 ? `${c.diasAtraso} dias em atraso` : 'No prazo'}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </li>
        )}
      </ul>
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Total em aberto
        </span>
        <span className="num text-base font-semibold text-card-foreground">{formatBRL(total)}</span>
      </div>
    </SectionCard>);

}