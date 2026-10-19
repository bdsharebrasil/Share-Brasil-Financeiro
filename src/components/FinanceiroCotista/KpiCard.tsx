import React from 'react';

interface KpiCardProps {
  label: string;
  valor: string;
  detalhe?: string;
  Icon: React.ElementType;
  destaque?: boolean;
}

export function KpiCard({ label, valor, detalhe, Icon, destaque = false }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-colors ${
      destaque ? 'border-brand/50' : 'border-border hover:border-brand/40'}`
      }>
      
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      </div>
      <p className="num mt-2 text-2xl font-semibold leading-tight text-card-foreground">{valor}</p>
      {detalhe ? <p className="mt-1.5 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>);

}