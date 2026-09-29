import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { aprovarEnvioCompra, buscarEnviosCompraShare, converterEnvioCompra, formatarData, formatarMoeda, type SolicitacaoPagamento } from "@/lib/financeiro-share-api";

const statusLabels: Record<string, string> = {
  PENDENTE: "Aguardando aprovação",
  APROVADO: "Aprovada · aguardando pagamento",
  CONCLUIDO: "Concluída",
  CONVERTIDO: "Conta criada",
  CANCELADO: "Cancelada",
};

export function AbaSolicitacoesCompra() {
  const [items, setItems] = useState<SolicitacaoPagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [ordem, setOrdem] = useState("vencimento");
  const filtrados = useMemo(() => items.filter((item) => {
    const termo = busca.trim().toLowerCase();
    const correspondeBusca = !termo || [item.descricao, item.solicitante_nome, item.criado_por, item.id].some((valor) => String(valor ?? "").toLowerCase().includes(termo));
    return correspondeBusca && (filtroStatus === "TODOS" || String(item.status).toUpperCase() === filtroStatus);
  }).sort((a, b) => ordem === "maior" ? Number(b.valor) - Number(a.valor) : ordem === "menor" ? Number(a.valor) - Number(b.valor) : ordem === "vencimento-desc" ? String(b.vencimento ?? "").localeCompare(String(a.vencimento ?? "")) : String(a.vencimento ?? "").localeCompare(String(b.vencimento ?? ""))), [items, busca, filtroStatus, ordem]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setItems(await buscarEnviosCompraShare()); }
    catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as solicitações de compra."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function aprovar(item: SolicitacaoPagamento) {
    setProcessando(item.id);
    try {
      await aprovarEnvioCompra(item.id);
      await converterEnvioCompra(item.id);
      toast.success("Solicitação aprovada e conta criada para pagamento.");
      await carregar();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível aprovar a solicitação.");
      await carregar();
    } finally { setProcessando(null); }
  }

  async function criarConta(item: SolicitacaoPagamento) {
    setProcessando(item.id);
    try {
      await converterEnvioCompra(item.id);
      toast.success("Conta a pagar criada.");
      await carregar();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível criar a conta."); }
    finally { setProcessando(null); }
  }

  return <section className="space-y-4">
    <header className="financeiro-panel-header rounded-xl border border-border bg-card">
      <div><h2 className="text-sm font-bold">Solicitações de compra</h2><p className="mt-1 text-xs text-muted-foreground">Despesas enviadas para o caixa da Share, separadas das contas já lançadas.</p></div>
      <Button variant="outline" size="sm" onClick={() => void carregar()}><RefreshCw size={14} className="mr-2" /> Atualizar</Button>
    </header>
    {erro && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
    <div className="grid gap-2 md:grid-cols-[1fr_190px_230px]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar descrição, solicitante ou número…" aria-label="Buscar solicitações de compra" className="pl-9" /></div>
      <select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filtrar solicitação por status"><option value="TODOS">Todos os status</option><option value="PENDENTE">Pendente</option><option value="APROVADO">Aprovado</option><option value="CONVERTIDO">Conta criada</option><option value="CONCLUIDO">Concluída</option><option value="CANCELADO">Cancelado</option></select>
      <select value={ordem} onChange={(event) => setOrdem(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Ordenar solicitações"><option value="vencimento">Vencimento mais próximo</option><option value="vencimento-desc">Vencimento mais distante</option><option value="maior">Maior valor</option><option value="menor">Menor valor</option></select>
    </div>
    <div className="financeiro-panel overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-xs">
        <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Documento / emissão</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
        <tbody className="divide-y divide-border/70">
          {carregando ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Carregando solicitações…</td></tr> : filtrados.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma solicitação de compra encontrada.</td></tr> : filtrados.map((item) => {
            const status = String(item.status ?? "PENDENTE").toUpperCase();
            return <tr key={item.id} className="hover:bg-muted/25">
              <td className="max-w-[340px] px-4 py-3"><p className="truncate font-mono text-xs font-semibold">{item.id}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatarData(item.criado_em)}</p><p className="mt-1 truncate text-xs">{item.descricao}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{item.solicitante_nome ?? item.criado_por ?? "Não identificado"}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatarData(item.vencimento ?? item.data_despesa)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarMoeda(Number(item.valor ?? 0))}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === "PENDENTE" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : status === "CANCELADO" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>{statusLabels[status] ?? status.replace(/_/g, " ")}</span></td>
              <td className="px-4 py-3 text-right">{status === "PENDENTE" ? <Button size="sm" onClick={() => void aprovar(item)} disabled={processando === item.id}><Check size={14} className="mr-1" />{processando === item.id ? "Aprovando…" : "Aprovar"}</Button> : status === "APROVADO" && !item.lancamento_id ? <Button size="sm" variant="outline" onClick={() => void criarConta(item)} disabled={processando === item.id}>{processando === item.id ? "Criando…" : "Criar conta"}</Button> : item.lancamento_id ? <span className="text-[10px] text-muted-foreground">Conta vinculada</span> : "—"}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
