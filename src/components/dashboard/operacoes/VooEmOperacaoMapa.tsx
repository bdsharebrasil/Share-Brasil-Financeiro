import { useMemo } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import { Plane } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css"; // Essencial para o mapa não quebrar o layout

// Importação das tipagens do seu projeto
import type { VooEmOperacao } from "@/lib/colaborador-api";

interface MapaVooProps {
  voo: VooEmOperacao;
}

export default function VooEmOperacaoMapa({ voo }: { voo: any }) {
  // 1. Pega a chave do Stadia Maps injetada pelo Vite
  const apiKey = import.meta.env.VITE_API_OPENSTREETMAP || "";

  // 2. Centraliza o mapa dinamicamente com base na rota
  const initialViewState = useMemo(() => {
    const lat = voo.rastreio?.lat || voo.origem_coord?.lat || -23.55;
    const lon = voo.rastreio?.lon || voo.origem_coord?.lon || -46.63;
    return { latitude: lat, longitude: lon, zoom: 6 };
  }, [voo]);

  // 3. Monta a linha da rota (GeoJSON) conectando origem ao destino
  const rotaGeoJSON = useMemo(() => {
    if (!voo.origem_coord || !voo.destino_coord) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [voo.origem_coord.lon, voo.origem_coord.lat],
          [voo.destino_coord.lon, voo.destino_coord.lat],
        ],
      },
    };
  }, [voo.origem_coord, voo.destino_coord]);

  // 4. Coordenada atual do avião (ADS-B ao vivo ou última posição conhecida)
  const posicaoAviao = useMemo(() => {
    if (voo.rastreio?.lat && voo.rastreio?.lon) {
      return { lat: voo.rastreio.lat, lon: voo.rastreio.lon };
    }
    return voo.origem_coord || null;
  }, [voo.rastreio, voo.origem_coord]);

  // Ângulo de rotação do avião (rumo/heading do ADS-B ou padrão apontando para a direita)
  const rumoAviao = voo.rastreio?.rumo || voo.rastreio?.heading || 0;

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-xl bg-[#111]">
      <Map
        initialViewState={initialViewState}
        // Aplica o tema escuro profissional do Stadia Maps passando a sua chave
        mapStyle={`https://stadiamaps.com{apiKey}`}
        style={{ width: "100%", height: "100%" }}
      >
        {/* DESENHA A ROTA PLANEJADA TRACEJADA */}
        {rotaGeoJSON && (
          <Source id="rota-planejada" type="geojson" data={rotaGeoJSON as any}>
            <Layer
              id="linha-da-rota"
              type="line"
              paint={{
                "line-color": "#1a8ec0", // Cor sky-400 combinando com seu app
                "line-width": 2,
                "line-dasharray": [2, 2], // Deixa tracejado estilizado
              }}
            />
          </Source>
        )}

        {/* MARCADOR DA ORIGEM */}
        {voo.origem_coord && (
          <Marker longitude={voo.origem_coord.lon} latitude={voo.origem_coord.lat}>
            <div className="flex flex-col items-center">
              <span className="rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-mono font-bold text-foreground border border-border shadow-sm">
                {voo.origem}
              </span>
            </div>
          </Marker>
        )}

        {/* MARCADOR DO DESTINO */}
        {voo.destino_coord && (
          <Marker longitude={voo.destino_coord.lon} latitude={voo.destino_coord.lat}>
            <div className="flex flex-col items-center">
              <span className="rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-mono font-bold text-foreground border border-border shadow-sm">
                {voo.destino}
              </span>
            </div>
          </Marker>
        )}

        {/* MARCADOR DO AVIÃO COM SINAL ADS-B AO VIVO */}
        {posicaoAviao && (
          <Marker longitude={posicaoAviao.lon} latitude={posicaoAviao.lat} anchor="center">
            <div 
              className="transition-all duration-1000 ease-out"
              style={{ transform: `rotate(${rumoAviao}deg)` }}
            >
              <Plane 
                size={22} 
                className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" 
              />
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}