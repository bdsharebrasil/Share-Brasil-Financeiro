import { useEffect, useMemo, useRef, useState } from "react";
import MapLibre, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";
import { Plane } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

import { segmentosTrilha, horarioRastreio, vooComSinalNoAr } from "@/lib/rastreio";
import { coordenadaRastreioValida, pontosParaEnquadrar, trechosPlanejados } from "@/lib/rastreio-mapa";
import type { VooEmOperacao, PontoRastreio } from "@/lib/colaborador-api";
import { buscarCartas, type ChartResponse } from "@/lib/flightplan-api";

interface MapaVooProps {
  voo: VooEmOperacao;
  pernaId?: string;
  historico?: boolean;
  compacto?: boolean;
}

type Coord = { lat: number; lon: number };

// Satélite real e rótulos sobrepostos, no estilo de monitoramento aeronáutico.
const ESTILO_SATELITE: StyleSpecification = {
  version: 8,
  sources: {
    imagem: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagens © Esri",
    },
    rotulos: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Rótulos © Esri",
    },
  },
  layers: [
    { id: "satelite", type: "raster", source: "imagem" },
    { id: "nomes", type: "raster", source: "rotulos" },
  ],
};

const COR_POR_ALTITUDE: ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "alt"],
  0, "#f5a623", 6500, "#f97316", 16500, "#fb7185",
  30000, "#f43f5e", 40000, "#a855f7",
];

const par = (c: Coord): [number, number] => [c.lon, c.lat];

