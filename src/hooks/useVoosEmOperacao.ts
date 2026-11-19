import { useCallback, useEffect, useRef, useState } from "react";
import { buscarRotaerOperacao, buscarVoosEmOperacao, type VooEmOperacao } from "@/lib/colaborador-api";
import { coordenadaRastreioValida, type CoordenadaRastreio } from "@/lib/rastreio-mapa";
import { coordenadaReferenciaAerodromo } from "@/lib/aerodromos-referencia";

const INTERVALO_SEM_VOO = 60_000;
const INTERVALO_COM_VOO = 10_000;
const LIMITE_BACKOFF = 60_000;
const CACHE_AERODROMO_MS = 5 * 60_000;

type Estado = { voos: VooEmOperacao[]; carregando: boolean; erro: string | null; atualizadoEm: string | null };
type CacheAerodromo = { coordenada: CoordenadaRastreio | null; expiraEm: number };

export function useVoosEmOperacao(): Estado {
  const [estado, setEstado] = useState<Estado>({ voos: [], carregando: true, erro: null, atualizadoEm: null });
  const aerodromos = useRef(new Map<string, CacheAerodromo>());
  const pendentes = useRef(new Map<string, Promise<CoordenadaRastreio | null>>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregamentoAtual = useRef(0);
  const backoff = useRef(0);

  const resolverAerodromo = useCallback(async (icao: string): Promise<CoordenadaRastreio | null> => {
    const codigo = icao.trim().toUpperCase();
    if (!codigo) return null;
    const salvo = aerodromos.current.get(codigo);
    if (salvo && salvo.expiraEm > Date.now()) return salvo.coordenada;
    const pendente = pendentes.current.get(codigo);
    if (pendente) return pendente;

    const consulta = (async () => {
      let coordenada: CoordenadaRastreio | null = null;
      try {
        const resposta = await buscarRotaerOperacao(codigo);
        const valor = resposta.airport?.coordinates;
        if (valor) {
          const candidata = { lat: Number(valor.lat), lon: Number(valor.lng) };
          if (coordenadaRastreioValida(candidata)) coordenada = candidata;
        }
      } catch {
        // Aeródromos privados podem não ter ficha ROTAER; não interromper o painel.
      } finally {
        // Último recurso documentado para SIAQ/SWJN, sem simular posição real.
        if (!coordenada) coordenada = coordenadaReferenciaAerodromo(codigo);
        aerodromos.current.set(codigo, {
          coordenada, expiraEm: Date.now() + CACHE_AERODROMO_MS,
        });
        pendentes.current.delete(codigo);
      }
      return coordenada;
    })();
    pendentes.current.set(codigo, consulta);
    return consulta;
  }, []);

  const carregar = useCallback(async () => {
    const id = ++carregamentoAtual.current;
    if (document.visibilityState !== "visible") return;
    try {
      const resposta = await buscarVoosEmOperacao();
      if (id !== carregamentoAtual.current) return;
      // Histórico permanece acessível; o corte final retira o voo da lista ao vivo.
      const voos = Array.isArray(resposta.voos) ? resposta.voos.filter((voo) => {
        const ultimaPerna = voo.pernas?.[voo.pernas.length - 1];
        return !ultimaPerna || (!ultimaPerna.horario_corte && String(ultimaPerna.status || "").toLowerCase() !== "cortado");
      }) : [];

      // Aproveita as coordenadas que vieram do D1, independentemente da perna.
      const coordenadas = new Map<string, CoordenadaRastreio>();
      const registrar = (codigo: string | null | undefined, coord: CoordenadaRastreio | null | undefined) => {
        if (codigo && coordenadaRastreioValida(coord)) coordenadas.set(codigo.toUpperCase(), coord);
      };
      for (const voo of voos) {
        registrar(voo.origem, voo.origem_coord);
        registrar(voo.destino, voo.destino_coord);
        for (const perna of voo.pernas || []) {
          registrar(perna.origem, perna.origem_coord);
          registrar(perna.destino, perna.destino_coord);
        }
      }

      // Antes o fallback buscava apenas DESTINO; sem a origem era impossível
      // desenhar/enquadrar a rota SIAQ → SWJN quando o ADS-B estava ausente.
      const codigos = [...new Set(voos.flatMap((voo) => [
        voo.origem, voo.destino,
        ...(voo.pernas || []).flatMap((perna) => [perna.origem, perna.destino]),
      ]).filter((codigo): codigo is string => Boolean(codigo)).map((codigo) => codigo.toUpperCase()))];
      await Promise.all(codigos.filter((icao) => !coordenadas.has(icao)).map(async (icao) => {
        const coord = await resolverAerodromo(icao);
        if (coord) coordenadas.set(icao, coord);
      }));
      if (id !== carregamentoAtual.current) return;

      const completos = voos.map((voo) => {
        const coord = (codigo: string | null | undefined, original: CoordenadaRastreio | null | undefined) =>
          coordenadaRastreioValida(original) ? original : coordenadas.get((codigo || "").toUpperCase()) || null;
        const pernas = (voo.pernas || []).map((perna) => ({
          ...perna,
          origem_coord: coord(perna.origem, perna.origem_coord),
          destino_coord: coord(perna.destino, perna.destino_coord),
        }));
        return {
          ...voo,
          origem_coord: coord(voo.origem, voo.origem_coord),
          destino_coord: coord(voo.destino, voo.destino_coord),
          pernas,
          perna_atual: pernas.find((perna) => perna.id === voo.perna_atual?.id) || voo.perna_atual,
        };
      });

      backoff.current = 0;
      setEstado({
        voos: completos, carregando: false, erro: null,
        atualizadoEm: resposta.atualizado_em || new Date().toISOString(),
      });
    } catch (erro) {
      if (id !== carregamentoAtual.current) return;
      backoff.current = Math.min(LIMITE_BACKOFF, backoff.current ? backoff.current * 2 : 1000);
      setEstado((atual) => ({
        ...atual, carregando: false,
        erro: erro instanceof Error ? erro.message : "Falha ao carregar rastreio",
      }));
    }
  }, [resolverAerodromo]);

  useEffect(() => {
    let montado = true;
    const agendar = () => {
      if (!montado || document.visibilityState !== "visible") return;
      timer.current = setTimeout(async () => {
        await carregar();
        agendar();
      }, backoff.current || (estado.voos.length ? INTERVALO_COM_VOO : INTERVALO_SEM_VOO));
    };
    const aoVisibilidade = () => {
      if (document.visibilityState === "visible") {
        backoff.current = 0;
        if (timer.current) clearTimeout(timer.current);
        void carregar().finally(agendar);
      } else if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    void carregar();
    agendar();
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => {
      montado = false;
      carregamentoAtual.current += 1;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", aoVisibilidade);
    };
  }, [carregar, estado.voos.length]);

  return estado;
}
