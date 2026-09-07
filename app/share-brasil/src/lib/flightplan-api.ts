import { apiFetch } from "@/lib/api";

export type AerodromoOption = {
  id: string;
  label: string;
  name: string;
  city?: string | null;
};

export type WeatherResponse = {
  loc: string;
  metar: string;
  taf: string;
  weather_condition?: "clear" | "cloudy" | "rain" | "storm" | "snow";
  observed_at?: string | null;
  temperature_c?: number | null;
  dew_point_c?: number | null;
  qnh_hpa?: number | null;
  wind?: {
    direction_deg?: number | null;
    speed_kt?: number | null;
    gust_kt?: number | null;
    variable?: boolean;
  };
  source?: string;
};

export type ChartResponse = {
  title: string;
  tipo: string;
  descricao: string;
  url: string;
};

export type AirportDetail = {
  icao: string;
  name?: string;
  city?: string | null;
  state?: string | null;
  elevation?: string | number | null;
  coordinates?: { lat: number; lng: number } | null;
  runways?: unknown[];
  frequencies?: unknown[];
  restrictions?: unknown[];
};

export type FlightPlanResponse = {
  flightplan: {
    adep: string;
    ades: string;
    route: string;
    route_source: "AISWEB/DECEA" | "fallback";
    distance_nm: number;
    estimated_time: string;
    flight_minutes: number;
    cruise_speed: number;
  };
  performance?: {
    source: "performance_aeronave" | "aeronave";
    fabricante: string | null;
    modelo: string | null;
    tipo_aeronave: string | null;
    velocidade_cruzeiro_kt: number;
    consumo_combustivel_lh: number;
    categoria: string | null;
    teto_servico_ft: number | null;
    taxa_subida_fpm: number | null;
    taxa_descida_fpm: number | null;
  } | null;
  fuel: {
    burn_lh: number;
    trip_liters: number;
    reserve_liters: number;
    taxi_liters: number;
    total_required: number;
    reserve_min: number;
  };
  departure: { icao: string; name: string; lat: number; lon: number };
  destination: { icao: string; name: string; lat: number; lon: number };
  alternates: Array<{ icao: string; name: string; distance_km: number }>;
  notam_alerts: Array<{ id: string; number?: string | null; message: string; start?: string | null; end?: string | null }>;
  notam_count: number;
};

export async function buscarAerodromos(): Promise<{ aerodromos: AerodromoOption[] }> {
  return apiFetch("/api/aerodromos") as Promise<{ aerodromos: AerodromoOption[] }>;
}

export async function buscarClima(icao: string): Promise<WeatherResponse> {
  return apiFetch(`/api/weather/${encodeURIComponent(icao)}`) as Promise<WeatherResponse>;
}

export async function buscarCartas(icao: string): Promise<{ charts?: ChartResponse[] }> {
  return apiFetch(`/api/charts/${encodeURIComponent(icao)}`) as Promise<{ charts?: ChartResponse[] }>;
}

export async function buscarRotaer(icao: string): Promise<{ airport: AirportDetail }> {
  return apiFetch(`/api/rotaer/${encodeURIComponent(icao)}`) as Promise<{ airport: AirportDetail }>;
}

export async function calcularPlanoVoo(params: {
  adep: string;
  ades: string;
  speed: number;
  fuelBurn: number;
  reserveMin: number;
  aircraftId?: string;
}): Promise<FlightPlanResponse> {
  const query = new URLSearchParams({
    adep: params.adep,
    ades: params.ades,
    speed: String(params.speed),
    fuel_burn: String(params.fuelBurn),
    reserve: String(params.reserveMin),
  });
  if (params.aircraftId) query.set("aeronave_id", params.aircraftId);
  return apiFetch(`/api/flightplan?${query.toString()}`) as Promise<FlightPlanResponse>;
}
