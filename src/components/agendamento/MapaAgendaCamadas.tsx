import type { StyleSpecification } from "maplibre-gl";
import { Layers3 } from "lucide-react";

export type ModoMapaAgenda = "terrestre" | "satelite" | "alta" | "baixa";
const CARTAS: Record<"alta" | "baixa", string> = {
  alta: String(import.meta.env.VITE_MAPA_ENRC_ALTA_TILES || "").trim(),
  baixa: String(import.meta.env.VITE_MAPA_ENRC_BAIXA_TILES || "").trim(),
};
export const modosMapaAgenda = [
  { id: "terrestre", nome: "Terrestre" },
  { id: "satelite", nome: "Satélite" },
  { id: "alta", nome: "Carta de alta altitude (ENRC-H)" },
  { id: "baixa", nome: "Carta de baixa altitude (ENRC-L)" },
] as const;
export function cartaDisponivel(modo: ModoMapaAgenda) {
  if (modo === "terrestre" || modo === "satelite") return true;
  const url = CARTAS[modo];
  return /^https:\/\//i.test(url) && ((url.includes("{z}") && url.includes("{x}") && url.includes("{y}")) || url.includes("{bbox-epsg-3857}"));
}
export function estiloMapaAgenda(modo: ModoMapaAgenda): StyleSpecification {
  const raster = (url: string, attribution: string, maxzoom = 19) => ({ type: "raster" as const, tiles: [url], tileSize: 256, maxzoom, attribution });
  if (modo === "alta" || modo === "baixa") {
    if (!cartaDisponivel(modo)) return { version: 8, sources: {}, layers: [{ id: "sem-carta", type: "background", paint: { "background-color": "#0D213A" } }] };
    return { version: 8, sources: { carta: raster(CARTAS[modo], "Fonte aeronáutica configurada · ENRC-" + (modo === "alta" ? "H" : "L")) }, layers: [{ id: "carta", type: "raster", source: "carta" }] };
  }
  if (modo === "terrestre") return { version: 8, sources: { base: raster("https://tile.openstreetmap.org/{z}/{x}/{y}.png", "© OpenStreetMap contributors") }, layers: [{ id: "base", type: "raster", source: "base" }] };
  return { version: 8, sources: { imagem: raster("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "Imagens © Esri"), rotulos: raster("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", "Rótulos © Esri") }, layers: [{ id: "satelite", type: "raster", source: "imagem" }, { id: "nomes", type: "raster", source: "rotulos" }] };
}
export function SeletorMapaAgenda({ modo, aoMudar }: { modo: ModoMapaAgenda; aoMudar: (m: ModoMapaAgenda) => void }) {
  return <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/80 px-2 py-1.5 text-[11px] text-white"><Layers3 size={13}/><select aria-label="Modo de visualização do mapa" value={modo} onChange={e => aoMudar(e.target.value as ModoMapaAgenda)} className="max-w-[200px] bg-slate-950 text-white outline-none">{modosMapaAgenda.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>;
}
export function AvisoCartaAgenda({ modo, erro }: { modo: ModoMapaAgenda; erro?: boolean }) {
  if (cartaDisponivel(modo) && !erro) return null;
  const carta = modo === "alta" || modo === "baixa";
  return <div role="status" className="absolute inset-x-3 top-12 z-10 rounded-lg bg-slate-950/95 p-3 text-xs text-white shadow-lg">{carta ? "Camada ENRC " + (modo === "alta" ? "H" : "L") + " indisponível. " : "Falha ao carregar o mapa. "}{carta && <a href="https://geoaisweb.decea.mil.br/" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-300 underline">Consultar a carta oficial no GeoAISWEB</a>}</div>;
}
