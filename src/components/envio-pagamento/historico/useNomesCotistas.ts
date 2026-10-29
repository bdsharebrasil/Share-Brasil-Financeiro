import { useEffect, useMemo, useRef, useState } from "react";
import { buscarCotistasAeronave } from "@/lib/colaborador-api";
import type { EnvioPagamento, RascunhoEnvioPagamento } from "@/lib/colaborador-api";
import { registro } from "./history-model";

/** Resolve nomes pela mesma API usada no formulário, uma consulta por aeronave. */
export function useNomesCotistas(envios: EnvioPagamento[], rascunhos: RascunhoEnvioPagamento[]) {
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const cache = useRef(new Map<string, Promise<Record<string, string>>>());
  const chave = useMemo(() => {
    const ids = new Set<string>();
    for (const envio of envios) {
      const dados = registro(envio);
      if (dados.tipo !== "share" && typeof dados.aeronave_id === "string" && dados.aeronave_id) ids.add(dados.aeronave_id);
    }
    for (const rascunho of rascunhos) {
      if (rascunho.tipo_envio === "share") continue;
      try {
        const form = registro(registro(JSON.parse(String(registro(rascunho).dados_json || "{}"))).form);
        if (typeof form.aeronave_id === "string" && form.aeronave_id) ids.add(form.aeronave_id);
      } catch { /* Um rascunho inválido não impede a leitura dos demais. */ }
    }
    return JSON.stringify([...ids].sort());
  }, [envios, rascunhos]);

  useEffect(() => {
    let ativo = true;
    const ids = JSON.parse(chave) as string[];
    const consultas = ids.map(id => {
      let consulta = cache.current.get(id);
      if (!consulta) {
        consulta = buscarCotistasAeronave(id).then(({ cotistas }) => Object.fromEntries(cotistas.map(cotista => [cotista.id, cotista.nome])));
        cache.current.set(id, consulta);
        void consulta.catch(() => { cache.current.delete(id); });
      }
      return consulta;
    });
    void Promise.allSettled(consultas).then(resultados => {
      if (!ativo) return;
      const mapa: Record<string, string> = {};
      resultados.forEach(resultado => { if (resultado.status === "fulfilled") Object.assign(mapa, resultado.value); });
      setNomes(mapa);
    });
    return () => { ativo = false; };
  }, [chave]);
  return nomes;
}
