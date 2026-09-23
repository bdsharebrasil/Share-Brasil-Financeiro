import { useCallback, useEffect, useState } from "react";
import { buscarFichasPesoBalanceamento, type FichaPesoBalanceamentoLista } from "@/lib/colaborador-api";

export function useFichaPesoBalanceamento() {
  const [fichas, setFichas] = useState<FichaPesoBalanceamentoLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { setFichas((await buscarFichasPesoBalanceamento()).fichas); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar as fichas."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  return { fichas, carregando, erro, recarregar: carregar };
}
