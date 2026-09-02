import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Calculator, Check, ChevronRight, CircleAlert, Landmark, Loader2, Plus, RefreshCw, Scale, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CabecalhoSecao, CartaoKpi, EstadoVazio, EtiquetaStatus, HeroDashboard } from "@/components/dashboard/PrimitivosDashboard";
import { buscarBalancoEconomico, buscarOpcoesLancamento, criarLancamentoEconomico, formatarCentavos, formatarData, formatarMoeda, type BalancoEconomico, type LancamentoEconomico, type OpcoesLancamento } from "@/lib/financeiro-share-api";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

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

function parseValorReais(value: string) {
  const normalizado = value.trim().replace(/\s/g, "");
  if (!normalizado) return Number.NaN;
  const numero = normalizado.includes(",")
    ? Number(normalizado.replace(/\./g, "").replace(",", "."))
    : Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : Number.NaN;
}

function tomFluxo(fluxo: string) {
  return fluxo === "ENTRADA" ? "green" : "amber";
}

function statusFinanceiro(status: string) {
  const valor = status.toLowerCase();
  if (["pago", "quitado", "conciliado", "aprovado"].includes(valor)) return { label: "Pago", tone: "green" as const };
  if (["cancelado", "reprovado"].includes(valor)) return { label: "Cancelado", tone: "red" as const };
  return { label: "Pendente", tone: "amber" as const };
}

function nomeCotista(id: string, opcoes: OpcoesLancamento | null) {
  return opcoes?.cotistas?.find((cotista) => cotista.id === id)?.nome || id;
}