export default function VooEmOperacaoMapa({
  voo, pernaId, historico = !vooComSinalNoAr(voo), compacto = false,
}: MapaVooProps) {
  const mapaRef = useRef<MapRef>(null);
  const [mapaCarregado, setMapaCarregado] = useState(false);
  const [cartasAeronáuticas, setCartasAeronáuticas] = useState<ChartResponse[]>([]);
  const assinaturaEnquadrada = useRef<string>("");

  const pernas = useMemo(() => {
    const lista = [...(voo.pernas || [])];
    if (voo.perna_atual && !lista.some((perna) => perna.id === voo.perna_atual?.id)) lista.push(voo.perna_atual);
    return lista;
  }, [voo.pernas, voo.perna_atual]);
  const pernasMapa = useMemo(() => pernaId ? pernas.filter((perna) => perna.id === pernaId) : pernas, [pernas, pernaId]);
  const planejados = useMemo(() => trechosPlanejados(voo).filter((trecho) => !pernaId || trecho.id === pernaId), [voo, pernaId]);
  const rotaPlanejada = useMemo((): FeatureCollection<LineString> => ({
    type: "FeatureCollection",
    features: planejados.map((trecho) => ({
      type: "Feature" as const,
      properties: { id: trecho.id, origem: trecho.origem, destino: trecho.destino },
      geometry: { type: "LineString" as const, coordinates: trecho.coordenadas },
    })),
  }), [planejados]);

  const pernaAtualVisivel = !pernaId || voo.perna_atual?.id === pernaId;
  const posicaoAoVivo: Coord | null = useMemo(() => pernaAtualVisivel && !historico && vooComSinalNoAr(voo) && voo.rastreio
    && coordenadaRastreioValida(voo.rastreio)
    ? { lat: voo.rastreio.lat, lon: voo.rastreio.lon } : null, [historico, pernaAtualVisivel, voo]);
  const trilhaVisivel = useMemo(() => (voo.trilha || []).filter((ponto) => !pernaId || ponto.trilha_id === pernaId), [voo.trilha, pernaId]);

  // Cada ponto do mapa é de uma fonte conhecida: aeródromo, trilha ou ADS-B atual.
  const marcadores = useMemo(() => {
    const mapa = new Map<string, Coord>();
    const adicionar = (icao: string | null | undefined, coord: Coord | null | undefined) => {
      if (icao && coordenadaRastreioValida(coord)) mapa.set(icao, coord);
    };
    for (const perna of pernasMapa) {
      adicionar(perna.origem, perna.origem_coord);
      adicionar(perna.destino, perna.destino_coord);
    }
    adicionar(voo.origem, voo.origem_coord);
    adicionar(voo.destino, voo.destino_coord);
    return [...mapa.entries()];
  }, [pernasMapa, voo.origem, voo.origem_coord, voo.destino, voo.destino_coord]);

  const trilha = useMemo((): FeatureCollection<LineString> => {
    const pontos: PontoRastreio[] = [...trilhaVisivel];
    if (posicaoAoVivo && voo.rastreio) {
      const anterior = pontos[pontos.length - 1];
      if (!anterior || anterior.lat !== posicaoAoVivo.lat || anterior.lon !== posicaoAoVivo.lon) {
        pontos.push({
          lat: posicaoAoVivo.lat, lon: posicaoAoVivo.lon,
          alt_ft: voo.rastreio.alt_ft, registrado_em: new Date().toISOString(),
          trilha_id: anterior?.trilha_id || voo.perna_atual?.id || voo.id,
        });
      }
    }
    return {
      type: "FeatureCollection",
      features: segmentosTrilha(pontos).map(({ anterior, ponto }) => ({
        type: "Feature" as const,
        properties: { alt: ponto.alt_ft ?? 0 },
        geometry: {
          type: "LineString" as const,
          coordinates: [[anterior.lon, anterior.lat], [ponto.lon, ponto.lat]],
        },
      })),
    };
  }, [trilhaVisivel, voo.rastreio, voo.id, voo.perna_atual?.id, posicaoAoVivo]);

  const pontos = useMemo(() => {
    if (!pernaId) return pontosParaEnquadrar(voo);
    const perna = pernas.find((item) => item.id === pernaId) || voo.perna_atual;
    const coords = [perna?.origem_coord, perna?.destino_coord].filter(coordenadaRastreioValida).map((coord) => par(coord));
    for (const ponto of trilhaVisivel) if (coordenadaRastreioValida(ponto)) coords.push(par(ponto));
    if (pernaAtualVisivel && voo.rastreio && coordenadaRastreioValida(voo.rastreio)) coords.push(par(voo.rastreio));
    return coords;
  }, [voo, pernaId, pernas, pernaAtualVisivel, trilhaVisivel]);
  // O centro é baseado na rota/posição. Nunca começa em São Paulo por padrão.
  const primeiroPonto = pontos[0] || [-51.9253, -14.2350];
  const initialViewState = {
    latitude: primeiroPonto[1],
    longitude: primeiroPonto[0],
    zoom: 5,
  };

  // O ROTAER pode resolver coordenadas após a primeira montagem. Enquadrar novamente
  // quando chegam dados novos, mas sem reposicionar a cada render igual.
  useEffect(() => {
    const icaos = [...new Set([voo.origem, ...pernas.map((perna) => perna.origem), voo.destino, ...pernas.map((perna) => perna.destino)].filter((icao): icao is string => Boolean(icao)))]
      .slice(0, 4);
    if (!icaos.length) return;
    let ativo = true;
    void Promise.all(icaos.map((icao) => buscarCartas(icao).catch(() => ({ charts: [] }))))
      .then((respostas) => {
        if (!ativo) return;
        const unicas = new Map<string, ChartResponse>();
        respostas.forEach((resposta) => (resposta.charts || []).forEach((carta) => {
          if (carta.url) unicas.set(carta.url, carta);
        }));
        setCartasAeronáuticas([...unicas.values()]);
      });
    return () => { ativo = false; };
  }, [voo.origem, voo.destino, pernas]);

  const assinatura = pontos.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join("|");
  useEffect(() => {
    if (!mapaCarregado || !pontos.length || assinaturaEnquadrada.current === assinatura) return;
    assinaturaEnquadrada.current = assinatura;
    if (pontos.length === 1) {
      mapaRef.current?.jumpTo({ center: pontos[0], zoom: 10 });
      return;
    }
    const longitudes = pontos.map(([longitude]) => longitude);
    const latitudes = pontos.map(([, latitude]) => latitude);
    mapaRef.current?.fitBounds(
      [[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]],
      { padding: compacto ? 26 : 42, maxZoom: 11, duration: 350 },
    );
  }, [mapaCarregado, assinatura, compacto, pontos]);

  const temTrilha = trilhaVisivel.length > 0;
  const temRota = rotaPlanejada.features.length > 0;
  const semGeometria = !pontos.length;

  return (
    <div
      className={`${compacto ? "h-[250px]" : "h-[340px]"} relative w-full overflow-hidden rounded-xl bg-slate-900`}
      aria-label={posicaoAoVivo ? "Posição real e percurso ADS-B da aeronave" : "Mapa satélite da rota planejada e sinais captados"}
    >
      <MapLibre
        ref={mapaRef}
        initialViewState={initialViewState}
        mapStyle={ESTILO_SATELITE}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
        onLoad={() => setMapaCarregado(true)}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {temRota && (
          <Source id="rota-planejada" type="geojson" data={rotaPlanejada}>
            <Layer id="rota-contorno" type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#020617", "line-width": 10, "line-opacity": 0.9 }} />
            <Layer id="rota-halo" type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.95 }} />
            <Layer id="rota-prevista" type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#06b6d4", "line-width": 4, "line-opacity": 1, "line-dasharray": [2, 1.5] }} />
          </Source>
        )}

        {trilha.features.length > 0 && (
          <Source id="trilha-adsb" type="geojson" data={trilha}>
            <Layer id="trilha-contorno" type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#111827", "line-width": 6, "line-opacity": 0.85 }} />
            <Layer id="trilha-real" type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": COR_POR_ALTITUDE, "line-width": 3.5 }} />
          </Source>
        )}

        {marcadores.map(([icao, coordenadas]) => (
          <Marker key={icao} longitude={coordenadas.lon} latitude={coordenadas.lat} anchor="bottom">
            <span className="rounded-md border border-white/20 bg-slate-950/90 px-2 py-1 font-mono text-[10px] font-bold text-white shadow-lg">
              {icao}
            </span>
          </Marker>
        ))}

        {!posicaoAoVivo && temTrilha && (() => {
          const ultimo = trilhaVisivel[trilhaVisivel.length - 1];
          return ultimo && coordenadaRastreioValida(ultimo) ? (
            <Marker longitude={ultimo.lon} latitude={ultimo.lat} anchor="center">
              <span className="rounded-md border border-orange-300/60 bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                Última posição · {horarioRastreio(ultimo.registrado_em)}
              </span>
            </Marker>
          ) : null;
        })()}

        {posicaoAoVivo && (
          <Marker longitude={posicaoAoVivo.lon} latitude={posicaoAoVivo.lat} anchor="center">
            <div className="relative flex items-center justify-center" title="Posição ADS-B atual">
              <span className="absolute -top-9 whitespace-nowrap rounded-md bg-slate-950/90 px-2 py-1 font-mono text-[10px] font-bold text-white shadow-lg">
                {voo.matricula_registro || "Aeronave"}
              </span>
              <div style={{ transform: `rotate(${(voo.rastreio?.rumo_graus ?? 0) - 45}deg)` }}>
                <Plane size={29} fill="#f97316" className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.8)]" />
              </div>
            </div>
          </Marker>
        )}
      </MapLibre>

      {cartasAeronáuticas.length > 0 && (
        <div className="absolute left-3 top-3 z-[2] flex max-w-[70%] gap-1 rounded-lg border border-white/20 bg-slate-950/85 p-1 shadow-lg">
          {[...cartasAeronáuticas].slice(0, 4).map((carta, indice) => (
            <a
              key={carta.url || indice}
              href={carta.url}
              target="_blank"
              rel="noopener noreferrer"
              title={carta.title || carta.tipo || "Carta aeronáutica"}
              className="max-w-32 truncate rounded-md px-2 py-1 text-[10px] font-bold text-cyan-100 hover:bg-white/10"
            >
              {carta.title || carta.tipo || "Carta"}
            </a>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-white/20 bg-slate-950/85 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow">
          {posicaoAoVivo ? "● Posição ADS-B ao vivo" : temTrilha ? "Histórico ADS-B"
            : temRota ? "Rota prevista" : "Aguardando coordenadas dos aeródromos"}
        </span>
        {temRota && <span className="rounded-md bg-slate-950/80 px-2 py-1.5 text-[10px] font-semibold text-amber-300">
          Linha tracejada: rota prevista
        </span>}
      </div>
      {semGeometria && <span className="sr-only">Não existem coordenadas disponíveis para enquadrar esta operação.</span>}
    </div>
  );
}
