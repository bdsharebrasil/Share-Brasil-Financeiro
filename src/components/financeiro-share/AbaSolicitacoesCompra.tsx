import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <div className="financeiro-panel overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-xs">
        <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Solicitação</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Data necessária</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
        <tbody className="divide-y divide-border/70">
          {carregando ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Carregando solicitações…</td></tr> : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma solicitação de compra encontrada.</td></tr> : items.map((item) => {
            const status = String(item.status ?? "PENDENTE").toUpperCase();
            return <tr key={item.id} className="hover:bg-muted/25">
              <td className="max-w-[340px] px-4 py-3"><p className="truncate font-semibold">{item.descricao}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.id}</p></td>
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
