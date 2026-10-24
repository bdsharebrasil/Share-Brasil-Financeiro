import { useMemo } from "react";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import { Plane } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

import type { VooEmOperacao } from "@/lib/colaborador-api";

interface MapaVooProps {
  voo: VooEmOperacao;
}

const ESTILO_OPENSTREETMAP: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "openstreetmap-tiles", type: "raster", source: "openstreetmap" }],
};

function linhaGeoJSON(coordenadas: [number, number][]): Feature<LineString> | null {
  if (coordenadas.length < 2) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coordenadas },
  };
}

export default function VooEmOperacaoMapa({ voo }: MapaVooProps) {
  const initialViewState = useMemo(() => {
    const atual = voo.rastreio;
    const lat = atual?.lat ?? voo.origem_coord?.lat ?? -23.55;
    const lon = atual?.lon ?? voo.origem_coord?.lon ?? -46.63;
    return { latitude: lat, longitude: lon, zoom: 6 };
  }, [voo.rastreio, voo.origem_coord]);

  const rotaGeoJSON = useMemo(() => {
    if (!voo.origem_coord || !voo.destino_coord) return null;
    return linhaGeoJSON([
      [voo.origem_coord.lon, voo.origem_coord.lat],
      [voo.destino_coord.lon, voo.destino_coord.lat],
    ]);
  }, [voo.origem_coord, voo.destino_coord]);

  const trilhaGeoJSON = useMemo(() => {
    const coordenadas: [number, number][] = (voo.trilha || []).map(({ lon, lat }) => [lon, lat]);
    if (voo.rastreio) {
      const atual: [number, number] = [voo.rastreio.lon, voo.rastreio.lat];
      const ultima = coordenadas[coordenadas.length - 1];
      if (!ultima || ultima[0] !== atual[0] || ultima[1] !== atual[1]) coordenadas.push(atual);
    }
    return linhaGeoJSON(coordenadas);
  }, [voo.trilha, voo.rastreio]);

  const posicaoAviao = useMemo(() => {
    const rastreio = voo.rastreio;
    if (rastreio && rastreio.lat != null && rastreio.lon != null) {
      return { lat: rastreio.lat, lon: rastreio.lon };
    }
    return voo.origem_coord;
  }, [voo.rastreio, voo.origem_coord]);
  const rumoAviao = voo.rastreio?.rumo_graus ?? 0;

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-xl bg-[#111]" aria-label="Mapa da rota planejada e posição da aeronave">
      <Map
        initialViewState={initialViewState}
        mapStyle={ESTILO_OPENSTREETMAP}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
        {rotaGeoJSON && (
          <Source id="rota-planejada" type="geojson" data={rotaGeoJSON}>
            <Layer
              id="linha-da-rota"
              type="line"
              paint={{ "line-color": "#1a8ec0", "line-width": 2, "line-dasharray": [2, 2] }}
            />
          </Source>
        )}
        {trilhaGeoJSON && (
          <Source id="trilha-adsb" type="geojson" data={trilhaGeoJSON}>
            <Layer id="linha-trilha-adsb" type="line" paint={{ "line-color": "#eab308", "line-width": 3 }} />
          </Source>
        )}
        {voo.origem_coord && (
          <Marker longitude={voo.origem_coord.lon} latitude={voo.origem_coord.lat}>
            <span className="rounded border border-border bg-background/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground shadow-sm">
              {voo.origem}
            </span>
          </Marker>
        )}
        {voo.destino_coord && (
          <Marker longitude={voo.destino_coord.lon} latitude={voo.destino_coord.lat}>
            <span className="rounded border border-border bg-background/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground shadow-sm">
              {voo.destino}
            </span>
          </Marker>
        )}
        {posicaoAviao && (
          <Marker longitude={posicaoAviao.lon} latitude={posicaoAviao.lat} anchor="center">
            <div className="transition-transform duration-1000 ease-out" style={{ transform: `rotate(${rumoAviao}deg)` }}>
              <Plane size={22} className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}