export default function DashboardGestorFinanceiro() {
  const [dados, setDados] = useState<BalancoEconomico | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [inicio, setInicio] = useState(primeiroDiaDoMes);
  const [fim, setFim] = useState(ultimoDiaDoMes);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const [balanco, novasOpcoes] = await Promise.all([
        buscarBalancoEconomico(inicio, fim),
        opcoes ? Promise.resolve(opcoes) : buscarOpcoesLancamento(),
      ]);
      setDados(balanco);
      if (!opcoes) setOpcoes(novasOpcoes);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os dados financeiros reais.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [fim, inicio, opcoes]);

  useEffect(() => { void carregar(); }, [carregar]);

  const movimentacoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.lancamentos || []).filter((item) => !termo || [item.descricao, item.categoria, item.grupoCategoria, item.pagoPor].some((campo) => campo.toLowerCase().includes(termo))).sort((a, b) => b.data.localeCompare(a.data));
  }, [busca, dados?.lancamentos]);

  const resumo = useMemo(() => {
    const lancamentos = dados?.lancamentos || [];
    const entradas = lancamentos.filter((item) => item.fluxo === "ENTRADA").reduce((total, item) => total + item.valorCentavos, 0);
    const saidas = lancamentos.filter((item) => item.fluxo === "SAIDA").reduce((total, item) => total + item.valorCentavos, 0);
    const pendentes = lancamentos.filter((item) => !["pago", "quitado", "conciliado", "cancelado"].includes(item.status.toLowerCase())).length;
    const creditos = (dados?.saldos || []).filter((item) => item.saldoCentavos > 0).reduce((total, item) => total + item.saldoCentavos, 0);
    return { entradas, saidas, saldo: entradas - saidas, pendentes, creditos };
  }, [dados]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, number>();
    (dados?.lancamentos || []).filter((item) => item.fluxo === "SAIDA").forEach((item) => mapa.set(item.grupoCategoria || "Sem grupo", (mapa.get(item.grupoCategoria || "Sem grupo") || 0) + item.valorCentavos));
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [dados?.lancamentos]);

  const abrirNovo = async () => {
    if (!opcoes) {
      try { setOpcoes(await buscarOpcoesLancamento()); } catch { toast.error("Não foi possível carregar as opções do lançamento."); return; }
    }
    setNovoAberto(true);
  };

  return (
    <div className="route-enter">
      <HeroDashboard ambiente="gestor" title="Controle financeiro" subtitle="Lançamentos, rateios e compensação econômica">
        <Button type="button" onClick={() => void abrirNovo()} className="h-10 gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"><Plus size={15} /> Novo lançamento</Button>
      </HeroDashboard>

      {erro && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]"><span>{erro}</span><Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 border-[#e77b80]/40 bg-transparent text-[10px] text-[#ed8c90]">Tentar novamente</Button></div>}

      <section className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-3 md:flex-row md:items-end md:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Período de análise</p><p className="mt-1 text-xs text-muted-foreground">Os valores abaixo vêm do D1 e respeitam as datas informadas.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="space-y-1"><Label className="text-[10px]">Início</Label><Input type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} className="h-9 w-full text-xs sm:w-[145px]" /></div><div className="space-y-1"><Label className="text-[10px]">Fim</Label><Input type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} className="h-9 w-full text-xs sm:w-[145px]" /></div><Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-9 gap-2 border-border text-[10px]"><RefreshCw size={13} className={atualizando ? "animate-spin" : ""} /> Atualizar</Button></div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoKpi label="Saldo do caixa" value={carregando ? "—" : formatarCentavos(resumo.saldo)} detail="Entradas menos saídas no período" tone={resumo.saldo >= 0 ? "green" : "red"} icon={<WalletCards size={16} />} />
        <CartaoKpi label="Entradas" value={carregando ? "—" : formatarCentavos(resumo.entradas)} detail="Aportes, reembolsos e devoluções" tone="blue" icon={<ArrowDownRight size={16} />} />
        <CartaoKpi label="Saídas" value={carregando ? "—" : formatarCentavos(resumo.saidas)} detail="Despesas financeiras registradas" tone="amber" icon={<ArrowUpRight size={16} />} />
        <CartaoKpi label="Créditos a compensar" value={carregando ? "—" : formatarCentavos(resumo.creditos)} detail={`${resumo.pendentes} lançamento(s) pendente(s)`} tone="violet" icon={<Scale size={16} />} />
      </div>

      <div className="mb-5 grid gap-2 md:grid-cols-3">
        <ResumoConceito icon={<Landmark size={15} />} titulo="Lançamento financeiro" detalhe="O que entrou ou saiu do caixa" valor={`${dados?.lancamentos?.length || 0} registros`} />
        <ResumoConceito icon={<Calculator size={15} />} titulo="Rateio econômico" detalhe="Quanto cada cotista deveria suportar" valor={`${dados?.saldos?.length || 0} cotistas`} />
        <ResumoConceito icon={<WalletCards size={15} />} titulo="Movimentação de caixa" detalhe="Quem depositou, antecipou ou reembolsou" valor={`${dados?.holdings?.length || 0} holdings`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<ArrowUpRight size={15} />} title="Movimentação por grupo" detail="Saídas econômicas no período" />{grupos.length ? <div className="space-y-4 p-5">{grupos.map(([grupo, valor], index) => { const maior = grupos[0]?.[1] || 1; return <div key={grupo}><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="truncate font-semibold">{grupo}</span><span className="font-mono text-muted-foreground">{formatarCentavos(valor)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${index === 0 ? "bg-primary" : index === 1 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.max(8, (valor / maior) * 100)}%` }} /></div></div>; })}</div> : <EstadoVazio label="Nenhuma saída no período" />}</section>
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Scale size={15} />} title="Compensação entre cotistas" detail="Valores líquidos por credor e devedor" />{dados?.saldos?.length ? <div className="divide-y divide-border/60">{dados.saldos.slice(0, 5).map((saldo) => <div key={saldo.cotista} className="flex items-center gap-3 px-4 py-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${saldo.saldoCentavos >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}><Scale size={14} /></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{nomeCotista(saldo.cotista, opcoes)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Pago {formatarCentavos(saldo.totalPagoCentavos)} · devido {formatarCentavos(saldo.totalDevidoCentavos)}</p></div><div className="text-right"><p className={`font-mono text-[11px] font-bold ${saldo.saldoCentavos >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{saldo.saldoCentavos >= 0 ? "+" : "−"}{formatarCentavos(Math.abs(saldo.saldoCentavos))}</p><p className="text-[9px] text-muted-foreground">{saldo.saldoCentavos >= 0 ? "a receber" : "a pagar"}</p></div></div>)}</div> : <EstadoVazio label="Nenhum saldo de cotista" />}</section>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Landmark size={15} />} title="Lançamentos financeiros" detail="Entradas, saídas, pagadores e rateio econômico" action={<Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar lançamento" className="h-8 w-[155px] text-[10px]" />} />{carregando ? <div className="space-y-3 p-5"><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /></div> : movimentacoes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Lançamento</th><th className="px-4 py-3">Fluxo</th><th className="px-4 py-3">Pagador / caixa</th><th className="px-4 py-3">Rateio</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{movimentacoes.map((item) => <LinhaLancamento key={item.id} item={item} opcoes={opcoes} />)}</tbody></table></div> : <EstadoVazio label="Nenhum lançamento encontrado" />}</section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Scale size={15} />} title="Matriz de compensação" detail="Quem deve reembolsar quem" />{Object.keys(dados?.matrizCompensacao || {}).length ? <div className="overflow-x-auto p-4"><table className="w-full min-w-[560px] border-collapse text-left"><thead><tr><th className="border-b border-border p-2 text-[9px] uppercase tracking-[.1em] text-muted-foreground">Credor ↓ / devedor →</th>{Object.keys(dados?.matrizCompensacao || {}).map((id) => <th key={id} className="border-b border-border p-2 text-right text-[9px] uppercase tracking-[.1em] text-muted-foreground">{nomeCotista(id, opcoes).slice(0, 12)}</th>)}</tr></thead><tbody>{Object.entries(dados?.matrizCompensacao || {}).map(([credor, devedores]) => <tr key={credor} className="border-b border-border/50 last:border-0"><th className="p-2 text-[10px] font-bold">{nomeCotista(credor, opcoes).slice(0, 16)}</th>{Object.keys(dados?.matrizCompensacao || {}).map((devedor) => <td key={devedor} className={`p-2 text-right font-mono text-[10px] ${devedores[devedor] > 0 ? "font-bold text-emerald-300" : "text-muted-foreground/50"}`}>{devedores[devedor] > 0 ? formatarCentavos(devedores[devedor]) : "—"}</td>)}</tr>)}</tbody></table></div> : <EstadoVazio label="Nenhuma compensação pendente" />}</section>
        <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Landmark size={15} />} title="Holding" detail="Saldo bancário e participação dos sócios" />{dados?.holdings?.length ? <div className="divide-y divide-border/60">{dados.holdings?.map((holding) => <div key={holding.id} className="p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold">{holding.nome}</p><p className="mt-1 text-[10px] text-muted-foreground">{holding.contaBancaria || "Conta não informada"}</p></div><EtiquetaStatus tone="blue">{holding.socios.length} sócio(s)</EtiquetaStatus></div><div className="mt-3 space-y-2">{holding.socios.slice(0, 3).map((socio) => <div key={socio.cotistaId} className="flex items-center justify-between text-[10px]"><span className="truncate text-muted-foreground">{nomeCotista(socio.cotistaId, opcoes)} · {socio.percentual}%</span><span className="font-mono font-bold">{formatarCentavos(socio.saldoCentavos)}</span></div>)}</div></div>)}</div> : <EstadoVazio label="Nenhuma holding ativa" />}</section>
      </section>

      <NovoLancamentoDialog aberto={novoAberto} aoFechar={() => setNovoAberto(false)} opcoes={opcoes} aoCriar={async () => { setNovoAberto(false); await carregar(true); }} />
    </div>
  );
}

