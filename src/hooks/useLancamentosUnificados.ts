import { useCallback, useEffect, useState } from "react";
import { buscarLancamentosUnificados } from "@/lib/financeiro-share-api";
import { normalizarLancamentoUnificado, type LancamentoUnificado } from "@/lib/lancamentos-unificados";

export type { FluxoUnificado, SituacaoUnificada, LancamentoUnificado } from "@/lib/lancamentos-unificados";

export function useLancamentosUnificados() {
  const [lancamentos, setLancamentos] = useState<LancamentoUnificado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await buscarLancamentosUnificados();
      setLancamentos(resposta.map(normalizarLancamentoUnificado));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os lançamentos.");
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { void recarregar(); }, [recarregar]);
  return { lancamentos, carregando, erro, recarregar };
}
