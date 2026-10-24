import { useMemo, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { Plane } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

import type { VooEmOperacao } from "@/lib/colaborador-api";

interface MapaVooProps {
  voo: VooEmOperacao;
}

type Coord = { lat: number; lon: number };
type PontoTrilha = { lat: number; lon: number; alt_ft?: number | null };

// Esri World Topo: mapa com relevo, estradas e cidades (parecido com o FlightRadar24), sem chave de API.
const ESTILO_TERRENO: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Tiles © Esri",
    },
  },
  layers: [{ id: "esri-topo", type: "raster", source: "esri" }],
};

// Rastro colorido pela altitude (alt_ft, em pés).
const COR_POR_ALTITUDE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "alt"],
  0, "#f5a623",
  6500, "#d4e157",
  16500, "#43d17a",
  30000, "#1ea7d6",
  40000, "#7c4dff",
];

function linhaGeoJSON(coordenadas: [number, number][]): Feature<LineString> | null {
  if (coordenadas.length < 2) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coordenadas },
  };
}

export default function VooEmOperacaoMapa({ voo }: MapaVooProps) {
  const mapRef = useRef<MapRef>(null);

  const pernas = voo.pernas ?? [];
  const pernaAtual = voo.perna_atual ?? null;
  const pernaJaPousou = pernaAtual ? ["pousado", "cortado"].includes(pernaAtual.status) : false;

  // Avião: posição ADS-B; sem sinal, fica no pouso da perna (se já pousou) ou na origem dela
  const posicaoAviao = useMemo<Coord | null>(() => {
    const rastreio = voo.rastreio;
    if (rastreio && rastreio.lat != null && rastreio.lon != null) {
      return { lat: rastreio.lat, lon: rastreio.lon };
    }
    return (pernaJaPousou ? voo.destino_coord : voo.origem_coord) ?? null;
  }, [voo.rastreio, voo.origem_coord, voo.destino_coord, pernaJaPousou]);

  const rumoAviao = voo.rastreio?.rumo_graus ?? 0;

  // Aeródromos de todas as pernas (sem repetir), para os marcadores
  const aerodromos = useMemo(() => {
    const mapa: Record<string, Coord> = {};
    const adicionar = (icao: string | null | undefined, coord: Coord | null | undefined) => {
      if (icao && coord) mapa[icao] = coord;
    };
    pernas.forEach((perna) => {
      adicionar(perna.origem, perna.origem_coord);
      adicionar(perna.destino, perna.destino_coord);
    });
    adicionar(voo.origem, voo.origem_coord);
    adicionar(voo.destino, voo.destino_coord);
    return Object.entries(mapa);
  }, [pernas, voo.origem, voo.destino, voo.origem_coord, voo.destino_coord]);

  const initialViewState = useMemo(
    () => ({
      latitude: posicaoAviao?.lat ?? -23.55,
      longitude: posicaoAviao?.lon ?? -46.63,
      zoom: 7,
    }),
    // só na montagem: depois disso o usuário controla o mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Enquadra todas as pernas e o avião quando o mapa carrega
  const enquadrarRota = () => {
    const pontos: [number, number][] = aerodromos.map(([, c]) => [c.lon, c.lat]);
    if (posicaoAviao) pontos.push([posicaoAviao.lon, posicaoAviao.lat]);
    if (pontos.length < 2) return;
    const lons = pontos.map(([lon]) => lon);
    const lats = pontos.map(([, lat]) => lat);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 70, maxZoom: 9, duration: 0 },
    );
  };

  // Pernas anteriores: linha cheia e discreta
  const pernasAnterioresGeoJSON = useMemo((): FeatureCollection<LineString> | null => {
    const features = pernas
      .filter((perna) => perna.id !== pernaAtual?.id && perna.origem_coord && perna.destino_coord)
      .map((perna) => linhaGeoJSON([
        [perna.origem_coord!.lon, perna.origem_coord!.lat],
        [perna.destino_coord!.lon, perna.destino_coord!.lat],
      ]))
      .filter((feature): feature is Feature<LineString> => feature !== null);
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [pernas, pernaAtual?.id]);

  // Perna atual: tracejada
  const rotaAtualGeoJSON = useMemo(() => {
    if (!voo.origem_coord || !voo.destino_coord) return null;
    return linhaGeoJSON([
      [voo.origem_coord.lon, voo.origem_coord.lat],
      [voo.destino_coord.lon, voo.destino_coord.lat],
    ]);
  }, [voo.origem_coord, voo.destino_coord]);

  // Trilha real da perna atual: um segmento por par de pontos, com a altitude para colorir
  const trilhaGeoJSON = useMemo((): FeatureCollection<LineString, { alt: number }> | null => {
    const pontos: PontoTrilha[] = [...((voo.trilha ?? []) as PontoTrilha[])];
    const atual = voo.rastreio;
    if (atual && atual.lat != null && atual.lon != null) {
      const ultimo = pontos[pontos.length - 1];
      if (!ultimo || ultimo.lat !== atual.lat || ultimo.lon !== atual.lon) {
        pontos.push({ lat: atual.lat, lon: atual.lon, alt_ft: atual.no_solo ? 0 : atual.alt_ft ?? 0 });
      }
    }
    if (pontos.length < 2) return null;
    return {
      type: "FeatureCollection",
      features: pontos.slice(1).map((ponto, i) => ({
        type: "Feature",
        properties: { alt: ponto.alt_ft ?? 0 },
        geometry: {
          type: "LineString",
          coordinates: [
            [pontos[i].lon, pontos[i].lat],
            [ponto.lon, ponto.lat],
          ],
        },
      })),
    };
  }, [voo.trilha, voo.rastreio]);

  return (
    <div
      className="h-[360px] w-full overflow-hidden rounded-xl bg-slate-200"
      aria-label="Mapa das pernas do voo e posição da aeronave"
    >
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={ESTILO_TERRENO}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
        onLoad={enquadrarRota}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {pernasAnterioresGeoJSON && (
          <Source id="pernas-anteriores" type="geojson" data={pernasAnterioresGeoJSON}>
            <Layer
              id="linha-pernas-anteriores"
              type="line"
              paint={{ "line-color": "#475569", "line-width": 2.5, "line-opacity": 0.75 }}
            />
          </Source>
        )}

        {rotaAtualGeoJSON && (
          <Source id="rota-planejada" type="geojson" data={rotaAtualGeoJSON}>
            <Layer
              id="rota-planejada-contorno"
              type="line"
              paint={{ "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.6 }}
            />
            <Layer
              id="linha-da-rota"
              type="line"
              paint={{ "line-color": "#1a8ec0", "line-width": 2.5, "line-opacity": 0.9, "line-dasharray": [2, 2] }}
            />
          </Source>
        )}

        {trilhaGeoJSON && (
          <Source id="trilha-adsb" type="geojson" data={trilhaGeoJSON}>
            <Layer
              id="trilha-adsb-contorno"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#000000", "line-width": 6, "line-opacity": 0.25 }}
            />
            <Layer
              id="linha-trilha-adsb"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": COR_POR_ALTITUDE, "line-width": 3.5 }}
            />
          </Source>
        )}

        {aerodromos.map(([icao, coord]) => (
          <Marker key={icao} longitude={coord.lon} latitude={coord.lat} anchor="bottom">
            <span className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow">
              {icao}
            </span>
          </Marker>
        ))}

        {posicaoAviao && (
          <Marker longitude={posicaoAviao.lon} latitude={posicaoAviao.lat} anchor="center">
            <div className="relative flex flex-col items-center">
              {voo.matricula_registro && (
                <span className="absolute -top-7 whitespace-nowrap rounded bg-white px-2 py-0.5 text-[11px] font-bold text-slate-900 shadow-md">
                  {voo.matricula_registro.replace("-", "")}
                </span>
              )}
              {/* O ícone Plane do Lucide aponta para 45° (nordeste), por isso o -45 */}
              <div
                className="transition-transform duration-1000 ease-out"
                style={{ transform: `rotate(${rumoAviao - 45}deg)` }}
              >
                <Plane
                  size={26}
                  fill="#e11d48"
                  className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                />
              </div>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}