import React from 'react';
import { Building2, Fuel, MoreHorizontal, Receipt, Shield, Trophy } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { composicaoCustos } from '../../data/metricas';
import { formatBRL } from '../../utils/format';

const ICONES: Record<string, React.ElementType> = {
  Combustível: Fuel,
  Hangaragem: Building2,
  Seguro: Shield,
  Taxas: Receipt,
  Outros: MoreHorizontal
};

export function RankingGastos() {
  const maximo = Math.max(...composicaoCustos.map((c) => c.percentual));

  return (
    <SectionCard
      titulo="Ranking dos gastos"
      descricao="Categorias com maior peso no custo da empresa"
      Icon={Trophy}
      semPadding>
      
      <ol className="divide-y divide-border">
        {composicaoCustos.map((c, i) => {
          const Icon = ICONES[c.categoria] ?? MoreHorizontal;
          const cor = `var(--chart-${i + 1})`;
          return (
            <li
              key={c.categoria}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent">
              
              <span className="num w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                {i + 1}º
              </span>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)` }}>
                
                <Icon className="h-4 w-4" style={{ color: cor }} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-card-foreground">
                {c.categoria}
              </span>
              <span className="num text-sm font-semibold text-card-foreground">
                {formatBRL(c.valor)}
              </span>
              <span
                className="num rounded-md px-2 py-0.5 text-xs font-medium"
                style={{
                  color: cor,
                  backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`
                }}>
                
                {c.percentual}%
              </span>
              <span
                className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-muted sm:w-40"
                role="presentation">
                
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${c.percentual / maximo * 100}%`,
                    backgroundColor: cor
                  }} />
                
              </span>
            </li>);

        })}
      </ol>
    </SectionCard>);

}