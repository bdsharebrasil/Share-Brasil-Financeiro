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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  criarLancamentoEconomico,
  parseValorReais,
  buscarOpcoesLancamento,
  buscarDashboardCotista,
  formatarMoeda,
  formatarCentavos,
  formatarData,
} from "@/lib/financeiro-share-api";
import type { OpcoesLancamento, DashboardCotista } from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { buscarOpcoesEnvioPagamento, buscarCotistasAeronave } from "@/lib/colaborador-api";

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
        valor_centavos: valorCentavos,
        observacoes: observacoes.trim() || undefined,
        aeronave_id: aeronaveId || undefined,

        ...(modo === "CLIENTE" && {
          fluxo: fluxoCliente,
          pago_por_cotista_id: pagoPorCotista,
          pago_diretamente: pagoDiretamenteCliente,
          rateios: rateios.map((r) => ({ id: r.cotista, percentual: Number(r.percentual) })),
        }),

        ...(modo === "HOLDING" && {
          holding_id: holdingId,
          tipo_movimento_hold: tipoMovimentoHold,
          pago_diretamente: pagoDiretamenteHold,
          rateios: tipoMovimentoHold === "DESPESA"
            ? rateios.map((r) => ({ id: r.cotista, percentual: Number(r.percentual) }))
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
            <button
              type="button"
              onClick={() => setModo("CLIENTE")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                modo === "CLIENTE" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User size={14} /> Cliente / Direto
            </button>
            <button
              type="button"
              onClick={() => setModo("HOLDING")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                modo === "HOLDING" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 size={14} /> Holding (Conta Conjunta)
            </button>
          </div>
        )}
        {possuiCliente && !possuiHolding && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <User size={14} /> Cliente / Direto
          </div>
        )}
        {!possuiCliente && possuiHolding && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <Building2 size={14} /> Holding (Conta Conjunta)
          </div>
        )}

        {erroLocal && (
          <div className="flex items-start gap-2 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[11px] text-[#ed8c90]">
            <CircleAlert size={14} className="mt-0.5 shrink-0" />
            <span>{erroLocal}</span>
          </div>
        )}

        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={modo === "CLIENTE" ? "Ex.: Hangaragem mensal" : "Ex.: Aporte mensal dos sócios"} />
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {opcoes?.categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {modo === "CLIENTE" && (
            <>
              <div className="space-y-2">
                <Label>Fluxo</Label>
                <Select value={fluxoCliente} onValueChange={(v) => setFluxoCliente(v as "SAIDA" | "ENTRADA")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAIDA">Saída · despesa</SelectItem>
                    <SelectItem value="ENTRADA">Entrada · aporte/reembolso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pagador / Responsável</Label>
                <Select value={pagoPorCotista} onValueChange={setPagoPorCotista}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {cotistasCliente.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                <div className="space-y-0.5">
                  <Label className="text-sm">Pago diretamente pelo cotista?</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Ative se o cliente pagou do próprio bolso. Não passará pelo caixa da Share.
                  </p>
                </div>
                <Switch checked={pagoDiretamenteCliente} onCheckedChange={setPagoDiretamenteCliente} />
              </div>
            </>
          )}

          {modo === "HOLDING" && (
            <>
              <div className="space-y-2">
                <Label>Tipo de Movimento</Label>
                <Select value={tipoMovimentoHold} onValueChange={(v) => setTipoMovimentoHold(v as "APORTE" | "DESPESA")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESPESA">Saída · Despesa da Holding</SelectItem>
                    <SelectItem value="APORTE">Entrada · Aporte dos Sócios</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Holding</Label>
                <Select value={holdingId} onValueChange={setHoldingId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a Holding" /></SelectTrigger>
                  <SelectContent>
                    {opcoes?.holdings?.map((h) => <SelectItem key={h.id} value={h.id}>{h.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {tipoMovimentoHold === "DESPESA" && (
                <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Pago com recurso próprio do sócio?</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Ative se um sócio pagou do próprio bolso, ignorando o saldo da conta conjunta da Holding.
                    </p>
                  </div>
                  <Switch checked={pagoDiretamenteHold} onCheckedChange={setPagoDiretamenteHold} />
                </div>
              )}
            </>
          )}

          {(modo === "CLIENTE" || (modo === "HOLDING" && tipoMovimentoHold === "DESPESA")) && (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.03] p-4 sm:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">Rateio econômico</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Distribuído entre os {modo === "CLIENTE" ? "cotistas" : "sócios da holding"}. Soma = 100%.
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold ${Math.abs(totalPercentual - 100) <= 0.0001 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                  {totalPercentual.toFixed(4)}%
                </span>
              </div>
              {rateios.map((rateio, index) => (
                <div key={`${index}-${rateio.cotista}`} className="grid gap-2 sm:grid-cols-[1fr_145px_34px]">
                  <Select value={rateio.cotista} onValueChange={(v) => setRateios((atual) => atual.map((linha, li) => li === index ? { ...linha, cotista: v } : linha))}>
                    <SelectTrigger><SelectValue placeholder={modo === "CLIENTE" ? "Cotista" : "Sócio"} /></SelectTrigger>
                    <SelectContent>
                      {(modo === "CLIENTE" ? cotistasCliente : cotistasHolding).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input inputMode="decimal" value={rateio.percentual} onChange={(e) => setRateios((atual) => atual.map((linha, li) => li === index ? { ...linha, percentual: e.target.value } : linha))} placeholder="%" />
                  <Button type="button" variant="ghost" onClick={() => setRateios((atual) => atual.length === 1 ? atual : atual.filter((_, li) => li !== index))} className="h-10 px-2 text-muted-foreground hover:text-red-300">
                    <X size={14} />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setRateios((atual) => [...atual, { cotista: "", percentual: "0" }])} className="h-8 gap-2 border-dashed text-[10px]">
                <Plus size={13} /> Adicionar {modo === "CLIENTE" ? "cotista" : "sócio"}
              </Button>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes para auditoria" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FinanceiroCotista() {
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesLancamento | null>(null);
  const [dashboard, setDashboard] = useState<DashboardCotista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aeronaves, setAeronaves] = useState<AeronaveOpcao[]>([]);
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string>("");
  const [cotistasAeronave, setCotistasAeronave] = useState<CotistaAeronave[]>([]);

  const carregar = useCallback(async () => {
    try {
      const [ops, dash] = await Promise.all([buscarOpcoesLancamento(), buscarDashboardCotista()]);
      setOpcoes(ops);
      setDashboard(dash);
    } catch {
      setOpcoes(null);
      setDashboard(null);
    } finally {
      setCarregando(false);
    }
  }, []);

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
    carregar();
    carregarAeronaves();
  }, [carregar, carregarAeronaves]);

  useEffect(() => {
    carregarCotistas(aeronaveSelecionada);
  }, [aeronaveSelecionada, carregarCotistas]);

  const lancamentosFiltrados = useMemo(() => {
    if (!dashboard?.lancamentos) return [];
    if (!aeronaveSelecionada) return dashboard.lancamentos;
    return dashboard.lancamentos.filter((l) =>
      l.rateios.some((r) =>
        cotistasAeronave.some((c) => c.nome === r.cotista),
      ),
    );
  }, [dashboard, aeronaveSelecionada, cotistasAeronave]);

  const entradas = dashboard?.resumo?.entradas ?? 0;
  const saidas = dashboard?.resumo?.saidas ?? 0;
  const saldo = dashboard?.resumo?.saldo ?? 0;

  const cotistasParaDialog: CotistaAeronave[] = useMemo(() => {
    if (aeronaveSelecionada) return cotistasAeronave;
    return (opcoes?.cotistas ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      cliente_id: null,
      socio_id: null,
      percentual_sociedade: c.percentual_sociedade ?? 0,
      holding_id: null,
      eh_holding: 0,
    }));
  }, [aeronaveSelecionada, cotistasAeronave, opcoes]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-[-.02em]">Financeiro do Cotista</h2>
          <p className="text-xs text-muted-foreground">Visão econômica consolidada de cotistas e holdings.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={aeronaveSelecionada} onValueChange={setAeronaveSelecionada}>
            <SelectTrigger className="h-9 w-[220px] gap-2 text-xs">
              <Plane size={14} className="text-muted-foreground" />
              <SelectValue placeholder="Todas as aeronaves" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as aeronaves</SelectItem>
              {aeronaves.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.matricula_registro} · {a.modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAberto(true)} className="gap-2">
            <Plus size={15} /> Novo lançamento
          </Button>
        </div>
      </div>

      {aeronaveSelecionada && cotistasAeronave.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Cotistas desta aeronave</p>
          <div className="flex flex-wrap gap-2">
            {cotistasAeronave.map((c) => (
              <span key={c.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium ${c.eh_holding ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
                {c.eh_holding ? <Building2 size={11} /> : <User size={11} />}
                {c.nome}
                <span className="font-mono text-[10px] opacity-60">{c.percentual_sociedade}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Entradas</p>
              <p className="mt-1 text-lg font-bold text-emerald-400">{formatarMoeda(entradas)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Saídas</p>
              <p className="mt-1 text-lg font-bold text-red-400">{formatarMoeda(saidas)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Saldo</p>
              <p className="mt-1 text-lg font-bold">{formatarMoeda(saldo)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Custo rateado</p>
              <p className="mt-1 text-lg font-bold text-amber-400">{formatarMoeda(dashboard?.resumo?.custo_rateado ?? 0)}</p>
            </div>
          </div>

          {dashboard && dashboard.fechamento_mensal.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold">Fechamento mensal</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">
                      <th className="px-4 py-3">Mês</th>
                      <th className="px-4 py-3 text-right">Entradas</th>
                      <th className="px-4 py-3 text-right">Saídas</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                      <th className="px-4 py-3 text-right">Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.fechamento_mensal.map((m) => (
                      <tr key={m.mes} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
                        <td className="px-4 py-3 text-[11px] font-semibold">{m.mes}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-mono text-emerald-400">{formatarMoeda(m.entradas)}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-mono text-red-400">{formatarMoeda(m.saidas)}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-mono font-bold">{formatarMoeda(m.saldo)}</td>
                        <td className="px-4 py-3 text-right text-[10px] text-muted-foreground">{m.lancamentos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dashboard && dashboard.ranking_cotistas.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold">Ranking de cotistas</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground">
                      <th className="px-4 py-3">Cotista</th>
                      <th className="px-4 py-3 text-right">Devido</th>
                      <th className="px-4 py-3 text-right">Pago</th>
                      <th className="px-4 py-3 text-right">Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.ranking_cotistas.map((r, i) => (
                      <tr key={`${r.cotista}-${i}`} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
                        <td className="px-4 py-3 text-[11px] font-semibold">{r.cotista}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-mono text-red-400">{formatarMoeda(r.devido)}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-mono text-emerald-400">{formatarMoeda(r.pago)}</td>
                        <td className="px-4 py-3 text-right text-[10px] text-muted-foreground">{r.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dashboard && dashboard.saldos.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold">Saldos por cotista</p>
              </div>
              <div className="divide-y divide-border">
                {dashboard.saldos.map((s, i) => (
                  <div key={`${s.cotista}-${i}`} className="flex items-center justify-between px-4 py-3 text-xs">
                    <span className="truncate font-medium">{s.cotista}</span>
                    <div className="flex items-center gap-4 text-[10px]">
                      <span className="text-muted-foreground">Pago: {formatarCentavos(s.totalPagoCentavos)}</span>
                      <span className="text-muted-foreground">Devido: {formatarCentavos(s.totalDevidoCentavos)}</span>
                      <span className={`font-mono font-bold ${s.saldoCentavos >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatarCentavos(s.saldoCentavos)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard && dashboard.ranking_gastos.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold">Ranking de gastos por categoria</p>
              </div>
              <div className="divide-y divide-border">
                {dashboard.ranking_gastos.slice(0, 6).map((g, i) => (
                  <div key={`${g.categoria}-${i}`} className="flex items-center justify-between px-4 py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{g.categoria}</p>
                      <p className="text-[10px] text-muted-foreground">{g.grupo} · {g.quantidade} lançamento(s)</p>
                    </div>
                    <span className="ml-3 shrink-0 font-mono font-bold text-red-400">{formatarMoeda(g.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lancamentosFiltrados.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold">Lançamentos</p>
              </div>
              <div className="divide-y divide-border">
                {lancamentosFiltrados.map((lanc) => (
                  <div key={lanc.id} className="flex items-center justify-between px-4 py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{lanc.descricao}</p>
                      <p className="text-[10px] text-muted-foreground">{formatarData(lanc.data)} · {lanc.categoria}</p>
                      {lanc.rateios.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {lanc.rateios.map((r) => (
                            <span key={r.cotista} className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                              {r.cotista} · {r.percentual}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`ml-3 shrink-0 font-bold ${lanc.fluxo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>
                      {lanc.fluxo === "ENTRADA" ? "+" : "-"}{formatarCentavos(lanc.valorCentavos)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard && dashboard.holdings.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold">Holdings</p>
              </div>
              <div className="divide-y divide-border">
                {dashboard.holdings.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold">{h.nome}</p>
                        {h.contaBancaria && <p className="text-[10px] text-muted-foreground">{h.contaBancaria}</p>}
                      </div>
                    </div>
                    {h.socios.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {h.socios.map((s) => (
                          <div key={s.cotistaId} className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">{s.cotistaId} · {s.percentual}%</span>
                            <span className={`font-mono font-bold ${s.saldoCentavos >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {formatarCentavos(s.saldoCentavos)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <NovoLancamentoCotistaDialog
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        opcoes={opcoes}
        cotistasAeronave={cotistasParaDialog}
        aeronaveId={aeronaveSelecionada}
        aoCriar={carregar}
      />
    </div>
  );
}
