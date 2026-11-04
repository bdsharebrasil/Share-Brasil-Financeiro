import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaSolicitacoesCompra } from "./AbaSolicitacoesCompra";
import { AbaSolicitacoesPagamento } from "./AbaSolicitacoesPagamento";
import { toast } from "sonner";
import { useContasAPagar, type DadosBaixaAPagar } from "@/hooks/useContasAPagar";
import { TabelaLancamentos } from "@/components/financeiro-design/TabelaLancamentos";
import { DetalheContaAPagar } from "./DetalheContaAPagar";
import { ModalContaAPagar } from "./ModalContaAPagar";
import { agendarContaAPagar, anexarDocumentoLancamento, duplicarLancamento, editarLancamento, type ContaBancaria } from "@/lib/financeiro-share-api";
import type { ContaAPagar } from "./tipos";
import {
  type FiltrosTabela,
  type LancamentoTabela,
  FILTROS_VAZIOS,
  mapearContaAPagar,
  formatarBRL,
} from "@/components/financeiro-design/lancamento-tabela";

export function AbaContasAPagar({ onNovaConta, contasBancarias, subAba, onSubAbaChange }: { onNovaConta: () => void; contasBancarias: ContaBancaria[]; subAba: string; onSubAbaChange: (valor: string) => void }) {
  const { contas, carregando, erro, darBaixa, recarregar } = useContasAPagar({});
  const [filtros, setFiltros] = useState<FiltrosTabela>(FILTROS_VAZIOS);
  const [baixaAlvo, setBaixaAlvo] = useState<ContaAPagar | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const contaDetalhe = useMemo(() => contas.find((conta) => conta.id === detalheId) || null, [contas, detalheId]);
  const itens = useMemo(() => contas.map(mapearContaAPagar), [contas]);
  const filtrados = useMemo(() => itens.filter((lancamento) => {
    if (filtros.busca) {
      const busca = filtros.busca.toLocaleLowerCase("pt-BR");
      const dados = [lancamento.descricao, lancamento.fornecedor, lancamento.id, lancamento.documento ?? ""].join(" ").toLocaleLowerCase("pt-BR");
      if (!dados.includes(busca)) return false;
    }
    if (filtros.status !== "TODOS" && lancamento.status !== filtros.status) return false;
    if (filtros.grupo !== "TODOS" && lancamento.grupoCategoria !== filtros.grupo) return false;
    return true;
  }), [itens, filtros]);

  const emAberto = useMemo(() => contas.filter((conta) => !["PAGO", "CANCELADO"].includes(conta.status)).reduce((total, conta) => total + conta.valor, 0), [contas]);
  const atrasado = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return contas.filter((conta) => !["PAGO", "CANCELADO"].includes(conta.status) && conta.dataVencimento.slice(0, 10) < hoje).reduce((total, conta) => total + conta.valor, 0);
  }, [contas]);
  const totalPago = useMemo(() => contas.filter((conta) => conta.status === "PAGO").reduce((total, conta) => total + conta.valor, 0), [contas]);

  async function editar(lancamento: LancamentoTabela) {
    const descricao = window.prompt("Descrição da conta", lancamento.descricao);
    if (!descricao?.trim() || descricao.trim() === lancamento.descricao) return;
    try {
      await editarLancamento(lancamento.lancamentoId ?? lancamento.id, { descricao: descricao.trim() });
      await recarregar();
      toast.success("Conta atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível editar a conta.");
    }
  }

  async function duplicar(lancamento: LancamentoTabela) {
    try {
      await duplicarLancamento(lancamento.lancamentoId ?? lancamento.id);
      await recarregar();
      toast.success("Conta duplicada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível duplicar a conta.");
    }
  }

  async function agendar(lancamento: LancamentoTabela) {
    try {
      await agendarContaAPagar(lancamento.id);
      await recarregar();
      toast.success("Pagamento agendado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar o pagamento.");
    }
  }

  async function anexar(lancamento: LancamentoTabela) {
    const url = window.prompt("URL do documento", "https://");
    if (!url?.trim() || url.trim() === "https://") return;
    const nome = window.prompt("Nome do documento", "documento");
    if (!nome?.trim()) return;
    try {
      await anexarDocumentoLancamento(lancamento.lancamentoId ?? lancamento.id, { nome: nome.trim(), url: url.trim() });
      await recarregar();
      toast.success("Documento anexado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível anexar o documento.");
    }
  }

  async function confirmarBaixa(id: string, dados: DadosBaixaAPagar) {
    await darBaixa(id, {
      dataPagamento: dados.dataPagamento,
      bancoPagamento: dados.bancoPagamento,
      comprovantePagamentoUrl: dados.comprovantePagamentoUrl,
      formaPagamento: dados.formaPagamento,
      observacoes: dados.observacoes,
    });
    setBaixaAlvo(null);
  }

  return (
    <Tabs value={subAba} onValueChange={onSubAbaChange} className="space-y-3">
      <TabsList className="h-auto rounded-xl border border-border/70 bg-card/70 p-1">
        <TabsTrigger value="contas" className="rounded-lg px-3 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Contas da Share</TabsTrigger>
        <TabsTrigger value="compras" className="rounded-lg px-3 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Solicitações de compra</TabsTrigger>
        <TabsTrigger value="solicitacoes" className="rounded-lg px-3 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Solicitações de pagamento</TabsTrigger>
      </TabsList>
      <TabsContent value="compras" className="mt-0"><AbaSolicitacoesCompra /></TabsContent>
      <TabsContent value="solicitacoes" className="mt-0"><AbaSolicitacoesPagamento contasBancarias={contasBancarias} /></TabsContent>
      <TabsContent value="contas" className="mt-0">
        <div className="space-y-3">
          {erro && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{erro}</div>}
          <TabelaLancamentos
            titulo="Contas a pagar"
            itens={filtrados}
            itensTotais={itens}
            filtros={filtros}
            onFiltrar={setFiltros}
            onDarBaixa={(lancamento) => setBaixaAlvo(contas.find((conta) => conta.id === lancamento.id) ?? null)}
            onAbrirDetalhe={(lancamento) => setDetalheId(lancamento.id)}
            onEditar={(lancamento) => void editar(lancamento)}
            onDuplicar={(lancamento) => void duplicar(lancamento)}
            onAgendar={(lancamento) => void agendar(lancamento)}
            onAnexar={(lancamento) => void anexar(lancamento)}
            carregando={carregando}
            acoes={<Button type="button" size="sm" className="h-8 gap-2 text-[11px]" onClick={onNovaConta}><Plus size={13} /> Nova conta</Button>}
            resumo={`Em aberto ${formatarBRL(emAberto)} · vencido ${formatarBRL(atrasado)} · pago ${formatarBRL(totalPago)}`}
          />
          {baixaAlvo && <ModalContaAPagar
            key={baixaAlvo.id}
            conta={baixaAlvo}
            aberto
            onFechar={() => setBaixaAlvo(null)}
            contasBancarias={contasBancarias}
            onConfirmar={(dados) => confirmarBaixa(baixaAlvo.id, dados)}
          />}
          <DetalheContaAPagar
            conta={contaDetalhe}
            onFechar={() => setDetalheId(null)}
            onBaixar={(conta) => {
              setDetalheId(null);
              setBaixaAlvo(conta);
            }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
