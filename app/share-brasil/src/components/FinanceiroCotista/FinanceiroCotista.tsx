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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch"; // Importe o Switch se disponível, ou use checkbox
import {
  criarLancamentoEconomico,
  parseValorReais, // Assumindo que foi exportada/movida para utilitários
} from "@/lib/financeiro-share-api";
import type { OpcoesLancamento } from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";

function hoje() { return new Date().toISOString().slice(0, 10); }

type RateioDraft = { cotista: string; percentual: string };

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
  const [modo, setModo] = useState<"CLIENTE" | "HOLDING">("CLIENTE");
  
  // Estados gerais
  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioDraft[]>([]);

  // Estados específicos: Cliente
  const [fluxoCliente, setFluxoCliente] = useState<"SAIDA" | "ENTRADA">("SAIDA");
  const [pagoPorCotista, setPagoPorCotista] = useState("");
  const [pagoDiretamenteCliente, setPagoDiretamenteCliente] = useState(false);

  // Estados específicos: Holding
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
    
    setCategoriaId(opcoes?.categorias[0]?.id || "");
    setPagoPorCotista(cotistasAeronave[0]?.id || "");
    
    // Filtra apenas cotistas que são holdings para o select
    const holds = opcoes?.holdings || [];
    if (holds.length > 0) setHoldingId(holds[0].id);

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
    if (modo === "CLIENTE" && !pagoPorCotista) return setErroLocal("Informe o pagador.");
    if (modo === "HOLDING" && !holdingId) return setErroLocal("Selecione a Holding.");
    
    // Aporte de Holding não exige rateio econômico complexo, mas despesas sim.
    if (modo === "CLIENTE" || (modo === "HOLDING" && tipoMovimentoHold === "DESPESA")) {
      if (rateios.some((r) => !r.cotista)) return setErroLocal("Todos os rateios precisam de um cotista/sócio.");
      if (Math.abs(totalPercentual - 100) > 0.0001) return setErroLocal(`Rateio deve somar 100%. Atual: ${totalPercentual.toFixed(4)}%`);
    }

    setSalvando(true);
    try {
      // O Payload agora informa o backend exatamente qual arquitetura seguir
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
        
        // Dados Cliente
        ...(modo === "CLIENTE" && {
          fluxo: fluxoCliente,
          pago_por_cotista_id: pagoPorCotista,
          pago_diretamente: pagoDiretamenteCliente,
          rateios: rateios.map((r) => ({ id: r.cotista, percentual: Number(r.percentual) })),
        }),

        // Dados Holding
        ...(modo === "HOLDING" && {
          holding_id: holdingId,
          tipo_movimento_hold: tipoMovimentoHold,
          pago_diretamente: pagoDiretamenteHold, // Se true, não movimenta saldo da holding
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

        {/* Seletor de Modo: Cliente vs Holding */}
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

          {/* FLUXO CLIENTE */}
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
                    {cotistasAeronave.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
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

          {/* FLUXO HOLDING */}
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

          {/* RATEIO (Visível para Cliente ou Despesas de Holding) */}
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
                      {cotistasAeronave.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
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