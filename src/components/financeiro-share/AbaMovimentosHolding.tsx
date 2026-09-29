import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarContasBancariasHolding, buscarMovimentosHoldingPendentes, darBaixaMovimentoHolding, formatarCentavos, formatarData, type ContaBancaria, type MovimentoHoldingPendente } from "@/lib/financeiro-share-api";

export function AbaMovimentosHolding() {
  const [movimentos, setMovimentos] = useState<MovimentoHoldingPendente[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<MovimentoHoldingPendente | null>(null);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [contaId, setContaId] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [pendentes, opcoes] = await Promise.all([buscarMovimentosHoldingPendentes(), buscarContasBancariasHolding()]);
      setMovimentos(pendentes);
      setContas(opcoes);
      setContaId((atual) => opcoes.some((item) => item.id === atual) ? atual : opcoes[0]?.id ?? "");
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível carregar pagamentos de holdings."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function confirmarBaixa() {
    if (!alvo || !contaId) return;
    setSalvando(true);
    try {
      await darBaixaMovimentoHolding(alvo.id, { dataPagamento: data, contaBancariaId: contaId, formaPagamento: "TRANSFERENCIA", comprovanteUrl: comprovante.trim() || undefined });
      toast.success("Movimento e rateios da holding atualizados como pagos.");
      setAlvo(null);
      setComprovante("");
      await carregar();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível baixar o movimento da holding."); }
    finally { setSalvando(false); }
  }

  return <div className="space-y-4">
    <header className="financeiro-panel-header rounded-xl border border-border bg-card">
      <div><h2 className="text-sm font-bold">Solicitações de pagamento · Holdings</h2></div>
      <Button variant="outline" size="sm" onClick={() => void carregar()}><RefreshCw size={14} className="mr-2" /> Atualizar</Button>
    </header>
    {erro && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
    <div className="financeiro-panel overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Holding / cotista</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
        <tbody className="divide-y divide-border/70">{carregando ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando movimentos…</td></tr> : movimentos.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum pagamento de holding pendente.</td></tr> : movimentos.map((movimento) => <tr key={movimento.id} className="hover:bg-muted/25">
          <td className="max-w-[300px] px-4 py-3"><p className="truncate font-semibold">{movimento.descricao}</p><p className="mt-1 text-[10px] text-muted-foreground">{movimento.categoria_nome ?? "Sem categoria"}</p></td>
          <td className="px-4 py-3"><p>{movimento.holding_nome ?? "Holding não identificada"}</p><p className="mt-1 text-[10px] text-muted-foreground">{movimento.socio_nome ?? "Cotista não identificado"}</p></td>
          <td className="px-4 py-3">{movimento.aeronave ?? "—"}</td>
          <td className="whitespace-nowrap px-4 py-3">{formatarData(movimento.data_vencimento)}</td>
          <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarCentavos(movimento.valor_centavos)}</td>
          <td className="px-4 py-3"><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{String(movimento.status).replace(/_/g, " ")}</span></td>
          <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => { setAlvo(movimento); setData(new Date().toISOString().slice(0, 10)); setContaId(contas.find((conta) => conta.holding_id === movimento.holding_id)?.id ?? ""); }}>Dar baixa</Button></td>
        </tr>)}</tbody>
      </table>
    </div>

    <Dialog open={Boolean(alvo)} onOpenChange={(aberto) => { if (!aberto) setAlvo(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Baixar pagamento da holding</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-sm font-semibold">{alvo?.descricao}</p><p className="mt-1 text-xs text-muted-foreground">{alvo?.holding_nome} · {formatarCentavos(alvo?.valor_centavos ?? 0)}</p></div>
          <div className="grid gap-2"><Label htmlFor="holding-data">Data do pagamento</Label><Input id="holding-data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Conta bancária da holding</Label><Select value={contaId} onValueChange={setContaId}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{contas.filter((conta) => conta.holding_id === alvo?.holding_id).map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="holding-comprovante">Comprovante (URL)</Label><Input id="holding-comprovante" value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="https://…" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button><Button disabled={salvando || !contaId} onClick={() => void confirmarBaixa()}><CheckCircle2 size={15} className="mr-2" />{salvando ? "Salvando…" : "Confirmar baixa"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
