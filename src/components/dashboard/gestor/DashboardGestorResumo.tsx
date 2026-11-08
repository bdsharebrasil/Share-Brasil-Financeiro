import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HeroDashboard } from "@/components/dashboard/ComponentesDashboard";
import {
  formatarMoeda,
  buscarOpcoesFinanceiroShare,
  buscarSolicitacoesBaixaPortal,
  type ContaBancaria,
  type SolicitacaoBaixaPortal,
} from "@/lib/financeiro-share-api";
import {
  buscarFeriasCorporativas,
  buscarPerfilColaborador,
  type SolicitacaoFerias,
} from "@/lib/colaborador-api";
import { useContasAPagar } from "@/hooks/useContasAPagar";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import { LancamentosUnificados } from "@/components/financeiro-share/LancamentosUnificados";
import {
  linhasDeContasAPagar,
  linhasDeContasAReceber,
  type FluxoLinha,
} from "@/components/financeiro-share/linhas-contas";
import { AbaSolicitacoesBaixaPortal } from "@/components/financeiro-share/AbaSolicitacoesBaixaPortal";
import { AbaMovimentosHolding } from "@/components/financeiro-share/AbaMovimentosHolding";
import { AbaSalarios } from "@/components/financeiro-share/AbaSalarios";
import NFSaidaTab from "@/components/financeiro-share/NFSaidaTab";

/* -------------------------------------------------------------------------- */
/*  Tipos e constantes                                                        */
/* -------------------------------------------------------------------------- */

type Modulo = "entrada" | "saida" | "baixas" | "holding" | "folha" | "nf-saida";
type SituacaoFiltro = "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";
type Tom = "receber" | "pagar" | "alerta" | "info";

type FiltrosModulo = { situacao?: string; inicio?: string; fim?: string };

const modulos: Array<{ id: Modulo; rotulo: string; detalhe: string; Icon: LucideIcon }> = [
  { id: "entrada", rotulo: "Registrar entrada", detalhe: "Recebimentos, aportes e receitas", Icon: TrendingUp },
  { id: "saida", rotulo: "Registrar saída", detalhe: "Pagamentos, despesas e fornecedores", Icon: TrendingDown },
  { id: "baixas", rotulo: "Baixa cotista portal", detalhe: "Conferir recibos enviados pelos cotistas", Icon: CheckCircle2 },
  { id: "holding", rotulo: "Holding", detalhe: "Movimentos financeiros das holdings", Icon: Building2 },
  { id: "folha", rotulo: "Folha de pagamento", detalhe: "Salários, benefícios e férias", Icon: Users },
  { id: "nf-saida", rotulo: "NF de saída", detalhe: "Notas e recibos de saída", Icon: FileText },
];

const SITUACOES: SituacaoFiltro[] = ["PENDENTE", "ATRASADO", "PAGO", "CANCELADO"];

/** Classes estáticas (o Tailwind precisa enxergar a string completa) — funcionam em light e dark. */
const TONS: Record<Tom, string> = {
  receber: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pagar: "bg-red-500/10 text-red-700 dark:text-red-400",
  alerta: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* -------------------------------------------------------------------------- */
/*  Utilitários de data / soma                                                */
/* -------------------------------------------------------------------------- */

function saudacaoAtual() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dataMaisDias(dias: number) {
  const d = new Date(`${hojeISO()}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const somar = (linhas: Array<{ valor: number }>) => linhas.reduce((s, l) => s + l.valor, 0);
const titulos = (n: number) => `${n} ${n === 1 ? "título" : "títulos"}`;

/* -------------------------------------------------------------------------- */
/*  Subcomponentes de apresentação                                            */
/* -------------------------------------------------------------------------- */

function Valor({ carregando, children, className = "" }: { carregando: boolean; children: React.ReactNode; className?: string }) {
  if (carregando) return <span className="skeleton mt-1 block h-7 w-28 max-w-full rounded-md" aria-hidden />;
  return <span className={className}>{children}</span>;
}

function CabecalhoSecao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="mb-1.5 min-w-0">
      <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-xs text-muted-foreground sm:text-[13px]">{descricao}</p>}
    </div>
  );
}

type CelulaFluxoProps = {
  rotulo: string;
  tom: Extract<Tom, "receber" | "pagar">;
  Icon: LucideIcon;
  total: number;
  quantidade: number;
  carregando: boolean;
  onClick: () => void;
};

function CelulaFluxo({ rotulo, total, quantidade, carregando, onClick }: CelulaFluxoProps) {
  const texto = formatarMoeda(total);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${rotulo}: ${carregando ? "carregando" : texto}, ${titulos(quantidade)}`}
      className={`flex min-w-0 flex-col justify-center border-l border-border px-3 py-2 text-left transition-colors hover:bg-muted/50 motion-reduce:transition-none sm:px-4 ${FOCO} focus-visible:ring-inset focus-visible:ring-offset-0`}
    >
      <Valor carregando={carregando} className="block truncate text-sm font-bold tabular-nums leading-tight text-foreground sm:text-base">
        <span title={texto}>{texto}</span>
      </Valor>
      <span className="mt-0.5 block truncate text-[11px] leading-none text-muted-foreground">
        {carregando ? "Carregando…" : titulos(quantidade)}
      </span>
    </button>
  );
}

