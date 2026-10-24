import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { VooEmOperacao } from "@/lib/colaborador-api";
import "maplibre-gl/dist/maplibre-gl.css";

const estilo = {
  version: 8 as const,
  sources: {
    base: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "base", type: "raster" as const, source: "base" }],
};

function geoJsonLinha(pontos: Array<[number, number]>) {
  return {
    type: "FeatureCollection" as const,
    features: pontos.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: pontos } }] : [],
  };
}

function marcadorAerodromo(codigo: string, cor: string) {
  const elemento = document.createElement("div");
  elemento.textContent = codigo || "AER";
  elemento.title = codigo || "Aeródromo";
  elemento.style.cssText = `display:flex;align-items:center;justify-content:center;min-width:34px;height:24px;padding:0 6px;border:2px solid white;border-radius:7px;background:${cor};color:white;font:700 10px system-ui,sans-serif;box-shadow:0 1px 5px #0008;`;
  return elemento;
}

export default function VooEmOperacaoMapa({ voo }: { voo: VooEmOperacao }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const primeiraCarga = useRef(true);
  const marcadores = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!container.current || mapa.current) return;
    const instancia = new maplibregl.Map({
      container: container.current,
      style: estilo,
      center: [-47, -22],
      zoom: 5,
      attributionControl: { compact: true },
    });
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
      const origem = voo.origem_coord ? [voo.origem_coord.lon, voo.origem_coord.lat] as [number, number] : null;
      const destino = voo.destino_coord ? [voo.destino_coord.lon, voo.destino_coord.lat] as [number, number] : null;
      const rota = [origem, destino].filter((ponto): ponto is [number, number] => Boolean(ponto));
      const atualizar = (id: string, dados: Array<[number, number]>, cor: string, tracejada = false) => {
        const geoJson = geoJsonLinha(dados);
        const fonte = instancia.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (fonte) fonte.setData(geoJson);
        else {
          instancia.addSource(id, { type: "geojson", data: geoJson });
          instancia.addLayer({ id: `${id}-linha`, type: "line", source: id, paint: { "line-color": cor, "line-width": tracejada ? 3 : 4, ...(tracejada ? { "line-dasharray": [2, 2] } : {}) } });
        }
      };
      atualizar("rota-operacao", rota, "#2563eb", true);
      atualizar("trilha-operacao", pontos, "#eab308");

      if (origem && voo.origem) marcadores.current.push(new maplibregl.Marker({ element: marcadorAerodromo(voo.origem, "#2563eb"), anchor: "bottom" }).setLngLat(origem).addTo(instancia));
      if (destino && voo.destino) marcadores.current.push(new maplibregl.Marker({ element: marcadorAerodromo(voo.destino, "#475569"), anchor: "bottom" }).setLngLat(destino).addTo(instancia));
      if (atual) {
        const el = document.createElement("div");
        el.textContent = "✈";
        el.title = voo.matricula_registro ? `Aeronave ${voo.matricula_registro}` : "Aeronave em voo";
        el.style.cssText = `display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:2px solid white;border-radius:50%;background:#facc15;color:#111827;font:700 21px system-ui,sans-serif;box-shadow:0 1px 8px #0009;transform:rotate(${voo.rastreio?.rumo_graus || 0}deg);`;
        marcadores.current.push(new maplibregl.Marker({ element: el }).setLngLat(atual).addTo(instancia));
      }

      const enquadramento = [...rota, ...pontos];
      if (primeiraCarga.current && enquadramento.length) {
        const limites = new maplibregl.LngLatBounds();
        enquadramento.forEach((ponto) => limites.extend(ponto));
        instancia.fitBounds(limites, { padding: 55, maxZoom: 9, duration: 0 });
        primeiraCarga.current = false;
      }
    };
    if (instancia.isStyleLoaded()) desenhar();
    else instancia.once("load", desenhar);
    return () => { instancia.off("load", desenhar); };
  }, [voo]);

  return <div ref={container} className="h-[360px] min-h-[300px] w-full" aria-label="Mapa da rota planejada e posição da aeronave" />;
}
