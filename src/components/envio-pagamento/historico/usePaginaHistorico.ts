import { useCallback, useEffect, useState } from "react";

const PARAMETRO = "pagamentos";
const VALOR = "historico";
const EVENTO = "pagamentos:navegacao";
const estaNoHistorico = () => typeof window !== "undefined" && new URL(window.location.href).searchParams.get(PARAMETRO) === VALOR;

/** Página exclusiva, com URL, voltar/avançar e recarga, sem exigir um router específico. */
export function usePaginaHistorico() {
  const [historico, setHistorico] = useState(estaNoHistorico);
  useEffect(() => {
    const sincronizar = () => setHistorico(estaNoHistorico());
    window.addEventListener("popstate", sincronizar);
    window.addEventListener(EVENTO, sincronizar);
    return () => {
      window.removeEventListener("popstate", sincronizar);
      window.removeEventListener(EVENTO, sincronizar);
    };
  }, []);

  const navegar = useCallback((abrir: boolean) => {
    const url = new URL(window.location.href);
    const atual = url.searchParams.get(PARAMETRO);
    if ((abrir && atual === VALOR) || (!abrir && atual !== VALOR)) return;
    if (abrir) url.searchParams.set(PARAMETRO, VALOR);
    else url.searchParams.delete(PARAMETRO);
    // Preserva o estado interno do router e os demais parâmetros da página.
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new Event(EVENTO));
    setHistorico(abrir);
  }, []);

  return { historico, abrirHistorico: useCallback(() => navegar(true), [navegar]), fecharHistorico: useCallback(() => navegar(false), [navegar]) };
}
