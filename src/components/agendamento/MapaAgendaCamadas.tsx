import type { StyleSpecification } from "maplibre-gl";
import { Layers3 } from "lucide-react";
import { API_BASE } from "@/lib/api";

export type ModoMapaAgenda = "terrestre" | "satelite" | "alta" | "baixa";
export const modosMapaAgenda = [
  { id: "terrestre", nome: "Terrestre" },
  { id: "satelite", nome: "Satélite" },
  { id: "alta", nome: "Carta de rota de alta altitude (ENRC-H)" },
  { id: "baixa", nome: "Carta de rota de baixa altitude (ENRC-L)" },
] as const;
const TILES_ENRC = (modo: "alta" | "baixa") => `${API_BASE}/api/cartas/enrc/${modo}/{z}/{x}/{y}`;
export function cartaDisponivel(modo: ModoMapaAgenda) {
  return modo === "alta" || modo === "baixa";
}
export function estiloMapaAgenda(modo: ModoMapaAgenda): StyleSpecification {
  const raster = (tiles: string, attribution: string, maxzoom = 19) => ({ type: "raster" as const, tiles: [tiles], tileSize: 256, maxzoom, attribution });
  if (modo === "alta" || modo === "baixa") {
    const legenda = modo === "alta" ? "ENRC-H" : "ENRC-L";
    return { version: 8, sources: { carta: raster(TILES_ENRC(modo), `Carta ${legenda} · GeoAISWEB/DECEA`, 18) }, layers: [{ id: "carta", type: "raster", source: "carta" }] };
  }
  if (modo === "terrestre") return { version: 8, sources: { base: raster("https://tile.openstreetmap.org/{z}/{x}/{y}.png", "© OpenStreetMap contributors") }, layers: [{ id: "base", type: "raster", source: "base" }] };
  return { version: 8, sources: { imagem: raster("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "Imagens © Esri"), rotulos: raster("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", "Rótulos © Esri") }, layers: [{ id: "satelite", type: "raster", source: "imagem" }, { id: "nomes", type: "raster", source: "rotulos" }] };
}
export function SeletorMapaAgenda({ modo, aoMudar }: { modo: ModoMapaAgenda; aoMudar: (m: ModoMapaAgenda) => void }) {
  return <label className="mx-[5px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/80 px-[7px] py-[11px] text-[11px] font-extralight text-white"><Layers3 size={13}/><select aria-label="Modo de visualização do mapa" value={modo} onChange={e => aoMudar(e.target.value as ModoMapaAgenda)} className="max-w-[200px] bg-[rgba(178,186,189,1)] text-[rgba(50,52,53,1)] outline-none">{modosMapaAgenda.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>;
}
export function AvisoCartaAgenda({ modo, erro }: { modo: ModoMapaAgenda; erro?: boolean }) {
  if ((modo !== "alta" && modo !== "baixa") || !erro) return null;
  const nome = modo === "alta" ? "ENRC-H" : "ENRC-L";
  return <div role="status" className="absolute inset-x-3 top-12 z-10 rounded-lg bg-slate-950/95 p-3 text-xs text-white shadow-lg">A fonte oficial {nome} está indisponível no momento. Consulte o status e a carta vigente no <a href="https://geoaisweb.decea.mil.br/" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-300 underline">GeoAISWEB</a>.</div>;
}
