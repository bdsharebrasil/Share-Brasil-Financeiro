import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CircleAlert, Download, RefreshCw, Scale, TrendingDown, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CabecalhoSecao, CartaoKpi, EstadoVazio, EtiquetaStatus, HeroDashboard } from "@/components/dashboard/PrimitivosDashboard";
import { buscarDashboardCotista, buscarOpcoesLancamento, formatarCentavos, formatarData, type DashboardCotista, type OpcoesLancamento } from "@/lib/financeiro-share-api";

function primeiroDiaDoMes() {
  const data = new Date();
  data.setDate(1);
  return data.toISOString().slice(0, 10);
}

function ultimoDiaDoMes() {
  const data = new Date();
  data.setMonth(data.getMonth() + 1, 0);
  return data.toISOString().slice(0, 10);
}

function nomeCotista(id: string, opcoes: OpcoesLancamento | null) {
  return opcoes?.cotistas?.find((cotista) => cotista.id === id)?.nome || id;
}

function mesLabel(valor: string) {
  const [ano, mes] = valor.split("-");
  if (!ano || !mes) return valor;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(Number(ano), Number(mes) - 1, 1)).replace(".", "");
}

function percentual(valor: number, total: number) {
  return total > 0 ? Math.max(3, Math.min(100, (valor / total) * 100)) : 3;
}

function statusLabel(status: string) {
  const normalizado = status.toLowerCase();
  if (["pago", "quitado", "conciliado", "aprovado"].includes(normalizado)) return { label: "Pago", tone: "green" as const };
  if (["cancelado", "reprovado"].includes(normalizado)) return { label: "Cancelado", tone: "red" as const };
  return { label: "Pendente", tone: "amber" as const };
}

