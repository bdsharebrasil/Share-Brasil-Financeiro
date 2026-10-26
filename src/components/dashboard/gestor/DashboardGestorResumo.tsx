import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bell, Building2, CalendarClock, FileText, RefreshCw, TrendingDown, TrendingUp, Users, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HeroDashboard } from "@/components/dashboard/ComponentesDashboard";
import { formatarMoeda, buscarOpcoesFinanceiroShare, buscarSolicitacoesBaixaPortal, type ContaBancaria, type SolicitacaoBaixaPortal } from "@/lib/financeiro-share-api";
import { buscarFeriasCorporativas, buscarPerfilColaborador, type SolicitacaoFerias } from "@/lib/colaborador-api";
import { useLancamentosUnificados, type FluxoUnificado } from "@/hooks/useLancamentosUnificados";
import { LancamentosUnificados } from "@/components/financeiro-share/LancamentosUnificados";
import { AbaSolicitacoesBaixaPortal } from "@/components/financeiro-share/AbaSolicitacoesBaixaPortal";
import { AbaMovimentosHolding } from "@/components/financeiro-share/AbaMovimentosHolding";
import { AbaSalarios } from "@/components/financeiro-share/AbaSalarios";
import NFSaidaTab from "@/components/financeiro-share/NFSaidaTab";
type Modulo = "entrada" | "saida" | "baixas" | "holding" | "folha" | "nf-saida";
const modulos: Array<{ id: Modulo; rotulo: string; detalhe: string; Icon: typeof Wallet }> = [
  { id: "entrada", rotulo: "Registrar entrada", detalhe: "Recebimentos, aportes e receitas", Icon: TrendingUp },
  { id: "saida", rotulo: "Registrar saída", detalhe: "Pagamentos, despesas e fornecedores", Icon: TrendingDown },
  { id: "baixas", rotulo: "Baixa cotista portal", detalhe: "Conferir recibos enviados pelos cotistas", Icon: CheckCircle2 },
  { id: "holding", rotulo: "Holding", detalhe: "Movimentos financeiros das holdings", Icon: Building2 },
  { id: "folha", rotulo: "Folha pagamento", detalhe: "Salários, benefícios e férias", Icon: Users },
  { id: "nf-saida", rotulo: "NF saída", detalhe: "Notas e recibos de saída", Icon: FileText },
];
function saudacaoAtual() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
function hojeISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function dataMaisDias(dias: number) { const d = new Date(`${hojeISO()}T12:00:00`); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
export default function DashboardGestorResumo({ aoNavegar }: { aoNavegar: (menu: string, aba?: string) => void }) {
  const location = useLocation(); const navigate = useNavigate();
  const valorModulo = new URLSearchParams(location.search).get("modulo") as Modulo | null;
  const modulo = modulos.some((m) => m.id === valorModulo) ? valorModulo : null;
  const [nome, setNome] = useState("Gestor"); const [baixas, setBaixas] = useState<SolicitacaoBaixaPortal[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]); const [ferias, setFerias] = useState<SolicitacaoFerias[]>([]);
  const [carregando, setCarregando] = useState(true); const [atualizando, setAtualizando] = useState(false); const [erro, setErro] = useState<string | null>(null);
  const quantidadeAnterior = useRef<number | null>(null); const { lancamentos, recarregar: recarregarLancamentos } = useLancamentosUnificados();
  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true); setErro(null);
    try { const [baixasResp, feriasResp] = await Promise.all([buscarSolicitacoesBaixaPortal(), buscarFeriasCorporativas(hojeISO()).catch(() => null)]); setBaixas(baixasResp.solicitacoes || []); setFerias(feriasResp?.registros || []); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível atualizar o resumo."); }
    finally { setCarregando(false); setAtualizando(false); }
  }, []);
  useEffect(() => {
    void carregar(); void buscarPerfilColaborador().then((r) => setNome(r.perfil.nome_exibicao || r.perfil.nome_completo || "Gestor")).catch(() => undefined);
    void buscarOpcoesFinanceiroShare().then((r) => setContasBancarias(r.contas_bancarias)).catch(() => undefined);
    const timer = window.setInterval(() => void carregar(true), 30_000); const focus = () => void carregar(true); window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [carregar]);
  useEffect(() => { if (quantidadeAnterior.current !== null && baixas.length > quantidadeAnterior.current) { const novas = baixas.length - quantidadeAnterior.current; toast.info(`${novas} nova${novas === 1 ? " solicitação" : "s solicitações"} de baixa do Portal Cliente.`); } quantidadeAnterior.current = baixas.length; }, [baixas.length]);
  const resumo = useMemo(() => {
    const hoje = hojeISO(); const limite = dataMaisDias(7); const pendentes = lancamentos.filter((l) => l.situacao === "PENDENTE" || l.situacao === "ATRASADO");
    const hojeFluxo = (fluxo: FluxoUnificado) => pendentes.filter((l) => l.fluxo === fluxo && l.dataVencimento === hoje);
    const semanaFluxo = (fluxo: FluxoUnificado) => pendentes.filter((l) => l.fluxo === fluxo && l.dataVencimento && l.dataVencimento >= hoje && l.dataVencimento <= limite);
    return { receberHoje: hojeFluxo("ENTRADA"), pagarHoje: hojeFluxo("SAIDA"), receberSemana: semanaFluxo("ENTRADA"), pagarSemana: semanaFluxo("SAIDA"), feriasPendentes: ferias.filter((f) => f.status === "solicitada"), feriasProximas: ferias.filter((f) => f.status === "aprovada" && f.data_inicio >= hoje && f.data_inicio <= dataMaisDias(10)) };
  }, [lancamentos, ferias]);
  const abrir = (id: Modulo, filtros?: { situacao?: string; inicio?: string; fim?: string }) => { const params = new URLSearchParams({ modulo: id }); if (filtros?.situacao) params.set("situacao", filtros.situacao); if (filtros?.inicio) params.set("inicio", filtros.inicio); if (filtros?.fim) params.set("fim", filtros.fim); navigate(`/?${params.toString()}`); }; const voltar = () => navigate("/");
  const query = new URLSearchParams(location.search);
  const filtroInicial = { situacao: query.get("situacao") === "PENDENTE" || query.get("situacao") === "ATRASADO" || query.get("situacao") === "PAGO" || query.get("situacao") === "CANCELADO" ? query.get("situacao") as "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO" : undefined, inicio: query.get("inicio") || undefined, fim: query.get("fim") || undefined };
  const tituloModulo = modulo ? modulos.find((m) => m.id === modulo)?.rotulo : null;
  const cards = [
    { label: "Contas a receber hoje", linhas: resumo.receberHoje, nota: `${resumo.receberHoje.length} títulos`, Icon: TrendingUp, click: () => abrir("entrada", { situacao: "PENDENTE", inicio: hojeISO(), fim: hojeISO() }), tom: "text-emerald-400" },
    { label: "Contas a pagar hoje", linhas: resumo.pagarHoje, nota: `${resumo.pagarHoje.length} títulos`, Icon: TrendingDown, click: () => abrir("saida", { situacao: "PENDENTE", inicio: hojeISO(), fim: hojeISO() }), tom: "text-red-400" },
    { label: "A receber na semana", linhas: resumo.receberSemana, nota: `${resumo.receberSemana.length} títulos`, Icon: CalendarClock, click: () => abrir("entrada", { situacao: "PENDENTE", inicio: hojeISO(), fim: dataMaisDias(7) }), tom: "text-emerald-400" },
    { label: "A pagar na semana", linhas: resumo.pagarSemana, nota: `${resumo.pagarSemana.length} títulos`, Icon: CalendarClock, click: () => abrir("saida", { situacao: "PENDENTE", inicio: hojeISO(), fim: dataMaisDias(7) }), tom: "text-red-400" },
  ];
  const primeiroNome = nome.split(" ").filter(Boolean)[0] || "Gestor";
  return <div className="route-enter mx-auto w-full max-w-[1480px] space-y-6 pb-10">
    <HeroDashboard ambiente="gestor" title={`${saudacaoAtual()}, ${primeiroNome}`} subtitle="Resumo financeiro e visão executiva do que precisa da sua atenção hoje">
      <Button type="button" onClick={() => { void carregar(true); void recarregarLancamentos(); }} disabled={atualizando} variant="outline" className="h-9 gap-2 border-white/20 bg-white/5 text-xs text-white backdrop-blur hover:bg-white/10"><RefreshCw size={14} className={atualizando ? "animate-spin" : ""}/> Atualizar</Button>
    </HeroDashboard>
    {erro && <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}<Button variant="outline" size="sm" onClick={() => void carregar()}>Tentar novamente</Button></div>}
    {modulo ? <section className="space-y-4"><div className="flex flex-wrap items-center gap-2 border-b border-border pb-3"><Button variant="ghost" onClick={voltar} className="gap-2"><ArrowLeft size={15}/> Voltar ao Dashboard</Button><span className="text-muted-foreground">/</span><h2 className="text-sm font-bold">{tituloModulo}</h2></div>
      {modulo === "entrada" && <LancamentosUnificados key={location.search} fluxo="ENTRADA" filtroInicial={filtroInicial}/>}{modulo === "saida" && <LancamentosUnificados key={location.search} fluxo="SAIDA" filtroInicial={filtroInicial}/>}
      {modulo === "baixas" && <AbaSolicitacoesBaixaPortal solicitacoes={baixas} carregando={carregando} erro={Boolean(erro)} contasBancarias={contasBancarias} aoAtualizar={async () => { await carregar(true); }}/>}
      {modulo === "holding" && <AbaMovimentosHolding/>}{modulo === "folha" && <AbaSalarios/>}{modulo === "nf-saida" && <NFSaidaTab/>}
    </section> : <>
      <section><h2 className="mb-3 text-xs font-extrabold uppercase tracking-[.16em] text-muted-foreground">Resumo do dia</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({label,linhas,nota,Icon,click,tom})=><button key={label} type="button" onClick={click} className="rounded-xl border border-border bg-card/75 p-4 text-left transition hover:border-primary/40 hover:bg-card"><div className={`flex items-center justify-between ${tom}`}><span className="text-[11px] font-bold text-foreground">{label}</span><Icon size={17}/></div><div className="mt-3 text-xl">{carregando ? "—" : formatarMoeda(linhas.reduce((s,l)=>s+l.valor,0))}</div><p className="mt-1 text-[10px] text-muted-foreground">{nota}</p></button>)}
        {[{label:"Solicitação de baixa cotista",count:baixas.length,note:`${baixas.length} aguardando conferência`,Icon:Bell,click:()=>abrir("baixas"),tom:"text-amber-400"},{label:"Solicitações de férias pendentes",count:resumo.feriasPendentes.length,note:"Aguardando aprovação",Icon:Users,click:()=>aoNavegar("ferias"),tom:"text-amber-400"},{label:"Férias nos próximos 10 dias",count:resumo.feriasProximas.length,note:"Férias aprovadas",Icon:CalendarClock,click:()=>aoNavegar("ferias"),tom:"text-sky-400"}].map(({label,count,note,Icon,click,tom})=><button key={label} type="button" onClick={click} className="rounded-xl border border-border bg-card/75 p-4 text-left transition hover:border-primary/40 hover:bg-card"><div className={`flex items-center justify-between ${tom}`}><span className="text-[11px] font-bold text-foreground">{label}</span><Icon size={17}/></div><div className="mt-3 text-xl font-extrabold">{carregando ? "—" : count}</div><p className="mt-1 text-[10px] text-muted-foreground">{note}</p></button>)}
      </div></section>
      <section><h2 className="mb-3 text-xs font-extrabold uppercase tracking-[.16em] text-muted-foreground">Acesso rápido</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modulos.map(({id,rotulo,detalhe,Icon})=><button key={id} type="button" onClick={()=>abrir(id)} className="group flex items-center gap-3 rounded-xl border border-border bg-card/75 p-4 text-left transition hover:border-primary/40 hover:bg-card"><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon size={17}/></span><span className="min-w-0 flex-1"><strong className="block text-xs">{rotulo}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{detalhe}</span></span><ArrowRight size={15} className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></button>)}</div></section>
    </>}
  </div>;
}
