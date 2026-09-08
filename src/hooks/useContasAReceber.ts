import { useCallback, useEffect, useState } from 'react';
import { buscarContasAReceber, darBaixaContaAReceber } from '../lib/financeiro-share-api';
import type { ContaAReceber, FiltrosContasAReceber } from '../components/financeiro-share/tipos';
import type { DadosBaixaReceber } from '../components/financeiro-share/ModalContaAReceber';

interface RetornoUseContasAReceber {
  contas: ContaAReceber[];
  carregando: boolean;
  erro: string | null;
  darBaixa: (
    id: string,
    dados: DadosBaixaReceber
  ) => Promise<void>;
  recarregar: () => void;
}

/** Busca as contas a receber e expõe a ação de dar baixa (marcar como recebido). */
export function useContasAReceber(filtros: FiltrosContasAReceber = {}): RetornoUseContasAReceber {
  const [contas, setContas] = useState<ContaAReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    buscarContasAReceber(filtros)
      .then(setContas)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.status, filtros.vencidasAte, filtros.cotistaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const darBaixa = useCallback(
    async (
      id: string,
      dados: DadosBaixaReceber
    ) => {
      const contaAtualizada = await darBaixaContaAReceber(id, dados);
      setContas((atual) => atual.map((c) => (c.id === id ? contaAtualizada : c)));
    },
    []
  );

  return { contas, carregando, erro, darBaixa, recarregar: carregar };
}
