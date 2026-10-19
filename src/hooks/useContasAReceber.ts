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
    const externo = (event: StorageEvent) => { if (event.key === 'financeiro-atualizado') carregar(); };
    window.addEventListener('financeiro-atualizado', carregar);
    window.addEventListener('storage', externo);
    return () => { window.removeEventListener('financeiro-atualizado', carregar); window.removeEventListener('storage', externo); };
  }, [carregar]);

  const darBaixa = useCallback(
    async (
      id: string,
      dados: DadosBaixaReceber
    ) => {
      await darBaixaContaAReceber(id, dados);
      // Payment succeeded: a refresh failure must not be reported as a payment failure.
      try { setContas(await buscarContasAReceber(filtros)); }
      catch (e) { setErro(`Recebimento salvo; falha ao atualizar: ${e instanceof Error ? e.message : 'Recarregue a lista.'}`); }
    },
    [filtros]
  );

  return { contas, carregando, erro, darBaixa, recarregar: carregar };
}
