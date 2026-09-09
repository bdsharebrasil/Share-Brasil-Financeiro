import React, { useState } from 'react';
import { CheckCircle2, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from './SectionCard';
import { StatusBadge } from './StatusBadge';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { contasEmAberto } from '../../data/financeiro';
import { formatBRL, formatData } from '../../utils/format';

export function ContasAReceber() {
  const [recebidos, setRecebidos] = useState<string[]>([]);

  const pendentes = contasEmAberto.filter((c) => !recebidos.includes(c.id));
  const total = pendentes.reduce((s, c) => s + c.valor, 0);
  const atrasadas = pendentes.filter((c) => c.diasAtraso > 0);

  return (
    <SectionCard
      titulo="Contas a receber dos cotistas"
      descricao={`${pendentes.length} títulos · ${formatBRL(total)} · ${atrasadas.length} em atraso`}
      Icon={HandCoins}
      acoes={
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
        toast.info('Cobrança enviada', {
          description: `${pendentes.length} cotistas notificados por e-mail.`
        })
        }>
        
          Cobrar todos
        </Button>
      }
      semPadding>
      
      {pendentes.length === 0 ?
      <p className="px-5 py-14 text-center text-sm text-muted-foreground">
          Nenhum título a receber. Todos os cotistas estão em dia.
        </p> :

      <ul className="divide-y divide-border">
          {pendentes.map((c) =>
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-card-foreground">{c.nome}</p>
                  <Badge variant="outline" className="num text-[10px]">
                    {c.aeronave}
                  </Badge>
                </div>
                <p className="num text-xs text-muted-foreground">
                  {c.id} · {c.competencia} · venc. {formatData(c.vencimento)}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-bold text-card-foreground">{formatBRL(c.valor)}</p>
                <p
              className={`num text-xs ${c.diasAtraso > 0 ? 'text-danger' : 'text-muted-foreground'}`}>
              
                  {c.diasAtraso > 0 ? `${c.diasAtraso} dias em atraso` : 'No prazo'}
                </p>
              </div>
              <StatusBadge status={c.status} />
              <Button
            size="xs"
            onClick={() => {
              setRecebidos((r) => [...r, c.id]);
              toast.success('Recebimento registrado', {
                description: `${c.nome} · ${formatBRL(c.valor)}`
              });
            }}>
            
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Dar Baixa
              </Button>
            </li>
        )}
        </ul>
      }
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Total a receber
        </span>
        <span className="num text-base font-bold text-card-foreground">{formatBRL(total)}</span>
      </div>
    </SectionCard>);

}