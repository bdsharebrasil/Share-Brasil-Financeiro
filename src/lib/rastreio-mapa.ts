import type { VooEmOperacao } from "./colaborador-api";

export type CoordenadaRastreio = { lat: number; lon: number };
export type TrechoPlanejado = {
  id: string;
  origem: string | null;
  destino: string | null;
  coordenadas: [number, number][];
};

export function coordenadaRastreioValida(valor: CoordenadaRastreio | null | undefined): valor is CoordenadaRastreio {
  if (!valor || valor.lat == null || valor.lon == null) return false;
  const lat = Number(valor.lat);
  const lon = Number(valor.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function par(valor: CoordenadaRastreio): [number, number] {
  return [Number(valor.lon), Number(valor.lat)];
}

/** Segmentos planejados, separados por perna: jamais são tratados como trajetória ADS-B real. */
export function trechosPlanejados(voo: VooEmOperacao): TrechoPlanejado[] {
  const pernas = [...(voo.pernas || [])];
  if (voo.perna_atual && !pernas.some((perna) => perna.id === voo.perna_atual?.id)) pernas.push(voo.perna_atual);
  const partes: TrechoPlanejado[] = pernas.length
    ? pernas.map((perna) => ({
        id: perna.id,
        origem: perna.origem,
        destino: perna.destino,
        coordenadas: coordenadaRastreioValida(perna.origem_coord) && coordenadaRastreioValida(perna.destino_coord)
          ? [par(perna.origem_coord), par(perna.destino_coord)] : [],
      }))
    : [{
        id: voo.id,
        origem: voo.origem,
        destino: voo.destino,
        coordenadas: coordenadaRastreioValida(voo.origem_coord) && coordenadaRastreioValida(voo.destino_coord)
          ? [par(voo.origem_coord), par(voo.destino_coord)] : [],
      }];

  // Pode existir perna sem coordenadas, enquanto a rota principal já foi resolvida no ROTAER.
  if (!partes.some((trecho) => trecho.coordenadas.length >= 2)
    && coordenadaRastreioValida(voo.origem_coord) && coordenadaRastreioValida(voo.destino_coord)) {
    return [{ id: pernas.length === 1 ? pernas[0].id : voo.id, origem: voo.origem, destino: voo.destino,
      coordenadas: [par(voo.origem_coord), par(voo.destino_coord)] }];
  }
  return partes.filter((trecho) => trecho.coordenadas.length >= 2);
}

export function pontosParaEnquadrar(voo: VooEmOperacao): [number, number][] {
  const pontos = trechosPlanejados(voo).flatMap((item) => item.coordenadas);
  const aeroporto = (c: CoordenadaRastreio | null | undefined) => {
    if (coordenadaRastreioValida(c)) pontos.push(par(c));
  };
  aeroporto(voo.origem_coord);
  aeroporto(voo.destino_coord);
  const pernas = [...(voo.pernas || [])];
  if (voo.perna_atual && !pernas.some((perna) => perna.id === voo.perna_atual?.id)) pernas.push(voo.perna_atual);
  for (const perna of pernas) {
    aeroporto(perna.origem_coord);
    aeroporto(perna.destino_coord);
  }
  for (const ponto of voo.trilha || []) aeroporto(ponto);
  if (voo.rastreio && Number.isFinite(voo.rastreio.lat) && Number.isFinite(voo.rastreio.lon)) {
    aeroporto(voo.rastreio);
  }
  return pontos;
}
