import type { VooEmOperacao } from "./colaborador-api";

export type CoordenadaRastreio = { lat: number; lon: number };
export type TrechoPlanejado = {
  id: string;
  origem: string | null;
  destino: string | null;
  coordenadas: [number, number][];
};

export function coordenadaRastreioValida(valor: CoordenadaRastreio | null | undefined): valor is CoordenadaRastreio {
  return Boolean(valor && Number.isFinite(valor.lat) && Number.isFinite(valor.lon)
    && Math.abs(valor.lat) <= 90 && Math.abs(valor.lon) <= 180);
}

function par(valor: CoordenadaRastreio): [number, number] {
  return [valor.lon, valor.lat];
}

/** Segmentos planejados, separados por perna: jamais são tratados como trajetória ADS-B real. */
export function trechosPlanejados(voo: VooEmOperacao): TrechoPlanejado[] {
  const partes: TrechoPlanejado[] = voo.pernas.length
    ? voo.pernas.map((perna) => ({
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
    return [{ id: voo.id, origem: voo.origem, destino: voo.destino,
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
  for (const perna of voo.pernas) {
    aeroporto(perna.origem_coord);
    aeroporto(perna.destino_coord);
  }
  for (const ponto of voo.trilha || []) aeroporto(ponto);
  if (voo.rastreio && Number.isFinite(voo.rastreio.lat) && Number.isFinite(voo.rastreio.lon)) {
    aeroporto(voo.rastreio);
  }
  return pontos;
}
