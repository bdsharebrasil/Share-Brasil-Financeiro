import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import { TrendingDown, Wallet } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { serieMensal } from '../../data/metricas';
import type { Cotista } from '../../types/financeiro';
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

export function useSerieCotista(cotista: Cotista) {
  return useMemo(
    () =>
    serieMensal.map((s, i) => {
      const fator = 0.24 + (i + cotista.horasVoadas) % 5 * 0.008;
      const custo = Math.round(s.custoTotal / 2 * fator);
      const horas = Number((s.horas / 8 * (0.85 + i % 3 * 0.1)).toFixed(1));
      return {
        mes: s.mes,
        custo,
        horas,
        custoHora: Math.round(custo / horas),
        mediaFrota: s.custoHora * 2
      };
    }),
    [cotista.horasVoadas]
  );
}

interface Props {
  cotista: Cotista;
}

export function GraficoCustoHoraCotista({ cotista }: Props) {
  const serie = useSerieCotista(cotista);

  return (
    <SectionCard
      titulo="Custo por hora — cotista x média da frota"
      descricao="Comparativo mensal de eficiência (R$/h)"
      Icon={TrendingDown}>
      
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" {...eixo} />
            <YAxis {...eixo} width={56} tickFormatter={(v: number) => formatBRL(v, true)} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, n) => [`${formatBRL(v)}/h`, String(n)]} />
            
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="custoHora"
              name={cotista.nome}
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              barSize={28} />
            
            <Line
              type="monotone"
              dataKey="mediaFrota"
              name="Média da frota"
              stroke="var(--chart-4)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false} />
            
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>);

}

export function GraficoCustoMesCotista({ cotista }: Props) {
  const serie = useSerieCotista(cotista);
  const total = serie.reduce((s, m) => s + m.custo, 0);

  return (
    <SectionCard
      titulo="Custo rateado por mês"
      descricao={`Total apurado no exercício: ${formatBRL(total)}`}
      Icon={Wallet}>
      
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" {...eixo} />
            <YAxis {...eixo} width={56} tickFormatter={(v: number) => formatBRL(v, true)} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [formatBRL(v), 'Custo rateado']} />
            
            <Bar dataKey="custo" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>);

}