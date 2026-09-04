import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Loader2,
  Plane,
  Plus,
  RefreshCw,
  Scale,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CabecalhoSecao, CartaoKpi, EstadoVazio, EtiquetaStatus, HeroDashboard } from "@/components/dashboard/PrimitivosDashboard";
import {
  buscarBalancoEconomico,
  buscarOpcoesLancamento,
  criarLancamentoEconomico,
  formatarCentavos,
  formatarData,
  formatarMoeda,
  type BalancoEconomico,
  type LancamentoEconomico,
  type OpcoesLancamento,
} from "@/lib/financeiro-share-api";
import { buscarOpcoesEnvioPagamento, buscarCotistasAeronave, type CotistaAeronave, type OpcaoEnvioPagamento } from "@/lib/colaborador-api";

function hoje() { return new Date().toISOString().slice(0, 10); }
function primeiroDiaDoMes() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function ultimoDiaDoMes() { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().slice(0, 10); }

function parseValorReais(value: string): number {
  const n = value.trim().replace(/\./g, "").replace(",", ".");
  const num = Number(n);
  return Number.isFinite(num) ? Math.round(num * 100) : Number.NaN;
}

function nomeCotista(id: string, opcoes: OpcoesLancamento | null, cotistasAeronave: CotistaAeronave[]): string {
  const op = opcoes?.cotistas?.find((c) => c.id === id)?.nome;
  if (op) return op;
  const ca = cotistasAeronave.find((c) => c.id === id)?.nome;
  return ca || id;
}