export default function DashboardFinanceiroCotista() {
  const [dados, setDados] = useState<DashboardCotista | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [inicio, setInicio] = useState(primeiroDiaDoMes);
  const [fim, setFim] = useState(ultimoDiaDoMes);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const [dashboard, novasOpcoes] = await Promise.all([
        buscarDashboardCotista(inicio, fim),
        opcoes ? Promise.resolve(opcoes) : buscarOpcoesLancamento(),
      ]);
      setDados(dashboard);
      if (!opcoes) setOpcoes(novasOpcoes);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar o financeiro dos cotistas.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [fim, inicio, opcoes]);

  useEffect(() => { void carregar(); }, [carregar]);

  const lancamentos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.lancamentos || []).filter((item) => !termo || [item.descricao, item.categoria, item.grupoCategoria, item.fornecedor || ""].some((campo) => campo.toLowerCase().includes(termo))).sort((a, b) => b.data.localeCompare(a.data));
  }, [busca, dados?.lancamentos]);
  const maiorCategoria = dados?.ranking_gastos?.[0]?.valor || 1;
  const maiorCotista = dados?.ranking_cotistas?.[0]?.devido || 1;
  const saldoTotal = dados?.saldos?.reduce((total, item) => total + item.saldoCentavos, 0) || 0;

  return (
    <div className="route-enter">
      <HeroDashboard ambiente="gestor" title="Financeiro Cotista" subtitle="Fechamento mensal, custos rateados e equilíbrio entre cotistas">
        <div className="flex flex-wrap items-center gap-2">
          <EtiquetaStatus tone="blue"><Users size={12} /> {dados?.saldos?.length || 0} cotistas no período</EtiquetaStatus>
          <Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-9 gap-2 border-border bg-card/70 text-xs"><RefreshCw size={13} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button>
        </div>
      </HeroDashboard>

      {erro && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]"><span>{erro}</span><Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 border-[#e77b80]/40 bg-transparent text-[10px] text-[#ed8c90]">Tentar novamente</Button></div>}

      <section className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-3 md:flex-row md:items-end md:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Período do fechamento</p><p className="mt-1 text-xs text-muted-foreground">O balanço considera somente despesas com rateio ou caixa de cliente.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="space-y-1"><label className="text-[10px] text-muted-foreground" htmlFor="cotista-inicio">Início</label><Input id="cotista-inicio" type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} className="h-9 w-full text-xs sm:w-[145px]" /></div><div className="space-y-1"><label className="text-[10px] text-muted-foreground" htmlFor="cotista-fim">Fim</label><Input id="cotista-fim" type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} className="h-9 w-full text-xs sm:w-[145px]" /></div></div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CartaoKpi label="Custo total rateado" value={carregando ? "—" : formatarCentavos(dados?.resumo.custo_rateado)} detail="Parcela atribuída aos cotistas" tone="blue" icon={<Scale size={16} />} />
        <CartaoKpi label="Saldo do período" value={carregando ? "—" : formatarCentavos(dados?.resumo.saldo)} detail="Entradas menos saídas" tone={Number(dados?.resumo.saldo || 0) >= 0 ? "green" : "red"} icon={<WalletCards size={16} />} />
        <CartaoKpi label="Média mensal" value={carregando ? "—" : formatarCentavos(dados?.resumo.media_mensal)} detail="Custo médio no intervalo" tone="violet" icon={<BarChart3 size={16} />} />
        <CartaoKpi label="Média por lançamento" value={carregando ? "—" : formatarCentavos(dados?.resumo.media_lancamento)} detail="Despesas de cliente" tone="amber" icon={<TrendingDown size={16} />} />
        <CartaoKpi label="Pendências" value={carregando ? "—" : String(dados?.resumo.pendentes || 0)} detail="Aguardando baixa ou conferência" tone="red" icon={<CircleAlert size={16} />} />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CalendarDays size={15} />} title="Fechamento mensal" detail="Entradas, despesas e custo rateado por competência" />{dados?.fechamento_mensal?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Mês</th><th className="px-4 py-3 text-right">Lançamentos</th><th className="px-4 py-3 text-right">Entradas</th><th className="px-4 py-3 text-right">Despesas</th><th className="px-4 py-3 text-right">Rateado</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead><tbody>{dados.fechamento_mensal.map((linha) => <tr key={linha.mes} className="border-b border-border/50 last:border-0"><td className="px-4 py-3 text-xs font-bold capitalize">{mesLabel(linha.mes)}</td><td className="px-4 py-3 text-right text-xs text-muted-foreground">{linha.lancamentos}</td><td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">{formatarCentavos(linha.entradas)}</td><td className="px-4 py-3 text-right font-mono text-xs text-amber-300">{formatarCentavos(linha.saidas)}</td><td className="px-4 py-3 text-right font-mono text-xs text-primary">{formatarCentavos(linha.custoRateado)}</td><td className={`px-4 py-3 text-right font-mono text-xs font-bold ${linha.saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatarCentavos(linha.saldo)}</td></tr>)}</tbody></table></div> : <EstadoVazio label="Nenhum fechamento no período" />}</section>
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<BarChart3 size={15} />} title="Leitura do período" detail="Comparativo das despesas registradas" /><div className="space-y-5 p-5"><div><div className="mb-2 flex items-center justify-between text-[10px]"><span className="text-muted-foreground">Custo rateado / despesas</span><span className="font-mono font-bold">{dados?.resumo.saidas ? Math.round((dados.resumo.custo_rateado / dados.resumo.saidas) * 100) : 0}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, dados?.resumo.saidas ? (dados.resumo.custo_rateado / dados.resumo.saidas) * 100 : 0)}%` }} /></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-border/70 bg-secondary/20 p-3"><p className="text-[10px] text-muted-foreground">Saldo entre cotistas</p><p className={`mt-1 font-mono text-sm font-bold ${saldoTotal >= 0 ? "text-emerald-400" : "text-amber-300"}`}>{formatarCentavos(saldoTotal)}</p></div><div className="rounded-lg border border-border/70 bg-secondary/20 p-3"><p className="text-[10px] text-muted-foreground">Maior categoria</p><p className="mt-1 truncate text-xs font-bold">{dados?.ranking_gastos?.[0]?.categoria || "—"}</p></div></div><p className="text-[10px] leading-relaxed text-muted-foreground">Use o ranking abaixo para identificar concentração de custos e o fechamento mensal para acompanhar tendência e sazonalidade.</p></div></section>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<TrendingDown size={15} />} title="Ranking de gastos" detail="Categorias com maior impacto no período" />{dados?.ranking_gastos?.length ? <div className="space-y-4 p-5">{dados.ranking_gastos.map((item, index) => <div key={`${item.categoria}-${index}`}><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="min-w-0 truncate font-semibold"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-secondary font-mono text-[9px] text-muted-foreground">{index + 1}</span>{item.categoria}</span><span className="shrink-0 font-mono text-xs font-bold">{formatarCentavos(item.valor)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${index === 0 ? "bg-primary" : index === 1 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${percentual(item.valor, maiorCategoria)}%` }} /></div><p className="mt-1 text-[9px] text-muted-foreground">{item.grupo} · {item.quantidade} lançamento(s)</p></div>)}</div> : <EstadoVazio label="Nenhum gasto categorizado" />}</section>
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Users size={15} />} title="Ranking por cotista" detail="Custos atribuídos antes da compensação" />{dados?.ranking_cotistas?.length ? <div className="space-y-4 p-5">{dados.ranking_cotistas.map((item, index) => <div key={item.cotista}><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="min-w-0 truncate font-semibold"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-secondary font-mono text-[9px] text-muted-foreground">{index + 1}</span>{nomeCotista(item.cotista, opcoes)}</span><span className="shrink-0 font-mono text-xs font-bold">{formatarCentavos(item.devido)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-violet-400" style={{ width: `${percentual(item.devido, maiorCotista)}%` }} /></div><p className="mt-1 text-[9px] text-muted-foreground">{item.quantidade} rateio(s) · identificação {item.cotista}</p></div>)}</div> : <EstadoVazio label="Nenhum cotista com custo atribuído" />}</section>
      </div>

      <section className="mb-5 overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Scale size={15} />} title="Balanço e compensação" detail="Quem pagou, quanto deveria suportar e diferença líquida" />{dados?.saldos?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Cotista</th><th className="px-4 py-3 text-right">Pago diretamente</th><th className="px-4 py-3 text-right">Devido no rateio</th><th className="px-4 py-3 text-right">Saldo líquido</th><th className="px-4 py-3">Leitura</th></tr></thead><tbody>{dados.saldos.map((saldo) => { const positivo = saldo.saldoCentavos >= 0; return <tr key={saldo.cotista} className="border-b border-border/50 last:border-0"><td className="px-4 py-3 text-xs font-bold">{nomeCotista(saldo.cotista, opcoes)}</td><td className="px-4 py-3 text-right font-mono text-xs">{formatarCentavos(saldo.totalPagoCentavos)}</td><td className="px-4 py-3 text-right font-mono text-xs">{formatarCentavos(saldo.totalDevidoCentavos)}</td><td className={`px-4 py-3 text-right font-mono text-xs font-bold ${positivo ? "text-emerald-400" : "text-amber-300"}`}>{positivo ? "+" : "−"}{formatarCentavos(Math.abs(saldo.saldoCentavos))}</td><td className="px-4 py-3"><EtiquetaStatus tone={positivo ? "green" : "amber"}>{positivo ? "A receber" : "A pagar"}</EtiquetaStatus></td></tr>; })}</tbody></table></div> : <EstadoVazio label="Nenhum saldo para compensar" />}</section>

      <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<WalletCards size={15} />} title="Lançamentos do cotista" detail="Despesas de cliente e rateios do período" action={<div className="flex items-center gap-2"><Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar categoria ou fornecedor" className="h-8 w-[210px] text-[10px]" /><Button type="button" variant="outline" className="hidden h-8 gap-1.5 text-[10px] sm:flex"><Download size={12} /> Exportar</Button></div>} />{carregando ? <div className="space-y-3 p-5"><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /></div> : lancamentos.length ? <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Lançamento</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Rateio</th><th className="px-4 py-3 text-right">Valor total</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{lancamentos.map((item) => { const status = statusLabel(item.status); const rateado = item.rateios.reduce((total, rateio) => total + rateio.valorCentavos, 0); return <tr key={item.id} className="border-b border-border/50 last:border-0"><td className="max-w-[250px] px-4 py-3"><p className="truncate text-xs font-bold">{item.descricao}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{item.fornecedor || item.documento || "Sem fornecedor informado"}</p></td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{item.categoria}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.grupoCategoria}</p></td><td className="px-4 py-3 text-[10px] text-muted-foreground">{formatarData(item.data)}</td><td className="px-4 py-3 font-mono text-[10px] text-primary">{formatarCentavos(rateado)} <span className="text-muted-foreground">({item.rateios.length})</span></td><td className="px-4 py-3 text-right font-mono text-xs font-bold">{formatarCentavos(item.valorCentavos)}</td><td className="px-4 py-3"><EtiquetaStatus tone={status.tone}>{status.label}</EtiquetaStatus></td></tr>; })}</tbody></table></div> : <EstadoVazio label="Nenhum lançamento de cotista encontrado" />}</section>
    </div>
  );
}
