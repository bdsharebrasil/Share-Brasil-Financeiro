import { useEffect, useState } from "react";
import { Bell, ChevronDown, CloudSun, Clock3, Globe2, LoaderCircle, Menu, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomesAmbiente, type Ambiente, type Tema } from "@/types/navegacao";
import { buscarContagemMensagensNaoLidas, buscarPerfilColaborador, carregarArquivoColaborador } from "@/lib/colaborador-api";
import { buscarClima, type WeatherResponse } from "@/lib/flightplan-api";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";

const AVATAR_PADRAO = "/icon.pilot.png";

const CIDADES_METEOROLOGIA = [
  { id: "SBSP", label: "São Paulo · SBSP" },
  { id: "SBGR", label: "São Paulo / Guarulhos · SBGR" },
  { id: "SBRJ", label: "Rio de Janeiro · SBRJ" },
  { id: "SBGL", label: "Rio de Janeiro / Galeão · SBGL" },
  { id: "SBBR", label: "Brasília · SBBR" },
  { id: "SBCF", label: "Belo Horizonte · SBCF" },
  { id: "SBCY", label: "Cuiabá · SBCY" },
  { id: "SBPA", label: "Porto Alegre · SBPA" },
  { id: "RECIFE", label: "Recife · SBRF" },
  { id: "SALVADOR", label: "Salvador · SBSV" },
];

function valorTemperatura(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "—" : `${value}°C`;
}

function valorVento(weather: WeatherResponse | null) {
  if (!weather?.wind) return "—";
  const direction = weather.wind.variable ? "VRB" : `${String(weather.wind.direction_deg ?? 0).padStart(3, "0")}°`;
  const gust = weather.wind.gust_kt ? ` G${weather.wind.gust_kt}` : "";
  return `${direction} ${weather.wind.speed_kt ?? "—"} kt${gust}`;
}

export function LogoShare({ compacto = false }: { compacto?: boolean }) {
  return <div className={cn("flex items-center gap-3", compacto && "gap-0")} aria-label="Share Brasil">{!compacto && <div className="leading-none"><p className="text-[14px] font-extrabold tracking-[.22em] text-foreground">SHARE</p><p className="mt-1 text-[10px] font-semibold italic tracking-[.12em] text-primary">Brasil</p></div>}</div>;
}

function WeatherTophead({ tema }: { tema: Tema }) {
  const [icao, setIcao] = useState(() => window.localStorage.getItem("share-brasil-weather-icao") || "SBSP");
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const selectedCity = CIDADES_METEOROLOGIA.find((city) => city.id === icao) || CIDADES_METEOROLOGIA[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void buscarClima(icao).then((result) => {
      if (!active) return;
      setWeather(result);
    }).catch(() => {
      if (!active) return;
      setWeather(null);
      setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    window.localStorage.setItem("share-brasil-weather-icao", icao);
    return () => { active = false; };
  }, [icao]);

  const chooseCity = (next: string) => {
    setIcao(next);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label="Abrir condições meteorológicas" className={cn("flex items-center gap-2 rounded-lg border border-border/70 px-2.5 py-2 text-left text-[10px] transition-colors hover:border-primary/35 hover:bg-secondary/60 sm:px-3", open && "border-primary/45 bg-primary/[.05]")} style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>
        {loading ? <LoaderCircle size={14} className="animate-spin text-primary" /> : <CloudSun size={14} className="text-[#f1c348]" />}
        <span className="hidden text-muted-foreground sm:inline">{selectedCity.label.split(" · ")[0]}</span>
        <strong className="font-mono text-foreground">{error ? "—" : valorTemperatura(weather?.temperature_c)}</strong>
        <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="fixed inset-x-2 top-[76px] z-[1000] max-h-[calc(100dvh-84px)] w-auto overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-[0_18px_45px_rgba(0,0,0,.3)] sm:inset-x-auto sm:right-4 sm:w-[min(92vw,350px)] md:absolute md:right-0 md:top-[calc(100%+10px)] md:max-h-[calc(100dvh-84px)] md:w-[350px]">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Condições atuais</p><p className="mt-1 break-words text-xs font-bold">{selectedCity.label}</p></div><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">AISWEB</span></div>
        <SearchableCombobox items={CIDADES_METEOROLOGIA} value={icao} onChange={chooseCity} placeholder="Selecionar cidade" searchPlaceholder="Buscar cidade ou ICAO" emptyMessage="Cidade não cadastrada." icon={<CloudSun size={14} />} className="h-10 bg-background text-sm" />
        {loading ? <div className="flex items-center gap-2 py-5 text-[10px] text-muted-foreground"><LoaderCircle size={14} className="animate-spin text-primary" /> Consultando METAR...</div> : error ? <div className="mt-3 rounded-lg border border-[#e77b80]/30 bg-[#e77b80]/10 p-3 text-[10px] text-[#ed8c90]">Não foi possível obter o METAR de {icao}. Tente novamente em instantes.</div> : <>
          <div className="mt-3 grid grid-cols-2 gap-2"><WeatherTopMetric label="Temperatura" value={valorTemperatura(weather?.temperature_c)} /><WeatherTopMetric label="Vento" value={valorVento(weather)} /><WeatherTopMetric label="Ponto de orvalho" value={valorTemperatura(weather?.dew_point_c)} /><WeatherTopMetric label="QNH" value={weather?.qnh_hpa == null ? "—" : `${weather.qnh_hpa} hPa`} /></div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/60 p-2 text-[9px] text-muted-foreground"><Wind size={13} className="mt-0.5 shrink-0 text-primary" /><span className="min-w-0 break-words">METAR <strong className="font-mono text-foreground">{weather?.loc || icao}</strong>{weather?.observed_at ? ` · ${weather.observed_at}` : ""}</span></div>
          {weather?.metar && <p className="mt-2 break-words rounded-lg border border-border/70 bg-background/60 p-2 font-mono text-[9px] leading-relaxed text-muted-foreground">{weather.metar}</p>}
          <p className="mt-3 text-[9px] text-muted-foreground">Atualização via proxy seguro do backend · dados aeronáuticos AISWEB/DECEA.</p>
        </>}
      </div>}
    </div>
  );
}

function WeatherTopMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-secondary/30 p-2.5"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-[11px] font-bold text-foreground">{value}</p></div>;
}

export function BarraSuperior({ ambiente, tema, aoTrocarAmbiente, aoAlternarTema, aoAbrirMenu, aoAbrirPerfil }: { ambiente: Ambiente; tema: Tema; aoTrocarAmbiente: (ambiente: Ambiente) => void; aoAlternarTema: () => void; aoAbrirMenu: () => void; aoAbrirPerfil: () => void }) {
  const [horario, setHorario] = useState(new Date());
  const [avatar, setAvatar] = useState(AVATAR_PADRAO);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setHorario(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ativo = true;
    void buscarContagemMensagensNaoLidas().then(({ unread }) => {
      if (ativo) setMensagensNaoLidas(unread);
    }).catch(() => {
      if (ativo) setMensagensNaoLidas(0);
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    let objectUrl: string | null = null;
    void buscarPerfilColaborador().then(async (response) => {
      if (!ativo) return;
      if (!response.perfil.foto_url) {
        setAvatar(AVATAR_PADRAO);
        return;
      }
      const blob = await carregarArquivoColaborador("/api/colaborador/foto");
      if (!ativo) return;
      objectUrl = URL.createObjectURL(blob);
      setAvatar(objectUrl);
    }).catch(() => {
      if (ativo) setAvatar(AVATAR_PADRAO);
    });
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const horaLocal = horario.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const horaUtc = horario.toLocaleTimeString("pt-BR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-7"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={aoAbrirMenu} aria-label="Abrir menu" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"><Menu size={20} /></button><div className="md:hidden"><LogoShare compacto /></div><label className="sr-only" htmlFor="dashboard-mobile">Selecionar dashboard</label><select id="dashboard-mobile" value={ambiente} onChange={(event) => aoTrocarAmbiente(event.target.value as Ambiente)} className="h-9 max-w-[128px] rounded-lg border border-border bg-card px-2 text-[10px] font-bold text-foreground outline-none focus:border-primary md:hidden" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>{(["gestor", "operacoes", "financeiro"] as Ambiente[]).map((item) => <option key={item} value={item}>{nomesAmbiente[item]}</option>)}</select><div className="hidden min-w-0 items-center gap-1 rounded-xl border border-border bg-card/70 p-1 md:flex" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>{(["gestor", "operacoes", "financeiro"] as Ambiente[]).map((item) => <button type="button" key={item} onClick={() => aoTrocarAmbiente(item)} className={cn("rounded-lg px-3 py-2 text-[11px] font-bold transition-all", ambiente === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>{nomesAmbiente[item]}</button>)}</div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground lg:flex" title="Horário local do dispositivo" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}><Clock3 size={13} className="text-primary" /><span className="text-foreground">{horaLocal}</span><span className="text-primary/70">Local</span></div><div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground xl:flex" title="Horário Universal Coordenado" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}><Globe2 size={13} className="text-primary" /><span className="text-foreground">{horaUtc}</span><span className="text-primary/70">UTC</span></div><WeatherTophead tema={tema} /><button type="button" aria-label="Abrir notificações" className="relative rounded-lg border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"><Bell size={17} />{mensagensNaoLidas > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f1c348]" />}</button><button type="button" onClick={aoAbrirPerfil} aria-label="Abrir meu perfil" className="ml-1 h-9 w-9 overflow-hidden rounded-lg bg-[#0b4a78] ring-2 ring-primary/10"><img src={avatar} alt="Avatar do perfil" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = AVATAR_PADRAO; }} /></button></div></header>;
}
