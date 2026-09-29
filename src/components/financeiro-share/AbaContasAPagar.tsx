import { useMemo, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaSolicitacoesCompra } from "./AbaSolicitacoesCompra";
import { toast } from "sonner";
import { useContasAPagar } from "@/hooks/useContasAPagar";
import type { ContaAPagar } from "./tipos";
import { KpiCard } from "@/components/financeiro-design/KpiCard";
import { TabelaLancamentos } from "@/components/financeiro-design/TabelaLancamentos";
import { DarBaixaDialog, type DadosBaixaSaida } from "@/components/financeiro-design/DarBaixaDialog";
import { DetalheContaAPagar } from "./DetalheContaAPagar";
import { agendarContaAPagar, anexarDocumentoLancamento, duplicarLancamento, editarLancamento } from "@/lib/financeiro-share-api";
import {
  type FiltrosTabela,
  type LancamentoTabela,
  FILTROS_VAZIOS,
  mapearContaAPagar,
  formatarBRL,
} from "@/components/financeiro-design/lancamento-tabela";

function formatarBRLLocal(valor: number): string {
  return formatarBRL(valor);
}

export function AbaContasAPagar({ onNovaConta }: { onNovaConta: () => void }) {
  const { contas, carregando, erro, darBaixa, recarregar } = useContasAPagar({});

  async function editar(lancamento: LancamentoTabela) {
    const descricao = window.prompt("Descrição da conta", lancamento.descricao);
    if (!descricao?.trim() || descricao.trim() === lancamento.descricao) return;
    try { await editarLancamento(lancamento.lancamentoId ?? lancamento.id, { descricao: descricao.trim() }); await recarregar(); toast.success("Conta atualizada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível editar a conta."); }
  }

  async function duplicar(lancamento: LancamentoTabela) {
    try { await duplicarLancamento(lancamento.lancamentoId ?? lancamento.id); await recarregar(); toast.success("Conta duplicada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível duplicar a conta."); }
  }

  async function agendar(lancamento: LancamentoTabela) {
    try { await agendarContaAPagar(lancamento.id); await recarregar(); toast.success("Pagamento agendado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível agendar o pagamento."); }
  }

  async function anexar(lancamento: LancamentoTabela) {
    const url = window.prompt("URL do documento", "https://");
    if (!url?.trim() || url.trim() === "https://") return;
    const nome = window.prompt("Nome do documento", "documento");
    if (!nome?.trim()) return;
    try { await anexarDocumentoLancamento(lancamento.lancamentoId ?? lancamento.id, { nome: nome.trim(), url: url.trim() }); await recarregar(); toast.success("Documento anexado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível anexar o documento."); }
  }
  const [filtros, setFiltros] = useState<FiltrosTabela>(FILTROS_VAZIOS);
  const [baixaAlvo, setBaixaAlvo] = useState<LancamentoTabela | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const contaDetalhe = useMemo(() => contas.find((c) => c.id === detalheId) || null, [contas, detalheId]);

  const itens = useMemo(() => contas.map(mapearContaAPagar), [contas]);

  const filtrados = useMemo(() => {
    return itens.filter((l) => {
      if (filtros.busca) {
        const busca = filtros.busca.toLowerCase();
        if (![l.descricao, l.fornecedor, l.categoriaNome, l.id, l.documento].some((valor) => String(valor ?? "").toLowerCase().includes(busca))) return false;
      }
      if (filtros.status === "LIQUIDADO" && !["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(l.status)) return false;
      if (filtros.status !== "TODOS" && filtros.status !== "LIQUIDADO" && l.status !== filtros.status) return false;
      if (filtros.grupo !== "TODOS" && l.grupoCategoria !== filtros.grupo) return false;
      return true;
    });
  }, [itens, filtros]);

  const emAberto = useMemo(
    () => contas.filter((c) => !["PAGO", "CANCELADO"].includes(c.status)).reduce((s, c) => s + c.valor, 0),
    [contas],
  );
  const atrasado = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return contas.filter((c) => !["PAGO", "CANCELADO"].includes(c.status) && c.dataVencimento.slice(0, 10) < hoje).reduce((s, c) => s + c.valor, 0);
  }, [contas]);
  const totalPago = useMemo(
    () => contas.filter((c) => c.status === "PAGO").reduce((s, c) => s + c.valor, 0),
    [contas],
  );

  async function confirmarBaixa(id: string, dados: DadosBaixaSaida) {
    await darBaixa(id, {
      dataPagamento: dados.dataPagamento,
      bancoPagamento: dados.contaBancaria,
      comprovantePagamentoUrl: undefined,
      valorPago: dados.valorPago,
      formaPagamento: dados.formaPagamento,
      observacoes: dados.observacoes,
    });
  }

  return (
    <Tabs defaultValue="contas" className="space-y-4">
      <TabsList className="h-auto rounded-xl border border-border bg-card p-1">
        <TabsTrigger value="contas" className="rounded-lg px-4 py-2 text-xs">Contas da Share</TabsTrigger>
        <TabsTrigger value="compras" className="rounded-lg px-4 py-2 text-xs">Solicitações de compra</TabsTrigger>
      </TabsList>
      <TabsContent value="compras" className="mt-0"><AbaSolicitacoesCompra /></TabsContent>
      <TabsContent value="contas" className="mt-0">
      <div className="space-y-4">
      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total a Pagar"
          valor={formatarBRLLocal(contas.reduce((s, c) => s + c.valor, 0))}
          detalhe={`${contas.length} registros`}
          Icon={Wallet}
          destaque
        />
        <KpiCard
          label="Em Aberto"
          valor={formatarBRLLocal(emAberto)}
          detalhe="Pendentes de pagamento"
          Icon={Wallet}
        />
        <KpiCard
          label="Atrasado"
          valor={formatarBRLLocal(atrasado)}
          detalhe={atrasado > 0 ? "Títulos vencidos" : "Nenhum título em atraso"}
          Icon={Wallet}
        />
        <KpiCard
          label="Pago"
          valor={formatarBRLLocal(totalPago)}
          detalhe="Já liquidados"
          Icon={Wallet}
        />
      </div>

      <TabelaLancamentos
        titulo="Contas a pagar"
        itens={filtrados}
        filtros={filtros}
        onFiltrar={setFiltros}
        onDarBaixa={setBaixaAlvo}
        onAbrirDetalhe={(l) => setDetalheId(l.id)}
        onEditar={(l) => void editar(l)}
        onDuplicar={(l) => void duplicar(l)}
        onAgendar={(l) => void agendar(l)}
        onAnexar={(l) => void anexar(l)}
        carregando={carregando}
        acoes={<Button size="sm" className="gap-2" onClick={onNovaConta}><Plus size={14} /> Nova conta</Button>}
      />

      <DarBaixaDialog
        lancamento={baixaAlvo}
        onFechar={() => setBaixaAlvo(null)}
        onConfirmar={confirmarBaixa}
      />

      <DetalheContaAPagar
        conta={contaDetalhe}
        onFechar={() => setDetalheId(null)}
        onBaixar={darBaixa}
      />
      </div>
      </TabsContent>
    </Tabs>
  );
}
