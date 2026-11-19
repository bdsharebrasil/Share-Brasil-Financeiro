import type { CoordenadaRastreio } from "./rastreio-mapa";

/**
 * Referências estáticas oficiais exclusivamente para a geometria prevista,
 * usadas apenas se o D1 e a consulta ROTAER não retornarem coordenadas.
 * Atualizar os cadastros D1/ROTAER é preferível; NUNCA usar como posição ADS-B.
 *
 * Fonte AISWEB/DECEA:
 * SIAQ: https://aisweb.decea.mil.br/?codigo=SIAQ&i=aerodromos
 *   15°30'23"S / 056°05'54"W; atualização publicada 05/11/2026.
 * SWJN: https://aisweb.decea.mil.br/?codigo=SWJN&i=aerodromos
 *   11°25'10"S / 058°42'36"W; atualização publicada 12/11/2026.
 */
const COORDENADAS_DE_REFERENCIA: Record<string, CoordenadaRastreio> = {
  SIAQ: { lat: -(15 + 30 / 60 + 23 / 3600), lon: -(56 + 5 / 60 + 54 / 3600) },
  SWJN: { lat: -(11 + 25 / 60 + 10 / 3600), lon: -(58 + 42 / 60 + 36 / 3600) },
};

export function coordenadaReferenciaAerodromo(icao: string): CoordenadaRastreio | null {
  return COORDENADAS_DE_REFERENCIA[String(icao || "").trim().toUpperCase()] || null;
}
