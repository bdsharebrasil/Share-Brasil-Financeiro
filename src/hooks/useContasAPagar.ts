import { useCallback, useEffect, useState } from 'react';
import { buscarContasAPagar, darBaixaContaAPagar } from '../lib/apiFinanceiroShare';
import type { ContaAPagar, FiltrosContasAPagar } from '../components/financeiro-share/tipos';

interface RetornoUseContasAPagar {
  contas: ContaAPagar[];
  carregando: boolean;
  erro: string | null;
  darBaixa: (
    id: string,
    dados: { dataPagamento: string; bancoPagamento: string; comprovantePagamentoUrl?: string }
  ) => Promise<void>;
  recarregar: () => void;
}

/** Busca as contas a pagar e expõe a ação de dar baixa (marcar como pago). */
export function useContasAPagar(filtros: FiltrosContasAPagar = {}): RetornoUseContasAPagar {
  const [contas, setContas] = useState<ContaAPagar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    buscarContasAPagar(filtros)
      .then(setContas)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.status, filtros.vencidasAte, filtros.fornecedorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const darBaixa = useCallback(
    async (
      id: string,
      dados: { dataPagamento: string; bancoPagamento: string; comprovantePagamentoUrl?: string }
    ) => {
      const contaAtualizada = await darBaixaContaAPagar(id, dados);
      setContas((atual) => atual.map((c) => (c.id === id ? contaAtualizada : c)));
    },
    []
  );

  return { contas, carregando, erro, darBaixa, recarregar: carregar };
}
