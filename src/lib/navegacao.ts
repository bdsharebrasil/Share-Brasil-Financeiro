/**
 * Cálculos geodésicos de navegação (WGS-84).
 * Distância por fórmula inversa de Vincenty, com queda para círculo máximo.
 * Proa verdadeira apenas — proa magnética só é exibida quando há declinação
 * de fonte confiável (nunca chamamos proa verdadeira de magnética).
 */

export interface Coordenada {
  lat: number;
  lon: number;
}

const RAIO_TERRA_M = 6371008.8;
const NM_POR_METRO = 1 / 1852;

const rad = (g: number) => (g * Math.PI) / 180;
const grau = (r: number) => (r * 180) / Math.PI;

/** Distância geodésica em metros (Vincenty inverso, elipsoide WGS-84). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const eixoA = 6378137, achatamento = 1 / 298.257223563;
  const eixoB = (1 - achatamento) * eixoA;
  const L = rad(b.lon - a.lon);
  const U1 = Math.atan((1 - achatamento) * Math.tan(rad(a.lat)));
  const U2 = Math.atan((1 - achatamento) * Math.tan(rad(b.lat)));
  const senU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const senU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = L, lambdaAnterior = 0, iteracoes = 0;
  let senSigma = 0, cosSigma = 0, sigma = 0, cos2SigmaM = 0, cosQuadAlfa = 0;

  while (Math.abs(lambda - lambdaAnterior) > 1e-12 && iteracoes < 200) {
    const senLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
    senSigma = Math.sqrt(
      (cosU2 * senLambda) ** 2 + (cosU1 * senU2 - senU1 * cosU2 * cosLambda) ** 2,
    );
    if (senSigma === 0) return 0;
    cosSigma = senU1 * senU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(senSigma, cosSigma);
    const senAlfa = (cosU1 * cosU2 * senLambda) / senSigma;
    cosQuadAlfa = 1 - senAlfa ** 2;
    cos2SigmaM = cosQuadAlfa === 0 ? 0 : cosSigma - (2 * senU1 * senU2) / cosQuadAlfa;
    const C = (achatamento / 16) * cosQuadAlfa * (4 + achatamento * (4 - 3 * cosQuadAlfa));
    lambdaAnterior = lambda;
    lambda =
      L +
      (1 - C) * achatamento * senAlfa *
        (sigma + C * senSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    iteracoes += 1;
  }

  if (iteracoes >= 200) return distanciaCirculoMaximoMetros(a, b);

  const uQuad = (cosQuadAlfa * (eixoA ** 2 - eixoB ** 2)) / eixoB ** 2;
  const A = 1 + (uQuad / 16384) * (4096 + uQuad * (-768 + uQuad * (320 - 175 * uQuad)));
  const B = (uQuad / 1024) * (256 + uQuad * (-128 + uQuad * (74 - 47 * uQuad)));
  const deltaSigma =
    B * senSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) * cos2SigmaM * (-3 + 4 * senSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));

  return eixoB * A * (sigma - deltaSigma);
}

function distanciaCirculoMaximoMetros(a: Coordenada, b: Coordenada): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanciaNM(a: Coordenada, b: Coordenada): number {
  return distanciaMetros(a, b) * NM_POR_METRO;
}

export function distanciaKm(a: Coordenada, b: Coordenada): number {
  return distanciaMetros(a, b) / 1000;
}

/** Proa verdadeira inicial do segmento (graus, 0–360). */
export function proaVerdadeira(a: Coordenada, b: Coordenada): number {
  const phi1 = rad(a.lat), phi2 = rad(b.lat), dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (grau(Math.atan2(y, x)) + 360) % 360;
}

/** Pontos intermediários do círculo máximo, para desenhar a rota no mapa. */
export function arcoCirculoMaximo(a: Coordenada, b: Coordenada, passos = 64): [number, number][] {
  const d = distanciaMetros(a, b) / RAIO_TERRA_M;
  if (d === 0) return [[a.lon, a.lat]];
  const pontos: [number, number][] = [];
  for (let i = 0; i <= passos; i += 1) {
    const f = i / passos;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon));
    const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon));
    const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
    pontos.push([grau(Math.atan2(y, x)), grau(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return pontos;
}

/** Tempo do segmento em minutos, considerando velocidade no solo. */
export function tempoMinutos(distanciaEmNM: number, velocidadeSoloKt: number): number | null {
  if (!velocidadeSoloKt || velocidadeSoloKt <= 0) return null;
  return (distanciaEmNM / velocidadeSoloKt) * 60;
}

export interface EntradaCombustivel {
  minutosVoo: number;
  consumoPorHora: number;
  minutosReserva: number;
  minutosTaxi: number;
  combustivelABordo?: number | undefined;
}

export interface ResultadoCombustivel {
  etapa: number;
  reserva: number;
  taxi: number;
  total: number;
  autonomiaMinutos: number | null;
  margemMinutos: number | null;
  margemLitros: number | null;
}

export function calcularCombustivel(e: EntradaCombustivel): ResultadoCombustivel {
  const porMinuto = e.consumoPorHora / 60;
  const etapa = e.minutosVoo * porMinuto;
  const reserva = e.minutosReserva * porMinuto;
  const taxi = e.minutosTaxi * porMinuto;
  const total = etapa + reserva + taxi;
  const abordo = e.combustivelABordo;
  const autonomiaMinutos = abordo && porMinuto > 0 ? abordo / porMinuto : null;
  return {
    etapa,
    reserva,
    taxi,
    total,
    autonomiaMinutos,
    margemMinutos: autonomiaMinutos === null ? null : autonomiaMinutos - (e.minutosVoo + e.minutosTaxi),
    margemLitros: abordo === undefined ? null : abordo - total,
  };
}

/** Converte "-23.5 -46.6", "-23.5,-46.6" ou "23 26 S / 046 28 W" em coordenada. */
export function interpretarCoordenadas(bruto: string | null | undefined): Coordenada | null {
  if (!bruto) return null;
  const texto = bruto.trim();

  const decimal = texto.match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (decimal && decimal[1] && decimal[2]) {
    const lat = Number(decimal[1].replace(",", "."));
    const lon = Number(decimal[2].replace(",", "."));
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }

  const gms = texto.match(
    /(\d{1,3})[°\s:]+(\d{1,2})(?:[.'\s:]+(\d{1,2}(?:\.\d+)?))?\s*([NSns])[^\d]+(\d{1,3})[°\s:]+(\d{1,2})(?:[.'\s:]+(\d{1,2}(?:\.\d+)?))?\s*([EWew])/,
  );
  if (gms) {
    const val = (g: string, m: string, s: string | undefined, hemi: string) => {
      const v = Number(g) + Number(m) / 60 + (s ? Number(s) / 3600 : 0);
      return /[SWsw]/.test(hemi) ? -v : v;
    };
    return {
      lat: val(gms[1]!, gms[2]!, gms[3], gms[4]!),
      lon: val(gms[5]!, gms[6]!, gms[7], gms[8]!),
    };
  }
  return null;
}
