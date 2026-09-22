/**
 * Abstração de provedor de basemap.
 * O componente MapaRota nunca conhece o provedor: recebe apenas um estilo.
 * Trocar MapTiler por outro provedor significa acrescentar um objeto aqui.
 * A chave vem de variável de ambiente — nunca é escrita no código.
 */
import type { StyleSpecification } from "maplibre-gl";

export type EstiloMapa = "padrao" | "terreno" | "satelite" | "aeronautico";

export interface ProvedorMapa {
  id: string;
  nome: string;
  disponivel: boolean;
  atribuicao: string;
  estilo: (estilo: EstiloMapa) => string | StyleSpecification;
}

const CHAVE_MAPTILER = (import.meta.env["VITE_MAPTILER_KEY"] as string | undefined)?.trim() || "";

const ESTILOS_MAPTILER: Record<EstiloMapa, string> = {
  padrao: "streets-v2",
  terreno: "landscape",
  satelite: "hybrid",
  aeronautico: "dataviz-dark",
};

export const provedorMapTiler: ProvedorMapa = {
  id: "maptiler",
  nome: "MapTiler",
  disponivel: CHAVE_MAPTILER.length > 0,
  atribuicao: "© MapTiler © OpenStreetMap contributors",
  estilo: (estilo) =>
    `https://api.maptiler.com/maps/${ESTILOS_MAPTILER[estilo]}/style.json?key=${CHAVE_MAPTILER}`,
};

/** Provedor de contingência, usado apenas quando não há chave configurada. */
export const provedorContingencia: ProvedorMapa = {
  id: "contingencia",
  nome: "Base de contingência",
  disponivel: true,
  atribuicao: "© OpenStreetMap contributors",
  estilo: (): StyleSpecification => ({
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      base: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  }),
};

export function provedorAtivo(): ProvedorMapa {
  return provedorMapTiler.disponivel ? provedorMapTiler : provedorContingencia;
}

/**
 * Camadas aeronáuticas/meteorológicas servidas por WMS.
 * Ficam preparadas para receber endpoints AISWEB/DECEA sem alterar o mapa.
 */
export interface CamadaExterna {
  id: string;
  nome: string;
  url: string | null;
}

export const camadasExternas: CamadaExterna[] = [
  { id: "espaco_aereo", nome: "Espaço aéreo", url: null },
  { id: "meteorologia", nome: "Meteorologia", url: null },
  { id: "notam", nome: "NOTAM / alertas", url: null },
];
