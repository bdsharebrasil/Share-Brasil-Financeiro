import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { Activity } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { serieMensal } from '../../data/metricas';
import { formatNumero } from '../../utils/format';

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

const totalHoras = serieMensal.reduce((s, m) => s + m.horas, 0);
const totalVoos = serieMensal.reduce((s, m) => s + m.voos, 0);

const RESUMO = [
{ label: 'Média Semanal', valor: `${formatNumero(totalHoras / (serieMensal.length * 4.3), 1)} h/semana` },
{ label: 'Média Mensal', valor: `${formatNumero(totalHoras / serieMensal.length, 1)} h/mês` },
{ label: 'Horário mais frequente', valor: '08h – 10h' },
{ label: 'Dia mais utilizado', valor: 'Sexta-feira' }];


export function GraficosUtilizacao() {
  return (
    <SectionCard
      titulo="Utilização"
      descricao={`Horas voadas e quantidade de voos por mês · ${formatNumero(totalHoras)} h em ${totalVoos} voos`}
      Icon={Activity}>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Horas voadas por mês
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieMensal} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradHoras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis {...eixo} width={44} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${formatNumero(v)} h`, 'Horas voadas']} />
                
                <Area
                  type="monotone"
                  dataKey="horas"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#gradHoras)" />
                
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Voos por mês
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieMensal} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis {...eixo} width={44} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} voos`, 'Voos realizados']} />
                
                <Bar dataKey="voos" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {RESUMO.map((r) =>
        <div key={r.label}>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="num mt-0.5 text-base font-semibold text-card-foreground">{r.valor}</dd>
          </div>
        )}
      </dl>
    </SectionCard>);

}