type LinhaPendenciaProps = {
  rotulo: string;
  nota: string;
  contagem: number;
  tom: Extract<Tom, "alerta" | "info">;
  Icon: LucideIcon;
  carregando: boolean;
  onClick: () => void;
};

function LinhaPendencia({ rotulo, nota, contagem, tom, Icon, carregando, onClick }: LinhaPendenciaProps) {
  const destaque = !carregando && contagem > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${rotulo}: ${carregando ? "carregando" : contagem}`}
      className={`group flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50 motion-reduce:transition-none sm:px-4 ${FOCO} focus-visible:ring-inset focus-visible:ring-offset-0`}
    >
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${TONS[tom]}`}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{rotulo}</span>
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">{nota}</span>
      </span>
      <span className={`min-w-7 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${destaque ? TONS[tom] : "bg-muted text-muted-foreground"}`}>
        {carregando ? "—" : contagem}
      </span>
      <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
    </button>
  );
}

function AtalhoModulo({ rotulo, detalhe, Icon, onClick }: { rotulo: string; detalhe: string; Icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={detalhe}
      className={`group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg motion-reduce:transition-none ${FOCO}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground motion-reduce:transition-none">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] font-semibold leading-tight text-foreground">{rotulo}</strong>
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">{detalhe}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componente principal                                                      */
/* -------------------------------------------------------------------------- */

export default function DashboardGestorResumo({ aoNavegar }: { aoNavegar: (menu: string, aba?: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const valorModulo = query.get("modulo") as Modulo | null;
  const modulo: Modulo | null = modulos.some((m) => m.id === valorModulo) ? valorModulo : null;
  const moduloAtual = modulo ? modulos.find((m) => m.id === modulo) : null;

  const [nome, setNome] = useState("Gestor");
  const [baixas, setBaixas] = useState<SolicitacaoBaixaPortal[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [ferias, setFerias] = useState<SolicitacaoFerias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const quantidadeAnterior = useRef<number | null>(null);

  const contasPagar = useContasAPagar();
  const contasReceber = useContasAReceber();

  const lancamentos = useMemo(
    () => [...linhasDeContasAPagar(contasPagar.contas), ...linhasDeContasAReceber(contasReceber.contas)],
    [contasPagar.contas, contasReceber.contas],
  );

  const recarregarLancamentos = () => {
    contasPagar.recarregar();
    contasReceber.recarregar();
  };

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setErro(null);
    try {
      const [baixasResp, feriasResp] = await Promise.all([
        buscarSolicitacoesBaixaPortal(),
        buscarFeriasCorporativas(hojeISO()).catch(() => null),
      ]);
      setBaixas(baixasResp.solicitacoes || []);
      setFerias(feriasResp?.registros || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o resumo.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    void buscarPerfilColaborador()
      .then((r) => setNome(r.perfil.nome_exibicao || r.perfil.nome_completo || "Gestor"))
      .catch(() => undefined);
    void buscarOpcoesFinanceiroShare()
      .then((r) => setContasBancarias(r.contas_bancarias))
      .catch(() => undefined);

    const timer = window.setInterval(() => void carregar(true), 30_000);
    const aoFocar = () => void carregar(true);
    window.addEventListener("focus", aoFocar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", aoFocar);
    };
  }, [carregar]);

  useEffect(() => {
    if (quantidadeAnterior.current !== null && baixas.length > quantidadeAnterior.current) {
      const novas = baixas.length - quantidadeAnterior.current;
      toast.info(`${novas} nova${novas === 1 ? " solicitação" : "s solicitações"} de baixa do Portal Cliente.`);
    }
    quantidadeAnterior.current = baixas.length;
  }, [baixas.length]);

  const resumo = useMemo(() => {
    const hoje = hojeISO();
    const limite = dataMaisDias(7);
    const pendentes = lancamentos.filter((l) => l.situacao === "PENDENTE" || l.situacao === "ATRASADO");
    const doDia = (fluxo: FluxoLinha) => pendentes.filter((l) => l.fluxo === fluxo && l.dataVencimento === hoje);
    const daSemana = (fluxo: FluxoLinha) =>
      pendentes.filter((l) => l.fluxo === fluxo && l.dataVencimento && l.dataVencimento >= hoje && l.dataVencimento <= limite);

    return {
      receberHoje: doDia("ENTRADA"),
      pagarHoje: doDia("SAIDA"),
      receberSemana: daSemana("ENTRADA"),
      pagarSemana: daSemana("SAIDA"),
      feriasPendentes: ferias.filter((f) => f.status === "solicitada"),
      feriasProximas: ferias.filter((f) => f.status === "aprovada" && f.data_inicio >= hoje && f.data_inicio <= dataMaisDias(10)),
    };
  }, [lancamentos, ferias]);

  const abrir = (id: Modulo, filtros?: FiltrosModulo) => {
    const params = new URLSearchParams({ modulo: id });
    if (filtros?.situacao) params.set("situacao", filtros.situacao);
    if (filtros?.inicio) params.set("inicio", filtros.inicio);
    if (filtros?.fim) params.set("fim", filtros.fim);
    navigate(`/?${params.toString()}`);
  };
  const voltar = () => navigate("/");

  const situacaoQuery = query.get("situacao") as SituacaoFiltro | null;
  const filtroInicial = {
    situacao: situacaoQuery && SITUACOES.includes(situacaoQuery) ? situacaoQuery : undefined,
    inicio: query.get("inicio") || undefined,
    fim: query.get("fim") || undefined,
  };

  const primeiroNome = nome.split(" ").filter(Boolean)[0] || "Gestor";

  const totalReceberSemana = somar(resumo.receberSemana);
  const totalPagarSemana = somar(resumo.pagarSemana);
  const saldoSemana = totalReceberSemana - totalPagarSemana;

  const hoje = hojeISO();
  const fim7 = dataMaisDias(7);

  const linhasFluxo: Array<{
    titulo: string;
    celulas: Array<Omit<CelulaFluxoProps, "carregando">>;
  }> = [
    {
      titulo: "Hoje",
      celulas: [
        {
          rotulo: "A receber",
          tom: "receber",
          Icon: TrendingUp,
          total: somar(resumo.receberHoje),
          quantidade: resumo.receberHoje.length,
          onClick: () => abrir("entrada", { situacao: "PENDENTE", inicio: hoje, fim: hoje }),
        },
        {
          rotulo: "A pagar",
          tom: "pagar",
          Icon: TrendingDown,
          total: somar(resumo.pagarHoje),
          quantidade: resumo.pagarHoje.length,
          onClick: () => abrir("saida", { situacao: "PENDENTE", inicio: hoje, fim: hoje }),
        },
      ],
    },
    {
      titulo: "7 dias",
      celulas: [
        {
          rotulo: "A receber",
          tom: "receber",
          Icon: CalendarClock,
          total: totalReceberSemana,
          quantidade: resumo.receberSemana.length,
          onClick: () => abrir("entrada", { situacao: "PENDENTE", inicio: hoje, fim: fim7 }),
        },
        {
          rotulo: "A pagar",
          tom: "pagar",
          Icon: CalendarClock,
          total: totalPagarSemana,
          quantidade: resumo.pagarSemana.length,
          onClick: () => abrir("saida", { situacao: "PENDENTE", inicio: hoje, fim: fim7 }),
        },
      ],
    },
  ];

  const pendencias: Array<Omit<LinhaPendenciaProps, "carregando">> = [
    {
      rotulo: "Baixas de cotistas",
      nota: "Aguardando conferência",
      contagem: baixas.length,
      tom: "alerta",
      Icon: Bell,
      onClick: () => abrir("baixas"),
    },
    {
      rotulo: "Férias solicitadas",
      nota: "Aguardando aprovação",
      contagem: resumo.feriasPendentes.length,
      tom: "alerta",
      Icon: Users,
      onClick: () => aoNavegar("ferias"),
    },
    {
      rotulo: "Férias nos próximos 10 dias",
      nota: "Já aprovadas",
      contagem: resumo.feriasProximas.length,
      tom: "info",
      Icon: CalendarClock,
      onClick: () => aoNavegar("ferias"),
    },
  ];

  return (
    <div className="route-enter mx-auto w-full min-w-0 max-w-[1480px] space-y-4 pb-8">
      {!modulo && (
        <HeroDashboard
          ambiente="gestor"
          title={`${saudacaoAtual()}, ${primeiroNome}`}
          subtitle="Resumo financeiro e visão executiva do que precisa da sua atenção hoje"
        >
          <Button
            type="button"
            onClick={() => {
              void carregar(true);
              void recarregarLancamentos();
            }}
            disabled={atualizando}
            variant="outline"
            className="h-9 w-full gap-2 border-white/20 bg-white/5 text-xs text-white hover:bg-white/10 sm:w-auto"
          >
            <RefreshCw size={14} className={atualizando ? "animate-spin" : ""} />
            {atualizando ? "Atualizando…" : "Atualizar"}
          </Button>
        </HeroDashboard>
      )}

      {erro && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="min-w-0 break-words">{erro}</span>
          <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {modulo ? (
        /* ------------------------------ Módulo aberto ------------------------------ */
        <section className="min-w-0 space-y-2" aria-label={moduloAtual?.rotulo}>
          <div className="flex justify-start -my-[9px] py-0 text-[11px] leading-[11px] font-light">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={voltar}
              className="mx-1 my-[4px] size-8 min-h-0 px-0 py-0 text-[10px] leading-[5px] font-light overflow-hidden rounded-[4px] [border-style:outset] border-[rgba(70,133,139,0.93)] text-muted-foreground hover:text-foreground"
              aria-label="Voltar ao dashboard"
              title="Voltar ao dashboard"
            >
              <ArrowLeft size={16} />
            </Button>
          </div>

          <div className="-ml-[11px] -mr-[44px] min-w-0 pl-0 pr-0">
            {modulo === "entrada" && <LancamentosUnificados key={location.search} fluxo="ENTRADA" filtroInicial={filtroInicial} />}
            {modulo === "saida" && <LancamentosUnificados key={location.search} fluxo="SAIDA" filtroInicial={filtroInicial} />}
            {modulo === "baixas" && (
              <AbaSolicitacoesBaixaPortal
                solicitacoes={baixas}
                carregando={carregando}
                erro={Boolean(erro)}
                contasBancarias={contasBancarias}
                aoAtualizar={async () => {
                  await carregar(true);
                }}
              />
            )}
            {modulo === "holding" && <AbaMovimentosHolding />}
            {modulo === "folha" && <AbaSalarios />}
            {modulo === "nf-saida" && <NFSaidaTab />}
          </div>
        </section>
      ) : (
        /* ------------------------------ Visão geral ------------------------------ */
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-12 xl:items-start">
            {/* Fluxo de caixa */}
            <section className="min-w-0 xl:col-span-7 2xl:col-span-8" aria-busy={carregando}>
              <CabecalhoSecao titulo="" />
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="grid grid-cols-[4rem_1fr_1fr] border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground sm:grid-cols-[6rem_1fr_1fr]">
                  <span className="px-3 py-1.5 sm:px-4">Vencimento</span>
                  <span className="flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-emerald-700 dark:text-emerald-400 sm:px-4">
                    <TrendingUp size={12} /> A receber
                  </span>
                  <span className="flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-red-700 dark:text-red-400 sm:px-4">
                    <TrendingDown size={12} /> A pagar
                  </span>
                </div>
                {linhasFluxo.map((linha) => (
                  <div key={linha.titulo} className="grid grid-cols-[4rem_1fr_1fr] border-b border-border sm:grid-cols-[6rem_1fr_1fr]">
                    <span className="flex items-center px-3 text-xs font-medium text-foreground sm:px-4">{linha.titulo}</span>
                    {linha.celulas.map((c) => (
                      <CelulaFluxo key={`${linha.titulo}-${c.rotulo}`} {...c} carregando={carregando} />
                    ))}
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-1.5 sm:px-4">
                  <span className="text-[11px] font-medium text-muted-foreground">Saldo previsto em 7 dias</span>
                  <Valor
                    carregando={carregando}
                    className={`text-xs font-bold tabular-nums sm:text-sm ${saldoSemana < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
                  >
                    {formatarMoeda(saldoSemana)}
                  </Valor>
                </div>
              </div>
            </section>

            {/* Pendências */}
            <section className="min-w-0 xl:col-span-5 2xl:col-span-4" aria-busy={carregando}>
              <CabecalhoSecao titulo="Precisa da sua atenção" />
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {pendencias.map((p) => (
                  <LinhaPendencia key={p.rotulo} {...p} carregando={carregando} />
                ))}
              </div>
            </section>
          </div>

          {/* Acesso rápido */}
          <section className="min-w-0">
            <CabecalhoSecao titulo="Acesso rápido" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {modulos.map(({ id, rotulo, detalhe, Icon }) => (
                <AtalhoModulo key={id} rotulo={rotulo} detalhe={detalhe} Icon={Icon} onClick={() => abrir(id)} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
