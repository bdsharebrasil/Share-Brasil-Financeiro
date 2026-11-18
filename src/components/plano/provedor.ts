import type { StyleSpecification } from "maplibre-gl";

export type EstiloMapa = "padrao" | "terreno" | "satelite" | "aeronautico";
export interface ProvedorMapa {
  id: string;
  nome: string;
  disponivel: boolean;
  atribuicao: string;
  estilo: (estilo: EstiloMapa) => string | StyleSpecification;
}

const CHAVE_MAPTILER = (import.meta.env.VITE_MAPTILER_KEY as string | undefined)?.trim() || "";
// URL pública de tiles XYZ ou WMS compatível com EPSG:3857. Nunca usar uma base temática como carta aeronáutica.
const CARTAS = (import.meta.env.VITE_MAPA_AERONAUTICO_TILES as string | undefined)?.trim() || "";
export const aeronauticoDisponivel = /^https:\/\//.test(CARTAS) && (/\{z\}.*\{[xy]\}|\{bbox-epsg-3857\}/.test(CARTAS));

function raster(tiles: string, atribuicao: string, maxzoom = 19): StyleSpecification {
  return { version: 8, sources: { base: { type: "raster", tiles: [tiles], tileSize: 256, maxzoom, attribution: atribuicao } }, layers: [{ id: "base", type: "raster", source: "base" }] };
}

export const provedorContingencia: ProvedorMapa = {
  id: "publico", nome: "Mapas públicos", disponivel: true, atribuicao: "© OpenStreetMap contributors",
  estilo: estilo => {
    if (estilo === "terreno") return raster("https://tile.opentopomap.org/{z}/{x}/{y}.png", '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)', 17);
    if (estilo === "satelite") return raster("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "Esri, Maxar, Earthstar Geographics, and the GIS User Community");
    if (estilo === "aeronautico") {
      if (!aeronauticoDisponivel) throw new Error("Cartas aeronáuticas indisponíveis neste mapa.");
      return raster(CARTAS, "© DECEA / fonte da carta aeronáutica");
    }
    return raster("https://tile.openstreetmap.org/{z}/{x}/{y}.png", '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
  },
};

const ESTILOS_MAPTILER = { padrao: "streets-v2", terreno: "landscape", satelite: "hybrid" };
export const provedorMapTiler: ProvedorMapa = {
  id: "maptiler", nome: "MapTiler", disponivel: !!CHAVE_MAPTILER, atribuicao: "© MapTiler © OpenStreetMap contributors",
  estilo: estilo => estilo === "aeronautico" ? provedorContingencia.estilo(estilo) : `https://api.maptiler.com/maps/${ESTILOS_MAPTILER[estilo]}/style.json?key=${CHAVE_MAPTILER}`,
};
export function provedorAtivo(): ProvedorMapa { return provedorMapTiler.disponivel ? provedorMapTiler : provedorContingencia; }

export interface CamadaExterna { id: string; nome: string; url: string | null; }
export const camadasExternas: CamadaExterna[] = [
  { id: "espaco_aereo", nome: "Espaço aéreo", url: null },
  { id: "meteorologia", nome: "Meteorologia", url: null },
  { id: "notam", nome: "NOTAM / alertas", url: null },
];
