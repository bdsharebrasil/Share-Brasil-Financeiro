import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, FileClock, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buscarContasAPagar,
  buscarContasAReceber,
  buscarSolicitacoesPagamento,
  formatarMoeda,
  formatarData,
  type ReembolsoColaborador,
} from "@/lib/financeiro-share-api";
import type { ContaAPagar, ContaAReceber } from "./tipos";

type ItemPrioridade = {
  id: string;
  tipo: "pagar" | "receber";
  vencimento: string;
  descricao: string;
  responsavel: string;
  valor: number;
  status: string;
};

const quitados = new Set(["PAGO", "RECEBIDO", "REEMBOLSADO", "CANCELADO"]);
const dataHoje = () => new Date().toISOString().slice(0, 10);

export function AbaResumoFinanceiro({ aoMudarAba }: { aoMudarAba: (aba: string) => void }) {
  const [contasPagar, setContasPagar] = useState<ContaAPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaAReceber[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void Promise.all([buscarContasAPagar(), buscarContasAReceber(), buscarSolicitacoesPagamento()])
      .then(([pagar, receber, solicitacoes]) => {
        if (!ativo) return;
        setContasPagar(pagar);
        setContasReceber(receber);
        setReembolsos(solicitacoes.reembolsos);
      })
      .catch((cause: unknown) => {
        if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar o resumo financeiro.");
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const hoje = dataHoje();
  const contasEmAberto = contasPagar.filter((conta) => !quitados.has(String(conta.status).toUpperCase()));
  const atrasadas = contasReceber.filter((conta) => !quitados.has(String(conta.status).toUpperCase()) && (conta.dataVencimento ?? "") < hoje);
  const reembolsosPendentes = reembolsos.filter((conta) => !quitados.has(String(conta.status).toUpperCase()));
  const valorReembolsos = reembolsosPendentes.reduce((total, conta) => total + conta.valor, 0);

  const prioridades = useMemo(() => {
    const pagar: ItemPrioridade[] = contasEmAberto.map((conta) => ({
      id: conta.id,
      tipo: "pagar",
      vencimento: conta.dataVencimento ?? "",
      descricao: conta.descricao ?? conta.categoriaNome ?? "Conta a pagar",
      responsavel: conta.fornecedorId ?? "Share Brasil",
      valor: conta.valor,
      status: conta.status,
    }));
    const receber: ItemPrioridade[] = atrasadas.map((conta) => ({
      id: conta.id,
      tipo: "receber",
      vencimento: conta.dataVencimento ?? "",
      descricao: conta.descricao ?? conta.categoriaNome ?? "Conta a receber",
      responsavel: conta.fornecedor ?? conta.cotistaId ?? "Cliente",
      valor: conta.valor,
      status: conta.status,
    }));
    return [...pagar, ...receber].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
  }, [contasEmAberto, atrasadas]);

  return (
    <div className="space-y-5">
      {erro && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
      <section className="grid gap-3 md:grid-cols-3" aria-label="Resumo financeiro">
        <button type="button" onClick={() => aoMudarAba("contas-apagar")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3">
            <span><span className="financeiro-kpi-label">Despesas a pagar</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(contasEmAberto.reduce((total, conta) => total + conta.valor, 0))}</span><span className="mt-1 block text-xs text-muted-foreground">{contasEmAberto.length} contas da empresa em aberto</span></span>
            <span className="financeiro-kpi-icon text-amber-600 dark:text-amber-400"><ReceiptText size={16} /></span>
          </div>
        </button>
        <button type="button" onClick={() => aoMudarAba("contas-areceber")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3">
            <span><span className="financeiro-kpi-label">Contas a receber em atraso</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(atrasadas.reduce((total, conta) => total + conta.valor, 0))}</span><span className="mt-1 block text-xs text-muted-foreground">{atrasadas.length} títulos vencidos</span></span>
            <span className="financeiro-kpi-icon text-rose-600 dark:text-rose-400"><ArrowDownCircle size={16} /></span>
          </div>
        </button>
        <button type="button" onClick={() => aoMudarAba("solicitacoes-pagamento")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3">
            <span><span className="financeiro-kpi-label">Reembolsos de colaboradores</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(valorReembolsos)}</span><span className="mt-1 block text-xs text-muted-foreground">{reembolsosPendentes.length} solicitações aguardando pagamento</span></span>
            <span className="financeiro-kpi-icon text-cyan-700 dark:text-cyan-400"><FileClock size={16} /></span>
          </div>
        </button>
      </section>

      <section className="financeiro-panel">
        <header className="financeiro-panel-header">
          <div><h2 className="text-sm font-bold">Prioridades mais próximas</h2><p className="mt-1 text-xs text-muted-foreground">Ordenadas pela data de vencimento</p></div>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => aoMudarAba("contas-apagar")}>Ver contas <ArrowUpCircle size={14} className="ml-2" /></Button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-border/70">
              {carregando ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando prioridades…</td></tr> : prioridades.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma conta pendente ou vencida.</td></tr> : prioridades.map((item) => {
                const vencida = item.vencimento < hoje;
                return <tr key={`${item.tipo}-${item.id}`} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.tipo === "pagar" ? "Pagar" : "Receber"}</td>
                  <td className={`whitespace-nowrap px-4 py-3 ${vencida ? "font-semibold text-destructive" : ""}`}>{formatarData(item.vencimento)}</td>
                  <td className="max-w-[300px] truncate px-4 py-3 font-medium">{item.descricao}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{item.responsavel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarMoeda(item.valor)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${vencida ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{vencida ? "EM ATRASO" : item.status.replace(/_/g, " ")}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
