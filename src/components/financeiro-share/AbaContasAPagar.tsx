import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useContasAPagar } from "@/hooks/useContasAPagar";
import type { ContaAPagar } from "./tipos";
import { KpiCard } from "@/components/financeiro-design/KpiCard";
import { TabelaLancamentos } from "@/components/financeiro-design/TabelaLancamentos";
import { DarBaixaDialog, type DadosBaixaSaida } from "@/components/financeiro-design/DarBaixaDialog";
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

export function AbaContasAPagar() {
  const { contas, carregando, erro, darBaixa } = useContasAPagar({});
  const [filtros, setFiltros] = useState<FiltrosTabela>(FILTROS_VAZIOS);
  const [baixaAlvo, setBaixaAlvo] = useState<LancamentoTabela | null>(null);

  const itens = useMemo(() => contas.map(mapearContaAPagar), [contas]);

  const filtrados = useMemo(() => {
    return itens.filter((l) => {
      if (filtros.busca) {
        const busca = filtros.busca.toLowerCase();
        if (!l.descricao.toLowerCase().includes(busca) && !l.fornecedor.toLowerCase().includes(busca) && !l.id.toLowerCase().includes(busca)) return false;
      }
      if (filtros.status !== "TODOS" && l.status !== filtros.status) return false;
      if (filtros.grupo !== "TODOS" && l.grupoCategoria !== filtros.grupo) return false;
      return true;
    });
  }, [itens, filtros]);

  const emAberto = useMemo(
    () => contas.filter((c) => c.status === "PENDENTE" || c.status === "EM_ABERTO").reduce((s, c) => s + c.valor, 0),
    [contas],
  );
  const atrasado = useMemo(
    () => contas.filter((c) => c.status === "PENDENTE" && new Date(c.dataVencimento) < new Date()).reduce((s, c) => s + c.valor, 0),
    [contas],
  );
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
        carregando={carregando}
      />

      <DarBaixaDialog
        lancamento={baixaAlvo}
        onFechar={() => setBaixaAlvo(null)}
        onConfirmar={confirmarBaixa}
      />
    </div>
  );
}
