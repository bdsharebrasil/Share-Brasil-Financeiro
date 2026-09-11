import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import type { ContaAReceber } from "./tipos";
import { ModalContaAReceber } from "./ModalContaAReceber";
import { KpiCard } from "@/components/financeiro-design/KpiCard";
import { TabelaLancamentos } from "@/components/financeiro-design/TabelaLancamentos";
import {
  type FiltrosTabela,
  type LancamentoTabela,
  FILTROS_VAZIOS,
  mapearContaAReceber,
  formatarBRL,
} from "@/components/financeiro-design/lancamento-tabela";

export function AbaContasAReceber() {
  const { contas, carregando, erro, darBaixa } = useContasAReceber({});
  const [filtros, setFiltros] = useState<FiltrosTabela>(FILTROS_VAZIOS);
  const [contaSelecionada, setContaSelecionada] = useState<ContaAReceber | null>(null);

  const itens = useMemo(() => contas.map(mapearContaAReceber), [contas]);

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

  const aReceber = useMemo(
    () => contas.filter((c) => ["PENDENTE", "EM_ABERTO", "ATRASADO", "EM_ATRASO"].includes(c.status)).reduce((s, c) => s + c.valor, 0),
    [contas],
  );
  const atrasado = useMemo(
    () => contas.filter((c) => ["PENDENTE", "EM_ABERTO", "ATRASADO", "EM_ATRASO"].includes(c.status) && new Date(c.dataVencimento) < new Date()).reduce((s, c) => s + c.valor, 0),
    [contas],
  );
  const recebido = useMemo(
    () => contas.filter((c) => c.status === "RECEBIDO").reduce((s, c) => s + c.valor, 0),
    [contas],
  );

  function onDarBaixa(lancamento: LancamentoTabela) {
    const conta = contas.find((c) => c.id === lancamento.id);
    if (conta) setContaSelecionada(conta);
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
          label="Total a Receber"
          valor={formatarBRL(contas.reduce((s, c) => s + c.valor, 0))}
          detalhe={`${contas.length} registros`}
          Icon={HandCoins}
          destaque
        />
        <KpiCard
          label="Em Aberto"
          valor={formatarBRL(aReceber)}
          detalhe="Pendentes de recebimento"
          Icon={HandCoins}
        />
        <KpiCard
          label="Atrasado"
          valor={formatarBRL(atrasado)}
          detalhe={atrasado > 0 ? "Títulos vencidos" : "Nenhum título em atraso"}
          Icon={HandCoins}
        />
        <KpiCard
          label="Recebido"
          valor={formatarBRL(recebido)}
          detalhe="Já recebidos"
          Icon={HandCoins}
        />
      </div>

      <TabelaLancamentos
        titulo="Contas a receber"
        itens={filtrados}
        filtros={filtros}
        onFiltrar={setFiltros}
        onDarBaixa={onDarBaixa}
        carregando={carregando}
      />

      {contaSelecionada && (
        <ModalContaAReceber
          conta={contaSelecionada}
          aberto
          onFechar={() => setContaSelecionada(null)}
          onConfirmar={async (dados) => {
            await darBaixa(contaSelecionada.id, dados);
            setContaSelecionada(null);
          }}
        />
      )}
    </div>
  );
}