function ResumoConceito({ icon, titulo, detalhe, valor }: { icon: React.ReactNode; titulo: string; detalhe: string; valor: string }) {
  return <div className="rounded-xl border border-border bg-card/60 p-3.5"><div className="flex items-start justify-between gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">{icon}</span><ChevronRight size={14} className="mt-1 text-muted-foreground" /></div><p className="mt-3 text-[11px] font-bold">{titulo}</p><p className="mt-1 text-[10px] text-muted-foreground">{detalhe}</p><p className="mt-3 font-mono text-[11px] text-primary">{valor}</p></div>;
}

function LinhaLancamento({ item, opcoes }: { item: LancamentoEconomico; opcoes: OpcoesLancamento | null }) {
  const status = statusFinanceiro(item.status);
  const totalRateio = item.rateios.reduce((total, rateio) => total + rateio.percentual, 0);
  return <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3"><p className="max-w-[255px] truncate text-[10px] font-bold">{item.descricao}</p><p className="mt-1 text-[9px] text-muted-foreground">{formatarData(item.data)} · {item.categoria}</p></td><td className="px-4 py-3"><EtiquetaStatus tone={tomFluxo(item.fluxo) as "green" | "amber"}>{item.fluxo === "ENTRADA" ? "Entrada" : "Saída"}</EtiquetaStatus></td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{nomeCotista(item.pagoPor, opcoes)}</p><p className="mt-1 text-[9px] uppercase text-muted-foreground">{item.caixa}</p></td><td className="px-4 py-3"><p className="font-mono text-[10px]">{item.rateios.length} cotista(s)</p><p className="mt-1 text-[9px] text-muted-foreground">{totalRateio.toFixed(4)}%</p></td><td className={`px-4 py-3 text-right font-mono text-[10px] font-bold ${item.fluxo === "ENTRADA" ? "text-emerald-300" : "text-foreground"}`}>{item.fluxo === "ENTRADA" ? "+" : "−"}{formatarCentavos(item.valorCentavos)}</td><td className="px-4 py-3"><EtiquetaStatus tone={status.tone}>{status.label}</EtiquetaStatus></td></tr>;
}

