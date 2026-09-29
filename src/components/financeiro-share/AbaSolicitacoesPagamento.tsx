import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buscarSolicitacoesPagamento, darBaixaContaAPagar, formatarData, formatarMoeda, type ContaBancaria, type ReembolsoColaborador, type SolicitacaoPagamento } from "@/lib/financeiro-share-api";

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
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("TODOS");
  const [ordem, setOrdem] = useState("vencimento");

  const enviosFiltrados = useMemo(() => envios.filter((item) => {
    const termo = busca.trim().toLowerCase();
    const correspondeBusca = !termo || [item.descricao, item.solicitante_nome, item.criado_por, item.id, item.tipo].some((valor) => String(valor ?? "").toLowerCase().includes(termo));
    return correspondeBusca && (statusFiltro === "TODOS" || String(item.status).toUpperCase() === statusFiltro);
  }).sort((a, b) => ordem === "maior" ? Number(b.valor) - Number(a.valor) : ordem === "menor" ? Number(a.valor) - Number(b.valor) : ordem === "vencimento-desc" ? String(b.vencimento ?? b.data_despesa ?? "").localeCompare(String(a.vencimento ?? a.data_despesa ?? "")) : String(a.vencimento ?? a.data_despesa ?? "").localeCompare(String(b.vencimento ?? b.data_despesa ?? ""))), [envios, busca, statusFiltro, ordem]);
  const reembolsosFiltrados = useMemo(() => reembolsos.filter((item) => {
    const termo = busca.trim().toLowerCase();
    const correspondeBusca = !termo || [item.descricao, item.solicitanteNome, item.fornecedorId, item.id].some((valor) => String(valor ?? "").toLowerCase().includes(termo));
    return correspondeBusca && (statusFiltro === "TODOS" || String(item.status).toUpperCase() === statusFiltro);
  }).sort((a, b) => ordem === "maior" ? b.valor - a.valor : ordem === "menor" ? a.valor - b.valor : ordem === "vencimento-desc" ? b.dataVencimento.localeCompare(a.dataVencimento) : a.dataVencimento.localeCompare(b.dataVencimento)), [reembolsos, busca, statusFiltro, ordem]);

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
    <div className="grid gap-2 md:grid-cols-[1fr_190px_230px_auto]">
      <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar descrição, solicitante ou documento…" aria-label="Buscar solicitações" />
      <Select value={statusFiltro} onValueChange={setStatusFiltro}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="APROVADO">Aprovado</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="PAGO">Pago</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={ordem} onValueChange={setOrdem}><SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger><SelectContent><SelectItem value="vencimento">Vencimento mais próximo</SelectItem><SelectItem value="vencimento-desc">Vencimento mais distante</SelectItem><SelectItem value="maior">Maior valor</SelectItem><SelectItem value="menor">Menor valor</SelectItem></SelectContent></Select>
      <Button className="h-10" variant="outline" size="sm" onClick={() => void carregar()}><RefreshCw size={14} className="mr-2" /> Atualizar</Button>
    </div>
    <Tabs defaultValue="cotista" className="space-y-4">
      <TabsList className="financeiro-tabs h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
        <TabsTrigger value="cotista" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Reembolso cotista</TabsTrigger>
        <TabsTrigger value="colaborador" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Reembolso colaborador</TabsTrigger>
      </TabsList>
      <TabsContent value="cotista" className="mt-0">
        <div className="financeiro-panel overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Solicitação</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-border/70">{carregando ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando envios…</td></tr> : enviosFiltrados.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum envio de pagamento encontrado.</td></tr> : enviosFiltrados.map((item) => <tr key={item.id} className="hover:bg-muted/25"><td className="max-w-[320px] truncate px-4 py-3 font-semibold">{item.descricao}</td><td className="px-4 py-3 text-muted-foreground">{item.solicitante_nome ?? item.criado_por ?? "—"}</td><td className="px-4 py-3">{item.tipo === "reembolso" ? "Reembolso" : "Caixa cliente"}</td><td className="px-4 py-3">{formatarData(item.vencimento ?? item.data_despesa)}</td><td className="px-4 py-3 text-right font-mono">{formatarMoeda(Number(item.valor ?? 0))}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-[10px]">{String(item.status).replace(/_/g, " ")}</span></td></tr>)}</tbody>
          </table>
        </div>
      </TabsContent>
      <TabsContent value="colaborador" className="mt-0">
        <div className="financeiro-panel overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-border/70">{carregando ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando reembolsos…</td></tr> : reembolsosFiltrados.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum reembolso pendente.</td></tr> : reembolsosFiltrados.map((item) => <tr key={item.id} className="hover:bg-muted/25">
              <td className="max-w-[340px] px-4 py-3"><p className="truncate font-semibold">{item.descricao ?? "Despesa reembolsável"}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.aeronaveId ?? "Relatório de viagem"}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{item.solicitanteNome ?? "Colaborador não identificado"}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatarData(item.dataVencimento)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarMoeda(item.valor)}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{String(item.status).replace(/_/g, " ")}</span></td>
              <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => { setAlvo(item); setDataPagamento(new Date().toISOString().slice(0, 10)); setBancoId(contasBancarias[0]?.id ?? ""); }}>Dar baixa</Button></td>
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
          <div className="grid gap-2"><Label>Conta Share</Label><Select value={bancoId} onValueChange={setBancoId}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{contasBancarias.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="reembolso-comprovante">Comprovante (URL)</Label><Input id="reembolso-comprovante" value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="https://…" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button><Button disabled={salvando || !bancoId} onClick={() => void confirmarBaixa()}><CheckCircle2 size={15} className="mr-2" />{salvando ? "Salvando…" : "Confirmar pagamento"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
