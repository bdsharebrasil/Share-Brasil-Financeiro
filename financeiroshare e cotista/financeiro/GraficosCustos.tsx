import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { Layers } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { composicaoCustos, serieMensal } from '../../data/metricas';
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

const custoTotal = composicaoCustos.reduce((s, c) => s + c.valor, 0);
const mediaAnual = Math.round(
  serieMensal.reduce((s, m) => s + m.custoTotal, 0) / serieMensal.length
);
const principal = composicaoCustos[0];

const RESUMO = [
{ label: 'Custo Total', valor: custoTotal },
...composicaoCustos.slice(0, 3).map((c) => ({ label: c.categoria, valor: c.valor }))];


export function GraficosCustos() {
  return (
    <SectionCard
      titulo="Composição e evolução dos custos"
      descricao="Distribuição por categoria e comportamento mensal dos gastos operacionais"
      Icon={Layers}>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Distribuição por categoria
          </p>
          <div className="relative h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={composicaoCustos}
                  dataKey="valor"
                  nameKey="categoria"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}>
                  
                  {composicaoCustos.map((_, i) =>
                  <Cell key={i} fill={`var(--chart-${i + 1})`} />
                  )}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-lg font-semibold text-card-foreground">
                {principal.percentual}%
              </span>
              <span className="text-xs text-muted-foreground">{principal.categoria}</span>
            </div>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {composicaoCustos.map((c, i) =>
            <li key={c.categoria} className="flex items-center gap-1.5 text-xs">
                <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: `var(--chart-${i + 1})` }}
                aria-hidden="true" />
              
                <span className="text-muted-foreground">{c.categoria}</span>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Gastos por categoria (R$)
          </p>
          <div className="h-[248px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...composicaoCustos].reverse()}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  {...eixo}
                  tickFormatter={(v: number) => formatBRL(v, true)} />
                
                <YAxis type="category" dataKey="categoria" {...eixo} width={82} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [formatBRL(v), 'Total']} />
                
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={18}>
                  {[...composicaoCustos].reverse().map((_, i) =>
                  <Cell
                    key={i}
                    fill={`var(--chart-${composicaoCustos.length - i})`} />

                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Evolução mensal de custos
          </p>
          <div className="h-[248px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieMensal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis
                  {...eixo}
                  width={56}
                  domain={['dataMin - 20000', 'dataMax + 20000']}
                  tickFormatter={(v: number) => formatBRL(v, true)} />
                
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [formatBRL(v), 'Custo do mês']} />
                
                <ReferenceLine
                  y={mediaAnual}
                  stroke="var(--danger)"
                  strokeDasharray="5 4"
                  label={{
                    value: 'Média anual',
                    position: 'insideBottomRight',
                    fill: 'var(--danger)',
                    fontSize: 10
                  }} />
                
                <Line
                  type="monotone"
                  dataKey="custoTotal"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }} />
                
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {RESUMO.map((r) =>
        <div key={r.label}>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="num mt-0.5 text-lg font-semibold text-card-foreground">
              {formatBRL(r.valor)}
            </dd>
          </div>
        )}
      </dl>
    </SectionCard>);

}