type RateioDraft = { cotista: string; percentual: string };

type NovoLancamentoDialogProps = { aberto: boolean; aoFechar: () => void; opcoes: OpcoesLancamento | null; aoCriar: () => Promise<void> };

function NovoLancamentoDialog({ aberto, aoFechar, opcoes, aoCriar }: NovoLancamentoDialogProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [fluxo, setFluxo] = useState<"SAIDA" | "ENTRADA">("SAIDA");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [pagador, setPagador] = useState("DGA_ADM");
  const [caixa, setCaixa] = useState("SHARE");
  const [reembolsavel, setReembolsavel] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioDraft[]>([{ cotista: "", percentual: "100" }]);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setData(hoje());
    setPagador(opcoes?.pagadores[0]?.id || "DGA_ADM");
    setCategoriaId(opcoes?.categorias[0]?.id || "");
    setRateios(opcoes?.cotistas[0] ? [{ cotista: opcoes.cotistas[0].id, percentual: "100" }] : [{ cotista: "", percentual: "100" }]);
  }, [aberto, opcoes]);

  const totalPercentual = rateios.reduce((total, rateio) => total + (Number(rateio.percentual) || 0), 0);

  const fechar = () => { if (salvando) return; aoFechar(); };
  const salvar = async () => {
    const categoria = opcoes?.categorias?.find((item) => item.id === categoriaId);
    const valorCentavos = parseValorReais(valor);
    const percentuais = rateios.map((rateio) => Number(rateio.percentual));
    setErro(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("A data deve estar no formato YYYY-MM-DD.");
    if (!descricao.trim()) return setErro("Informe a descrição do lançamento.");
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) return setErro("Informe um valor positivo em reais.");
    if (!pagador.trim()) return setErro("Informe quem realizou o pagamento.");
    if (!categoria) return setErro("Selecione uma categoria financeira.");
    if (!rateios.length || rateios.some((rateio) => !rateio.cotista)) return setErro("Informe o cotista em todas as linhas de rateio.");
    if (percentuais.some((percentual) => !Number.isFinite(percentual) || percentual < 0)) return setErro("Não é permitido percentual negativo.");
    if (Math.abs(totalPercentual - 100) > 0.0001) return setErro(`O rateio precisa somar exatamente 100%. Soma atual: ${totalPercentual.toFixed(4)}%.`);

    setSalvando(true);
    try {
      await criarLancamentoEconomico({
        data,
        descricao: descricao.trim(),
        categoria: categoria.nome,
        grupoCategoria: categoria.grupo || undefined,
        fluxo,
        valorCentavos,
        pagoPor: pagador,
        caixa,
        reembolsavel,
        status: "PAGO",
        observacoes: observacoes.trim() || undefined,
        rateios: rateios.map((rateio) => ({ cotista: rateio.cotista, percentual: Number(rateio.percentual) })),
      });
      toast.success("Lançamento financeiro registrado com sucesso.");
      setDescricao(""); setValor(""); setObservacoes("");
      await aoCriar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível registrar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  return <Dialog open={aberto} onOpenChange={(estado) => { if (!estado) fechar(); }}><DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-2xl border-border bg-card/95 backdrop-blur"><DialogHeader><DialogTitle className="text-lg font-bold tracking-[-.02em]">Novo lançamento financeiro</DialogTitle><DialogDescription className="text-[11px] text-muted-foreground">Registre o movimento do caixa, a pessoa que pagou e a responsabilidade econômica de cada cotista.</DialogDescription></DialogHeader>{erro && <div className="flex items-start gap-2 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[11px] text-[#ed8c90]"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>{erro}</span></div>}<div className="grid gap-4 py-1 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Input value={descricao} onChange={(evento) => setDescricao(evento.target.value)} placeholder="Ex.: Seguro da aeronave" /></div><div className="space-y-2"><Label>Fluxo</Label><Select value={fluxo} onValueChange={(value) => setFluxo(value as "SAIDA" | "ENTRADA")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SAIDA">Saída · despesa</SelectItem><SelectItem value="ENTRADA">Entrada · aporte/reembolso</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Valor (R$)</Label><Input inputMode="decimal" value={valor} onChange={(evento) => setValor(evento.target.value)} placeholder="0,00" /></div><div className="space-y-2"><Label>Data · YYYY-MM-DD</Label><Input type="date" value={data} onChange={(evento) => setData(evento.target.value)} /></div><div className="space-y-2"><Label>Caixa</Label><Select value={caixa} onValueChange={setCaixa}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SHARE">Share Brasil</SelectItem><SelectItem value="HOLDING">Holding</SelectItem><SelectItem value="COTISTA">Cotista</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Categoria</Label><Select value={categoriaId} onValueChange={setCategoriaId}><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger><SelectContent className="max-h-[280px]">{opcoes?.categorias?.map((categoria) => <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Quem pagou?</Label><Select value={pagador} onValueChange={setPagador}><SelectTrigger><SelectValue placeholder="Selecione o pagador" /></SelectTrigger><SelectContent>{opcoes?.pagadores?.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 sm:col-span-2"><input id="reembolsavel" type="checkbox" checked={reembolsavel} onChange={(evento) => setReembolsavel(evento.target.checked)} className="h-4 w-4 accent-primary" /><Label htmlFor="reembolsavel" className="cursor-pointer text-[11px]">Despesa reembolsável pela pessoa/cliente responsável</Label></div><div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.03] p-4 sm:col-span-2"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold">Rateio econômico</p><p className="mt-1 text-[10px] text-muted-foreground">Quanto cada cotista deveria suportar. A soma deve ser exatamente 100%.</p></div><span className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold ${Math.abs(totalPercentual - 100) <= 0.0001 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{totalPercentual.toFixed(4)}%</span></div>{rateios.map((rateio, index) => <div key={`${index}-${rateio.cotista}`} className="grid gap-2 sm:grid-cols-[1fr_145px_34px]"><Select value={rateio.cotista} onValueChange={(value) => setRateios((atual) => atual.map((linha, linhaIndex) => linhaIndex === index ? { ...linha, cotista: value } : linha))}><SelectTrigger><SelectValue placeholder="Selecione o cotista" /></SelectTrigger><SelectContent>{opcoes?.cotistas?.map((cotista) => <SelectItem key={cotista.id} value={cotista.id}>{cotista.nome}</SelectItem>)}</SelectContent></Select><Input inputMode="decimal" value={rateio.percentual} onChange={(evento) => setRateios((atual) => atual.map((linha, linhaIndex) => linhaIndex === index ? { ...linha, percentual: evento.target.value } : linha))} placeholder="Percentual" /><Button type="button" variant="ghost" onClick={() => setRateios((atual) => atual.length === 1 ? atual : atual.filter((_, linhaIndex) => linhaIndex !== index))} className="h-10 px-2 text-muted-foreground hover:text-red-300"><X size={14} /></Button></div>)}<Button type="button" variant="outline" onClick={() => setRateios((atual) => [...atual, { cotista: "", percentual: "0" }])} className="h-8 gap-2 border-dashed text-[10px]"><Plus size={13} /> Adicionar cotista</Button></div><div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} placeholder="Detalhes para auditoria do lançamento" /></div></div><DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button><Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">{salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar lançamento</Button></DialogFooter></DialogContent></Dialog>;
}
