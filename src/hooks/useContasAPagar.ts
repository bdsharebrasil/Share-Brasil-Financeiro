import { useCallback, useEffect, useState } from 'react';
import { buscarContasAPagar, darBaixaContaAPagar } from '../lib/financeiro-share-api';
import type { ContaAPagar, FiltrosContasAPagar } from '../components/financeiro-share/tipos';

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
    async (id: string, dados: DadosBaixaAPagar) => {
      await darBaixaContaAPagar(id, dados);
      setContas(await buscarContasAPagar(filtros));
    },
    [filtros]
  );

  return { contas, carregando, erro, darBaixa, recarregar: carregar };
}
