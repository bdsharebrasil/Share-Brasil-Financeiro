import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/financeiro-design/StatusBadge";
import { buscarContasBancariasHolding, buscarSolicitacoesPagamento, darBaixaContaAPagar, formatarData, formatarMoeda, type ContaBancaria, type ReembolsoColaborador, type SolicitacaoPagamento } from "@/lib/financeiro-share-api";

export function AbaSolicitacoesPagamento({ contasBancarias }: { contasBancarias: ContaBancaria[] }) {
  const [envios, setEnvios] = useState<SolicitacaoPagamento[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<ReembolsoColaborador | null>(null);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [bancoId, setBancoId] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [contasParaPagamento, setContasParaPagamento] = useState<ContaBancaria[]>(contasBancarias);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarSolicitacoesPagamento();
      setEnvios(dados.envios);
      setReembolsos(dados.reembolsos);
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as solicitações de pagamento."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    let ativo = true;
    if (!alvo || String(alvo.tipoCaixa).toUpperCase() !== "HOLDING") {
      setContasParaPagamento(contasBancarias);
      return () => { ativo = false; };
    }
    void buscarContasBancariasHolding().then((contas) => {
      if (ativo) setContasParaPagamento(contas.filter((conta) => !alvo.holdingId || conta.holding_id === alvo.holdingId));
    }).catch(() => { if (ativo) setContasParaPagamento([]); });
    return () => { ativo = false; };
  }, [alvo, contasBancarias]);

  async function confirmarBaixa() {
    if (!alvo?.id || !bancoId) return;
    setSalvando(true);
    try {
      await darBaixaContaAPagar(alvo.id, { dataPagamento, bancoPagamento: bancoId, comprovantePagamentoUrl: comprovante.trim() || undefined, formaPagamento: "TRANSFERENCIA" });
      toast.success("Reembolso do colaborador marcado como pago.");
      setAlvo(null);
      setComprovante("");
      await carregar();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível registrar o pagamento."); }
    finally { setSalvando(false); }
  }

  return <div className="space-y-5">
    {erro && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
    <div className="flex justify-end">
      <Button variant="outline" size="sm" onClick={() => void carregar()}><RefreshCw size={14} className="mr-2" /> Atualizar</Button>
    </div>
    <Tabs defaultValue="cotista" className="space-y-4">
      <TabsList className="financeiro-tabs h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
        <TabsTrigger value="cotista" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Solicitações de pagamento · caixa cliente</TabsTrigger>
        <TabsTrigger value="colaborador" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Reembolso colaborador</TabsTrigger>
      </TabsList>
      <TabsContent value="cotista" className="mt-0">
        <div className="financeiro-panel overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Solicitação</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-border/70">{carregando ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando envios…</td></tr> : envios.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum envio de pagamento encontrado.</td></tr> : envios.map((item) => <tr key={item.id} className="hover:bg-muted/25"><td className="max-w-[320px] truncate px-4 py-3 font-semibold">{item.descricao}</td><td className="px-4 py-3 text-muted-foreground">{item.solicitante_nome ?? item.criado_por ?? "—"}</td><td className="px-4 py-3">{item.tipo === "reembolso" ? "Reembolso" : "Caixa cliente"}</td><td className="px-4 py-3">{formatarData(item.vencimento ?? item.data_despesa)}</td><td className="px-4 py-3 text-right font-mono">{formatarMoeda(Number(item.valor ?? 0))}</td><td className="px-4 py-3"><StatusBadge status={String(item.status).toUpperCase()} /></td></tr>)}</tbody>
          </table>
        </div>
      </TabsContent>
      <TabsContent value="colaborador" className="mt-0">
        <div className="financeiro-panel overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-border/70">{carregando ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando reembolsos…</td></tr> : reembolsos.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum reembolso pendente.</td></tr> : reembolsos.map((item) => <tr key={item.id} className="hover:bg-muted/25">
              <td className="max-w-[340px] px-4 py-3"><p className="truncate font-semibold">{item.descricao ?? "Despesa reembolsável"}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.aeronaveId ?? "Relatório de viagem"}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{item.solicitanteNome ?? "Colaborador não identificado"}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatarData(item.dataVencimento)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarMoeda(item.valor)}</td>
              <td className="px-4 py-3"><StatusBadge status={String(item.status).toUpperCase()} /></td>
              <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => { setAlvo(item); setDataPagamento(new Date().toISOString().slice(0, 10)); setBancoId(""); }}>Dar baixa</Button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </TabsContent>
    </Tabs>

    <Dialog open={Boolean(alvo)} onOpenChange={(aberto) => { if (!aberto) setAlvo(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dar baixa no reembolso</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-sm font-semibold">{alvo?.descricao}</p><p className="mt-1 text-xs text-muted-foreground">{formatarMoeda(alvo?.valor ?? 0)}</p></div>
          <div className="grid gap-2"><Label htmlFor="reembolso-data">Data do pagamento</Label><Input id="reembolso-data" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Conta {String(alvo?.tipoCaixa).toUpperCase() === "HOLDING" ? "da holding" : "Share"}</Label><Select value={bancoId} onValueChange={setBancoId}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{contasParaPagamento.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="reembolso-comprovante">Comprovante (URL)</Label><Input id="reembolso-comprovante" value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="https://…" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button><Button disabled={salvando || !bancoId} onClick={() => void confirmarBaixa()}><CheckCircle2 size={15} className="mr-2" />{salvando ? "Salvando…" : "Confirmar pagamento"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
