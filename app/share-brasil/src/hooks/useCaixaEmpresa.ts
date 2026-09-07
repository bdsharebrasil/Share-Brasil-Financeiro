import { useCallback, useEffect, useMemo, useState } from 'react';
import { buscarCaixaEmpresa } from '../lib/apiFinanceiroShare';
import type { FiltrosCaixaEmpresa, Lancamento } from '../components/financeiro-share/tipos';

interface RetornoUseCaixaEmpresa {
  lancamentos: Lancamento[];
  carregando: boolean;
  erro: string | null;
  saldoCentavos: number;
  totalEntradasCentavos: number;
  totalSaidasCentavos: number;
  recarregar: () => void;
}

/**
 * Busca os lançamentos do caixa da empresa (caixa='SHARE') e calcula o
 * saldo do extrato de acordo com os filtros informados.
 */
export function useCaixaEmpresa(filtros: FiltrosCaixaEmpresa = {}): RetornoUseCaixaEmpresa {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    buscarCaixaEmpresa(filtros)
      .then(setLancamentos)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.competencia, filtros.fluxo, filtros.status, filtros.categoriaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const { totalEntradasCentavos, totalSaidasCentavos, saldoCentavos } = useMemo(() => {
    const entradas = lancamentos
      .filter((l) => l.fluxo === 'ENTRADA' && l.status !== 'CANCELADO')
      .reduce((soma, l) => soma + l.valorCentavos, 0);
    const saidas = lancamentos
      .filter((l) => l.fluxo === 'SAIDA' && l.status !== 'CANCELADO')
      .reduce((soma, l) => soma + l.valorCentavos, 0);
    return {
      totalEntradasCentavos: entradas,
      totalSaidasCentavos: saidas,
      saldoCentavos: entradas - saidas,
    };
  }, [lancamentos]);

  return {
    lancamentos,
    carregando,
    erro,
    saldoCentavos,
    totalEntradasCentavos,
    totalSaidasCentavos,
    recarregar: carregar,
  };
}
