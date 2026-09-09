import React from 'react';
import { ClipboardList, Plus, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard } from './SectionCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { orcamentos } from '../../data/operacional';
import type { StatusOrcamento } from '../../types/operacional';
import { formatBRL, formatData } from '../../utils/format';

const ROTULO: Record<StatusOrcamento, {label: string;classes: string;}> = {
  EM_ANALISE: { label: 'Em Análise', classes: 'bg-warning-soft text-warning border-warning/30' },
  APROVADO: { label: 'Aprovado', classes: 'bg-success-soft text-success border-success/30' },
  RECUSADO: { label: 'Recusado', classes: 'bg-danger-soft text-danger border-danger/30' },
  EXPIRADO: { label: 'Expirado', classes: 'bg-muted text-muted-foreground border-border' }
};

export function Orcamentos() {
  const emAnalise = orcamentos.filter((o) => o.status === 'EM_ANALISE');
  const totalAnalise = emAnalise.reduce((s, o) => s + o.valor, 0);

  return (
    <SectionCard
      titulo="Orçamentos de fornecedores"
      descricao={`${emAnalise.length} em análise · ${formatBRL(totalAnalise)} em negociação`}
      Icon={ClipboardList}
      acoes={
      <Button
        size="sm"
        onClick={() =>
        toast.success('Orçamento criado', {
          description: 'Solicitação registrada para cotação.'
        })
        }>
        
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Novo orçamento
        </Button>
      }
      semPadding>
      
      <ul className="divide-y divide-border">
        {orcamentos.map((o) =>
        <li key={o.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-card-foreground">{o.descricao}</p>
                  <Badge variant="outline" className="num text-[10px]">
                    {o.aeronave}
                  </Badge>
                </div>
                <p className="num mt-1 text-xs text-muted-foreground">
                  {o.id} · {o.fornecedor} · {o.categoria} · entrega em {o.prazoEntrega}
                </p>
                <p className="num mt-1 text-xs text-muted-foreground">
                  Validade da proposta: {formatData(o.validade)}
                </p>
                {o.economia ?
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Economia de {formatBRL(o.economia)} vs. contrato anterior
                  </p> :
              null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="num text-lg font-bold text-card-foreground">{formatBRL(o.valor)}</p>
                <span
                className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${ROTULO[o.status].classes}`}>
                
                  {ROTULO[o.status].label}
                </span>
                {o.status === 'EM_ANALISE' ?
              <div className="flex gap-1.5">
                    <Button
                  size="xs"
                  onClick={() =>
                  toast.success('Orçamento aprovado', {
                    description: `${o.fornecedor} · ${formatBRL(o.valor)}`
                  })
                  }>
                  
                      Aprovar
                    </Button>
                    <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                  toast.info('Orçamento recusado', { description: o.fornecedor })
                  }>
                  
                      Recusar
                    </Button>
                  </div> :
              null}
              </div>
            </div>
          </li>
        )}
      </ul>
    </SectionCard>);

}