const CORES_GRAFICO = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function DashboardFinanceiroCotista() {
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [opcoesEnvio, setOpcoesEnvio] = useState<OpcaoEnvioPagamento | null>(null);
  const [aeronaveId, setAeronaveId] = useState<string>("");
  const [cotistasAeronave, setCotistasAeronave] = useState<CotistaAeronave[]>([]);
  const [dados, setDados] = useState<BalancoEconomico | null>(null);
  const [inicio, setInicio] = useState(primeiroDiaDoMes);
  const [fim, setFim] = useState(ultimoDiaDoMes);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroAeronaves, setErroAeronaves] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregarOpcoes = useCallback(async () => {
    if (!opcoes) {
      try { setOpcoes(await buscarOpcoesLancamento()); }
      catch { setOpcoes({ categorias: [], contas_bancarias: [], cotistas: [], holdings: [], pagadores: [] }); }
    }
    if (!opcoesEnvio) {
      try {
        const envioOps = await buscarOpcoesEnvioPagamento();
        const aeronaves = Array.isArray(envioOps.aeronaves) ? envioOps.aeronaves : [];
        setOpcoesEnvio({ ...envioOps, aeronaves });
        if (!aeronaveId && aeronaves.length > 0) {
          setAeronaveId(aeronaves[0].id);
        }
      } catch (error) {
        setErroAeronaves(error instanceof Error ? error.message : "Não foi possível carregar a lista de aeronaves.");
      }
    }
  }, [opcoes, opcoesEnvio, aeronaveId]);

  const carregarCotistas = useCallback(async () => {
    if (!aeronaveId) { setCotistasAeronave([]); return; }
    try {
      const resp = await buscarCotistasAeronave(aeronaveId);
      setCotistasAeronave(resp.cotistas || []);
    } catch {
      setCotistasAeronave([]);
    }
  }, [aeronaveId]);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      const balanco = await buscarBalancoEconomico(inicio, fim);
      setDados(balanco);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os dados do cotista.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [fim, inicio]);

  useEffect(() => { void carregarOpcoes(); }, [carregarOpcoes]);
  useEffect(() => { void carregarCotistas(); }, [carregarCotistas]);
  useEffect(() => { void carregar(); }, [carregar]);

  const aeronaves = opcoesEnvio?.aeronaves ?? [];
  const aeronaveSelecionada = aeronaves.find((a) => a.id === aeronaveId);
  const idsCotistasAeronave = useMemo(() => new Set(cotistasAeronave.map((c) => c.id)), [cotistasAeronave]);

  const lancamentosFiltrados = useMemo(() => {
    if (!dados?.lancamentos) return [];
    return dados.lancamentos.filter((lanc) =>
      lanc.rateios.some((r) => idsCotistasAeronave.has(r.cotista)),
    ).sort((a, b) => b.data.localeCompare(a.data));
  }, [dados?.lancamentos, idsCotistasAeronave]);

  const saldosFiltrados = useMemo(() => {
    if (!dados?.saldos) return [];
    return dados.saldos.filter((s) => idsCotistasAeronave.has(s.cotista));
  }, [dados?.saldos, idsCotistasAeronave]);

  const resumo = useMemo(() => {
    const entradas = lancamentosFiltrados.filter((l) => l.fluxo === "ENTRADA").reduce((s, l) => s + l.valorCentavos, 0);
    const saidas = lancamentosFiltrados.filter((l) => l.fluxo === "SAIDA").reduce((s, l) => s + l.valorCentavos, 0);
    const custoRateado = lancamentosFiltrados
      .filter((l) => l.fluxo === "SAIDA")
      .reduce((s, l) => s + l.rateios.filter((r) => idsCotistasAeronave.has(r.cotista)).reduce((sub, r) => sub + r.valorCentavos, 0), 0);
    return { entradas, saidas, saldo: entradas - saidas, custoRateado };
  }, [lancamentosFiltrados, idsCotistasAeronave]);

  const gruposCusto = useMemo(() => {
    const mapa = new Map<string, number>();
    lancamentosFiltrados
      .filter((l) => l.fluxo === "SAIDA")
      .forEach((l) => {
        const grupo = l.grupoCategoria || "Sem grupo";
        const valorCotista = l.rateios.filter((r) => idsCotistasAeronave.has(r.cotista)).reduce((s, r) => s + r.valorCentavos, 0);
        mapa.set(grupo, (mapa.get(grupo) || 0) + valorCotista);
      });
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [lancamentosFiltrados, idsCotistasAeronave]);

  const dadosMensais = useMemo(() => {
    const mapa = new Map<string, { mes: string; saidas: number; entradas: number }>();
    lancamentosFiltrados.forEach((l) => {
      const mes = l.data.slice(0, 7);
      if (!mapa.has(mes)) mapa.set(mes, { mes, saidas: 0, entradas: 0 });
      const entry = mapa.get(mes)!;
      if (l.fluxo === "SAIDA") entry.saidas += l.valorCentavos;
      else entry.entradas += l.valorCentavos;
    });
    return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6);
  }, [lancamentosFiltrados]);

  const abrirNovo = async () => {
    if (!opcoes) {
      try { setOpcoes(await buscarOpcoesLancamento()); } catch { toast.error("Não foi possível carregar as opções."); return; }
    }
    setNovoAberto(true);
  };

  return (
    <div className="route-enter">
      <HeroDashboard ambiente="gestor" title="Financeiro Cotista" subtitle="Balanço econômico por aeronave e dados individuais dos cotistas">
        <Button type="button" onClick={() => void abrirNovo()} className="h-10 gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
          <Plus size={15} /> Novo lançamento cotista
        </Button>
      </HeroDashboard>

      {/* Seletor de aeronave */}
      <section className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Plane size={18} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Aeronave selecionada</p>
            {aeronaveSelecionada ? (
              <p className="mt-0.5 text-sm font-bold">{aeronaveSelecionada.matricula_registro} · {aeronaveSelecionada.fabricante} {aeronaveSelecionada.modelo}</p>
            ) : <p className="mt-0.5 text-sm text-muted-foreground">Selecione uma aeronave</p>}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label className="text-[10px]">Aeronave</Label>
            <Select value={aeronaveId} onValueChange={setAeronaveId}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[220px]"><SelectValue placeholder="Selecionar aeronave" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {aeronaves.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.matricula_registro} · {a.fabricante} {a.modelo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-full text-xs sm:w-[145px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-full text-xs sm:w-[145px]" />
          </div>
          <Button type="button" variant="outline" onClick={() => void carregar(true)} disabled={atualizando} className="h-9 gap-2 border-border text-[10px]">
            <RefreshCw size={13} className={atualizando ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </section>

      {erroAeronaves && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">
          <span>{erroAeronaves}</span>
          <Button type="button" variant="outline" onClick={() => { setErroAeronaves(null); void carregarOpcoes(); }} className="h-8 border-[#e77b80]/40 bg-transparent text-[10px] text-[#ed8c90]">Tentar novamente</Button>
        </div>
      )}

      {erro && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">
          <span>{erro}</span>
          <Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 border-[#e77b80]/40 bg-transparent text-[10px] text-[#ed8c90]">Tentar novamente</Button>
        </div>
      )}

      {/* KPIs da aeronave */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoKpi label="Saldo da aeronave" value={carregando ? "—" : formatarCentavos(resumo.saldo)} detail="Entradas menos saídas no período" tone={resumo.saldo >= 0 ? "green" : "red"} icon={<Wallet size={16} />} />
        <CartaoKpi label="Entradas" value={carregando ? "—" : formatarCentavos(resumo.entradas)} detail="Aportes e reembolsos" tone="blue" icon={<ArrowDownRight size={16} />} />
        <CartaoKpi label="Saídas" value={carregando ? "—" : formatarCentavos(resumo.saidas)} detail="Despesas da aeronave" tone="amber" icon={<ArrowUpRight size={16} />} />
        <CartaoKpi label="Custo rateado" value={carregando ? "—" : formatarCentavos(resumo.custoRateado)} detail="Quanto coube aos cotistas" tone="violet" icon={<Scale size={16} />} />
      </div>

      {/* Cotistas da aeronave */}
      <section className="mb-5 overflow-hidden rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<Plane size={15} />} title={`Cotistas · ${aeronaveSelecionada?.matricula_registro || "—"}`} detail="Participação e saldo individual de cada cotista" />
        {cotistasAeronave.length ? (
          <div className="divide-y divide-border/60">
            {cotistasAeronave.map((cotista) => {
              const saldo = saldosFiltrados.find((s) => s.cotista === cotista.id);
              return (
                <div key={cotista.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${saldo?.saldoCentavos != null && saldo.saldoCentavos >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>
                    <Scale size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold">{cotista.nome}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{cotista.percentual_sociedade}% de participação</p>
                  </div>
                  <div className="text-right">
                    {saldo ? (
                      <>
                        <p className={`font-mono text-[11px] font-bold ${saldo.saldoCentavos >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                          {saldo.saldoCentavos >= 0 ? "+" : "−"}{formatarCentavos(Math.abs(saldo.saldoCentavos))}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          Pago {formatarCentavos(saldo.totalPagoCentavos)} · Due {formatarCentavos(saldo.totalDevidoCentavos)}
                        </p>
                      </>
                    ) : <p className="text-[10px] text-muted-foreground">Sem movimentação</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EstadoVazio label="Nenhum cotista vinculado a esta aeronave" />}
      </section>

      {/* Gráficos */}
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        {/* Pie chart - custos por grupo */}
        <section className="overflow-hidden rounded-xl border border-border bg-card/75">
          <CabecalhoSecao icon={<TrendingDown size={15} />} title="Custos por categoria" detail="Distribuição das saídas rateadas" />
          {gruposCusto.length ? (
            <div className="p-5">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={gruposCusto} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                    {gruposCusto.map((_, i) => <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatarCentavos(v)}
                    contentStyle={{ background: "#111b29", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {gruposCusto.slice(0, 5).map((g, i) => (
                  <div key={g.nome} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-2 truncate">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES_GRAFICO[i % CORES_GRAFICO.length] }} />
                      <span className="truncate font-semibold">{g.nome}</span>
                    </span>
                    <span className="font-mono text-muted-foreground">{formatarCentavos(g.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EstadoVazio label="Nenhuma saída no período" />}
        </section>

        {/* Bar chart - mensal */}
        <section className="overflow-hidden rounded-xl border border-border bg-card/75">
          <CabecalhoSecao icon={<ArrowUpRight size={15} />} title="Evolução mensal" detail="Entradas e saídas dos últimos 6 meses" />
          {dadosMensais.length ? (
            <div className="p-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis tickFormatter={(v) => `${(v / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                  <Tooltip formatter={(v: number) => formatarCentavos(v)} contentStyle={{ background: "#111b29", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="saidas" name="Saídas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EstadoVazio label="Sem dados mensais no período" />}
        </section>
      </div>

      {/* Tabela de lançamentos */}
      <section className="overflow-hidden rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<Wallet size={15} />} title="Lançamentos da aeronave" detail="Entradas, saídas e rateios dos cotistas selecionados" />
        {carregando ? (
          <div className="space-y-3 p-5"><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /></div>
        ) : lancamentosFiltrados.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">
                  <th className="px-4 py-3">Lançamento</th>
                  <th className="px-4 py-3">Fluxo</th>
                  <th className="px-4 py-3">Pagador</th>
                  <th className="px-4 py-3">Rateio</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {lancamentosFiltrados.map((item) => {
                  const status = item.status.toLowerCase();
                  const tom = status === "pago" || status === "quitado" ? "green" : status === "cancelado" ? "red" : "amber";
                  const rateioCotistas = item.rateios.filter((r) => idsCotistasAeronave.has(r.cotista));
                  return (
                    <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <p className="max-w-[240px] truncate text-[10px] font-bold">{item.descricao}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">{formatarData(item.data)} · {item.categoria}</p>
                      </td>
                      <td className="px-4 py-3"><EtiquetaStatus tone={item.fluxo === "ENTRADA" ? "green" : "amber"}>{item.fluxo === "ENTRADA" ? "Entrada" : "Saída"}</EtiquetaStatus></td>
                      <td className="px-4 py-3"><p className="text-[10px] font-semibold">{nomeCotista(item.pagoPor, opcoes, cotistasAeronave)}</p><p className="mt-1 text-[9px] uppercase text-muted-foreground">{item.caixa}</p></td>
                      <td className="px-4 py-3"><p className="font-mono text-[10px]">{rateioCotistas.length} cotista(s)</p><p className="mt-1 text-[9px] text-muted-foreground">{rateioCotistas.reduce((s, r) => s + r.percentual, 0).toFixed(2)}%</p></td>
                      <td className={`px-4 py-3 text-right font-mono text-[10px] font-bold ${item.fluxo === "ENTRADA" ? "text-emerald-300" : "text-foreground"}`}>{item.fluxo === "ENTRADA" ? "+" : "−"}{formatarCentavos(item.valorCentavos)}</td>
                      <td className="px-4 py-3"><EtiquetaStatus tone={tom as "green" | "amber" | "red"}>{status === "pago" ? "Pago" : status === "cancelado" ? "Cancelado" : "Pendente"}</EtiquetaStatus></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EstadoVazio label="Nenhum lançamento para esta aeronave no período" />}
      </section>

      <NovoLancamentoCotistaDialog
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        opcoes={opcoes}
        cotistasAeronave={cotistasAeronave}
        aeronaveId={aeronaveId}
        aoCriar={async () => { setNovoAberto(false); await carregar(true); }}
      />
    </div>
  );
}

type RateioDraft = { cotista: string; percentual: string };

function NovoLancamentoCotistaDialog({
  aberto,
  aoFechar,
  opcoes,
  cotistasAeronave,
  aeronaveId,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  opcoes: OpcoesLancamento | null;
  cotistasAeronave: CotistaAeronave[];
  aeronaveId: string;
  aoCriar: () => Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [fluxo, setFluxo] = useState<"SAIDA" | "ENTRADA">("SAIDA");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [pagador, setPagador] = useState("");
  const [caixa, setCaixa] = useState("COTISTA");
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioDraft[]>([]);

  useEffect(() => {
    if (!aberto) return;
    setErroLocal(null);
    setData(hoje());
    setDescricao(""); setValor(""); setObservacoes("");
    setCategoriaId(opcoes?.categorias[0]?.id || "");
    setPagador(cotistasAeronave[0]?.id || opcoes?.pagadores[0]?.id || "");
    const totalCotistas = cotistasAeronave.length;
    if (totalCotistas > 0) {
      const pct = (100 / totalCotistas).toFixed(4);
      setRateios(cotistasAeronave.map((c) => ({ cotista: c.id, percentual: pct })));
    } else {
      setRateios([{ cotista: "", percentual: "100" }]);
    }
  }, [aberto, opcoes, cotistasAeronave]);

  const totalPercentual = rateios.reduce((total, r) => total + (Number(r.percentual) || 0), 0);

  const salvar = async () => {
    const categoria = opcoes?.categorias?.find((c) => c.id === categoriaId);
    const valorCentavos = parseValorReais(valor);
    setErroLocal(null);
    if (!descricao.trim()) return setErroLocal("Informe a descrição.");
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) return setErroLocal("Valor inválido.");
    if (!categoria) return setErroLocal("Selecione uma categoria.");
    if (!pagador) return setErroLocal("Informe quem pagou.");
    if (rateios.some((r) => !r.cotista)) return setErroLocal("Todos os rateios precisam de um cotista.");
    if (Math.abs(totalPercentual - 100) > 0.0001) return setErroLocal(`Rateio deve somar 100%. Atual: ${totalPercentual.toFixed(4)}%`);

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
        reembolsavel: true,
        status: "PAGO",
        observacoes: observacoes.trim() || undefined,
        aeronave_id: aeronaveId || undefined,
        rateios: rateios.map((r) => ({ cotista: r.cotista, percentual: Number(r.percentual) })),
      });
      toast.success("Lançamento cotista registrado.");
      await aoCriar();
    } catch (error) {
      setErroLocal(error instanceof Error ? error.message : "Erro ao registrar lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  const fechar = () => { if (salvando) return; aoFechar(); };

  return (
    <Dialog open={aberto} onOpenChange={(estado) => { if (!estado) fechar(); }}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-2xl border-border bg-card/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-[-.02em]">Novo lançamento cotista</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">Registre a despesa da aeronave e o rateio entre os cotistas vinculados.</DialogDescription>
        </DialogHeader>

        {erroLocal && <div className="flex items-start gap-2 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[11px] text-[#ed8c90]"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>{erroLocal}</span></div>}

        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Hangaragem mensal" /></div>
          <div className="space-y-2">
            <Label>Fluxo</Label>
            <Select value={fluxo} onValueChange={(v) => setFluxo(v as "SAIDA" | "ENTRADA")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="SAIDA">Saída · despesa</SelectItem><SelectItem value="ENTRADA">Entrada · aporte/reembolso</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Valor (R$)</Label><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></div>
          <div className="space-y-2"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">{opcoes?.categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quem pagou?</Label>
            <Select value={pagador} onValueChange={setPagador}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cotistasAeronave.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                {opcoes?.pagadores?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Caixa</Label>
            <Select value={caixa} onValueChange={setCaixa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="COTISTA">Cotista</SelectItem><SelectItem value="SHARE">Share Brasil</SelectItem><SelectItem value="HOLDING">Holding</SelectItem></SelectContent>
            </Select>
          </div>

          {/* Rateio */}
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.03] p-4 sm:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold">Rateio econômico</p><p className="mt-1 text-[10px] text-muted-foreground">Distribuído entre os cotistas da aeronave. Soma = 100%.</p></div>
              <span className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold ${Math.abs(totalPercentual - 100) <= 0.0001 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{totalPercentual.toFixed(4)}%</span>
            </div>
            {rateios.map((rateio, index) => (
              <div key={`${index}-${rateio.cotista}`} className="grid gap-2 sm:grid-cols-[1fr_145px_34px]">
                <Select value={rateio.cotista} onValueChange={(v) => setRateios((atual) => atual.map((linha, li) => li === index ? { ...linha, cotista: v } : linha))}>
                  <SelectTrigger><SelectValue placeholder="Cotista" /></SelectTrigger>
                  <SelectContent>
                    {cotistasAeronave.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} · {c.percentual_sociedade}%</SelectItem>)}
                    {opcoes?.cotistas?.filter((c) => !cotistasAeronave.find((ca) => ca.id === c.id)).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input inputMode="decimal" value={rateio.percentual} onChange={(e) => setRateios((atual) => atual.map((linha, li) => li === index ? { ...linha, percentual: e.target.value } : linha))} placeholder="%" />
                <Button type="button" variant="ghost" onClick={() => setRateios((atual) => atual.length === 1 ? atual : atual.filter((_, li) => li !== index))} className="h-10 px-2 text-muted-foreground hover:text-red-300"><X size={14} /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setRateios((atual) => [...atual, { cotista: "", percentual: "0" }])} className="h-8 gap-2 border-dashed text-[10px]"><Plus size={13} /> Adicionar cotista</Button>
          </div>

          <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes para auditoria" /></div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">{salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar lançamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
