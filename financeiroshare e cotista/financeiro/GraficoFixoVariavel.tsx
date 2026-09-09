import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { Scale } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { serieMensal } from '../../data/metricas';
import { formatBRL } from '../../utils/format';

const eixo = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false
};

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12
};

const totalFixo = serieMensal.reduce((s, m) => s + m.custoFixo, 0);
const totalVariavel = serieMensal.reduce((s, m) => s + m.custoVariavel, 0);

export function GraficoFixoVariavel() {
  const total = totalFixo + totalVariavel;

  return (
    <SectionCard
      titulo="Custo fixo x variável por competência"
      descricao={`${Math.round(totalFixo / total * 100)}% do custo da empresa é fixo no exercício`}
      Icon={Scale}>
      
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serieMensal} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" {...eixo} />
            <YAxis {...eixo} width={56} tickFormatter={(v: number) => formatBRL(v, true)} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, n) => [
              formatBRL(v),
              n === 'custoFixo' ? 'Custo fixo' : 'Custo variável']
              } />
            
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => v === 'custoFixo' ? 'Custo fixo' : 'Custo variável'} />
            
            <Bar dataKey="custoFixo" stackId="c" fill="var(--chart-2)" barSize={34} />
            <Bar
              dataKey="custoVariavel"
              stackId="c"
              fill="var(--chart-1)"
              barSize={34}
              radius={[4, 4, 0, 0]} />
            
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Custo fixo acumulado</dt>
          <dd className="num mt-0.5 text-lg font-semibold text-card-foreground">
            {formatBRL(totalFixo)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Custo variável acumulado</dt>
          <dd className="num mt-0.5 text-lg font-semibold text-card-foreground">
            {formatBRL(totalVariavel)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Custo médio por mês</dt>
          <dd className="num mt-0.5 text-lg font-semibold text-card-foreground">
            {formatBRL(total / serieMensal.length)}
          </dd>
        </div>
      </dl>
    </SectionCard>);

}