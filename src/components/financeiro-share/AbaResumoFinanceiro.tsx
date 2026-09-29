import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, FileClock, ReceiptText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buscarContasAPagar,
  buscarContasAReceber,
  buscarSolicitacoesPagamento,
  formatarMoeda,
  formatarData,
  type ReembolsoColaborador,
  type SolicitacaoPagamento,
} from "@/lib/financeiro-share-api";
import type { ContaAPagar, ContaAReceber } from "./tipos";

type TipoPrioridade = "empresa" | "receber" | "caixa-cliente" | "reembolso";
type ItemPrioridade = {
  id: string;
  tipo: TipoPrioridade;
  documento: string;
  emissao: string | null;
  vencimento: string;
  descricao: string;
  responsavel: string;
  valor: number;
  status: string;
};

const quitados = new Set(["PAGO", "RECEBIDO", "REEMBOLSADO", "CANCELADO"]);
const dataHoje = () => new Date().toISOString().slice(0, 10);
const pendente = (status: string) => !quitados.has(status.toUpperCase());

export function AbaResumoFinanceiro({ aoMudarAba }: { aoMudarAba: (aba: string) => void }) {
  const [contasPagar, setContasPagar] = useState<ContaAPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaAReceber[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPagamento[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void Promise.all([buscarContasAPagar(), buscarContasAReceber(), buscarSolicitacoesPagamento()])
      .then(([pagar, receber, pedidos]) => {
        if (!ativo) return;
        setContasPagar(pagar);
        setContasReceber(receber);
        setSolicitacoes(pedidos.envios.filter((item) => item.tipo === "cliente"));
        setReembolsos(pedidos.reembolsos);
      })
      .catch((cause: unknown) => {
        if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar o resumo financeiro.");
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const hoje = dataHoje();
  const contasEmAberto = contasPagar.filter((conta) => pendente(conta.status));
  const atrasadas = contasReceber.filter((conta) => pendente(conta.status) && (conta.dataVencimento ?? "") < hoje);
  const solicitacoesPendentes = solicitacoes.filter((item) => pendente(item.status));
  const reembolsosPendentes = reembolsos.filter((conta) => pendente(conta.status));
  const valorReembolsos = reembolsosPendentes.reduce((total, conta) => total + conta.valor, 0);

  const prioridades = useMemo(() => {
    const pagar: ItemPrioridade[] = contasEmAberto.map((conta) => ({
      id: conta.id,
      tipo: "empresa",
      documento: conta.documentoNumero ?? conta.id,
      emissao: conta.dataEmissao ?? conta.criadoEm,
      vencimento: conta.dataVencimento ?? "",
      descricao: conta.descricao ?? conta.categoriaNome ?? "Conta a pagar",
      responsavel: conta.fornecedor ?? conta.fornecedorId ?? "Share Brasil",
      valor: conta.valor,
      status: conta.status,
    }));
    const receber: ItemPrioridade[] = atrasadas.map((conta) => ({
      id: conta.id,
      tipo: "receber",
      documento: conta.documentoNumero ?? conta.id,
      emissao: conta.dataEmissao ?? conta.criadoEm,
      vencimento: conta.dataVencimento ?? "",
      descricao: conta.descricao ?? conta.categoriaNome ?? "Conta a receber",
      responsavel: conta.fornecedor ?? conta.cotistaId ?? "Cliente",
      valor: conta.valor,
      status: conta.status,
    }));
    const caixaCliente: ItemPrioridade[] = solicitacoesPendentes.map((item) => ({
      id: item.id,
      tipo: "caixa-cliente",
      documento: item.id,
      emissao: item.criado_em,
      vencimento: item.vencimento ?? item.data_despesa ?? item.criado_em,
      descricao: item.descricao || "Solicitação de pagamento",
      responsavel: item.solicitante_nome ?? item.criado_por ?? "Cliente",
      valor: Number(item.valor ?? 0),
      status: item.status,
    }));
    const reembolsar: ItemPrioridade[] = reembolsosPendentes.map((item) => ({
      id: item.id,
      tipo: "reembolso",
      documento: item.documentoNumero ?? item.id,
      emissao: item.dataEmissao ?? item.dataVencimento,
      vencimento: item.dataVencimento ?? "",
      descricao: item.descricao ?? "Reembolso de colaborador",
      responsavel: item.solicitanteNome ?? item.fornecedorId ?? "Colaborador",
      valor: item.valor,
      status: item.status,
    }));
    return [...pagar, ...receber, ...caixaCliente, ...reembolsar]
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 8);
  }, [contasEmAberto, atrasadas, solicitacoesPendentes, reembolsosPendentes]);

  const valorContasEmAberto = contasEmAberto.reduce((total, conta) => total + conta.valor, 0);
  const valorAtrasadas = atrasadas.reduce((total, conta) => total + conta.valor, 0);
  const valorSolicitacoes = solicitacoesPendentes.reduce((total, item) => total + Number(item.valor ?? 0), 0);

  return (
    <div className="space-y-5">
      {erro && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo financeiro">
        <button type="button" onClick={() => aoMudarAba("contas-apagar")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3"><span><span className="financeiro-kpi-label">Contas da empresa a pagar</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(valorContasEmAberto)}</span><span className="mt-1 block text-xs text-muted-foreground">{contasEmAberto.length} despesas do caixa Share</span></span><span className="financeiro-kpi-icon text-amber-600"><ReceiptText size={16} /></span></div>
        </button>
        <button type="button" onClick={() => aoMudarAba("solicitacoes-pagamento")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3"><span><span className="financeiro-kpi-label">Solicitações · caixa do cliente</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(valorSolicitacoes)}</span><span className="mt-1 block text-xs text-muted-foreground">{solicitacoesPendentes.length} pagamentos em andamento</span></span><span className="financeiro-kpi-icon text-cyan-700"><WalletCards size={16} /></span></div>
        </button>
        <button type="button" onClick={() => aoMudarAba("contas-areceber")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3"><span><span className="financeiro-kpi-label">Contas a receber em atraso</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(valorAtrasadas)}</span><span className="mt-1 block text-xs text-muted-foreground">{atrasadas.length} títulos vencidos</span></span><span className="financeiro-kpi-icon text-rose-600"><ArrowDownCircle size={16} /></span></div>
        </button>
        <button type="button" onClick={() => aoMudarAba("solicitacoes-pagamento")} className="financeiro-kpi text-left">
          <div className="flex items-start justify-between gap-3"><span><span className="financeiro-kpi-label">Reembolsos de colaboradores</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{carregando ? "—" : formatarMoeda(valorReembolsos)}</span><span className="mt-1 block text-xs text-muted-foreground">{reembolsosPendentes.length} aguardando pagamento</span></span><span className="financeiro-kpi-icon text-cyan-700"><FileClock size={16} /></span></div>
        </button>
      </section>

      <section className="financeiro-panel">
        <header className="financeiro-panel-header">
          <div><h2 className="text-sm font-bold">Próximas ações financeiras</h2><p className="mt-1 text-xs text-muted-foreground">Contas da empresa, caixa do cliente, recebíveis vencidos e reembolsos</p></div>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => aoMudarAba("contas-apagar")}>Ver contas <ArrowUpCircle size={14} className="ml-2" /></Button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Documento / emissão</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-border/70">
              {carregando ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando prioridades…</td></tr> : prioridades.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma pendência financeira.</td></tr> : prioridades.map((item) => {
                const vencida = item.vencimento && item.vencimento.slice(0, 10) < hoje;
                const tipoLabel = item.tipo === "empresa" ? "Caixa Share" : item.tipo === "receber" ? "A receber" : item.tipo === "caixa-cliente" ? "Caixa cliente" : "Reembolso";
                const destino = item.tipo === "empresa" ? "contas-apagar" : item.tipo === "receber" ? "contas-areceber" : "solicitacoes-pagamento";
                return <tr key={`${item.tipo}-${item.id}`} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{tipoLabel}</td>
                  <td className="whitespace-nowrap px-4 py-3"><p className="font-mono text-[11px] font-semibold">{item.documento}</p><p className="text-[10px] text-muted-foreground">{formatarData(item.emissao)}</p></td>
                  <td className={`whitespace-nowrap px-4 py-3 ${vencida ? "font-semibold text-destructive" : ""}`}>{formatarData(item.vencimento)}</td>
                  <td className="max-w-[280px] truncate px-4 py-3 font-medium">{item.descricao}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{item.responsavel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatarMoeda(item.valor)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${vencida ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>{vencida ? "EM ATRASO" : item.status.replace(/_/g, " ")}</span></td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => aoMudarAba(destino)}>Abrir</Button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
