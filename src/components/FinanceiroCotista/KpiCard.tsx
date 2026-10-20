import React from 'react';

interface KpiCardProps {
  label: string;
  valor: string;
  detalhe?: string;
  Icon: React.ElementType;
  destaque?: boolean;
  compacto?: boolean;
}

export function KpiCard({ label, valor, detalhe, Icon, destaque = false, compacto = false }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border bg-card ${compacto ? 'p-3' : 'p-4'} transition-colors ${
      destaque ? 'border-brand/50' : 'border-border hover:border-brand/40'}`
      }>
      
      <div className="flex items-start justify-between gap-2">
        <p className={`font-medium uppercase text-muted-foreground ${compacto ? 'text-[10px] tracking-normal' : 'text-xs tracking-wide'}`}>{label}</p>
        <Icon className={`shrink-0 text-brand ${compacto ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} aria-hidden="true" />
      </div>
      <p className={`num mt-2 font-semibold leading-tight text-card-foreground ${compacto ? 'text-xl' : 'text-2xl'}`}>{valor}</p>
      {detalhe ? <p className={`text-xs text-muted-foreground ${compacto ? 'mt-1' : 'mt-1.5'}`}>{detalhe}</p> : null}
    </div>);

}