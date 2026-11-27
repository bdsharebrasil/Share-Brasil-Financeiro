import type { StyleSpecification } from "maplibre-gl";
import { estiloMapaAgenda, type ModoMapaAgenda } from "@/components/agendamento/MapaAgendaCamadas";
export type EstiloMapa = "padrao" | "terreno" | "satelite" | "aeronautico" | "baixa";
export interface ProvedorMapa {
  id: string;
  nome: string;
  disponivel: boolean;
  atribuicao: string;
  estilo: (estilo: EstiloMapa) => string | StyleSpecification;
}
const CHAVE_MAPTILER = (import.meta.env.VITE_MAPTILER_KEY as string | undefined)?.trim() || "";
export const aeronauticoDisponivel = true;
function modoCompartilhado(estilo: EstiloMapa): ModoMapaAgenda {
  if (estilo === "satelite") return "satelite";
  if (estilo === "aeronautico") return "alta";
  if (estilo === "baixa") return "baixa";
  return "terrestre";
}
function raster(tiles: string, atribuicao: string, maxzoom = 19): StyleSpecification {
  return { version: 8, sources: { base: { type: "raster", tiles: [tiles], tileSize: 256, maxzoom, attribution: atribuicao } }, layers: [{ id: "base", type: "raster", source: "base" }] };
}
export const provedorContingencia: ProvedorMapa = {
  id: "publico", nome: "Mapas públicos", disponivel: true, atribuicao: "© OpenStreetMap contributors",
  estilo: estilo => estilo === "terreno"
    ? raster("https://tile.opentopomap.org/{z}/{x}/{y}.png", '© OpenStreetMap contributors | © OpenTopoMap', 17)
    : estiloMapaAgenda(modoCompartilhado(estilo)),
};
const ESTILOS_MAPTILER = { padrao: "streets-v2", terreno: "landscape", satelite: "hybrid" };
export const provedorMapTiler: ProvedorMapa = {
  id: "maptiler", nome: "MapTiler", disponivel: !!CHAVE_MAPTILER, atribuicao: "© MapTiler © OpenStreetMap contributors",
  estilo: estilo => estilo === "aeronautico" || estilo === "baixa" ? provedorContingencia.estilo(estilo) : `https://api.maptiler.com/maps/${ESTILOS_MAPTILER[estilo]}/style.json?key=${CHAVE_MAPTILER}`,
};
export function provedorAtivo(): ProvedorMapa { return provedorMapTiler.disponivel ? provedorMapTiler : provedorContingencia; }
export interface CamadaExterna { id: string; nome: string; url: string | null; }
export const camadasExternas: CamadaExterna[] = [
  { id: "espaco_aereo", nome: "Espaço aéreo", url: null },
  { id: "meteorologia", nome: "Meteorologia", url: null },
  { id: "notam", nome: "NOTAM / alertas", url: null },
];
