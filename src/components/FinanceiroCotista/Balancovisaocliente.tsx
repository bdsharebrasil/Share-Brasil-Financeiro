import React, { useState } from 'react';
import { BarChart3, Download, Lightbulb, PieChart, TrendingDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from './SectionCard';
import { COR_GRUPO, NOME_GRUPO, brl, destaques, type Resumo } from './BalancoResumo';

const compacto = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function BalancoVisaoCliente({ resumo: r, onBaixarPdf }: { resumo: Resumo; onBaixarPdf: () => Promise<void> }) {
  const [gerando, setGerando] = useState(false);
  const baixar = async () => { setGerando(true); try { await onBaixarPdf(); } finally { setGerando(false); } };
  const tooltip = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 };

  return (
    <div className="space-y-4">
      <SectionCard
        titulo="Em resumo"
        descricao={`${r.periodo} · ${r.nMeses} meses`}
        Icon={Lightbulb}
        acoes={
          <button
            type="button"
            onClick={baixar}
            disabled={gerando}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {gerando ? 'Gerando PDF…' : 'Baixar PDF'}
          </button>
        }>
        <ul className="space-y-2 text-sm text-card-foreground">
          {destaques(r).map((t) => <li key={t} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{t}</li>)}
        </ul>
      </SectionCard>

      <SectionCard titulo="Para onde foi o dinheiro" descricao="Categorias do maior para o menor gasto" Icon={PieChart}>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Fixos, variáveis e extras">
          {(['fixo', 'variavel', 'extra'] as const).map((g) => (
            <div key={g} style={{ width: `${(r.grupos[g] / r.total) * 100}%`, background: COR_GRUPO[g] }} />
          ))}
        </div>
        <div className="mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {(['fixo', 'variavel', 'extra'] as const).map((g) => (
            <span key={g}><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR_GRUPO[g] }} />
              {NOME_GRUPO[g]} {brl(r.grupos[g])} ({((r.grupos[g] / r.total) * 100).toFixed(0)}%)</span>
          ))}
        </div>
        <ol className="space-y-3">
          {r.categorias.map((c) => (
            <li key={c.chave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-card-foreground">{c.nome}</span>
                <span className="num text-muted-foreground">
                  <b className="text-card-foreground">{brl(c.total)}</b> · {c.pct.toFixed(1)}% · média {brl(c.mediaMes)}/mês
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: COR_GRUPO[c.grupo] }} />
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard titulo="Mês a mês" descricao="Quanto foi gasto em cada mês, separado por tipo de custo" Icon={BarChart3}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.mensal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compacto} width={48} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} contentStyle={tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="fixos" name="Fixos" stackId="a" fill={COR_GRUPO.fixo} isAnimationActive={false} />
              <Bar dataKey="variaveis" name="Variáveis" stackId="a" fill={COR_GRUPO.variavel} isAnimationActive={false} />
              <Bar dataKey="extras" name="Extras" stackId="a" fill={COR_GRUPO.extra} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {r.projecao.length > 0 && (
        <SectionCard
          titulo="Projeção: quanto custa a hora conforme você voa"
          descricao={`Fixo médio de ${brl(r.fixoMes)}/mês dividido pelas horas voadas, mais ${brl((r.variavelHora ?? 0) + (r.extraHora ?? 0))} por hora de custos variáveis e extras`}
          Icon={TrendingDown}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={r.projecao} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="horas" tickFormatter={(v) => `${v} h`} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compacto} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(v) => `${v} horas por mês`} contentStyle={tooltip} />
                <Line dataKey="custoHora" name="Custo por hora" stroke={COR_GRUPO.fixo} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground">
                {['Horas/mês', 'Fixo por hora', 'Variável por hora', 'Custo por hora', 'Custo no mês'].map((h, i) =>
                  <th key={h} className={`px-3 py-2 font-semibold ${i ? 'text-right' : ''}`}>{h}</th>)}
              </tr></thead>
              <tbody>{r.projecao.map((p) => (
                <tr key={p.horas} className="border-t border-border">
                  <td className="num px-3 py-2 font-semibold">{p.horas} h</td>
                  <td className="num px-3 py-2 text-right">{brl(p.fixoHora)}</td>
                  <td className="num px-3 py-2 text-right">{brl(p.variavelHora + p.extraHora)}</td>
                  <td className="num px-3 py-2 text-right font-bold">{brl(p.custoHora)}</td>
                  <td className="num px-3 py-2 text-right">{brl(p.custoMes)}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
