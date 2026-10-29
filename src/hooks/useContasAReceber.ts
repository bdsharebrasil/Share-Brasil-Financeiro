import { useCallback, useEffect, useState } from 'react';
import { buscarContasAReceber, buscarContasBancariasPorLancamento, darBaixaContaAReceber } from '../lib/financeiro-share-api';
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
  const { status, vencidasAte, cotistaId } = filtros;

  const carregarContas = useCallback(async () => {
    const [contas, contasPorLancamento] = await Promise.all([
      buscarContasAReceber({ status, vencidasAte, cotistaId }),
      buscarContasBancariasPorLancamento().catch(() => new Map<string, { id: string; nome: string | null }>()),
    ]);
    return contas.map((conta) => {
      const contaLancamento = conta.lancamentoId
        ? contasPorLancamento.get(conta.lancamentoId)
        : undefined;
      return contaLancamento
        ? { ...conta, contaBancariaId: contaLancamento.id, bancoRecebimento: contaLancamento.nome ?? conta.bancoRecebimento }
        : conta;
    });
  }, [status, vencidasAte, cotistaId]);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    carregarContas()
      .then(setContas)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [carregarContas]);

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
      try { setContas(await carregarContas()); }
      catch (e) { setErro(`Recebimento salvo; falha ao atualizar: ${e instanceof Error ? e.message : 'Recarregue a lista.'}`); }
    },
    [carregarContas]
  );

  return { contas, carregando, erro, darBaixa, recarregar: carregar };
}
