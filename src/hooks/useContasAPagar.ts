import { useCallback, useEffect, useState } from 'react';
import { buscarContasAPagar, buscarContasBancariasPorLancamento, buscarLancamentosComContasBancarias, darBaixaContaAPagar } from '../lib/financeiro-share-api';
import type { ContaAPagar, FiltrosContasAPagar, Lancamento, StatusContaFinanceira } from '../components/financeiro-share/tipos';

export interface DadosBaixaAPagar {
  dataPagamento: string;
  bancoPagamento: string;
  comprovantePagamentoUrl?: string;
  formaPagamento?: string;
  observacoes?: string;
}

interface RetornoUseContasAPagar {
  contas: ContaAPagar[];
  carregando: boolean;
  erro: string | null;
  darBaixa: (id: string, dados: DadosBaixaAPagar) => Promise<void>;
  recarregar: () => void;
}

function fluxoSaida(lancamento: Lancamento) {
  const fluxo = String(lancamento.fluxoOriginal || lancamento.fluxo).trim().toUpperCase().replace(/_/g, " ");
  return lancamento.caixa === "SHARE" && ["SAIDA", "DESPESA", "SAIDA REEMBOLSO", "REEMBOLSO"].includes(fluxo);
}

function comoContaAPagar(lancamento: Lancamento): ContaAPagar {
  return {
    id: lancamento.id,
    dataEmissao: lancamento.data || null,
    dataVencimento: lancamento.prazo || "",
    valor: lancamento.valorCentavos / 100,
    categoriaId: lancamento.categoriaId,
    categoriaNome: lancamento.categoria,
    descricao: lancamento.descricao,
    criadoPor: lancamento.criadoPor,
    aeronaveId: lancamento.aeronaveId,
    fornecedor: lancamento.fornecedor,
    fornecedorId: lancamento.fornecedorId,
    cotistaId: lancamento.cotistaId,
    cotistaNome: lancamento.cotistaNome ?? null,
    cotista: lancamento.cotista ?? lancamento.cotistaNome ?? null,
    reembolsavel: lancamento.reembolsavel,
    reembolsoQuitado: lancamento.reembolsoQuitado,
    boletoUrl: lancamento.anexos.find((anexo) => anexo.tipo === "boleto")?.url ?? null,
    nfUrl: lancamento.anexos.find((anexo) => anexo.tipo === "nf")?.url ?? null,
    dataPagamento: null,
    bancoPagamento: lancamento.contaBancaria ?? null,
    contaBancariaId: lancamento.contaBancariaId ?? null,
    fluxo: lancamento.fluxoOriginal ?? lancamento.fluxo,
    fonteLancamento: true,
    comprovantePagamentoUrl: lancamento.anexos.find((anexo) => anexo.tipo === "comprovante")?.url ?? null,
    documento: lancamento.documento,
    numeroDoc: lancamento.numeroDoc ?? null,
    numeroNf: lancamento.numeroNf ?? null,
    numeroRecibo: lancamento.numeroRecibo ?? null,
    numeroDemonstrativo: lancamento.numeroDemonstrativo ?? null,
    documentoUrl: lancamento.documentoUrl ?? null,
    url_demonstrativo: lancamento.url_demonstrativo ?? null,
    url_nf: lancamento.url_nf ?? null,
    url_recibo: lancamento.url_recibo ?? null,
    url_boleto: lancamento.url_boleto ?? null,
    url_doc: lancamento.url_doc ?? null,
    lancamentoId: lancamento.id,
    status: lancamento.status as StatusContaFinanceira,
    criadoEm: lancamento.criadoEm,
    atualizadoEm: lancamento.atualizadoEm,
  };
}

/** Busca as contas a pagar e expõe a ação de dar baixa (marcar como pago). */
export function useContasAPagar(filtros: FiltrosContasAPagar = {}): RetornoUseContasAPagar {
  const [contas, setContas] = useState<ContaAPagar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [contasLegadas, contasPorLancamento, lancamentos] = await Promise.all([
        buscarContasAPagar(filtros),
        buscarContasBancariasPorLancamento().catch(() => new Map<string, { id: string; nome: string | null }>()),
        filtros.incluirLancamentos
          ? buscarLancamentosComContasBancarias().catch((): Lancamento[] => [])
          : Promise.resolve<Lancamento[]>([]),
      ]);
      const lancamentosPorId = new Map(lancamentos.map((lancamento) => [lancamento.id, lancamento]));
      const contas = contasLegadas.map((conta) => {
        const contaLancamento = conta.lancamentoId
          ? contasPorLancamento.get(conta.lancamentoId)
          : undefined;
        const lancamento = conta.lancamentoId ? lancamentosPorId.get(conta.lancamentoId) : undefined;
        const contaComBanco = contaLancamento
          ? { ...conta, contaBancariaId: contaLancamento.id, bancoPagamento: contaLancamento.nome ?? conta.bancoPagamento }
          : conta;
        return {
          ...contaComBanco,
          url_demonstrativo: conta.url_demonstrativo ?? lancamento?.url_demonstrativo ?? null,
          url_nf: conta.url_nf ?? lancamento?.url_nf ?? null,
          url_recibo: conta.url_recibo ?? lancamento?.url_recibo ?? null,
          url_boleto: conta.url_boleto ?? lancamento?.url_boleto ?? null,
          url_doc: conta.url_doc ?? lancamento?.url_doc ?? null,
        };
      });
      const vinculados = new Set(contas.flatMap((conta) => [conta.id, conta.lancamentoId].filter((id): id is string => Boolean(id))));
      const adicionais = lancamentos
        .filter((lancamento) => fluxoSaida(lancamento) && !vinculados.has(lancamento.id))
        .filter((lancamento) => !filtros.status || lancamento.status === filtros.status)
        .filter((lancamento) => !filtros.fornecedorId || lancamento.fornecedorId === filtros.fornecedorId)
        .filter((lancamento) => !filtros.vencidasAte || (lancamento.prazo || "") <= filtros.vencidasAte)
        .map(comoContaAPagar);
      setContas([...contas, ...adicionais]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as contas a pagar.");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.status, filtros.vencidasAte, filtros.fornecedorId, filtros.incluirLancamentos, filtros.incluirReembolsos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const darBaixa = useCallback(
    async (id: string, dados: DadosBaixaAPagar) => {
      await darBaixaContaAPagar(id, dados);
      await carregar();
    },
    [carregar]
  );

  return { contas, carregando, erro, darBaixa, recarregar: carregar };
}
