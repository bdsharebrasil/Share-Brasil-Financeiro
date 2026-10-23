import { useState } from "react";
import { CloudSun, LoaderCircle } from "lucide-react";

import { buscarClima, buscarRotaer, type AirportDetail, type WeatherResponse } from "@/lib/flightplan-api";

type Camada = "temp" | "clouds" | "wind" | "rain" | "pressure" | "visibility";
const CAMADAS: { id: Camada; nome: string }[] = [
  { id: "temp", nome: "Temperatura" },
  { id: "clouds", nome: "Nuvens" },
  { id: "wind", nome: "Vento" },
  { id: "rain", nome: "Chuva" },
  { id: "pressure", nome: "Pressão" },
  { id: "visibility", nome: "Visibilidade" },
];

export default function ConsultaMeteorologia() {
  const [icao, setIcao] = useState("");
  const [dados, setDados] = useState<{ icao: string; met: WeatherResponse; aeroporto: AirportDetail } | null>(null);
  const [camada, setCamada] = useState<Camada>("temp");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function consultar(event: React.FormEvent) {
    event.preventDefault();
    const codigo = icao.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(codigo)) {
      setErro("Informe um código ICAO de quatro letras, por exemplo SBGR.");
      setDados(null);
      return;
    }

    setCarregando(true);
    setErro("");
    try {
      const [met, ficha] = await Promise.all([buscarClima(codigo), buscarRotaer(codigo)]);
      setDados({ icao: codigo, met, aeroporto: ficha.airport });
    } catch (error) {
      setDados(null);
      setErro(error instanceof Error ? error.message : "Não foi possível consultar a meteorologia do aeródromo.");
    } finally {
      setCarregando(false);
    }
  }

  const coordenadas = dados?.aeroporto.coordinates;
  const mapaUrl = dados && coordenadas
    ? `https://embed.windy.com/embed.html?${new URLSearchParams({
        type: "map",
        location: "coordinates",
        metricRain: "mm",
        metricTemp: "°C",
        metricWind: "kt",
        zoom: "8",
        overlay: camada,
        product: "ecmwf",
        level: "surface",
        lat: String(coordenadas.lat),
        lon: String(coordenadas.lng),
        detailLat: String(coordenadas.lat),
        detailLon: String(coordenadas.lng),
        marker: "true",
      }).toString()}`
    : "";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-foreground">Meteorologia do aeródromo</h2>
        <p className="mt-1 text-sm text-muted-foreground">Consulte METAR e TAF do AISWEB/DECEA e acompanhe as camadas meteorológicas no mapa.</p>
      </div>
      <form onSubmit={consultar} className="flex gap-7">
        <input value={icao} onChange={(event) => setIcao(event.target.value.toUpperCase())} maxLength={4} placeholder="Código ICAO · ex.: SBGR" aria-label="Código ICAO para meteorologia" className="ml-[3px] mr-[3px] h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm tracking-widest text-foreground" />
        <button type="submit" disabled={carregando} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {carregando ? <LoaderCircle size={15} className="animate-spin" /> : <CloudSun size={15} />} Consultar
        </button>
      </form>
      {erro && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}

      {dados && (
        <div className="space-y-4">
          <header>
            <p className="font-mono text-xs font-bold text-primary">{dados.icao} · {dados.met.source || "AISWEB/DECEA"}</p>
            <h3 className="mt-1 text-lg font-bold text-foreground">{dados.aeroporto.name || dados.icao}</h3>
            <p className="text-xs text-muted-foreground">{[dados.aeroporto.city, dados.aeroporto.state].filter(Boolean).join(" / ") || ""}{dados.met.observed_at ? ` · Observado ${dados.met.observed_at}` : ""}</p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo rotulo="Temperatura" valor={dados.met.temperature_c == null ? "—" : `${dados.met.temperature_c} °C`} />
            <Resumo rotulo="Ponto de orvalho" valor={dados.met.dew_point_c == null ? "—" : `${dados.met.dew_point_c} °C`} />
            <Resumo rotulo="Vento" valor={dados.met.wind?.speed_kt == null ? "—" : `${dados.met.wind.variable ? "Variável" : `${dados.met.wind.direction_deg ?? "—"}°`} · ${dados.met.wind.speed_kt} kt${dados.met.wind.gust_kt ? ` G${dados.met.wind.gust_kt}` : ""}`} />
            <Resumo rotulo="QNH" valor={dados.met.qnh_hpa == null ? "—" : `${dados.met.qnh_hpa} hPa`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="METAR · AISWEB/DECEA">{dados.met.metar || "METAR indisponível."}</Bloco>
            <Bloco titulo="TAF · AISWEB/DECEA">{dados.met.taf || "TAF indisponível."}</Bloco>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Mapa meteorológico</h3>
              <p className="mt-1 text-xs text-muted-foreground">Camadas de visualização do Windy; confirme os dados aeronáuticos nas fontes oficiais.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CAMADAS.map((item) => (
                <button key={item.id} type="button" aria-pressed={camada === item.id} onClick={() => setCamada(item.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${camada === item.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                  {item.nome}
                </button>
              ))}
            </div>
            {mapaUrl ? (
              <iframe key={mapaUrl} src={mapaUrl} title={`Mapa meteorológico de ${dados.icao}`} loading="lazy" className="h-[28rem] w-full rounded-xl border border-border" />
            ) : (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">O AISWEB não retornou coordenadas para este aeródromo; não foi possível posicionar o mapa.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</p><p className="mt-1 font-mono text-sm font-semibold text-primary">{valor}</p></div>;
}

function Bloco({ titulo, children }: { titulo: string; children: string }) {
  return <section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h3><p className="break-words whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">{children}</p></section>;
}
