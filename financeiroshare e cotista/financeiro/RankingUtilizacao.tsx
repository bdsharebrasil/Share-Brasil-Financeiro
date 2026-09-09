import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { rankingCotistas } from '../../data/metricas';
import { formatBRL, formatNumero } from '../../utils/format';

type Criterio = 'custoHora' | 'custoMes' | 'horas';

const CRITERIOS: {id: Criterio;label: string;}[] = [
{ id: 'custoHora', label: 'Custo x hora' },
{ id: 'custoMes', label: 'Custo por mês' },
{ id: 'horas', label: 'Horas voadas' }];


export function RankingUtilizacao({ destaqueId }: {destaqueId?: string;}) {
  const [criterio, setCriterio] = useState<Criterio>('custoHora');

  const ordenado = [...rankingCotistas].sort((a, b) =>
  criterio === 'custoHora' ? a.custoHora - b.custoHora : b[criterio] - a[criterio]
  );
  const maximo = Math.max(...ordenado.map((c) => c[criterio]));

  const valorFormatado = (v: number) =>
  criterio === 'horas' ? `${formatNumero(v, 1)} h` : formatBRL(v);

  return (
    <SectionCard
      titulo="Ranking de utilização"
      descricao={
      criterio === 'custoHora' ?
      'Custo por hora voada — do mais ao menos eficiente' :
      criterio === 'custoMes' ?
      'Custo rateado no mês — do maior para o menor' :
      'Horas voadas no mês — do maior para o menor'
      }
      Icon={Trophy}
      acoes={
      <div
        className="flex overflow-x-auto rounded-lg border border-border p-0.5"
        role="tablist"
        aria-label="Critério do ranking">
        
          {CRITERIOS.map((c) =>
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={criterio === c.id}
          onClick={() => setCriterio(c.id)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          criterio === c.id ?
          'bg-brand text-brand-foreground' :
          'text-muted-foreground hover:text-foreground'}`
          }>
          
              {c.label}
            </button>
        )}
        </div>
      }
      semPadding>
      
      <ol className="divide-y divide-border">
        {ordenado.map((c, i) => {
          const cor = `var(--chart-${i % 5 + 1})`;
          const percentual = Math.round(c[criterio] / maximo * 100);
          return (
            <li
              key={c.cotistaId}
              className={`flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-accent ${
              destaqueId === c.cotistaId ? 'bg-brand-soft/60' : ''}`
              }>
              
              <span className="num w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                {i + 1}º
              </span>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className="text-[11px]"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`,
                    color: cor
                  }}>
                  
                  {c.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-[140px] flex-1 items-center gap-2">
                <p className="truncate text-sm font-medium text-card-foreground">{c.nome}</p>
                <Badge variant="outline" className="num text-[10px]">
                  {c.aeronave}
                </Badge>
              </div>
              <span className="num text-sm font-semibold text-card-foreground">
                {valorFormatado(c[criterio])}
                {criterio === 'custoHora' ?
                <span className="text-xs font-normal text-muted-foreground">/h</span> :
                null}
              </span>
              <span
                className="num rounded-md px-2 py-0.5 text-xs font-medium"
                style={{
                  color: cor,
                  backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`
                }}>
                
                {formatNumero(c.horas, 1)} h
              </span>
              <span className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-muted sm:w-36">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${percentual}%`, backgroundColor: cor }} />
                
              </span>
            </li>);

        })}
      </ol>
    </SectionCard>);

}