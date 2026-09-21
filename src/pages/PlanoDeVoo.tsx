import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Compass,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Fuel,
  Lightbulb,
  LoaderCircle,
  MapPinned,
  Plane,
  Route,
  Save,
  ShieldCheck,
  Sun,
  Wind,
  XCircle,
  Zap,
} from "lucide-react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, WMSTileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import {
  buscarAerodromos,
  buscarCartas,
  buscarClima,
  buscarRotaer,
  buscarSol,
  calcularPlanoVoo,
  type AerodromoOption,
  type AirportDetail,
  type ChartResponse,
  type FlightPlanResponse,
  type SolarResponse,
  type WeatherResponse,
} from "@/lib/flightplan-api";
import {
  buscarChecklistPlanoVoo,
  buscarPainelAgendamento,
  buscarPlanosVoo,
  buscarPrecosAbastecimento,
  enviarPdfPlanoVoo,
  salvarChecklistPlanoVoo,
  salvarPlanoVoo,
  type AeronaveAgendamento,
  type PainelAgendamentoResponse,
  type PlanoVooSalvo,
  type PrecoAbastecimento,
  type ChecklistPlanoVoo,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";
import {
  CabecalhoSecao,
  EtiquetaStatus,
  EstadoVazio,
  IndicadorPagina,
} from "@/components/dashboard/ComponentesDashboard";
import NotamLeituraAjuda from "@/components/plano/NotamLeituraAjuda";
import { jsPDF } from "jspdf";

type FlightPlanForm = {
  existingFlightId: string;
  flightNumber: string;
  aircraftId: string;
  aircraftRegistration: string;
  aircraftType: string;
  aircraftCount: string;
  wakeCategory: string;
  flightRules: string;
  flightType: string;
  departure: string;
  destination: string;
  date: string;
  eobt: string;
  pilotId: string;
  copilotId: string;
  cruiseSpeed: string;
  fuelType: string;
  fuelBurn: string;
  enduranceHours: string;
  reserveMin: string;
  taxiMin: string;
  alternate: string;
  equipment: string;
  route: string;
  remarks: string;
};

type GeneratedData = {
  response: FlightPlanResponse;
  departureAirport: AirportDetail | null;
  destinationAirport: AirportDetail | null;
  departureWeather: WeatherResponse | null;
  destinationWeather: WeatherResponse | null;
  departureCharts: ChartResponse[];
  destinationCharts: ChartResponse[];
  departureSolar: SolarResponse | null;
  destinationSolar: SolarResponse | null;
  departureFuelPrices: { fornecedores: PrecoAbastecimento[]; historico: PrecoAbastecimento[] } | null;
  destinationFuelPrices: { fornecedores: PrecoAbastecimento[]; historico: PrecoAbastecimento[] } | null;
};

const DEFAULT_AIRPORTS = [
  { id: "SBSP", label: "SBSP · São Paulo / Congonhas", name: "São Paulo / Congonhas", city: "São Paulo" },
  { id: "SBGR", label: "SBGR · São Paulo / Guarulhos", name: "São Paulo / Guarulhos", city: "São Paulo" },
  { id: "SBRJ", label: "SBRJ · Rio de Janeiro / Santos Dumont", name: "Rio de Janeiro / Santos Dumont", city: "Rio de Janeiro" },
  { id: "SBGL", label: "SBGL · Rio de Janeiro / Galeão", name: "Rio de Janeiro / Galeão", city: "Rio de Janeiro" },
  { id: "SBBR", label: "SBBR · Brasília", name: "Brasília", city: "Brasília" },
  { id: "SBCF", label: "SBCF · Belo Horizonte / Confins", name: "Belo Horizonte / Confins", city: "Belo Horizonte" },
  { id: "SBCY", label: "SBCY · Cuiabá", name: "Cuiabá", city: "Cuiabá" },
  { id: "SBPA", label: "SBPA · Porto Alegre", name: "Porto Alegre", city: "Porto Alegre" },
];

const RULE_OPTIONS = [
  { id: "I", label: "I · IFR — voo totalmente IFR" },
  { id: "V", label: "V · VFR — voo totalmente VFR" },
  { id: "Y", label: "Y · IFR inicialmente, depois mudança" },
  { id: "Z", label: "Z · VFR inicialmente, depois mudança" },
];

const FLIGHT_TYPE_OPTIONS = [
  { id: "S", label: "S · Transporte Aéreo Regular" },
  { id: "G", label: "G · Aviação Geral" },
  { id: "N", label: "N · Transporte Aéreo Não Regular" },
  { id: "M", label: "M · Aeronave Militar" },
  { id: "X", label: "X · Distinto dos indicadores" },
];

const WAKE_OPTIONS = [
  { id: "J", label: "J · Super · A380" },
  { id: "H", label: "H · Pesada · ≥ 136.000 kg" },
  { id: "M", label: "M · Média · 7.000–136.000 kg" },
  { id: "L", label: "L · Leve · < 7.000 kg" },
];

const inputClass = "h-10 rounded-lg border-border/70 bg-background/70 text-sm shadow-sm";
const textareaClass = "min-h-[88px] rounded-lg border-border/70 bg-background/70 text-sm shadow-sm";
const CHECKLIST_PLANO_ITENS = [
  { id: "plano_passado", label: "Plano de voo passado e conferido" },
  { id: "abastecimento", label: "Abastecimento e custo conferidos" },
  { id: "meteorologia", label: "METAR/TAF e nascer/pôr do sol avaliados" },
  { id: "cartas", label: "Cartas AISWEB consultadas" },
  { id: "rotaer", label: "ROTAER, pista e regulamentos locais conferidos" },
  { id: "notam", label: "NOTAMs e obstáculos avaliados" },
  { id: "alternado", label: "Alternado e performance revisados" },
] as const;

type ChecklistPlanoItem = { concluido: boolean; observacao: string };
type ChecklistPlanoItens = Record<string, ChecklistPlanoItem>;

function itensChecklistPlano(itens?: Record<string, unknown> | null): ChecklistPlanoItens {
  return Object.fromEntries(CHECKLIST_PLANO_ITENS.map(({ id }) => {
    const valor = itens?.[id] as Partial<ChecklistPlanoItem> | undefined;
    return [id, { concluido: Boolean(valor?.concluido), observacao: String(valor?.observacao || "") }];
  }));
}

function initialForm(): FlightPlanForm {
  const date = new Date().toISOString().slice(0, 10);
  return {
    existingFlightId: "",
    flightNumber: "",
    aircraftId: "",
    aircraftRegistration: "",
    aircraftType: "",
    aircraftCount: "1",
    wakeCategory: "L",
    flightRules: "V",
    flightType: "G",
    departure: "",
    destination: "",
    date,
    eobt: "",
    pilotId: "",
    copilotId: "",
    cruiseSpeed: "120",
    fuelType: "AVGAS 100LL",
    fuelBurn: "36",
    enduranceHours: "4.5",
    reserveMin: "45",
    taxiMin: "10",
    alternate: "",
    equipment: "S",
    route: "",
    remarks: "",
  };
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-bold uppercase tracking-[.07em] text-muted-foreground">{label}</Label>
        {hint && <span className="text-[9px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function selectItems(items: Array<{ id: string; label: string }>) {
  return items;
}

function formatFlightTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  return `${Math.floor(safeMinutes / 60)}h${String(safeMinutes % 60).padStart(2, "0")}m`;
}

function formatNumber(value: number | null | undefined, suffix = "") {
  return value == null || Number.isNaN(value) ? "—" : `${value}${suffix}`;
}

function formatAirportName(airport: AirportDetail | null, fallback: string) {
  if (!airport) return fallback;
  return [airport.icao, airport.name || airport.city].filter(Boolean).join(" · ");
}

function weatherWind(weather: WeatherResponse | null) {
  if (!weather?.wind) return "—";
  const direction = weather.wind.variable ? "VRB" : `${String(weather.wind.direction_deg ?? 0).padStart(3, "0")}°`;
  const gust = weather.wind.gust_kt ? ` G${weather.wind.gust_kt}` : "";
  return `${direction} ${weather.wind.speed_kt ?? "—"} kt${gust}`;
}

function weatherLabel(weather: WeatherResponse | null) {
  if (!weather) return "Sem METAR";
  return `${formatNumber(weather.temperature_c, "°C")} · ${weatherWind(weather)}`;
}

function SelectField({
  label,
  value,
  items,
  onChange,
  placeholder,
  hint,
  allowFreeText = false,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  items: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
  allowFreeText?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <SearchableCombobox
        items={items}
        value={value}
        onChange={(next) => onChange(next)}
        placeholder={placeholder}
        searchPlaceholder={`Buscar ${label.toLowerCase()}...`}
        emptyMessage="Nenhuma opção encontrada."
        allowFreeText={allowFreeText}
        disabled={disabled}
        className="h-10 rounded-lg bg-background/70 text-sm"
      />
    </Field>
  );
}

function distanceNm(from: [number, number], to: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to[0] - from[0]);
  const dLon = toRad(to[1] - from[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(from: [number, number], to: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;
  const y = Math.sin(toRad(to[1] - from[1])) * Math.cos(toRad(to[0]));
  const x = Math.cos(toRad(from[0])) * Math.sin(toRad(to[0])) - Math.sin(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.cos(toRad(to[1] - from[1]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function WeatherRadarLayer() {
  const map = useMap();
  const [radarTime, setRadarTime] = useState<number | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    if (map.getZoom() < 5) map.setZoom(5);
    const updateZoom = () => setZoom(map.getZoom());
    map.on('zoomend', updateZoom);
    return () => { map.off('zoomend', updateZoom); };
  }, [map]);
  useEffect(() => {
    let active = true;
    fetch('https://api.rainviewer.com/public/weather-maps.json').then((response) => response.json()).then((data: any) => {
      const frames = [...(data?.radar?.past || []), ...(data?.radar?.nowcast || [])];
      const last = frames.at(-1)?.time;
      if (active && typeof last === 'number') setRadarTime(last);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!radarTime || zoom < 5) return null;
  return <TileLayer minZoom={5} url={`https://tilecache.rainviewer.com/v2/radar/${radarTime}/256/{z}/{x}/{y}/2/1_1.png`} opacity={0.48} zIndex={450} attribution='Radar: RainViewer' />;
}

function MeasureLayer({ points, onChange }: { points: [number, number][]; onChange: (points: [number, number][]) => void }) {
  useMapEvents({ click(event) { const next: [number, number] = [event.latlng.lat, event.latlng.lng]; onChange(points.length >= 2 ? [next] : [...points, next]); } });
  return <>{points.map((point, index) => <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={6} pathOptions={{ color: '#f1c348', fillColor: '#f1c348', fillOpacity: 1 }}><Tooltip permanent direction="top">P{index + 1}</Tooltip></CircleMarker>)}{points.length === 2 && <Polyline positions={points as [[number, number], [number, number]]} pathOptions={{ color: '#f1c348', weight: 3, dashArray: '6 6' }} />}</>;
}

function RouteViewport({ positions }: { positions: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(positions, { padding: [80, 80], maxZoom: 4 }); }, [map, positions]);
  return null;
}

function RouteMap({ data, className = "" }: { data: GeneratedData; className?: string }) {
  const response = data.response;
  const positions = useMemo<[[number, number], [number, number]]>(() => [[response.departure.lat, response.departure.lon], [response.destination.lat, response.destination.lon]], [response.departure.lat, response.departure.lon, response.destination.lat, response.destination.lon]);
  const center = useMemo<[number, number]>(() => [(response.departure.lat + response.destination.lat) / 2, (response.departure.lon + response.destination.lon) / 2], [response.departure.lat, response.destination.lat, response.departure.lon, response.destination.lon]);
  const mapKey = `${response.departure.icao}-${response.destination.icao}`;
  const [baseLayer, setBaseLayer] = useState<'mapa' | 'terreno' | 'satelite'>('mapa');
  const [showAirspace, setShowAirspace] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const measure = measurePoints.length === 2 ? { distance: distanceNm(measurePoints[0], measurePoints[1]), bearing: bearingDegrees(measurePoints[0], measurePoints[1]) } : null;
  const tileUrl = baseLayer === 'satelite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : baseLayer === 'terreno' ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  return <div className={`relative overflow-hidden rounded-xl border border-border bg-[#0b1725] ${className}`}><MapContainer key={mapKey} center={center} zoom={4} scrollWheelZoom className="h-[min(72vh,680px)] min-h-[520px] w-full"><RouteViewport positions={positions} /><TileLayer attribution={baseLayer === 'satelite' ? 'Tiles &copy; Esri' : baseLayer === 'terreno' ? '&copy; OpenTopoMap' : '&copy; OpenStreetMap'} url={tileUrl} />{showAirspace && <WMSTileLayer url="https://geoaisweb.decea.mil.br/geoserver/ows" params={{ layers: 'ICA:airspace,ICA:airway', format: 'image/png', transparent: true, version: '1.1.1' }} opacity={0.58} />}{showWeather && <WeatherRadarLayer />}<Polyline positions={positions} pathOptions={{ color: '#4aa3f0', weight: 4, dashArray: '10 8' }} /><CircleMarker center={positions[0]} radius={8} pathOptions={{ color: '#66d190', fillColor: '#66d190', fillOpacity: 0.95 }}><Tooltip permanent direction="top" offset={[0, -7]}>{response.departure.icao}</Tooltip></CircleMarker><CircleMarker center={positions[1]} radius={8} pathOptions={{ color: '#f1c348', fillColor: '#f1c348', fillOpacity: 0.95 }}><Tooltip permanent direction="top" offset={[0, -7]}>{response.destination.icao}</Tooltip></CircleMarker><MeasureLayer points={measurePoints} onChange={setMeasurePoints} /></MapContainer><div className="absolute left-3 top-16 z-[500] max-w-[260px] rounded-lg border border-white/10 bg-[#081321]/90 px-3 py-2 backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#78bdf4]">Rota sugerida</p><p className="mt-1 max-w-[250px] font-mono text-[11px] text-white">{response.flightplan.route}</p><p className="mt-1 text-[9px] text-white/60">{response.flightplan.route_source === 'AISWEB/DECEA' ? 'AISWEB / DECEA' : 'Direta / fallback'}</p></div><div className="absolute right-3 top-3 z-[500] flex max-w-[220px] flex-wrap justify-end gap-1.5 rounded-lg border border-white/10 bg-[#081321]/90 p-2 backdrop-blur"><span className="w-full px-1 pb-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/60">Camadas e cartas</span>{(['mapa', 'terreno', 'satelite'] as const).map((layer) => <button key={layer} type="button" onClick={() => setBaseLayer(layer)} className={`rounded-md px-2 py-1 text-[9px] font-bold ${baseLayer === layer ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-white/75 hover:bg-white/20'}`}>{layer === 'satelite' ? 'Satélite' : layer[0].toUpperCase() + layer.slice(1)}</button>)}<button type="button" onClick={() => setShowAirspace((value) => !value)} className={`rounded-md px-2 py-1 text-[9px] font-bold ${showAirspace ? 'bg-[#62c7a0] text-[#061b16]' : 'bg-white/10 text-white/75 hover:bg-white/20'}`}>Espaço aéreo</button><button type="button" onClick={() => setShowWeather((value) => !value)} className={`rounded-md px-2 py-1 text-[9px] font-bold ${showWeather ? 'bg-[#7bb8ed] text-[#061521]' : 'bg-white/10 text-white/75 hover:bg-white/20'}`}>Meteo ao vivo</button><button type="button" onClick={() => setMeasurePoints([])} className="rounded-md bg-white/10 px-2 py-1 text-[9px] font-bold text-white/75 hover:bg-white/20">Limpar régua</button></div>{measure && <div className="absolute bottom-3 left-3 z-[500] rounded-lg border border-[#f1c348]/40 bg-[#081321]/90 px-3 py-2 text-[10px] text-white shadow-lg backdrop-blur"><p className="font-bold text-[#f1c348]">Régua de navegação</p><p className="mt-1 font-mono">Proa {String(Math.round(measure.bearing)).padStart(3, '0')}° · {measure.distance.toFixed(1)} NM</p><p className="text-[9px] text-white/60">Clique em dois pontos do mapa para medir.</p></div>}{!measure && <p className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md bg-[#081321]/75 px-2 py-1 text-[9px] text-white/70">Régua: clique em dois pontos</p>}</div>;
}

function WeatherCard({ title, icao, weather }: { title: string; icao: string; weather: WeatherResponse | null }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{title}</p>
          <h3 className="mt-1 font-mono text-sm font-bold">{icao}</h3>
        </div>
        <CloudSun size={17} className="text-[#f1c348]" />
      </div>
      {weather ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
          <WeatherMetric label="Temperatura" value={formatNumber(weather.temperature_c, "°C")} />
          <WeatherMetric label="Ponto de orvalho" value={formatNumber(weather.dew_point_c, "°C")} />
          <WeatherMetric label="Vento" value={weatherWind(weather)} />
          <WeatherMetric label="QNH" value={formatNumber(weather.qnh_hpa, " hPa")} />
        </div>
      ) : (
        <p className="mt-4 text-[10px] text-muted-foreground">METAR indisponível no momento. Consulte novamente antes do despacho.</p>
      )}
      {weather?.metar && <p className="mt-4 break-words rounded-lg bg-secondary/60 p-2 font-mono text-[9px] leading-relaxed text-muted-foreground">METAR · {weather.metar}</p>}
      {weather?.taf && <p className="mt-2 break-words rounded-lg bg-secondary/40 p-2 font-mono text-[9px] leading-relaxed text-muted-foreground">TAF · {weather.taf}</p>}
    </div>
  );
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-secondary/30 p-2"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-[11px] font-bold">{value}</p></div>;
}

function ChartsList({ title, charts }: { title: string; charts: ChartResponse[] }) {
  const [selectedChart, setSelectedChart] = useState<ChartResponse | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">Cartas AISWEB</p><h3 className="mt-1 text-sm font-bold">{title}</h3></div>
        <MapPinned size={16} className="text-primary" />
      </div>
      {charts.length ? (
        <div className="mt-3 space-y-2">
          {charts.map((chart, index) => {
            const available = Boolean(chart.url);
            const previewUrl = available ? `/api/charts/preview?url=${encodeURIComponent(chart.url)}` : "";
            const downloadUrl = available ? `${previewUrl}&download=1` : "";
            const selected = selectedChart?.url === chart.url && selectedChart?.title === chart.title;
            return <div key={`${chart.url}-${index}`} className={`rounded-lg border bg-secondary/25 p-3 transition-colors ${selected ? "border-primary/50" : "border-border/70"}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block truncate text-[10px] font-bold">{chart.title || "Carta aeronáutica"}</span><span className="mt-1 block truncate text-[9px] text-muted-foreground">{[chart.tipo, chart.descricao].filter(Boolean).join(" · ") || "Documento aeronáutico AISWEB"}</span></div><MapPinned size={13} className="shrink-0 text-primary" /></div>
              <div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!available} onClick={() => setSelectedChart(selected ? null : chart)} className="h-7 gap-1.5 border-border bg-transparent px-2.5 text-[10px]"><ExternalLink size={12} />{selected ? "Fechar visualização" : "Visualizar na página"}</Button>{available && <a href={downloadUrl} download target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"><Download size={12} /> Baixar</a>}</div>
              {selected && <div className="mt-3 overflow-hidden rounded-lg border border-border bg-[#0b1725]"><iframe title={`Visualização ${chart.title || "carta aeronáutica"}`} src={previewUrl} className="h-[420px] w-full" /></div>}
            </div>;
          })}
        </div>
      ) : <p className="mt-4 text-[10px] text-muted-foreground">Nenhuma carta retornada para este aeródromo. A consulta oficial permanece disponível no AISWEB.</p>}
    </div>
  );
}

function valorOperacional(valor: unknown) {
  if (valor == null || valor === "") return "Não informado";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (Array.isArray(valor)) return valor.length ? valor.map((item) => valorOperacional(item)).join(" · ") : "Nenhum registro";
  return JSON.stringify(valor);
}

function AirportBriefingCard({ title, airport, solar, fuelPrices }: { title: string; airport: AirportDetail | null; solar: SolarResponse | null; fuelPrices: GeneratedData["departureFuelPrices"] }) {
  const operational = airport?.operational;
  const sun = solar?.solar?.[0];
  const prices = [...(fuelPrices?.fornecedores || []), ...(fuelPrices?.historico || [])];
  return <section className="rounded-xl border border-border bg-card/70 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">AISWEB / ROTAER</p><h3 className="mt-1 text-sm font-bold">{title} · {airport?.icao || "—"}</h3><p className="mt-1 text-[10px] text-muted-foreground">{airport?.name || airport?.city || "Ficha do aeródromo"} · {airport?.state || ""}</p></div><Plane size={16} className="text-primary" /></div>
    <div className="mt-4 grid gap-2 text-[10px] sm:grid-cols-2"><WeatherMetric label="Coordenadas" value={airport?.coordinates ? `${airport.coordinates.lat}, ${airport.coordinates.lng}` : "—"} /><WeatherMetric label="Elevação" value={String(airport?.elevation || "—")} /><WeatherMetric label="Nascer UTC" value={sun?.sunrise || "—"} /><WeatherMetric label="Pôr UTC" value={sun?.sunset || "—"} /></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><OperationalField icon={<Route size={13} />} label="Pistas" value={airport?.runways} /><OperationalField icon={<ShieldCheck size={13} />} label="OPEA" value={operational?.opea || airport?.opea} /><OperationalField icon={<AlertTriangle size={13} />} label="Obstáculos" value={operational?.obstacles || airport?.obstacles} /><OperationalField icon={<Lightbulb size={13} />} label="Outras iluminações" value={operational?.other_lighting || airport?.other_lighting} /><OperationalField icon={<Zap size={13} />} label="Energia secundária" value={operational?.secondary_power || airport?.secondary_power} /><OperationalField icon={<FileText size={13} />} label="Regulamentos locais" value={operational?.local_regulations || airport?.local_regulations} /></div>
    <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[.05] p-3"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-amber-300"><Fuel size={13} /> Abastecimento · valores informativos</p>{prices.length ? <div className="mt-2 space-y-1.5">{prices.slice(0, 4).map((price, index) => <div key={`${price.id || price.fornecedor || price.data}-${index}`} className="flex items-center justify-between gap-2 text-[10px]"><span className="min-w-0 truncate">{price.fornecedor || "Fornecedor não informado"} · {price.origem === "abastecimento_historico" ? `histórico ${price.data || ""}` : "cadastro"}</span><strong className="shrink-0 font-mono">R$ {Number(price.valor_unitario || 0).toFixed(2)}/L</strong></div>)}</div> : <p className="mt-2 text-[10px] text-muted-foreground">Nenhum preço cadastrado ou abastecimento histórico encontrado para este aeródromo.</p>}</div>
    {airport?.raw_data && <details className="mt-3 rounded-lg border border-border/70 bg-secondary/20 p-3"><summary className="cursor-pointer text-[10px] font-bold text-primary">Ver retorno bruto AISWEB/AIP</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-relaxed text-muted-foreground">{JSON.stringify(airport.raw_data, null, 2)}</pre></details>}
  </section>;
}

function OperationalField({ icon, label, value }: { icon: React.ReactNode; label: string; value: unknown }) {
  return <div className="min-w-0 rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{icon}{label}</p><p className="mt-1 break-words text-[10px] leading-relaxed">{valorOperacional(value)}</p></div>;
}

function ChecklistPlanoCard({ planId, checklist, onSaved, onError, onGeneratePdf, generatingPdf }: { planId: string | null; checklist: ChecklistPlanoVoo | null; onSaved: (value: ChecklistPlanoVoo) => void; onError: (message: string) => void; onGeneratePdf: () => void; generatingPdf: boolean }) {
  const [itens, setItens] = useState<ChecklistPlanoItens>(() => itensChecklistPlano(checklist?.itens));
  const [observacoes, setObservacoes] = useState(checklist?.observacoes || "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setItens(itensChecklistPlano(checklist?.itens)); setObservacoes(checklist?.observacoes || ""); }, [checklist]);
  const concluido = CHECKLIST_PLANO_ITENS.every(({ id }) => itens[id]?.concluido);
  const salvar = async (status: "rascunho" | "concluido") => {
    if (!planId) return;
    setSalvando(true);
    try {
      const result = await salvarChecklistPlanoVoo(planId, { itens, observacoes, status });
      onSaved({ id: result.id, plano_voo_id: planId, itens, observacoes, status: result.status, atualizado_em: result.atualizado_em });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Não foi possível salvar o checklist.");
    } finally {
      setSalvando(false);
    }
  };
  return <section className="rounded-xl border border-primary/25 bg-primary/[.04] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-primary"><CheckCircle2 size={14} /> Checklist do plano</p><h3 className="mt-1 text-sm font-bold">Conferências antes de liberar o voo</h3><p className="mt-1 text-[10px] text-muted-foreground">Marque cada item e registre observações operacionais.</p></div><EtiquetaStatus tone={concluido ? "green" : "amber"}>{checklist?.status === "concluido" ? "Concluído" : "Rascunho"}</EtiquetaStatus></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2">{CHECKLIST_PLANO_ITENS.map(({ id, label }) => <div key={id} className="rounded-lg border border-border/70 bg-card/60 p-3"><label className="flex items-start gap-2 text-[10px] font-semibold"><input type="checkbox" checked={Boolean(itens[id]?.concluido)} onChange={(event) => setItens((current) => ({ ...current, [id]: { ...current[id], concluido: event.target.checked } }))} className="mt-0.5 accent-primary" />{label}</label><Input value={itens[id]?.observacao || ""} onChange={(event) => setItens((current) => ({ ...current, [id]: { ...current[id], observacao: event.target.value } }))} placeholder="Observação opcional" className="mt-2 h-8 text-[10px]" /></div>)}</div>
    <Textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Observações gerais do piloto ou despacho" className="mt-3 min-h-20 text-xs" />
    <div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => void salvar("rascunho")} disabled={salvando || !planId} className="h-9 gap-2 text-[10px]">Salvar rascunho</Button><Button type="button" onClick={() => void salvar("concluido")} disabled={salvando || !planId || !concluido} className="h-9 gap-2 text-[10px]"><CheckCircle2 size={14} />{salvando ? "Salvando..." : "Concluir checklist"}</Button><Button type="button" variant="outline" onClick={onGeneratePdf} disabled={generatingPdf || !planId} className="h-9 gap-2 text-[10px]"><Download size={14} />{generatingPdf ? "Gerando PDF..." : "Baixar e salvar PDF"}</Button></div>
  </section>;
}

type ResultPanel = "cartas" | "rotaer" | "notam" | "meteorologia" | "checklist";

const RESULT_PANEL_OPTIONS: Array<{ id: ResultPanel; label: string; icon: React.ReactNode }> = [
  { id: "cartas", label: "Ver cartas", icon: <MapPinned size={16} /> },
  { id: "rotaer", label: "ROTAER / pistas", icon: <Route size={16} /> },
  { id: "notam", label: "NOTAM", icon: <AlertTriangle size={16} /> },
  { id: "meteorologia", label: "Meteorologia", icon: <CloudSun size={16} /> },
  { id: "checklist", label: "Checklist do plano", icon: <CheckCircle2 size={16} /> },
];

function PlanResultPanel({ panel, data, planId, checklist, onChecklistSaved, onError, onGeneratePdf, generatingPdf }: { panel: ResultPanel; data: GeneratedData; planId: string | null; checklist: ChecklistPlanoVoo | null; onChecklistSaved: (value: ChecklistPlanoVoo) => void; onError: (message: string) => void; onGeneratePdf: () => void; generatingPdf: boolean }) {
  const { response } = data;
  if (panel === "cartas") return <div className="space-y-3"><ChartsList title={`Cartas de ${response.departure.icao}`} charts={data.departureCharts} /><ChartsList title={`Cartas de ${response.destination.icao}`} charts={data.destinationCharts} /></div>;
  if (panel === "rotaer") return <div className="space-y-3"><AirportBriefingCard title="Origem" airport={data.departureAirport} solar={data.departureSolar} fuelPrices={data.departureFuelPrices} /><AirportBriefingCard title="Destino" airport={data.destinationAirport} solar={data.destinationSolar} fuelPrices={data.destinationFuelPrices} /></div>;
  if (panel === "meteorologia") return <div className="space-y-3"><WeatherCard title="Meteorologia de saída" icao={response.departure.icao} weather={data.departureWeather} /><WeatherCard title="Meteorologia de destino" icao={response.destination.icao} weather={data.destinationWeather} /></div>;
  if (panel === "checklist") return <ChecklistPlanoCard planId={planId} checklist={checklist} onSaved={onChecklistSaved} onError={onError} onGeneratePdf={onGeneratePdf} generatingPdf={generatingPdf} />;
  return <div className="space-y-3"><NotamLeituraAjuda /><section className="rounded-xl border border-[#f1c348]/30 bg-card/70 p-4"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-[#f1c348]" /><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#f1c348]">NOTAMs agregados</p><h3 className="mt-1 text-sm font-bold">Alertas da rota</h3></div></div>{response.notam_alerts.length > 0 ? <div className="mt-4 space-y-2">{response.notam_alerts.map((notam) => <div key={notam.id} className="rounded-lg border border-border/70 bg-secondary/25 p-3"><p className="font-mono text-[10px] font-bold">{notam.number || "NOTAM"}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{notam.message}</p></div>)}</div> : <p className="mt-4 text-[10px] text-muted-foreground">Nenhum NOTAM foi retornado para esta consulta.</p>}</section></div>;
}

function PlanResultSidebar({ panel, onToggle, data, planId, checklist, onChecklistSaved, onError, onGeneratePdf, generatingPdf }: { panel: ResultPanel | null; onToggle: (panel: ResultPanel) => void; data: GeneratedData; planId: string | null; checklist: ChecklistPlanoVoo | null; onChecklistSaved: (value: ChecklistPlanoVoo) => void; onError: (message: string) => void; onGeneratePdf: () => void; generatingPdf: boolean }) {
  return <aside className="min-w-0 rounded-xl border border-border bg-card/70 p-1.5">{panel && <div className="flex items-center justify-between gap-2 px-1.5 pb-2"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Camadas do plano</p><p className="mt-1 text-[10px] text-muted-foreground">Clique para abrir ou fechar</p></div><button type="button" onClick={() => onToggle(panel)} aria-label="Fechar painel" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><XCircle size={15} /></button></div>}<div className="grid gap-1.5">{RESULT_PANEL_OPTIONS.map((option) => <button key={option.id} type="button" title={option.label} aria-label={option.label} onClick={() => onToggle(option.id)} aria-pressed={panel === option.id} className={`h-10 w-10 shrink-0 rounded-full border p-0 transition-colors ${panel === option.id ? "border-primary/50 bg-primary/15 text-primary" : "border-border/70 bg-secondary/20 text-muted-foreground hover:border-primary/30 hover:bg-primary/[.06] hover:text-foreground"}`}>{option.icon}</button>)}</div>{panel && <div className="mt-3 max-h-[calc(72vh-20px)] overflow-y-auto border-t border-border pt-3"><PlanResultPanel panel={panel} data={data} planId={planId} checklist={checklist} onChecklistSaved={onChecklistSaved} onError={onError} onGeneratePdf={onGeneratePdf} generatingPdf={generatingPdf} /></div>}</aside>;
}

function PlanoSalvoCard({ plan, disabled, onOpen }: { plan: PlanoVooSalvo; disabled: boolean; onOpen: () => void }) {
  return <article className="rounded-xl border border-border/70 bg-background/30 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold text-primary">{plan.numero_voo || "Sem número"}</p><p className="mt-1 font-mono text-[10px] font-semibold">{plan.adep} → {plan.ades}</p></div><span className="text-right text-[10px] text-muted-foreground">{plan.data_voo || "Data não informada"}</span></div><p className="mt-2 text-[10px] text-muted-foreground">EOBT {plan.eobt || "UTC a definir"} · salvo em {new Date(plan.created_at).toLocaleDateString("pt-BR")}</p><Button type="button" variant="outline" onClick={onOpen} disabled={disabled} className="mt-3 h-9 w-full gap-1.5 border-border bg-transparent text-[10px]"><FolderOpen size={13} /> Abrir plano</Button></article>;
}

function OperationalResult({ data, form, onSave, onBack, saving, saved, planId, checklist, onChecklistSaved, onError, onGeneratePdf, generatingPdf }: { data: GeneratedData; form: FlightPlanForm; onSave: () => void; onBack: () => void; saving: boolean; saved: boolean; planId: string | null; checklist: ChecklistPlanoVoo | null; onChecklistSaved: (value: ChecklistPlanoVoo) => void; onError: (message: string) => void; onGeneratePdf: () => void; generatingPdf: boolean }) {
  const response = data.response;
  const speed = Math.max(Number(form.cruiseSpeed) || response.flightplan.cruise_speed || 1, 1);
  const burn = Math.max(Number(form.fuelBurn) || response.fuel.burn_lh || 1, 1);
  const endurance = Math.max(Number(form.enduranceHours) || 0, 0);
  const wind = data.departureWeather?.wind?.speed_kt || 0;
  const groundSpeed = Math.max(speed - wind, 1);
  const flightMinutes = (response.flightplan.distance_nm / groundSpeed) * 60;
  const reserveFuel = ((Number(form.reserveMin) || response.fuel.reserve_min) / 60) * burn;
  const taxiFuel = ((Number(form.taxiMin) || 10) / 60) * burn;
  const requiredFuel = (flightMinutes / 60) * burn + reserveFuel + taxiFuel;
  const availableFuel = endurance * burn;
  const marginFuel = availableFuel - requiredFuel;
  const canReach = marginFuel >= 0;
  const suggestedAlternate = response.alternates.find((item) => item.icao !== response.flightplan.ades);
  const [resultPanel, setResultPanel] = useState<ResultPanel | null>(null);

  return (
    <section className="mt-7 space-y-5 route-enter">
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
        <div><IndicadorPagina>Plano calculado</IndicadorPagina><h2 className="text-xl font-extrabold tracking-[-.04em]">Briefing operacional</h2><p className="mt-1 text-[11px] text-muted-foreground">Dados aeronáuticos e meteorológicos consultados no AISWEB/DECEA.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onBack} className="h-9 gap-2 text-xs"><ArrowLeft size={14} /> Editar plano</Button><EtiquetaStatus tone={canReach ? "green" : "red"}>{canReach ? "Autonomia compatível" : "Autonomia insuficiente"}</EtiquetaStatus><Button type="button" onClick={onSave} disabled={saving || saved} className="h-9 gap-2 text-xs">{saving ? <LoaderCircle size={14} className="animate-spin" /> : saved ? <BookmarkCheck size={14} /> : <Save size={14} />}{saved ? "Plano salvo" : "Salvar plano"}</Button></div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4"><WeatherMetric label="Distância" value={`${response.flightplan.distance_nm} NM`} /><WeatherMetric label="Tempo estimado" value={formatFlightTime(flightMinutes)} /><WeatherMetric label="Combustível requerido" value={`${Math.round(requiredFuel)} L`} /><WeatherMetric label="Margem de autonomia" value={`${Math.round(marginFuel)} L`} /></div>

      {response.performance && <section className="rounded-xl border border-primary/25 bg-primary/[.04] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.13em] text-primary">Performance da aeronave</p><h3 className="mt-1 text-sm font-bold">{[response.performance.fabricante, response.performance.modelo].filter(Boolean).join(' · ') || 'Dados cadastrados'}</h3></div><EtiquetaStatus tone="green">Fonte: {response.performance.source === 'performance_aeronave' ? 'performance_aeronave' : 'aeronave'}</EtiquetaStatus></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4"><WeatherMetric label="Cruzeiro" value={`${response.performance.velocidade_cruzeiro_kt} kt`} /><WeatherMetric label="Consumo" value={`${response.performance.consumo_combustivel_lh} L/h`} /><WeatherMetric label="Teto" value={response.performance.teto_servico_ft ? `${response.performance.teto_servico_ft} ft` : '—'} /><WeatherMetric label="Subida" value={response.performance.taxa_subida_fpm ? `${response.performance.taxa_subida_fpm} ft/min` : '—'} /></div></section>}

      <div className={`grid gap-4 xl:items-start ${resultPanel ? "xl:grid-cols-[minmax(0,1fr)_350px]" : "xl:grid-cols-[minmax(0,1fr)_72px]"}`}>
        <div className="min-w-0 space-y-3">
          <RouteMap data={data} />
          <section className="rounded-xl border border-border bg-card/70 p-4"><div className="flex items-center gap-2"><Compass size={16} className="text-primary" /><div><p className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">Rota publicada</p><p className="mt-1 font-mono text-xs font-bold">{response.flightplan.route}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><WeatherMetric label="Origem" value={formatAirportName(data.departureAirport, response.departure.name)} /><WeatherMetric label="Destino" value={formatAirportName(data.destinationAirport, response.destination.name)} /><WeatherMetric label="Fonte da rota" value={response.flightplan.route_source === "AISWEB/DECEA" ? "AISWEB/DECEA" : "Rota direta / fallback"} /><WeatherMetric label="NOTAMs" value={`${response.notam_count} alerta(s)`} /></div></section>
          <section className={`rounded-xl border p-4 ${canReach ? "border-[#5bbd75]/30 bg-[#5bbd75]/[.06]" : "border-[#e77b80]/40 bg-[#e77b80]/[.08]"}`}><div className="flex items-start gap-3">{canReach ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#6bd188]" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-[#ed8c90]" />}<div><p className="text-xs font-bold">{canReach ? "Autonomia dentro do planejamento" : "Revisar autonomia antes do despacho"}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Cálculo conservador usando vento de saída, consumo informado, táxi e reserva de {form.reserveMin} minutos.</p></div></div></section>
          <section className="rounded-xl border border-[#f1c348]/30 bg-[#f1c348]/[.06] p-4"><div className="flex items-start gap-3"><MapPinned size={18} className="mt-0.5 shrink-0 text-[#f4cc64]" /><div><p className="text-xs font-bold">Alternativa sugerida</p><p className="mt-1 font-mono text-sm font-bold">{suggestedAlternate ? `${suggestedAlternate.icao} · ${suggestedAlternate.name}` : "Nenhum alternado retornado"}</p><p className="mt-1 text-[10px] text-muted-foreground">{suggestedAlternate ? `${suggestedAlternate.distance_km} km do destino · validar NOTAM, meteorologia e performance.` : "Consulte a disponibilidade de aeródromos próximos no AISWEB."}</p></div></div></section>
        </div>
        <PlanResultSidebar panel={resultPanel} onToggle={(panel) => setResultPanel((current) => current === panel ? null : panel)} data={data} planId={planId} checklist={checklist} onChecklistSaved={onChecklistSaved} onError={onError} onGeneratePdf={onGeneratePdf} generatingPdf={generatingPdf} />
      </div>
    </section>
  );
}

export default function PlanoDeVoo() {
  const [form, setForm] = useState<FlightPlanForm>(initialForm);
  const [painel, setPainel] = useState<PainelAgendamentoResponse | null>(null);
  const [airports, setAirports] = useState<AerodromoOption[]>(DEFAULT_AIRPORTS);
  const [savedPlans, setSavedPlans] = useState<PlanoVooSalvo[]>([]);
  const [generated, setGenerated] = useState<GeneratedData | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistPlanoVoo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [airportError, setAirportError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof FlightPlanForm>(key: K, value: FlightPlanForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([buscarPainelAgendamento("2000-01-01", "2099-12-31"), buscarAerodromos(), buscarPlanosVoo()]).then((results) => {
      if (!active) return;
      const panelResult = results[0];
      const airportResult = results[1];
      const savedResult = results[2];
      if (panelResult.status === "fulfilled") setPainel(panelResult.value);
      if (airportResult.status === "fulfilled" && airportResult.value.aerodromos.length) setAirports(airportResult.value.aerodromos);
      else setAirportError("Catálogo AISWEB indisponível; usando aeródromos frequentes como referência.");
      if (savedResult.status === "fulfilled") setSavedPlans(savedResult.value);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const flights = useMemo(() => (painel?.agendamentos || []).filter((item) => item.numero_voo), [painel]);
  const aircraft = painel?.aeronaves || [];
  const crew = painel?.tripulacao || [];
  const airportItems = airports.map((item) => ({ id: item.id, label: item.label }));
  const alternateItems = generated?.response.alternates.map((item) => ({ id: item.icao, label: `${item.icao} · ${item.name} · ${item.distance_km} km` })) || [];
  const pilotItems = crew.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac}` }));
  const aircraftItems = aircraft.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${item.fabricante} ${item.modelo}` }));

  const selectExistingFlight = (id: string) => {
    const flight = flights.find((item) => item.id === id);
    if (!flight) return;
    const selectedAircraft = aircraft.find((item) => item.id === flight.aeronave_id);
    const aircraftType = selectedAircraft ? `${selectedAircraft.fabricante} ${selectedAircraft.modelo}`.trim() : form.aircraftType;
    const existingPilot = crew.find((item) => item.id === flight.piloto_id);
    setForm((current) => ({
      ...current,
      existingFlightId: id,
      flightNumber: flight.numero_voo || "",
      aircraftId: flight.aeronave_id || "",
      aircraftRegistration: selectedAircraft?.matricula_registro || flight.matricula_registro || "",
      aircraftType,
      departure: flight.origem || "",
      destination: flight.destino || "",
      date: flight.data_agendada || current.date,
      eobt: flight.horario_previsto_agendamento || "",
      pilotId: existingPilot?.id || flight.piloto_id || "",
      copilotId: flight.copiloto_id || "",
    }));
    setGenerated(null);
    setSavedPlanId(null);
    setChecklist(null);
    setSaved(false);
  };

  const selectAircraft = (id: string) => {
    const item = aircraft.find((aircraftItem) => aircraftItem.id === id);
    update("aircraftId", id);
    if (item) setForm((current) => ({ ...current, aircraftId: id, aircraftRegistration: item.matricula_registro, aircraftType: `${item.fabricante} ${item.modelo}`.trim() || item.tipo_aeronave || current.aircraftType, cruiseSpeed: String(item.performance_velocidade_cruzeiro_kt || item.velocidade_cruzeiro || current.cruiseSpeed), fuelBurn: String(item.consumo_combustivel || current.fuelBurn) }));
  };

  const generatePlan = async () => {
    setError(null);
    setGenerated(null);
    setSavedPlanId(null);
    setChecklist(null);
    setSaved(false);
    const departure = form.departure.trim().toUpperCase();
    const destination = form.destination.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(departure) || !/^[A-Z]{4}$/.test(destination)) {
      setError("Informe ADEP e DEST com códigos ICAO de quatro letras. Você pode pesquisar ou digitar o código no seletor.");
      return;
    }
    if (departure === destination) {
      setError("ADEP e DEST precisam ser aeródromos diferentes.");
      return;
    }
    if (["Y", "Z"].includes(form.flightRules) && !form.route.trim()) {
      setError("Para regras Y ou Z, informe a rota e os pontos de mudança no Item 15/18.");
      return;
    }
    setGenerating(true);
    try {
      const response = await calcularPlanoVoo({ adep: departure, ades: destination, speed: Number(form.cruiseSpeed) || 120, fuelBurn: Number(form.fuelBurn) || 36, reserveMin: Number(form.reserveMin) || 45, aircraftId: form.aircraftId || undefined });
      const [departureAirport, destinationAirport, departureWeather, destinationWeather, departureCharts, destinationCharts, departureSolar, destinationSolar, departureFuelPrices, destinationFuelPrices] = await Promise.all([
        buscarRotaer(departure).then((result) => result.airport).catch(() => null),
        buscarRotaer(destination).then((result) => result.airport).catch(() => null),
        buscarClima(departure).catch(() => null),
        buscarClima(destination).catch(() => null),
        buscarCartas(departure).then((result) => result.charts || []).catch(() => []),
        buscarCartas(destination).then((result) => result.charts || []).catch(() => []),
        buscarSol(departure, form.date).catch(() => null),
        buscarSol(destination, form.date).catch(() => null),
        buscarPrecosAbastecimento(departure, form.fuelType).catch(() => null),
        buscarPrecosAbastecimento(destination, form.fuelType).catch(() => null),
      ]);
      setForm((current) => ({ ...current, route: response.flightplan.route }));
      setGenerated({ response, departureAirport, destinationAirport, departureWeather, destinationWeather, departureCharts, destinationCharts, departureSolar, destinationSolar, departureFuelPrices, destinationFuelPrices });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível calcular o plano com o AISWEB.");
    } finally {
      setGenerating(false);
    }
  };

  const openSavedPlan = async (plan: PlanoVooSalvo) => {
    const payload = plan.payload || {};
    const savedForm = (payload.form || {}) as Partial<FlightPlanForm>;
    const selectedAircraft = aircraft.find((item) => item.id === savedForm.aircraftId);
    const restoredForm: FlightPlanForm = {
      ...initialForm(),
      ...savedForm,
      existingFlightId: '',
      flightNumber: plan.numero_voo || savedForm.flightNumber || '',
      aircraftId: savedForm.aircraftId || '',
      aircraftRegistration: selectedAircraft?.matricula_registro || savedForm.aircraftRegistration || '',
      aircraftType: selectedAircraft ? `${selectedAircraft.fabricante} ${selectedAircraft.modelo}`.trim() : savedForm.aircraftType || '',
      departure: plan.adep || savedForm.departure || '',
      destination: plan.ades || savedForm.destination || '',
      date: plan.data_voo || savedForm.date || initialForm().date,
      eobt: plan.eobt || savedForm.eobt || '',
    };
    if (selectedAircraft) {
      restoredForm.cruiseSpeed = String(selectedAircraft.performance_velocidade_cruzeiro_kt || selectedAircraft.velocidade_cruzeiro || restoredForm.cruiseSpeed);
      restoredForm.fuelBurn = String(selectedAircraft.consumo_combustivel || restoredForm.fuelBurn);
    }
    setForm(restoredForm);
    setSavedPlanId(plan.id);
    setSaved(true);
    setGenerated(null);
    setChecklist(null);
    void buscarChecklistPlanoVoo(plan.id).then(setChecklist).catch(() => setChecklist(null));
    setError(null);
    setGenerating(true);
    try {
      const response = await calcularPlanoVoo({ adep: restoredForm.departure.toUpperCase(), ades: restoredForm.destination.toUpperCase(), speed: Number(restoredForm.cruiseSpeed) || 120, fuelBurn: Number(restoredForm.fuelBurn) || 36, reserveMin: Number(restoredForm.reserveMin) || 45, aircraftId: restoredForm.aircraftId || undefined });
      const [departureAirport, destinationAirport, departureWeather, destinationWeather, departureCharts, destinationCharts, departureSolar, destinationSolar, departureFuelPrices, destinationFuelPrices] = await Promise.all([
        buscarRotaer(restoredForm.departure).then((result) => result.airport).catch(() => null),
        buscarRotaer(restoredForm.destination).then((result) => result.airport).catch(() => null),
        buscarClima(restoredForm.departure).catch(() => null),
        buscarClima(restoredForm.destination).catch(() => null),
        buscarCartas(restoredForm.departure).then((result) => result.charts || []).catch(() => []),
        buscarCartas(restoredForm.destination).then((result) => result.charts || []).catch(() => []),
        buscarSol(restoredForm.departure, restoredForm.date).catch(() => null),
        buscarSol(restoredForm.destination, restoredForm.date).catch(() => null),
        buscarPrecosAbastecimento(restoredForm.departure, restoredForm.fuelType).catch(() => null),
        buscarPrecosAbastecimento(restoredForm.destination, restoredForm.fuelType).catch(() => null),
      ]);
      setForm((current) => ({ ...current, route: response.flightplan.route }));
      setGenerated({ response, departureAirport, destinationAirport, departureWeather, destinationWeather, departureCharts, destinationCharts, departureSolar, destinationSolar, departureFuelPrices, destinationFuelPrices });
    } catch (cause) {
      setError(cause instanceof Error ? `Plano carregado, mas não foi possível atualizar a rota: ${cause.message}` : 'Plano carregado, mas não foi possível atualizar a rota.');
    } finally {
      setGenerating(false);
    }
  };

  const savePlan = async () => {
    if (!generated) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        numero_voo: form.flightNumber || null,
        adep: form.departure.toUpperCase(),
        ades: form.destination.toUpperCase(),
        data_voo: form.date,
        eobt: form.eobt || null,
        form,
        flightplan: generated.response.flightplan,
        performance: generated.response.performance,
        fuel: generated.response.fuel,
        alternates: generated.response.alternates,
        notam_alerts: generated.response.notam_alerts,
        meteorology: { departure: generated.departureWeather, destination: generated.destinationWeather },
        airports: { departure: generated.departureAirport, destination: generated.destinationAirport },
        solar: { departure: generated.departureSolar, destination: generated.destinationSolar, reference: "UTC" },
        charts: { departure: generated.departureCharts, destination: generated.destinationCharts },
        fuel_prices: { departure: generated.departureFuelPrices, destination: generated.destinationFuelPrices, fuel_type: form.fuelType, source: "controle_abastecimento" },
        fetched_at: new Date().toISOString(),
      };
      const result = await salvarPlanoVoo(payload);
      setSaved(true);
      setSavedPlanId(result.id);
      const currentChecklist = await buscarChecklistPlanoVoo(result.id).catch(() => null);
      setChecklist(currentChecklist);
      setSavedPlans((current) => [{ id: result.id, numero_voo: form.flightNumber || null, adep: form.departure.toUpperCase(), ades: form.destination.toUpperCase(), data_voo: form.date, eobt: form.eobt || null, created_at: result.created_at, checklist_status: currentChecklist?.status || "rascunho", payload }, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  const gerarPdfPlano = async () => {
    if (!generated || !savedPlanId) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const margem = 14;
      const largura = 182;
      let y = 16;
      const escrever = (texto: string, tamanho = 9, negrito = false) => {
        pdf.setFont("helvetica", negrito ? "bold" : "normal");
        pdf.setFontSize(tamanho);
        const linhas = pdf.splitTextToSize(texto, largura);
        if (y + linhas.length * 4.5 > 282) { pdf.addPage(); y = 16; }
        pdf.text(linhas, margem, y);
        y += linhas.length * 4.5 + 2;
      };
      const valorOperacional = (valor: unknown) => {
        if (valor == null || valor === "") return "—";
        if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") return String(valor);
        return JSON.stringify(valor).slice(0, 900);
      };
      const aeroporto = (titulo: string, detail: AirportDetail | null, solar: SolarResponse | null, prices: GeneratedData["departureFuelPrices"]) => {
        escrever(titulo, 12, true);
        escrever(`${detail?.icao || "—"} · ${detail?.name || detail?.city || "Aeródromo"}`);
        escrever(`Coordenadas: ${detail?.coordinates ? `${detail.coordinates.lat}, ${detail.coordinates.lng}` : "—"} · Elevação: ${detail?.elevation || "—"}`);
        const sun = solar?.solar?.[0];
        escrever(`Nascer/pôr do sol UTC: ${sun?.sunrise || "—"} / ${sun?.sunset || "—"}`);
        escrever(`Pistas: ${valorOperacional(detail?.runways)}\nOPEA: ${valorOperacional(detail?.operational?.opea || detail?.opea)}\nObstáculos: ${valorOperacional(detail?.operational?.obstacles || detail?.obstacles)}\nOutras iluminações: ${valorOperacional(detail?.operational?.other_lighting || detail?.other_lighting)}\nEnergia secundária: ${valorOperacional(detail?.operational?.secondary_power || detail?.secondary_power)}\nRegulamentos locais: ${valorOperacional(detail?.operational?.local_regulations || detail?.local_regulations)}`);
        escrever(`Preços consultados: ${valorOperacional(prices)}`);
      };
      escrever("PLANO DE VOO · BRIEFING OPERACIONAL", 15, true);
      escrever(`Voo ${form.flightNumber || "sem número"} · ${form.date} · EOBT ${form.eobt || "a definir"} UTC`, 10, true);
      escrever(`${form.departure.toUpperCase()} → ${form.destination.toUpperCase()} · Piloto ${crew.find((item) => item.id === form.pilotId)?.nome_completo || "não informado"}`);
      escrever(`Rota: ${generated.response.flightplan.route}`);
      escrever(`Distância: ${generated.response.flightplan.distance_nm} NM · Tempo: ${generated.response.flightplan.estimated_time} · Combustível requerido: ${Math.round(generated.response.fuel.total_required)} L`);
      aeroporto("ADEP · DADOS AISWEB/ROTAER", generated.departureAirport, generated.departureSolar, generated.departureFuelPrices);
      aeroporto("DEST · DADOS AISWEB/ROTAER", generated.destinationAirport, generated.destinationSolar, generated.destinationFuelPrices);
      escrever("METEOROLOGIA", 12, true);
      escrever(`Saída METAR: ${generated.departureWeather?.metar || "indisponível"}\nDestino METAR: ${generated.destinationWeather?.metar || "indisponível"}`);
      escrever(`TAF saída: ${generated.departureWeather?.taf || "indisponível"}\nTAF destino: ${generated.destinationWeather?.taf || "indisponível"}`);
      escrever("CHECKLIST DO PLANO", 12, true);
      CHECKLIST_PLANO_ITENS.forEach(({ id, label }) => { const item = itensChecklistPlano(checklist?.itens)[id]; escrever(`${item.concluido ? "[x]" : "[ ]"} ${label}${item.observacao ? ` — ${item.observacao}` : ""}`); });
      if (checklist?.observacoes) escrever(`Observações: ${checklist.observacoes}`);
      escrever(`Gerado em ${new Date().toLocaleString("pt-BR")} · Horários solares em UTC · Fonte: AISWEB/DECEA e controle de abastecimento.`);
      const arquivo = new File([pdf.output("blob")], `plano-${form.flightNumber || savedPlanId}.pdf`, { type: "application/pdf" });
      pdf.save(arquivo.name);
      await enviarPdfPlanoVoo(savedPlanId, arquivo);
    } catch (cause) {
      setError(cause instanceof Error ? `PDF baixado, mas não foi possível armazenar: ${cause.message}` : "PDF baixado, mas não foi possível armazenar.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const flightOptions = flights.map((flight) => ({ id: flight.id, label: `${flight.numero_voo} · ${flight.origem} → ${flight.destino} · ${flight.data_agendada}` }));

  return (
    <div className="route-enter space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101c2c] p-6 shadow-[0_18px_55px_rgba(0,0,0,.2)] md:p-8">
        <div className="absolute right-[-8%] top-[-75%] h-[260%] w-[45%] rotate-[18deg] bg-primary/[.08]" />
        <div className="relative">
          <h1 className="max-w-2xl text-[30px] font-extrabold tracking-[-.055em] text-white md:text-[40px]">Plano de voo profissional</h1>
        </div>
      </section>

      {error && <div className="flex items-start gap-3 rounded-xl border border-[#e77b80]/35 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{error}<button type="button" onClick={() => setError(null)} className="ml-2 font-bold underline">Fechar</button></div></div>}
      {airportError && <div className="rounded-xl border border-[#f1c348]/30 bg-[#f1c348]/10 p-3 text-[10px] text-[#f4cc64]">{airportError}</div>}

      <div className={generated ? "hidden" : "space-y-6"}>
      <section className="rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<CalendarClock size={15} />} title="Origem do plano" detail="Use um voo existente para preencher os dados ou comece manualmente." />
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:p-5">
          <Field label="Número de voo existente" hint={loading ? "Carregando..." : `${flightOptions.length} voo(s) disponível(is)`}>
            <SearchableCombobox items={flightOptions} value={form.existingFlightId} onChange={selectExistingFlight} placeholder={loading ? "Carregando voos..." : "Selecionar voo já aprovado"} searchPlaceholder="Buscar número, rota ou data" emptyMessage="Nenhum voo aprovado encontrado." disabled={loading} className="h-11 rounded-lg bg-background/70" />
          </Field>
          <Button type="button" variant="outline" onClick={() => { setForm(initialForm()); setGenerated(null); setSavedPlanId(null); setChecklist(null); setSaved(false); setError(null); }} className="h-11 gap-2 self-end border-border bg-transparent text-xs"><Plane size={14} /> Começar manualmente</Button>
        </div>
        {form.existingFlightId && <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-[#5bbd75]/25 bg-[#5bbd75]/[.06] px-3 py-2.5 text-[10px] text-[#6bd188] md:mx-5"><CheckCircle2 size={14} /> Dados do voo carregados. Revise todos os campos antes de gerar.</div>}
      </section>

      <section className="rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<Plane size={15} />} title="Identificação do voo e da aeronave" detail="Itens 7 e 9 — preenchimento compatível com o plano ICAO." />
        <div className="grid gap-5 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-4">
          <Field label="Número do voo / identificação"><Input value={form.flightNumber} onChange={(event) => update("flightNumber", event.target.value.toUpperCase())} placeholder="Ex.: PT-SHR-0124" className={inputClass} /></Field>
          <Field label="Aeronave da frota"><SearchableCombobox items={aircraftItems} value={form.aircraftId} onChange={selectAircraft} placeholder="Selecionar aeronave" searchPlaceholder="Buscar matrícula ou modelo" emptyMessage="Nenhuma aeronave ativa encontrada." className="h-10 rounded-lg bg-background/70 text-sm" /></Field>
          <Field label="Matrícula"><Input value={form.aircraftRegistration} onChange={(event) => update("aircraftRegistration", event.target.value.toUpperCase())} placeholder="PT-ABC" className={`${inputClass} font-mono`} /></Field>
          <Field label="Tipo de aeronave · fabricante e modelo" hint="Preenchido pela tabela aeronave"><Input value={form.aircraftType} readOnly placeholder="Selecione uma aeronave" className={inputClass} /></Field>
          <Field label="Número de aeronaves" hint="Formação"><Input type="number" min="1" value={form.aircraftCount} onChange={(event) => update("aircraftCount", event.target.value)} className={`${inputClass} font-mono`} /></Field>
          <SelectField label="Esteira de turbulência" value={form.wakeCategory} items={selectItems(WAKE_OPTIONS)} onChange={(value) => update("wakeCategory", value)} placeholder="Categoria" />
          <SelectField label="Regra de voo · Item 8" value={form.flightRules} items={selectItems(RULE_OPTIONS)} onChange={(value) => update("flightRules", value)} placeholder="Selecionar regra" />
          <SelectField label="Tipo de voo · Item 8" value={form.flightType} items={selectItems(FLIGHT_TYPE_OPTIONS)} onChange={(value) => update("flightType", value)} placeholder="Selecionar tipo" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<MapPinned size={15} />} title="Rota, horários e tripulação" detail="Itens 13, 15 e 18 — utilize códigos ICAO e horário UTC." />
        <div className="grid gap-5 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-4">
          <SelectField label="ADEP · saída" value={form.departure} items={airportItems} onChange={(value) => update("departure", value.toUpperCase())} placeholder="Pesquisar aeródromo" allowFreeText hint="ICAO" />
          <SelectField label="DEST · destino" value={form.destination} items={airportItems} onChange={(value) => update("destination", value.toUpperCase())} placeholder="Pesquisar aeródromo" allowFreeText hint="ICAO" />
          <Field label="Data do voo"><Input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} className={inputClass} /></Field>
          <Field label="EOBT · horário UTC"><Input type="time" value={form.eobt} onChange={(event) => update("eobt", event.target.value)} className={`${inputClass} font-mono`} /></Field>
          <SelectField label="Piloto em comando" value={form.pilotId} items={pilotItems} onChange={(value) => update("pilotId", value)} placeholder="Selecionar piloto" hint="CANAC" className="md:col-span-2" />
          <SelectField label="Copiloto" value={form.copilotId} items={pilotItems.filter((item) => item.id !== form.pilotId)} onChange={(value) => update("copilotId", value)} placeholder="Sem copiloto" hint="Opcional" className="md:col-span-2" />
          <Field label="Rota · Item 15" hint="Ex.: DCT ABC UA300 DCT"><Textarea value={form.route} onChange={(event) => update("route", event.target.value.toUpperCase())} placeholder="Será sugerida pelo AISWEB após o cálculo" className={textareaClass} /></Field>
          <Field label="RMK · Item 18" hint="Mudanças Y/Z, TYP/, RALT/"><Textarea value={form.remarks} onChange={(event) => update("remarks", event.target.value.toUpperCase())} placeholder="RMK RALT/..., RMK TYP/..." className={textareaClass} /></Field>
          <Field label="Equipamentos · Item 10" hint="Consulte as abreviaturas"><Input value={form.equipment} onChange={(event) => update("equipment", event.target.value.toUpperCase())} placeholder="Ex.: SDFG/LB1" className={`${inputClass} font-mono`} /></Field>
          <SelectField label="Alternativa preferida" value={form.alternate} items={alternateItems} onChange={(value) => update("alternate", value)} placeholder={generated ? "Selecionar alternado" : "Será sugerida após cálculo"} allowFreeText disabled={!generated} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<Fuel size={15} />} title="Performance e combustível" detail="O sistema calcula tempo, velocidade no solo, autonomia, reserva e alternativa." />
        <div className="grid gap-5 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-5">
          <Field label="Velocidade de cruzeiro" hint="kt"><Input type="number" min="1" value={form.cruiseSpeed} onChange={(event) => update("cruiseSpeed", event.target.value)} className={`${inputClass} font-mono`} /></Field>
          <SelectField label="Combustível planejado" value={form.fuelType} items={[{ id: "AVGAS 100LL", label: "AVGAS 100LL" }, { id: "JET A1", label: "JET A-1" }]} onChange={(value) => update("fuelType", value)} placeholder="Tipo de combustível" />
          <Field label="Consumo da aeronave" hint="L/h"><Input type="number" min="1" value={form.fuelBurn} onChange={(event) => update("fuelBurn", event.target.value)} className={`${inputClass} font-mono`} /></Field>
          <Field label="Autonomia disponível" hint="horas"><Input type="number" min="0" step="0.1" value={form.enduranceHours} onChange={(event) => update("enduranceHours", event.target.value)} className={`${inputClass} font-mono`} /></Field>
          <Field label="Reserva regulamentar" hint="minutos"><Input type="number" min="0" value={form.reserveMin} onChange={(event) => update("reserveMin", event.target.value)} className={`${inputClass} font-mono`} /></Field>
          <Field label="Táxi estimado" hint="minutos"><Input type="number" min="0" value={form.taxiMin} onChange={(event) => update("taxiMin", event.target.value)} className={`${inputClass} font-mono`} /></Field>
        </div>
        <div className="mx-4 mb-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[.05] p-3 text-[10px] leading-relaxed text-muted-foreground md:mx-5"><CircleHelp size={15} className="mt-0.5 shrink-0 text-primary" />O consumo é informado pelo operador e deve refletir a performance real da aeronave. O cálculo é uma ferramenta de apoio ao despacho e não substitui a decisão do piloto em comando.</div>
      </section>

      <section className="rounded-xl border border-border bg-card/75">
        <CabecalhoSecao icon={<ShieldCheck size={15} />} title="Referência rápida de abreviaturas" detail="Códigos do formulário alinhados ao padrão ICAO/DECEA." action={<a href="https://aisweb.decea.mil.br/?i=abreviaturas" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">Consultar AISWEB <ExternalLink size={11} /></a>} />
        <div className="grid gap-3 p-4 text-[10px] sm:grid-cols-2 lg:grid-cols-4 md:p-5"><div className="rounded-lg border border-border/70 bg-secondary/25 p-3"><p className="font-bold text-primary">I · V · Y · Z</p><p className="mt-1 leading-relaxed text-muted-foreground">Regras IFR, VFR ou mudança subsequente. Para Y/Z, registre os pontos de mudança na rota.</p></div><div className="rounded-lg border border-border/70 bg-secondary/25 p-3"><p className="font-bold text-primary">S · G · N · M · X</p><p className="mt-1 leading-relaxed text-muted-foreground">Tipo de voo: regular, geral, não regular, militar ou distinto.</p></div><div className="rounded-lg border border-border/70 bg-secondary/25 p-3"><p className="font-bold text-primary">J · H · M · L</p><p className="mt-1 leading-relaxed text-muted-foreground">Categoria de esteira: super, pesada, média e leve.</p></div><div className="rounded-lg border border-border/70 bg-secondary/25 p-3"><p className="font-bold text-primary">Item 18</p><p className="mt-1 leading-relaxed text-muted-foreground">Use RMK TYP/ para ZZZZ e RMK RALT/ para alternativa ou observações operacionais.</p></div></div>
      </section>

      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[.06] p-4 sm:flex-row sm:items-center md:p-5"><div className="flex items-start gap-3"><Route size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-xs font-bold">Gerar mapa e briefing</p><p className="mt-1 text-[10px] text-muted-foreground">Consulta rota, ROTAER, METAR/TAF, cartas e NOTAMs para origem e destino.</p></div></div><Button type="button" onClick={() => void generatePlan()} disabled={generating} className="h-11 gap-2 px-5 text-xs font-bold">{generating ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />} {generating ? "Consultando AISWEB..." : "Calcular plano de voo"}</Button></div>

      </div>

      {generated && <OperationalResult data={generated} form={form} onSave={() => void savePlan()} onBack={() => { setGenerated(null); setSaved(false); }} saving={saving} saved={saved} planId={savedPlanId} checklist={checklist} onChecklistSaved={setChecklist} onError={setError} onGeneratePdf={() => void gerarPdfPlano()} generatingPdf={generatingPdf} />}

      <section className={`${generated ? "hidden " : ""}rounded-xl border border-border bg-card/75`}>        <CabecalhoSecao icon={<BookmarkCheck size={15} />} title="Planos salvos" detail="Abra um plano concluído para revisar o briefing e atualizar a rota." />{savedPlans.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Voo</th><th className="px-4 py-3">Trecho</th><th className="px-4 py-3">Data / EOBT</th><th className="px-4 py-3">Salvo em</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{savedPlans.slice(0, 12).map((plan) => <tr key={plan.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3 font-mono text-[10px] font-bold">{plan.numero_voo || "Sem número"}</td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{plan.adep} → {plan.ades}</td><td className="px-4 py-3 text-[10px]"><p>{plan.data_voo || "—"}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{plan.eobt || "UTC a definir"}</p></td><td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(plan.created_at).toLocaleString("pt-BR")}</td><td className="px-4 py-3 text-right"><Button type="button" variant="outline" onClick={() => void openSavedPlan(plan)} disabled={generating} className="h-8 gap-1.5 border-border bg-transparent text-[10px]"><FolderOpen size={13} /> Abrir</Button></td></tr>)}</tbody></table></div><div className="space-y-2 p-3 md:hidden">{savedPlans.slice(0, 12).map((plan) => <PlanoSalvoCard key={plan.id} plan={plan} disabled={generating} onOpen={() => void openSavedPlan(plan)} />)}</div></> : <EstadoVazio label="Nenhum plano salvo ainda" />}</section>
    </div>
  );
}
