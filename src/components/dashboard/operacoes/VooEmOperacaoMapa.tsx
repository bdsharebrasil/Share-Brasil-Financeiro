import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { VooEmOperacao } from "@/lib/colaborador-api";
import "maplibre-gl/dist/maplibre-gl.css";

const estilo = {
  version: 8 as const,
  sources: { base: { type: "raster" as const, tiles: ["https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"], tileSize: 256, attribution: "© CARTO © OpenStreetMap contributors" } },
  layers: [{ id: "base", type: "raster" as const, source: "base" }],
};

function linha(id: string, pontos: Array<[number, number]>, cor: string, tracejada = false) {
  return {
    type: "FeatureCollection" as const,
    features: pontos.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: pontos } }] : [],
  };
}

export default function VooEmOperacaoMapa({ voo }: { voo: VooEmOperacao }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const primeiraCarga = useRef(true);
  const marcadores = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!container.current || mapa.current) return;
    const instancia = new maplibregl.Map({ container: container.current, style: estilo, center: [-47, -22], zoom: 5, attributionControl: { compact: true } });
    mapa.current = instancia;
    const resize = new ResizeObserver(() => instancia.resize());
    resize.observe(container.current);
    return () => { resize.disconnect(); instancia.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;
    const desenhar = () => {
      if (!instancia.isStyleLoaded()) return;
      marcadores.current.forEach((marcador) => marcador.remove());
      marcadores.current = [];
      const atual = voo.rastreio ? [voo.rastreio.lon, voo.rastreio.lat] as [number, number] : null;
      const trilha = (voo.trilha || []).map((ponto) => [ponto.lon, ponto.lat] as [number, number]);
      const pontos = trilha.length ? trilha : (atual ? [atual] : []);
      const rota = [voo.origem_coord, voo.destino_coord].filter(Boolean).map((ponto) => [ponto!.lon, ponto!.lat] as [number, number]);
      const atualizar = (id: string, dados: unknown, cor: string, tracejada = false) => {
        const fonte = instancia.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (fonte) fonte.setData(linha(id, dados as Array<[number, number]>, cor, tracejada));
        else {
          instancia.addSource(id, { type: "geojson", data: linha(id, dados as Array<[number, number]>, cor, tracejada) });
          instancia.addLayer({ id: `${id}-linha`, type: "line", source: id, paint: { "line-color": cor, "line-width": 3, ...(tracejada ? { "line-dasharray": [2, 2] } : {}) } });
        }
      };
      atualizar("rota-operacao", rota, "#38bdf8", true);
      atualizar("trilha-operacao", pontos, "#34d399");
      if (atual) {
        const el = document.createElement("div");
        el.className = "flex h-7 w-7 items-center justify-center rounded-full border border-white bg-sky-500 text-sm shadow-lg";
        el.innerHTML = `<span style="display:block;transform:rotate(${(voo.rastreio?.rumo_graus || 0) - 45}deg)">✈</span>`;
        marcadores.current.push(new maplibregl.Marker({ element: el }).setLngLat(atual).addTo(instancia));
      }
      const enquadramento = pontos.length ? pontos : rota;
      if (primeiraCarga.current && enquadramento.length) {
        const limites = new maplibregl.LngLatBounds();
        enquadramento.forEach((ponto) => limites.extend(ponto));
        instancia.fitBounds(limites, { padding: 35, maxZoom: 9, duration: 0 });
        primeiraCarga.current = false;
      }
    };
    if (instancia.isStyleLoaded()) desenhar();
    else instancia.once("load", desenhar);
    return () => { instancia.off("load", desenhar); };
  }, [voo]);

  return <div ref={container} className="h-[240px] w-full" aria-label="Mapa da rota e posição da aeronave" />;
}
