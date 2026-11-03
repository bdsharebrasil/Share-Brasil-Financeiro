import { useCallback, useEffect, useRef, useState } from "react";
import { buscarRotaerOperacao, buscarVoosEmOperacao, type RastreioAeronave, type VooEmOperacao } from "@/lib/colaborador-api";

const INTERVALO_SEM_VOO = 60_000;
const INTERVALO_COM_VOO = 10_000;
const LIMITE_BACKOFF = 60_000;

type Estado = { voos: VooEmOperacao[]; carregando: boolean; erro: string | null; atualizadoEm: string | null };

function mockVoo(tick: number): VooEmOperacao {
  const origem = { lat: -23.4356, lon: -46.4731 };
  const destino = { lat: -22.8099, lon: -43.2506 };
  const progresso = (tick % 100) / 100;
  const lat = origem.lat + (destino.lat - origem.lat) * progresso;
  const lon = origem.lon + (destino.lon - origem.lon) * progresso;
  const rastreio: RastreioAeronave = { hex: "A1B2C3", matricula: "PT-MOCK", callsign: "SBR001", lat, lon, alt_ft: 6500, no_solo: false, gs_kt: 120, rumo_graus: 45, vs_fpm: 250, visto_ha_s: tick % 3 === 0 ? 45 : 4, squawk: "1200", fonte: "mock" };
  return { id: "mock-voo", numero_voo: "SBR-MOCK", status: "em_voo", aeronave_id: "mock-aeronave", matricula_registro: "PT-MOCK", modelo: "Cessna 172", icao_hex: "A1B2C3", origem: "SBGR", destino: "SBGL", origem_coord: origem, destino_coord: destino, horario_previsto_agendamento: new Date().toISOString(), cotista_nome: "Simulação", piloto_nome: "Piloto de teste", copiloto_nome: null, rastreio, rastreio_status: rastreio.visto_ha_s <= 30 ? "ao_vivo" : "atrasado", perna_atual: null, pernas: [] };
}

function deduplicarVoos(voos: VooEmOperacao[]): VooEmOperacao[] {
  const porAeronave = new Map<string, VooEmOperacao>();
  voos.forEach((voo) => { const chave = voo.aeronave_id || voo.id; if (!porAeronave.has(chave)) porAeronave.set(chave, voo); });
  return [...porAeronave.values()];
}

export function useVoosEmOperacao(): Estado {
  const [estado, setEstado] = useState<Estado>({ voos: [], carregando: true, erro: null, atualizadoEm: null });
  const trilhas = useRef(new Map<string, Array<{ lat: number; lon: number }>>());
  const ultimasPosicoes = useRef(new Map<string, RastreioAeronave>());
  const destinos = useRef(new Map<string, { lat: number; lon: number }>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregamentoAtual = useRef(0);
  const backoff = useRef(0);
  const tickMock = useRef(0);

  const carregar = useCallback(async () => {
    const id = ++carregamentoAtual.current;
    if (document.visibilityState !== "visible") return;
    try {
      const resposta = import.meta.env.VITE_RASTREIO_MOCK === "1" ? { atualizado_em: new Date().toISOString(), voos: [mockVoo(tickMock.current++)] } : await buscarVoosEmOperacao();
      if (id !== carregamentoAtual.current) return;
      const voos = deduplicarVoos(Array.isArray(resposta.voos) ? resposta.voos : []);
      await Promise.all(voos.map(async (voo) => {
        if (voo.destino_coord || !voo.destino || destinos.current.has(voo.destino)) return;
        try { const resultado = await buscarRotaerOperacao(voo.destino); const coordenadas = resultado.airport?.coordinates; if (coordenadas && Number.isFinite(coordenadas.lat) && Number.isFinite(coordenadas.lng)) destinos.current.set(voo.destino, { lat: coordenadas.lat!, lon: coordenadas.lng! }); } catch { /* aeródromo sem ficha ROTAER */ }
      }));
      voos.forEach((voo) => {
        const posicao = voo.rastreio;
        if (!voo.destino_coord && voo.destino) voo.destino_coord = destinos.current.get(voo.destino) || null;
        if (!posicao) {
          voo.rastreio = ultimasPosicoes.current.get(voo.aeronave_id || voo.id) || null;
          voo.trilha = trilhas.current.get(voo.aeronave_id || voo.id) || [];
          return;
        }
        ultimasPosicoes.current.set(voo.aeronave_id || voo.id, posicao);
        const trilha = trilhas.current.get(voo.aeronave_id || voo.id) || [];
        const ultima = trilha[trilha.length - 1];
        if (!ultima || ultima.lat !== posicao.lat || ultima.lon !== posicao.lon) trilha.push({ lat: posicao.lat, lon: posicao.lon });
        trilhas.current.set(voo.aeronave_id || voo.id, trilha.slice(-120));
        voo.trilha = trilhas.current.get(voo.aeronave_id || voo.id);
      });
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
    const agendar = () => { if (!montado) return; timer.current = setTimeout(async () => { await carregar(); agendar(); }, backoff.current || (estado.voos.length ? INTERVALO_COM_VOO : INTERVALO_SEM_VOO)); };
    const aoVisibilidade = () => { if (document.visibilityState === "visible") { backoff.current = 0; void carregar(); } else if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    void carregar();
    agendar();
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => { montado = false; carregamentoAtual.current += 1; if (timer.current) clearTimeout(timer.current); document.removeEventListener("visibilitychange", aoVisibilidade); };
  }, [carregar, estado.voos.length]);

  return estado;
}
