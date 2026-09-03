import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabecalhoSecao, CartaoKpi, EstadoVazio, EtiquetaStatus, HeroDashboard } from "@/components/dashboard/PrimitivosDashboard";
import { formatarMoeda, formatarData } from "@/lib/financeiro-share-api";
import { buscarContasAPagar, buscarContasAReceber } from "@/lib/apiFinanceiroShare";
import type { ContaAPagar, ContaAReceber } from "@/components/financeiro-share/tipos";
import {
  buscarEnviosPagamento,
  buscarFeriasCorporativas,
  buscarPerfilColaborador,
  type EnvioPagamento,
  type FeriasCorporativasResponse,
  type SolicitacaoFerias,
} from "@/lib/colaborador-api";

function saudacaoAtual(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string): string {
  return nome.split(" ").filter(Boolean)[0] || "Gestor";
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasAte(dataISO: string): number {
  const hoje = new Date(hojeISO() + "T00:00:00");
  const alvo = new Date(dataISO.slice(0, 10) + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function statusVencimentoLabel(dataVencimento: string): { label: string; tone: "green" | "amber" | "red" } {
  const dias = diasAte(dataVencimento);
  if (dias < 0) return { label: "Atrasado", tone: "red" };
  if (dias === 0) return { label: "Vence hoje", tone: "amber" };
  if (dias <= 7) return { label: `Vence em ${dias}d`, tone: "amber" };
  return { label: `Vence em ${dias}d`, tone: "green" };
}

type ResumoGestor = {
  contasPagarProximas: ContaAPagar[];
  contasReceberAtraso: ContaAReceber[];
  enviosPendentes: EnvioPagamento[];
  feriasProximas: Array<SolicitacaoFerias & { nome_completo: string | null; nome_exibicao: string | null }>;
};

export default function DashboardGestorResumo({ aoNavegar }: { aoNavegar: (menu: string) => void }) {
  const [nomeColaborador, setNomeColaborador] = useState("Gestor");
  const [dados, setDados] = useState<ResumoGestor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [secaoExpandida, setSecaoExpandida] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setErro(null);
    try {
      const dataLimite = hojeISO();
      const daqui7dias = new Date();
      daqui7dias.setDate(daqui7dias.getDate() + 7);
      const limite7 = daqui7dias.toISOString().slice(0, 10);

      const [pagar, receber, envios, feriasResp] = await Promise.all([
        buscarContasAPagar({ vencidasAte: limite7 }),
        buscarContasAReceber({ vencidasAte: dataLimite }),
        buscarEnviosPagamento("reembolso"),
        buscarFeriasCorporativas(dataLimite).catch(() => null),
      ]);

      const contasPagarProximas = (pagar as ContaAPagar[])
        .filter((c) => c.status !== "PAGO" && c.status !== "CANCELADO")
        .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

      const contasReceberAtraso = (receber as ContaAReceber[])
        .filter((c) => c.status !== "PAGO" && c.status !== "CANCELADO" && diasAte(c.dataVencimento) < 0)
        .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

      const enviosPendentes = (envios.envios || []).filter(
        (e) => e.status === "pendente" || e.status === "aberto",
      );

      const feriasProximas = (feriasResp?.registros || [])
        .filter((r) => {
          const dias = diasAte(r.data_inicio);
          return dias >= 0 && dias <= 15 && r.status === "solicitada";
        })
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

      setDados({ contasPagarProximas, contasReceberAtraso, enviosPendentes, feriasProximas });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o resumo financeiro.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    void buscarPerfilColaborador()
      .then((r) => setNomeColaborador(r.perfil.nome_exibicao || r.perfil.nome_completo))
      .catch(() => undefined);
  }, [carregar]);

  const totais = useMemo(() => {
    if (!dados) return { pagar: 0, receber: 0, envios: 0, ferias: 0, totalAtencao: 0 };
    const pagar = dados.contasPagarProximas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const receber = dados.contasReceberAtraso.reduce((s, c) => s + Number(c.valor || 0), 0);
    const envios = dados.enviosPendentes.reduce((s, e) => s + Number(e.valor || 0), 0);
    const ferias = dados.feriasProximas.length;
    const totalAtencao = dados.contasPagarProximas.length + dados.contasReceberAtraso.length + dados.enviosPendentes.length + ferias;
    return { pagar, receber, envios, ferias, totalAtencao };
  }, [dados]);

  const nomeCurto = primeiroNome(nomeColaborador);
  const mensagemAtencao = carregando
    ? "Carregando suas pendências…"
    : totais.totalAtencao === 0
      ? `${saudacaoAtual()}, ${nomeCurto}. Tudo em dia — nenhuma pendência financeira precisa da sua atenção hoje.`
      : `${saudacaoAtual()}, ${nomeCurto}. Hoje você tem ${totais.totalAtencao} ${totais.totalAtencao === 1 ? "item que necessita" : "itens que necessitam"} da sua atenção.`;

  const expandir = (secao: string) => {
    setSecaoExpandida(secaoExpandida === secao ? null : secao);
  };

  return (
    <div className="route-enter">
      <HeroDashboard ambiente="gestor" title="Resumo financeiro" subtitle="Visão executiva do que precisa da sua atenção hoje">
        <Button type="button" onClick={() => void carregar(true)} disabled={atualizando} variant="outline" className="h-9 gap-2 border-white/20 bg-white/5 text-xs text-white backdrop-blur hover:bg-white/10">
          <RefreshCw size={14} className={atualizando ? "animate-spin" : ""} /> Atualizar
        </Button>
      </HeroDashboard>

      {erro && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">
          <span>{erro}</span>
          <Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 border-[#e77b80]/40 bg-transparent text-[10px] text-[#ed8c90]">Tentar novamente</Button>
        </div>
      )}

      {/* Cartão de atenção principal */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.06] to-transparent p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${totais.totalAtencao > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
              {totais.totalAtencao > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <div>
              <p className="text-sm font-bold tracking-[-.01em]">{mensagemAtencao}</p>
              {totais.totalAtencao > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {dados?.contasPagarProximas.length ?? 0} conta(s) a pagar próximas · {dados?.contasReceberAtraso.length ?? 0} em atraso · {dados?.enviosPendentes.length ?? 0} solicitação(ões) de pagamento · {dados?.feriasProximas.length ?? 0} férias próximas
                </p>
              )}
            </div>
          </div>
          {totais.totalAtencao > 0 && (
            <Button type="button" onClick={() => aoNavegar("financeiro-share")} className="h-9 gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
              Verificar agora <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </section>

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoKpi
          label="Contas a pagar próximas"
          value={carregando ? "—" : formatarMoeda(totais.pagar)}
          detail={`${dados?.contasPagarProximas.length ?? 0} conta(s) vencendo nos próximos 7 dias`}
          tone="amber"
          icon={<TrendingDown size={16} />}
        />
        <CartaoKpi
          label="Contas a receber em atraso"
          value={carregando ? "—" : formatarMoeda(totais.receber)}
          detail={`${dados?.contasReceberAtraso.length ?? 0} conta(s) vencidas não recebidas`}
          tone="red"
          icon={<TrendingUp size={16} />}
        />
        <CartaoKpi
          label="Solicitações de pagamento"
          value={carregando ? "—" : String(dados?.enviosPendentes.length ?? 0)}
          detail="Envios recebidos e ainda não verificados"
          tone="violet"
          icon={<Inbox size={16} />}
        />
        <CartaoKpi
          label="Férias próximas"
          value={carregando ? "—" : String(totais.ferias)}
          detail="Colaboradores com férias em até 15 dias"
          tone="blue"
          icon={<CalendarClock size={16} />}
        />
      </div>

      {/* Seções expansíveis */}
      <div className="space-y-4">
        {/* Contas a pagar próximas */}
        <SecaoExpansivel
          id="pagar"
          titulo="Contas a pagar próximas do vencimento"
          detalhe={`${dados?.contasPagarProximas.length ?? 0} conta(s) · ${formatarMoeda(totais.pagar)}`}
          icone={<Wallet size={15} />}
          expandida={secaoExpandida === "pagar"}
          aoAlternar={() => expandir("pagar")}
          onVerTodos={() => aoNavegar("financeiro-share")}
        >
          {carregando ? <SkeletonLinhas /> : (dados?.contasPagarProximas.length ?? 0) > 0 ? (
            <TabelaCompacta
              colunas={["Descrição", "Vencimento", "Valor", "Status"]}
              linhas={dados!.contasPagarProximas.slice(0, 5).map((c) => ({
                id: c.id,
                celulas: [
                  c.descricao || "—",
                  formatarData(c.dataVencimento),
                  formatarMoeda(Number(c.valor) || 0),
                  "",
                ],
                status: statusVencimentoLabel(c.dataVencimento),
              }))}
            />
          ) : <EstadoVazio label="Nenhuma conta a pagar próxima do vencimento" />}
        </SecaoExpansivel>

        {/* Contas a receber em atraso */}
        <SecaoExpansivel
          id="receber"
          titulo="Contas a receber em atraso"
          detalhe={`${dados?.contasReceberAtraso.length ?? 0} conta(s) · ${formatarMoeda(totais.receber)}`}
          icone={<TrendingUp size={15} />}
          expandida={secaoExpandida === "receber"}
          aoAlternar={() => expandir("receber")}
          onVerTodos={() => aoNavegar("financeiro-share")}
        >
          {carregando ? <SkeletonLinhas /> : (dados?.contasReceberAtraso.length ?? 0) > 0 ? (
            <TabelaCompacta
              colunas={["Descrição", "Vencimento", "Valor", "Status"]}
              linhas={dados!.contasReceberAtraso.slice(0, 5).map((c) => ({
                id: c.id,
                celulas: [
                  c.descricao || "—",
                  formatarData(c.dataVencimento),
                  formatarMoeda(Number(c.valor) || 0),
                  "",
                ],
                status: { label: "Atrasado", tone: "red" as const },
              }))}
            />
          ) : <EstadoVazio label="Nenhuma conta a receber em atraso" />}
        </SecaoExpansivel>

        {/* Solicitações de pagamento */}
        <SecaoExpansivel
          id="envios"
          titulo="Solicitações de pagamento recebidas"
          detalhe={`${dados?.enviosPendentes.length ?? 0} pendente(s) · ${formatarMoeda(totais.envios)}`}
          icone={<Inbox size={15} />}
          expandida={secaoExpandida === "envios"}
          aoAlternar={() => expandir("envios")}
          onVerTodos={() => aoNavegar("enviar-pagamento")}
        >
          {carregando ? <SkeletonLinhas /> : (dados?.enviosPendentes.length ?? 0) > 0 ? (
            <TabelaCompacta
              colunas={["Descrição", "Fornecedor", "Valor", "Status"]}
              linhas={dados!.enviosPendentes.slice(0, 5).map((e) => ({
                id: e.id,
                celulas: [
                  e.descricao || "—",
                  e.fornecedor || "—",
                  formatarMoeda(Number(e.valor) || 0),
                  "",
                ],
                status: { label: "Pendente", tone: "amber" as const },
              }))}
            />
          ) : <EstadoVazio label="Nenhuma solicitação de pagamento pendente" />}
        </SecaoExpansivel>

        {/* Férias próximas */}
        <SecaoExpansivel
          id="ferias"
          titulo="Férias próximas (15 dias)"
          detalhe={`${dados?.feriasProximas.length ?? 0} colaborador(es)`}
          icone={<CalendarClock size={15} />}
          expandida={secaoExpandida === "ferias"}
          aoAlternar={() => expandir("ferias")}
          onVerTodos={() => aoNavegar("ferias")}
        >
          {carregando ? <SkeletonLinhas /> : (dados?.feriasProximas.length ?? 0) > 0 ? (
            <div className="divide-y divide-border/60">
              {dados!.feriasProximas.map((f) => {
                const nome = f.nome_exibicao || f.nome_completo || "Colaborador";
                const dias = diasAte(f.data_inicio);
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400">
                      <CalendarClock size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold">{nome}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatarData(f.data_inicio)} → {formatarData(f.data_fim)} · {f.quantidade_dias} dias
                      </p>
                    </div>
                    <EtiquetaStatus tone={dias <= 3 ? "amber" : "blue"}>
                      {dias === 0 ? "Inicia hoje" : `Em ${dias}d`}
                    </EtiquetaStatus>
                  </div>
                );
              })}
            </div>
          ) : <EstadoVazio label="Nenhuma férias programada para os próximos 15 dias" />}
        </SecaoExpansivel>
      </div>
    </div>
  );
}

function SecaoExpansivel({
  id,
  titulo,
  detalhe,
  icone,
  expandida,
  aoAlternar,
  onVerTodos,
  children,
}: {
  id: string;
  titulo: string;
  detalhe: string;
  icone: React.ReactNode;
  expandida: boolean;
  aoAlternar: () => void;
  onVerTodos: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card/75">
      <button type="button" onClick={aoAlternar} className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-secondary/20">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-primary">{icone}</span>
          <div className="min-w-0">
            <h2 className="truncate text-xs font-bold">{titulo}</h2>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detalhe}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expandida && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onVerTodos(); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/10"
            >
              Ver todos <ArrowRight size={11} />
            </span>
          )}
          <ChevronRight size={15} className={`text-muted-foreground transition-transform ${expandida ? "rotate-90" : ""}`} />
        </div>
      </button>
      {expandida && <div>{children}</div>}
    </section>
  );
}

function TabelaCompacta({
  colunas,
  linhas,
}: {
  colunas: string[];
  linhas: Array<{ id: string; celulas: string[]; status?: { label: string; tone: "green" | "amber" | "red" } }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">
            {colunas.map((col) => (
              <th key={col} className="px-4 py-3">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
              {linha.celulas.map((cel, i) => (
                <td key={i} className={`px-4 py-3 text-[10px] ${i === 2 ? "text-right font-mono font-bold" : ""} ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>
                  {cel}
                </td>
              ))}
              <td className="px-4 py-3">
                {linha.status && <EtiquetaStatus tone={linha.status.tone}>{linha.status.label}</EtiquetaStatus>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonLinhas() {
  return (
    <div className="space-y-3 p-5">
      <div className="skeleton h-11 rounded-lg" />
      <div className="skeleton h-11 rounded-lg" />
      <div className="skeleton h-11 rounded-lg" />
    </div>
  );
}
