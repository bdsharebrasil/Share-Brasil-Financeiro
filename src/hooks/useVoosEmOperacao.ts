import { useCallback, useEffect, useRef, useState } from "react";
import { buscarRotaerOperacao, buscarVoosEmOperacao, type VooEmOperacao } from "@/lib/colaborador-api";

const INTERVALO_SEM_VOO = 60_000;
const INTERVALO_COM_VOO = 10_000;
const LIMITE_BACKOFF = 60_000;

type Estado = { voos: VooEmOperacao[]; carregando: boolean; erro: string | null; atualizadoEm: string | null };


export function useVoosEmOperacao(): Estado {
  const [estado, setEstado] = useState<Estado>({ voos: [], carregando: true, erro: null, atualizadoEm: null });
  const destinos = useRef(new Map<string, { lat: number; lon: number }>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregamentoAtual = useRef(0);
  const backoff = useRef(0);

  const carregar = useCallback(async () => {
    const id = ++carregamentoAtual.current;
    if (document.visibilityState !== "visible") return;
    try {
      const resposta = await buscarVoosEmOperacao();
      if (id !== carregamentoAtual.current) return;
      // Oculta também quando o frontend for publicado antes do backend atualizado.
      // O histórico do voo continua acessível pelo agendamento.
      const voos = Array.isArray(resposta.voos) ? resposta.voos.filter((voo) => {
        const ultimaPerna = voo.pernas?.[voo.pernas.length - 1];
        return !ultimaPerna || (!ultimaPerna.horario_corte && String(ultimaPerna.status || '').toLowerCase() !== 'cortado');
      }) : [];
      await Promise.all(voos.map(async (voo) => {
        if (voo.destino_coord || !voo.destino || destinos.current.has(voo.destino)) return;
        try { const resultado = await buscarRotaerOperacao(voo.destino); const coordenadas = resultado.airport?.coordinates; if (coordenadas && Number.isFinite(coordenadas.lat) && Number.isFinite(coordenadas.lng)) destinos.current.set(voo.destino, { lat: coordenadas.lat!, lon: coordenadas.lng! }); } catch { /* aeródromo sem ficha ROTAER */ }
      }));
      voos.forEach((voo) => {
        if (!voo.destino_coord && voo.destino) voo.destino_coord = destinos.current.get(voo.destino) || null;
        // A trilha e os eventos pertencem ao agendamento e vêm completos do servidor.
      });
      if (id !== carregamentoAtual.current) return;
      backoff.current = 0;
      setEstado({ voos, carregando: false, erro: null, atualizadoEm: resposta.atualizado_em || new Date().toISOString() });
    } catch (erro) {
      if (id !== carregamentoAtual.current) return;
      backoff.current = Math.min(LIMITE_BACKOFF, backoff.current ? backoff.current * 2 : 1_000);
      setEstado((atual) => ({ ...atual, carregando: false, erro: erro instanceof Error ? erro.message : "Falha ao carregar rastreio" }));
    }
  }, []);

  useEffect(() => {
    let montado = true;
    const agendar = () => { if (!montado || document.visibilityState !== "visible") return; timer.current = setTimeout(async () => { await carregar(); agendar(); }, backoff.current || (estado.voos.length ? INTERVALO_COM_VOO : INTERVALO_SEM_VOO)); };
    const aoVisibilidade = () => { if (document.visibilityState === "visible") { backoff.current = 0; if (timer.current) clearTimeout(timer.current); void carregar().finally(agendar); } else if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    void carregar();
    agendar();
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => { montado = false; carregamentoAtual.current += 1; if (timer.current) clearTimeout(timer.current); document.removeEventListener("visibilitychange", aoVisibilidade); };
  }, [carregar, estado.voos.length]);

  return estado;
}

