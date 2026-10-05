import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  Loader2,
  Plus,
  X,
  Building2,
  User,
  Plane,
  BarChart3,
  ReceiptText,
  ListOrdered,
  LayoutDashboard,
  PieChart,
  Fuel,
  Landmark,
  CalendarDays,
  FileText,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  criarLancamentoEconomico,
  parseValorReais,
  buscarOpcoesLancamento,
  buscarDashboardCotista,
  formatarMoeda,
  formatarCentavos,
  formatarData,
  buscarVoosEmprestimos,
} from "@/lib/financeiro-share-api";
import type { OpcoesLancamento, DashboardCotista, VooEmprestimo, LancamentoEconomico } from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { buscarOpcoesEnvioPagamento, buscarCotistasAeronave } from "@/lib/colaborador-api";
import { MediasCotista } from "./MediasCotista";

function hoje() { return new Date().toISOString().slice(0, 10); }

type RateioDraft = { cotista: string; percentual: string };

type AeronaveOpcao = { id: string; matricula_registro: string; fabricante: string; modelo: string };

export function NovoLancamentoCotistaDialog({
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
  const cotistasCliente = useMemo(() => cotistasAeronave.filter((c) => !c.eh_holding), [cotistasAeronave]);
  const cotistasHolding = useMemo(() => cotistasAeronave.filter((c) => Boolean(c.eh_holding)), [cotistasAeronave]);
  const possuiCliente = cotistasCliente.length > 0;
  const possuiHolding = cotistasHolding.length > 0;
  const [modo, setModo] = useState<"CLIENTE" | "HOLDING">("CLIENTE");

  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioDraft[]>([]);

  const [fluxoCliente, setFluxoCliente] = useState<"SAIDA" | "ENTRADA">("SAIDA");
  const [pagoPorCotista, setPagoPorCotista] = useState("");
  const [pagoDiretamenteCliente, setPagoDiretamenteCliente] = useState(false);

  const [tipoMovimentoHold, setTipoMovimentoHold] = useState<"APORTE" | "DESPESA">("DESPESA");
  const [holdingId, setHoldingId] = useState("");
  const [pagoDiretamenteHold, setPagoDiretamenteHold] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErroLocal(null);
    setData(hoje());
    setDescricao("");
    setValor("");
    setObservacoes("");
    setPagoDiretamenteCliente(false);
    setPagoDiretamenteHold(false);

    // Auto-selecionar modo: se só tem cliente, vai pra CLIENTE; se só tem holding, vai pra HOLDING
    if (possuiCliente && !possuiHolding) setModo("CLIENTE");
    else if (!possuiCliente && possuiHolding) setModo("HOLDING");

    const cotistasParaModo = modo === "CLIENTE" ? cotistasCliente : cotistasHolding;

    setCategoriaId(opcoes?.categorias[0]?.id || "");
    setPagoPorCotista(cotistasCliente[0]?.id || "");

    const holds = opcoes?.holdings || [];
    if (holds.length > 0) setHoldingId(holds[0].id);

    const totalCotistas = cotistasParaModo.length;
    if (totalCotistas > 0) {
      const pct = (100 / totalCotistas).toFixed(4);
      setRateios(cotistasParaModo.map((c) => ({ cotista: c.id, percentual: pct })));
    } else {
      setRateios([{ cotista: "", percentual: "100" }]);
    }
  }, [aberto, opcoes, cotistasAeronave, cotistasCliente, cotistasHolding, possuiCliente, possuiHolding, modo]);

  const totalPercentual = rateios.reduce((total, r) => total + (Number(r.percentual) || 0), 0);

  const salvar = async () => {
    const categoria = opcoes?.categorias?.find((c) => c.id === categoriaId);
    const valorCentavos = parseValorReais(valor);

    setErroLocal(null);
    if (!descricao.trim()) return setErroLocal("Informe a descrição.");
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) return setErroLocal("Valor inválido.");
    if (!categoria) return setErroLocal("Selecione uma categoria.");
    if (modo === "CLIENTE" && !pagoPorCotista) return setErroLocal("Informe o pagador.");
    if (modo === "HOLDING" && !holdingId) return setErroLocal("Selecione a Holding.");

    if (modo === "CLIENTE" || (modo === "HOLDING" && tipoMovimentoHold === "DESPESA")) {
      if (rateios.some((r) => !r.cotista)) return setErroLocal("Todos os rateios precisam de um cotista/sócio.");
      if (Math.abs(totalPercentual - 100) > 0.0001) return setErroLocal(`Rateio deve somar 100%. Atual: ${totalPercentual.toFixed(4)}%`);
    }

    setSalvando(true);
    try {
      const payload = {
        modo_lancamento: modo,
        data,
        descricao: descricao.trim(),
        categoria_id: categoria.id,
        categoria_nome: categoria.nome,
        grupo_categoria: categoria.grupo || undefined,
        tipo_rateio: "EXTRA",
        periodicidade: "ÚNICO",
        valor_centavos: valorCentavos,
        observacoes: observacoes.trim() || undefined,
        aeronave_id: aeronaveId || undefined,

        ...(modo === "CLIENTE" && {
          fluxo: fluxoCliente,
          cotista_aeronave_id: pagoPorCotista,
          pago_diretamente: pagoDiretamenteCliente,
          rateios: rateios.map((r) => ({ cotista_id: r.cotista, percentual: Number(r.percentual) })),
        }),

        ...(modo === "HOLDING" && {
          holding_id: holdingId,
          tipo_movimento_hold: tipoMovimentoHold,
          pago_diretamente: pagoDiretamenteHold,
          cotista_aeronave_id: rateios[0]?.cotista || undefined,
          rateios: tipoMovimentoHold === "DESPESA"
            ? rateios.map((r) => {
                const cotista = cotistasAeronave.find((item) => item.id === r.cotista);
                return { cotista_id: r.cotista, socio_id: cotista?.socio_id || undefined, percentual: Number(r.percentual) };
              })
            : [],
        }),
      };

      await criarLancamentoEconomico(payload);
      toast.success("Lançamento registrado com sucesso.");
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
          <DialogTitle className="text-lg font-bold tracking-[-.02em]">Novo lançamento</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Adicione uma movimentação separando o fluxo de caixa direto e o fluxo de Holdings.
          </DialogDescription>
        </DialogHeader>

        {possuiCliente && possuiHolding && (
          <div className="flex rounded-lg border border-border bg-muted/50 p-1">
            <button type="button" onClick={() => setModo("CLIENTE")} className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${modo === "CLIENTE" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><User size={14} /> Cliente / Direto</button>
            <button type="button" onClick={() => setModo("HOLDING")} className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${modo === "HOLDING" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Building2 size={14} /> Holding (Conta Conjunta)</button>
          </div>
        )}
        {possuiCliente && !possuiHolding && <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground"><User size={14} /> Cliente / Direto</div>}
        {!possuiCliente && possuiHolding && <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground"><Building2 size={14} /> Holding (Conta Conjunta)</div>}

        {erroLocal && <div className="flex items-start gap-2 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[11px] text-[#ed8c90]"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>{erroLocal}</span></div>}

        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={modo === "CLIENTE" ? "Ex.: Hangaragem mensal" : "Ex.: Aporte mensal dos sócios"} /></div>
          <div className="space-y-2"><Label>Valor (R$)</Label><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></div>
          <div className="space-y-2"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="space-y-2"><Label>Categoria</Label><Select value={categoriaId} onValueChange={setCategoriaId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="max-h-[280px]">{opcoes?.categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>

          {modo === "CLIENTE" && <>
            <div className="space-y-2"><Label>Fluxo</Label><Select value={fluxoCliente} onValueChange={(v) => setFluxoCliente(v as "SAIDA" | "ENTRADA")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SAIDA">Saída · despesa</SelectItem><SelectItem value="ENTRADA">Entrada · aporte/reembolso</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Pagador / Responsável</Label><Select value={pagoPorCotista} onValueChange={setPagoPorCotista}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{cotistasCliente.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3 sm:col-span-2"><div className="space-y-0.5"><Label className="text-sm">Pago diretamente pelo cotista?</Label><p className="text-[10px] text-muted-foreground">Ative se o cliente pagou do próprio bolso. Não passará pelo caixa da Share.</p></div><Switch checked={pagoDiretamenteCliente} onCheckedChange={setPagoDiretamenteCliente} /></div>
          </>}

          {modo === "HOLDING" && <>
            <div className="space-y-2"><Label>Tipo de Movimento</Label><Select value={tipoMovimentoHold} onValueChange={(v) => setTipoMovimentoHold(v as "APORTE" | "DESPESA")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DESPESA">Saída · Despesa da Holding</SelectItem><SelectItem value="APORTE">Entrada · Aporte dos Sócios</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Holding</Label><Select value={holdingId} onValueChange={setHoldingId}><SelectTrigger><SelectValue placeholder="Selecione a Holding" /></SelectTrigger><SelectContent>{opcoes?.holdings?.map((h) => <SelectItem key={h.id} value={h.id}>{h.nome}</SelectItem>)}</SelectContent></Select></div>
            {tipoMovimentoHold === "DESPESA" && <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3 sm:col-span-2"><div className="space-y-0.5"><Label className="text-sm">Pago diretamente pelo sócio?</Label><p className="text-[10px] text-muted-foreground">Use quando a despesa foi paga fora da conta da Holding.</p></div><Switch checked={pagoDiretamenteHold} onCheckedChange={setPagoDiretamenteHold} /></div>}
          </>}

          {(modo === "CLIENTE" || (modo === "HOLDING" && tipoMovimentoHold === "DESPESA")) && <div className="space-y-2 sm:col-span-2"><div className="flex items-center justify-between"><Label>Rateio</Label><span className={`font-mono text-[10px] ${Math.abs(totalPercentual - 100) < 0.0001 ? "text-emerald-400" : "text-amber-400"}`}>{totalPercentual.toFixed(2)}% / 100%</span></div>{rateios.map((rateio, index) => <div key={`${index}-${rateio.cotista}`} className="mt-2 grid grid-cols-[1fr_100px_36px] gap-2"><Select value={rateio.cotista} onValueChange={(v) => setRateios((atual) => atual.map((linha, li) => li === index ? { ...linha, cotista: v } : linha))}><SelectTrigger><SelectValue placeholder={modo === "CLIENTE" ? "Cotista" : "Sócio"} /></SelectTrigger><SelectContent>{(modo === "CLIENTE" ? cotistasCliente : cotistasHolding).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select><Input inputMode="decimal" value={rateio.percentual} onChange={(e) => setRateios((atual) => atual.map((linha, li) => li === index ? { ...linha, percentual: e.target.value } : linha))} placeholder="%" /><Button type="button" variant="ghost" onClick={() => setRateios((atual) => atual.length === 1 ? atual : atual.filter((_, li) => li !== index))} className="h-10 px-2 text-muted-foreground hover:text-red-300"><X size={14} /></Button></div>)}<Button type="button" variant="outline" onClick={() => setRateios((atual) => [...atual, { cotista: "", percentual: "0" }])} className="mt-2 h-8 gap-2 border-dashed text-[10px]"><Plus size={13} /> Adicionar {modo === "CLIENTE" ? "cotista" : "sócio"}</Button></div>}

          <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes para auditoria" /></div>
        </div>
        <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button><Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">{salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar lançamento</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusLancamento(status: string) {
  const normalizado = status.toUpperCase();
  if (["PAGO", "RECEBIDO", "CONFIRMADO", "LIQUIDADO"].includes(normalizado)) return { label: "Pago", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" };
  if (["EM_ATRASO", "ATRASADO"].includes(normalizado)) return { label: "Atrasado", className: "border-red-400/25 bg-red-400/10 text-red-300" };
  if (["CANCELADO", "ESTORNADO"].includes(normalizado)) return { label: "Cancelado", className: "border-slate-400/25 bg-slate-400/10 text-slate-300" };
  return { label: "Pendente", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
}

function valorPagoLancamento(lancamento: LancamentoEconomico) {
  const pagoInformado = Math.max(0, Number(lancamento.valorPagoCentavos || 0));
  if (["PAGO", "RECEBIDO", "CONFIRMADO", "LIQUIDADO"].includes(lancamento.status.toUpperCase())) {
    return Math.min(lancamento.valorCentavos, pagoInformado || lancamento.valorCentavos);
  }
  return Math.min(lancamento.valorCentavos, pagoInformado);
}

function LancamentosDespesa({ lancamentos, aoNovo }: { lancamentos: LancamentoEconomico[]; aoNovo: () => void }) {
  const despesas = lancamentos.filter((lancamento) => lancamento.fluxo === "SAIDA");
  const totalLancado = despesas.reduce((total, lancamento) => total + lancamento.valorCentavos, 0);
  const totalPago = despesas.reduce((total, lancamento) => total + valorPagoLancamento(lancamento), 0);
  const totalAberto = Math.max(0, totalLancado - totalPago);
  const totalReembolsos = despesas.reduce((total, lancamento) => total + (lancamento.reembolsavel ? lancamento.valorCentavos : 0), 0);
  const mesReferencia = despesas[0]?.data ? new Date(`${despesas[0].data.slice(0, 10)}T00:00:00`) : new Date();
  const mes = mesReferencia.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const cards = [
    { titulo: `Total lançado · ${mes}`, valor: totalLancado, detalhe: `${despesas.length} itens`, Icon: ReceiptText, tone: "text-sky-100", iconTone: "text-sky-300" },
    { titulo: "Total pago", valor: totalPago, detalhe: "Despesas liquidadas", Icon: Check, tone: "text-sky-100", iconTone: "text-emerald-300" },
    { titulo: "Em aberto", valor: totalAberto, detalhe: "Aguardando pagamento", Icon: CalendarDays, tone: "text-sky-100", iconTone: "text-amber-300" },
    { titulo: "Reembolsos", valor: totalReembolsos, detalhe: totalReembolsos ? "Valores reembolsáveis" : "Nenhum", Icon: FileText, tone: "text-sky-100", iconTone: "text-sky-300" },
  ];

  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ titulo, valor, detalhe, Icon, tone, iconTone }) => <div key={titulo} className="financeiro-kpi financeiro-kpi--primary min-h-[112px] p-4">
        <div className="flex items-start justify-between gap-3"><span className={`financeiro-kpi-icon ${iconTone}`}><Icon size={14} /></span><span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">{detalhe}</span></div>
        <p className="mt-3 text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">{titulo}</p><p className={`mt-1 font-mono text-xl font-bold ${tone}`}>{formatarCentavos(valor)}</p>
      </div>)}
    </div>
    <div className="financeiro-panel overflow-hidden">
      <div className="financeiro-panel-header"><div><p className="text-sm font-bold">Extrato · despesas</p><p className="mt-1 text-[10px] text-muted-foreground">Lançamentos, rateios, documentos e status de pagamento</p></div><Button size="sm" onClick={aoNovo} className="h-8 gap-1.5 text-[10px]"><Plus size={13} /> Novo lançamento</Button></div>
      {despesas.length ? <div className="overflow-x-auto"><table className="min-w-[920px] w-full text-left"><thead className="border-b border-border bg-muted/20 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Rateio</th><th className="px-3 py-3">Documento</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Valor</th></tr></thead><tbody className="divide-y divide-border/80">{despesas.map((lancamento) => { const status = statusLancamento(lancamento.status); const rateio = lancamento.grupoCategoria || lancamento.tipo; return <tr key={lancamento.id} className="transition-colors hover:bg-primary/[.035]"><td className="px-3 py-3 align-top"><p className="font-mono text-[11px] font-bold text-foreground">{formatarData(lancamento.data)}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">LC {lancamento.id.slice(0, 6).toUpperCase()}</p></td><td className="max-w-[270px] px-3 py-3"><p className="truncate text-[11px] font-bold text-foreground">{lancamento.descricao}</p><p className="mt-1 truncate text-[9px] text-muted-foreground">{lancamento.participanteNome || lancamento.fornecedor || "Responsável não informado"}</p></td><td className="px-3 py-3 text-[10px] text-muted-foreground">{lancamento.categoria || "Sem categoria"}</td><td className="px-3 py-3">{rateio ? <span className="inline-flex rounded border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[9px] font-bold uppercase text-primary">{rateio}</span> : <span className="text-[10px] text-muted-foreground">—</span>}</td><td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">{lancamento.documento || "—"}</td><td className="px-3 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-bold ${status.className}`}>{status.label}</span></td><td className="px-3 py-3 text-right font-mono text-[12px] font-bold text-foreground">{formatarCentavos(lancamento.valorCentavos)}</td></tr>; })}</tbody></table></div> : <div className="px-4 py-12 text-center text-xs text-muted-foreground">Nenhuma despesa encontrada para esta aeronave.</div>}
    </div>
  </div>;
}

export default function FinanceiroCotista() {
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [dashboard, setDashboard] = useState<DashboardCotista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDashboard, setErroDashboard] = useState<string | null>(null);
  const [aeronaves, setAeronaves] = useState<AeronaveOpcao[]>([]);
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string>("");
  const [cotistasAeronave, setCotistasAeronave] = useState<CotistaAeronave[]>([]);
  const [cotistaEmprestimo, setCotistaEmprestimo] = useState("");
  const [voosEmprestimos, setVoosEmprestimos] = useState<VooEmprestimo[]>([]);
  const [carregandoEmprestimos, setCarregandoEmprestimos] = useState(false);

  const carregar = useCallback(async () => {
    if (!aeronaveSelecionada) {
      setDashboard(null);
      setErroDashboard(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErroDashboard(null);
    try {
      setDashboard(await buscarDashboardCotista(undefined, undefined, aeronaveSelecionada));
    } catch (error) {
      setDashboard(null);
      setErroDashboard(error instanceof Error ? error.message : "Falha inesperada ao carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [aeronaveSelecionada]);

  const carregarAeronaves = useCallback(async () => {
    try {
      const resp = await buscarOpcoesEnvioPagamento();
      setAeronaves(resp.aeronaves || []);
    } catch {
      setAeronaves([]);
    }
  }, []);

  const carregarCotistas = useCallback(async (aeronaveId: string) => {
    if (!aeronaveId) {
      setCotistasAeronave([]);
      return;
    }
    try {
      const resp = await buscarCotistasAeronave(aeronaveId);
      setCotistasAeronave(resp.cotistas || []);
    } catch {
      setCotistasAeronave([]);
    }
  }, []);

  useEffect(() => {
    void buscarOpcoesLancamento().then(setOpcoes).catch(() => setOpcoes(null));
    carregarAeronaves();
  }, [carregarAeronaves]);

  useEffect(() => {
    carregar();
    carregarCotistas(aeronaveSelecionada);
  }, [aeronaveSelecionada, carregar, carregarCotistas]);
  useEffect(() => {
    const primeira = cotistasAeronave.find((cotista) => cotista.cliente_id || cotista.socio_id);
    if (!primeira) { setCotistaEmprestimo(""); setVoosEmprestimos([]); return; }
    const disponiveis = new Set(cotistasAeronave.filter((cotista) => cotista.cliente_id || cotista.socio_id).map((cotista) => `${cotista.socio_id ? "socio" : "cliente"}:${cotista.socio_id || cotista.cliente_id}`));
    if (!cotistaEmprestimo || !disponiveis.has(cotistaEmprestimo)) setCotistaEmprestimo(`${primeira.socio_id ? "socio" : "cliente"}:${primeira.socio_id || primeira.cliente_id}`);
  }, [cotistasAeronave, cotistaEmprestimo]);
  useEffect(() => {
    if (!cotistaEmprestimo || !aeronaveSelecionada) { setVoosEmprestimos([]); return; }
    const [tipo, id] = cotistaEmprestimo.split(":");
    if (!id || (tipo !== "cliente" && tipo !== "socio")) return;
    setCarregandoEmprestimos(true);
    void buscarVoosEmprestimos(id, tipo, aeronaveSelecionada).then(setVoosEmprestimos).catch(() => setVoosEmprestimos([])).finally(() => setCarregandoEmprestimos(false));
  }, [cotistaEmprestimo, aeronaveSelecionada]);

  const lancamentosFiltrados = useMemo(() => {
    if (!aeronaveSelecionada || !dashboard?.lancamentos) return [];
    return dashboard.lancamentos.filter((lancamento) => lancamento.aeronaveId === aeronaveSelecionada);
  }, [dashboard, aeronaveSelecionada]);

  const possuiHolding = cotistasAeronave.some((cotista) => Boolean(cotista.eh_holding));
  const [abaAtiva, setAbaAtiva] = useState<"resumo" | "medias" | "lancamentos" | "graficos" | "ranking" | "emprestimos" | "extrato">("resumo");

  const despesas = useMemo(
    () => lancamentosFiltrados.filter((lancamento) => lancamento.fluxo === "SAIDA"),
    [lancamentosFiltrados],
  );
  const custoFixo = despesas
    .filter((lancamento) => /fix|hangar|seguro|assinatura|mensal/i.test(`${lancamento.grupoCategoria} ${lancamento.categoria} ${lancamento.descricao}`))
    .reduce((total, lancamento) => total + lancamento.valorCentavos, 0);
  const custoVariavel = despesas.reduce((total, lancamento) => total + lancamento.valorCentavos, 0) - custoFixo;
  const dadosCategorias = (dashboard?.ranking_gastos ?? []).map((item) => ({
    nome: item.categoria,
    valor: item.valor / 100,
    quantidade: item.quantidade,
    grupo: item.grupo,
  }));
  const dadosMensais = (dashboard?.fechamento_mensal ?? []).map((item) => ({
    mes: item.mes.slice(5),
    entradas: item.entradas / 100,
    saidas: item.saidas / 100,
    saldo: item.saldo / 100,
  }));

  const cotistasParaDialog: CotistaAeronave[] = useMemo(
    () => (aeronaveSelecionada ? cotistasAeronave : []),
    [aeronaveSelecionada, cotistasAeronave],
  );

  const formatarValorGrafico = (valor: number) => formatarMoeda(valor).replace(",00", "");
  const coresCategorias = ["#22d3ee", "#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#94a3b8"];

  return (
    <div className="financeiro-shell route-enter space-y-5">
      <div className="financeiro-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="financeiro-eyebrow">CLIENTE / AERONAVE</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.035em] md:text-2xl">Financeiro do Cotista</h2>
          <p className="text-xs text-muted-foreground">Visão econômica consolidada de cotistas e holdings.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={aeronaveSelecionada} onValueChange={setAeronaveSelecionada}>
            <SelectTrigger className="h-9 w-full gap-2 text-xs sm:w-[220px]"><Plane size={14} className="text-muted-foreground" /><SelectValue placeholder="Todas as aeronaves" /></SelectTrigger>
            <SelectContent><SelectItem value="">Todas as aeronaves</SelectItem>{aeronaves.map((a) => <SelectItem key={a.id} value={a.id}>{a.matricula_registro} · {a.modelo}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {!aeronaveSelecionada ? (
        <div className="financeiro-panel rounded-xl border-dashed px-5 py-14 text-center">
          <Plane className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold">Selecione uma aeronave</p>
          <p className="mt-1 text-xs text-muted-foreground">Os dados financeiros do cotista serão exibidos depois da seleção.</p>
        </div>
      ) : <>
      {aeronaveSelecionada && cotistasAeronave.length > 0 && (
        <div className="financeiro-panel p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Cotistas desta aeronave</p>
          <div className="flex flex-wrap gap-2">{cotistasAeronave.map((c) => <span key={c.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium ${c.eh_holding ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>{c.eh_holding ? <Building2 size={11} /> : <User size={11} />}{c.nome}<span className="font-mono text-[10px] opacity-60">{c.percentual_sociedade}%</span></span>)}</div>
        </div>
      )}

      <div className="financeiro-tabs flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
        <button type="button" onClick={() => setAbaAtiva("resumo")} className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "resumo" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><LayoutDashboard size={14} />Resumo geral</button>
        <button type="button" onClick={() => setAbaAtiva("medias")} className={`flex min-w-[112px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "medias" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Gauge size={14} />MÉDIAS</button>
        <button type="button" onClick={() => setAbaAtiva("lancamentos")} className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "lancamentos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><ReceiptText size={14} />Lançamento de despesas</button>
        <button type="button" onClick={() => setAbaAtiva("graficos")} className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "graficos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><BarChart3 size={14} />Gráficos</button>
        <button type="button" onClick={() => setAbaAtiva("ranking")} className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "ranking" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><ListOrdered size={14} />Ranking de gastos</button> <button type="button" onClick={() => setAbaAtiva("emprestimos")} className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "emprestimos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Fuel size={14} />Voos empréstimos</button>
        {possuiHolding && <button type="button" onClick={() => setAbaAtiva("extrato")} className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition-colors sm:min-w-0 sm:text-xs ${abaAtiva === "extrato" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Landmark size={14} />Extrato Holding</button>}
      </div>

      {carregando ? <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 size={20} className="animate-spin" /></div> : erroDashboard ? (
        <div role="alert" className="financeiro-panel flex flex-col gap-3 border border-red-500/30 bg-red-500/5 px-4 py-4 sm:flex-row sm:items-center">
          <CircleAlert className="h-4 w-4 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-300">Não foi possível carregar o financeiro desta aeronave.</p>
            <p className="mt-1 break-words text-xs text-red-200/80">{erroDashboard}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>Tentar novamente</Button>
        </div>
      ) : (
        <>
          {abaAtiva === "resumo" && <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="financeiro-panel xl:col-span-2"><div className="mb-5 flex items-center gap-2 ml-[18px] mt-[11px]"><div><p className="text-sm font-bold">Composição dos custos</p><p className="text-[10px] text-muted-foreground">Custos fixos e variáveis das despesas lançadas</p></div></div><div className="grid gap-4 p-4 sm:grid-cols-2"><div className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Custos fixos</p><p className="mt-2 text-xl font-bold">{formatarCentavos(custoFixo)}</p><p className="mt-1 text-[10px] text-muted-foreground">Hangar, seguro e recorrências</p></div><div className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Custos variáveis</p><p className="mt-2 text-xl font-bold">{formatarCentavos(custoVariavel)}</p><p className="mt-1 text-[10px] text-muted-foreground">Operação, combustível e demais despesas</p></div></div></div>
              <div className="financeiro-panel p-5"><p className="text-sm font-bold">Indicadores</p><div className="mt-4 space-y-4"><div><p className="text-[10px] text-muted-foreground">Média mensal</p><p className="font-mono text-sm font-bold">{formatarCentavos(dashboard?.resumo?.media_mensal)}</p></div><div><p className="text-[10px] text-muted-foreground">Média por lançamento</p><p className="font-mono text-sm font-bold">{formatarCentavos(dashboard?.resumo?.media_lancamento)}</p></div><div><p className="text-[10px] text-muted-foreground">Pendências</p><p className="font-mono text-sm font-bold text-amber-400">{dashboard?.resumo?.pendentes ?? 0} lançamento(s)</p></div></div></div>
            </div>
            {Array.isArray(dashboard?.saldos) && dashboard.saldos.length > 0 ? <div className="financeiro-panel overflow-hidden"><div className="financeiro-panel-header"><p className="text-xs font-bold">Saldos por cotista</p></div><div className="divide-y divide-border">{dashboard.saldos.map((s, i) => <div key={`${s.cotista}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"><span className="font-medium">{s.cotista}</span><div className="flex gap-4 text-[10px]"><span className="text-muted-foreground">Pago: {formatarCentavos(s.totalPagoCentavos)}</span><span className="text-muted-foreground">Devido: {formatarCentavos(s.totalDevidoCentavos)}</span><span className={s.saldoCentavos >= 0 ? "font-mono font-bold text-emerald-400" : "font-mono font-bold text-red-400"}>{formatarCentavos(s.saldoCentavos)}</span></div></div>)}</div></div> : null}
            {possuiHolding && (dashboard?.holdings ?? []).length > 0 && <div className="space-y-3">{dashboard!.holdings.map((holding) => <section key={holding.id} className="financeiro-panel overflow-hidden"><div className="financeiro-panel-header"><div className="flex items-center gap-2"><Landmark size={15} className="text-primary" /><div><p className="text-xs font-bold">Saldo bancário · {holding.nome}</p><p className="mt-1 text-[10px] text-muted-foreground">{holding.contaBancaria || "Conta bancária não identificada"}</p></div></div><span className="font-mono text-sm font-bold">{formatarCentavos(holding.saldoContaCentavos)}</span></div><div className="divide-y divide-border">{holding.socios.map((socio) => <div key={socio.cotistaId} className="grid gap-2 px-4 py-3 text-[10px] sm:grid-cols-[minmax(120px,1.2fr)_repeat(4,minmax(90px,1fr))] sm:items-center"><div><p className="font-semibold">{socio.nome || cotistasAeronave.find((cotista) => cotista.socio_id === socio.cotistaId)?.nome || socio.cotistaId}</p><p className="text-muted-foreground">Participação: {Number(socio.percentual || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%</p></div><div><span className="text-muted-foreground">Depositado </span><strong className="font-mono">{formatarCentavos(socio.totalDepositadoCentavos)}</strong></div><div><span className="text-muted-foreground">Consumido da conta </span><strong className="font-mono">{formatarCentavos(socio.totalConsumidoCentavos)}</strong></div><div><span className="text-muted-foreground">Pago diretamente </span><strong className="font-mono">{formatarCentavos(socio.despesasPagasDiretamenteCentavos)}</strong></div><div><span className="text-muted-foreground">Saldo atribuído </span><strong className={`font-mono ${socio.saldoCentavos >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatarCentavos(socio.saldoCentavos)}</strong></div></div>)}</div></section>)}</div>}
          </div>}

          {abaAtiva === "medias" && <MediasCotista medias={dashboard?.medias ?? null} />}
          {abaAtiva === "lancamentos" && <LancamentosDespesa lancamentos={lancamentosFiltrados} aoNovo={() => setAberto(true)} />}
          {abaAtiva === "extrato" && possuiHolding && <div className="financeiro-panel overflow-hidden"><div className="financeiro-panel-header"><div><p className="text-sm font-bold">Extrato da conta Holding</p><p className="text-[10px] text-muted-foreground">Movimentos bancários e aportes; o rateio econômico permanece na aba de lançamentos.</p></div></div>{(dashboard?.movimentos_holding ?? []).length ? <div className="divide-y divide-border">{dashboard!.movimentos_holding.map((movimento) => { const entrada = ["ENTRADA", "APORTE", "ESTORNO"].includes(movimento.fluxo.toUpperCase()); return <div key={movimento.id} className="grid gap-2 px-3 py-3 text-xs sm:grid-cols-[90px_minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(110px,1fr)_100px_120px] sm:items-center sm:px-4"><div className="text-muted-foreground">{formatarData(movimento.data)}</div><div className="min-w-0"><p className="truncate font-semibold">{movimento.descricao}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{movimento.categoria || "Sem categoria"} · {movimento.holdingNome || "Holding"}</p></div><div className="text-muted-foreground">{movimento.socioNome || "Sócio não informado"}</div><div className="text-muted-foreground">{movimento.contaBancaria || "Conta não informada"}</div><div className="text-[10px] text-muted-foreground">{movimento.status}</div><div className={`text-right font-mono font-bold ${entrada ? "text-emerald-400" : "text-red-400"}`}>{entrada ? "+" : "−"}{formatarCentavos(movimento.valorCentavos)}</div></div>; })}</div> : <div className="px-4 py-12 text-center text-xs text-muted-foreground">Nenhum movimento bancário encontrado para esta aeronave.</div>}</div>}

          {abaAtiva === "emprestimos" && <div className="financeiro-panel overflow-hidden">
            <div className="financeiro-panel-header"><div><p className="text-sm font-bold">Voos empréstimos</p><p className="text-[10px] text-muted-foreground">Abastecimentos em nome deste cotista realizados em outras aeronaves.</p></div>
              <Select value={cotistaEmprestimo} onValueChange={setCotistaEmprestimo}><SelectTrigger className="h-8 w-full text-[10px] sm:w-[240px]"><SelectValue placeholder="Selecione o cotista" /></SelectTrigger><SelectContent>{cotistasAeronave.filter((cotista) => cotista.cliente_id || cotista.socio_id).map((cotista) => <SelectItem key={cotista.id} value={`${cotista.socio_id ? "socio" : "cliente"}:${cotista.socio_id || cotista.cliente_id}`}>{cotista.nome}</SelectItem>)}</SelectContent></Select>
            </div>
            {carregandoEmprestimos ? <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 size={18} className="animate-spin" /></div> : voosEmprestimos.length ? <div className="divide-y divide-border">{voosEmprestimos.map((voo) => <div key={voo.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"><div className="min-w-0"><p className="font-semibold">{voo.numero_voo || "Voo sem número"} · {voo.matricula_registro || "Aeronave não informada"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{formatarData(voo.data)} · {voo.trecho || "Trecho não informado"} · Local: {voo.local_icao || voo.local || "—"}</p></div><div className="text-right"><p className="font-mono font-bold text-amber-400">{Number(voo.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} L</p><p className="font-mono text-[10px] text-muted-foreground">{formatarMoeda(Number(voo.valor_total || 0))}</p></div></div>)}</div> : <div className="px-4 py-12 text-center text-xs text-muted-foreground">Nenhum abastecimento de voo empréstimo encontrado em outras aeronaves.</div>}
          </div>}
          {abaAtiva === "graficos" && <div className="grid gap-4 xl:grid-cols-2">
            <div className="financeiro-panel p-5"><div className="mb-5"><p className="text-sm font-bold">Evolução mensal</p><p className="text-[10px] text-muted-foreground">Entradas e saídas por competência</p></div><div className="h-52 sm:h-64">{dadosMensais.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={dadosMensais}><defs><linearGradient id="areaSaidas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => formatarValorGrafico(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} /><Tooltip formatter={(v: number) => formatarMoeda(v)} /><Area type="monotone" dataKey="saidas" name="Saídas" stroke="#22d3ee" fill="url(#areaSaidas)" strokeWidth={2} /><Area type="monotone" dataKey="entradas" name="Entradas" stroke="#34d399" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Dados insuficientes para o período.</div>}</div></div>
            <div className="financeiro-panel p-5"><div className="mb-5"><p className="text-sm font-bold">Custos por categoria</p><p className="text-[10px] text-muted-foreground">Distribuição das despesas registradas</p></div><div className="h-52 sm:h-64">{dadosCategorias.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dadosCategorias} layout="vertical" margin={{ left: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v: number) => formatarMoeda(v)} /><Bar dataKey="valor" name="Custo" radius={[0, 4, 4, 0]} fill="#22d3ee" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Dados insuficientes para o período.</div>}</div></div>
            <div className="financeiro-panel p-5 xl:col-span-2"><div className="mb-5 flex items-center gap-2"><PieChart size={15} className="text-primary" /><div><p className="text-sm font-bold">Participação por categoria</p><p className="text-[10px] text-muted-foreground">Percentual de cada despesa sobre o total</p></div></div><div className="h-52 sm:h-64">{dadosCategorias.length ? <ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={dadosCategorias} dataKey="valor" nameKey="nome" innerRadius={60} outerRadius={95} paddingAngle={3}>{dadosCategorias.map((item, i) => <Cell key={item.nome} fill={coresCategorias[i % coresCategorias.length]} />)}</Pie><Tooltip formatter={(v: number) => formatarMoeda(v)} /></RechartsPieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Dados insuficientes para o período.</div>}</div></div>
          </div>}

          {abaAtiva === "ranking" && <div className="grid gap-4 xl:grid-cols-2"><div className="financeiro-panel overflow-hidden"><div className="financeiro-panel-header"><p className="text-sm font-bold">Ranking de gastos</p></div><div className="divide-y divide-border">{(dashboard?.ranking_gastos ?? []).length ? dashboard!.ranking_gastos.map((g, i) => <div key={`${g.categoria}-${i}`} className="flex items-center gap-3 px-4 py-3"><span className="w-5 font-mono text-xs font-bold text-primary">{i + 1}º</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{g.categoria}</p><p className="text-[10px] text-muted-foreground">{g.grupo} · {g.quantidade} lançamento(s)</p></div><span className="font-mono text-xs font-bold">{formatarCentavos(g.valor)}</span></div>) : <div className="px-4 py-12 text-center text-xs text-muted-foreground">Ainda não há gastos lançados.</div>}</div></div><div className="financeiro-panel overflow-hidden"><div className="financeiro-panel-header"><p className="text-sm font-bold">Ranking de cotistas</p></div><div className="divide-y divide-border">{(dashboard?.ranking_cotistas ?? []).length ? dashboard!.ranking_cotistas.map((r, i) => <div key={`${r.cotista}-${i}`} className="flex items-center gap-3 px-4 py-3"><span className="w-5 font-mono text-xs font-bold text-primary">{i + 1}º</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{r.cotista}</p><p className="text-[10px] text-muted-foreground">{r.quantidade} lançamento(s)</p></div><div className="text-right text-[10px]"><p className="font-mono text-red-400">Dev.: {formatarCentavos(r.devido)}</p><p className="font-mono text-emerald-400">Pago: {formatarCentavos(r.pago)}</p></div></div>) : <div className="px-4 py-12 text-center text-xs text-muted-foreground">Ainda não há rateios registrados.</div>}</div></div></div>}
        </>
      )}
      </>}
      {aeronaveSelecionada && <NovoLancamentoCotistaDialog aberto={aberto} aoFechar={() => setAberto(false)} opcoes={opcoes} cotistasAeronave={cotistasParaDialog} aeronaveId={aeronaveSelecionada} aoCriar={carregar} />}
    </div>
  );
}
