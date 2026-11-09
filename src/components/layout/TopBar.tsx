import { useEffect, useState } from "react";
import { Bell, Check, ChevronDown, CloudRain, CloudSun, Clock3, Globe2, LoaderCircle, LogOut, Menu, Trash2, UserRound, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomesAmbiente, PONTO_ATIVO_EVENTO, PONTO_ATIVO_STORAGE, type Ambiente, type Tema } from "@/types/navegacao";
import { baixarAnexoRejeicaoRelatorio, buscarNotificacoesInternas, buscarPerfilColaborador, carregarArquivoColaborador, excluirNotificacaoInterna, limparNotificacoesInternas, marcarNotificacaoLida, type NotificacaoInterna } from "@/lib/colaborador-api";
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
  const WeatherIcon = weather?.weather_condition === "rain" || weather?.weather_condition === "storm" ? CloudRain : CloudSun;
  const weatherIconClass = weather?.weather_condition === "rain" || weather?.weather_condition === "storm" ? "text-[#3b9eea]" : "text-[#f1c348]";

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label="Abrir condições meteorológicas" className={cn("tophead-control flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10px] transition-colors hover:border-[rgba(71,140,172,0.35)] hover:bg-secondary/60 sm:px-3", open && "border-primary/45 bg-primary/[.05]")} style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>
        {loading ? <LoaderCircle size={14} className="animate-spin text-primary" /> : <WeatherIcon size={14} className={weatherIconClass} />}
        <span className="hidden text-muted-foreground sm:inline">{selectedCity.label.split(" · ")[0]}</span>
        <strong className="font-mono text-foreground">{error ? "—" : valorTemperatura(weather?.temperature_c)}</strong>
        <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="fixed inset-x-2 top-[var(--app-header-height)] z-[1000] max-h-[calc(100dvh-84px)] w-auto overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-[0_18px_45px_rgba(0,0,0,.3)] sm:inset-x-auto sm:right-4 sm:w-[min(92vw,350px)] md:absolute md:right-0 md:top-[calc(100%+10px)] md:max-h-[calc(100dvh-84px)] md:w-[350px]">
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

function ImagemAnexoRejeicao({ item }: { item: NotificacaoInterna }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!item.relatorio_id || !item.anexos_rejeicao) return;
    let anexos: Array<{ id?: string; nome_arquivo?: string }> = [];
    try { const parsed = JSON.parse(item.anexos_rejeicao); if (Array.isArray(parsed)) anexos = parsed; } catch { return; }
    const anexoIdNotificado = item.tarefa_titulo?.match(/\[ANEXO:([^\]]+)\]/)?.[1];
    const anexo = anexos.find((value) => value.id === anexoIdNotificado) || anexos[anexos.length - 1];
    if (!anexo?.id) return;
    let active = true;
    let objectUrl: string | null = null;
    void baixarAnexoRejeicaoRelatorio(item.relatorio_id, anexo.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.relatorio_id, item.anexos_rejeicao, item.tarefa_titulo]);
  return src ? <img src={src} alt="Imagem anexada à rejeição do relatório" className="mt-2 max-h-36 w-full rounded-lg border border-border object-contain object-left" /> : null;
}

export function BarraSuperior({ ambiente, podeAcessarGestor, tema, aoTrocarAmbiente, aoAlternarTema, aoAbrirMenu, aoAbrirPerfil, aoAbrirRelatorio, aoSair }: { ambiente: Ambiente; podeAcessarGestor: boolean; tema: Tema; aoTrocarAmbiente: (ambiente: Ambiente) => void; aoAlternarTema: () => void; aoAbrirMenu: () => void; aoAbrirPerfil: () => void; aoAbrirRelatorio: (id: string) => void; aoSair: () => void | Promise<void> }) {
  const [horario, setHorario] = useState(new Date());
  const [avatar, setAvatar] = useState(AVATAR_PADRAO);
  const [notificacoes, setNotificacoes] = useState<NotificacaoInterna[]>([]);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [pontoAtivo, setPontoAtivo] = useState(() => window.localStorage.getItem(PONTO_ATIVO_STORAGE) === "1");

  useEffect(() => {
    const timer = window.setInterval(() => setHorario(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const atualizarPonto = (event: Event) => {
      const ativo = (event as CustomEvent<{ ativo?: boolean }>).detail?.ativo;
      if (typeof ativo === "boolean") setPontoAtivo(ativo);
    };
    const sincronizarPonto = (event: StorageEvent) => {
      if (event.key === PONTO_ATIVO_STORAGE) setPontoAtivo(event.newValue === "1");
    };
    window.addEventListener(PONTO_ATIVO_EVENTO, atualizarPonto);
    window.addEventListener("storage", sincronizarPonto);
    return () => {
      window.removeEventListener(PONTO_ATIVO_EVENTO, atualizarPonto);
      window.removeEventListener("storage", sincronizarPonto);
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => void buscarNotificacoesInternas().then(({ notificacoes: items }) => {
      if (ativo) setNotificacoes(items || []);
    }).catch(() => { if (ativo) setNotificacoes([]); });
    atualizar();
    const timer = window.setInterval(atualizar, 30_000);
    return () => { ativo = false; window.clearInterval(timer); };
  }, []);
  const atualizarNotificacoes = async () => {
    const response = await buscarNotificacoesInternas();
    setNotificacoes(response.notificacoes || []);
  };
  const aoAbrirNotificacao = (item: NotificacaoInterna) => {
    if (!item.lido) void marcarNotificacaoLida(item.id, item.origem_notificacao).then(atualizarNotificacoes);
    const reportId = item.relatorio_id || item.tarefa_titulo?.match(/\[RELATORIO:([^\]]+)\]/)?.[1];
    if (reportId) { setNotificacoesAbertas(false); aoAbrirRelatorio(reportId); }
  };

  useEffect(() => {
    let ativo = true;
    let objectUrl: string | null = null;
    void buscarPerfilColaborador().then(async (response) => {
      if (!ativo) return;
      const fotoUrl = response.perfil.foto_url || (response.perfil.url_avatar ? "/api/colaborador/foto" : null);
      if (!fotoUrl) {
        setAvatar(AVATAR_PADRAO);
        return;
      }
      if (fotoUrl.startsWith("https://") || fotoUrl.startsWith("http://")) {
        setAvatar(fotoUrl);
        return;
      }
      const blob = await carregarArquivoColaborador(fotoUrl);
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

  return <header className="app-topbar safe-area-header relative z-40 flex h-[var(--app-header-height)] shrink-0 items-center justify-between gap-2 border-b border-[rgba(26,34,34,0.87)] bg-sidebar px-3 md:-ml-[76px] md:w-[calc(100%+76px)] md:grid md:grid-cols-[1fr_auto_1fr] md:pr-7 md:pl-[104px]">
    <div className="flex min-w-0 flex-1 items-center gap-3"><button type="button" onClick={aoAbrirMenu} aria-label="Abrir menu" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"><Menu size={20} /></button><div className="md:hidden"><LogoShare compacto /></div><label className="sr-only" htmlFor="dashboard-mobile">Selecionar dashboard</label><select id="dashboard-mobile" value={ambiente} onChange={(event) => aoTrocarAmbiente(event.target.value as Ambiente)} className="tophead-control h-9 max-w-[128px] rounded-lg border border-border bg-card px-2 text-[10px] font-bold text-foreground outline-none focus:border-primary md:hidden" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>{(["operacoes", "financeiro", "share-brasil", ...(podeAcessarGestor ? ["gestor" as Ambiente] : [])] as Ambiente[]).map((item) => <option key={item} value={item}>{nomesAmbiente[item]}</option>)}</select></div><div className="tophead-control hidden min-w-0 shrink-0 items-center justify-self-center gap-1 rounded-xl border border-[rgba(112,120,129,0.59)] bg-card/70 px-1.5 py-1 md:flex md:-translate-x-10" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>{(["operacoes", "financeiro", "share-brasil", ...(podeAcessarGestor ? ["gestor" as Ambiente] : [])] as Ambiente[]).map((item) => <button type="button" key={item} onClick={() => aoTrocarAmbiente(item)} aria-pressed={ambiente === item} className={cn("menu-cabecalho rounded-lg border border-transparent px-3 py-2 text-[11px] font-bold", ambiente === item ? "border-[var(--borda-controle-cabecalho)] bg-[rgba(1,29,61,0.93)] text-[rgba(220,230,243,1)] shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>{nomesAmbiente[item]}</button>)}</div><div className="flex flex-1 items-center justify-end gap-2"><div className={cn("tophead-control hidden items-center gap-2 rounded-lg border bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors lg:flex", pontoAtivo && ambiente === "share-brasil" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-200")} title="Horário local do dispositivo" style={tema === "light" && !(pontoAtivo && ambiente === "share-brasil") ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}><Clock3 size={13} className={cn(pontoAtivo && ambiente === "share-brasil" ? "text-emerald-300" : "text-primary")} /><span className="text-foreground">{horaLocal}</span><span className={cn("text-primary/70", pontoAtivo && ambiente === "share-brasil" && "text-emerald-300")}>{pontoAtivo && ambiente === "share-brasil" ? "Ponto ativo" : "Local"}</span></div><div className="tophead-control hidden items-center gap-2 rounded-lg border bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground xl:flex" title="Horário Universal Coordenado" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}><Globe2 size={13} className="text-primary" /><span className="text-foreground">{horaUtc}</span><span className="text-primary/70">UTC</span></div><WeatherTophead tema={tema} /><div className="relative shrink-0"><button type="button" onClick={() => setNotificacoesAbertas((aberta) => !aberta)} aria-label="Abrir notificações" aria-expanded={notificacoesAbertas} title="Notificações" className="relative rounded-lg border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"><Bell size={17} />{notificacoes.some((item) => !item.lido) && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#f1c348] px-1 text-center text-[9px] font-bold leading-4 text-[#17120a]">{notificacoes.filter((item) => !item.lido).length > 99 ? "99+" : notificacoes.filter((item) => !item.lido).length}</span>}</button>{notificacoesAbertas && <section className="absolute right-0 top-[calc(100%+10px)] z-[1000] w-[min(90vw,390px)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_18px_45px_rgba(0,0,0,.35)]"><header className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-bold">Notificações</h2><p className="text-[10px] text-muted-foreground">{notificacoes.filter((item) => !item.lido).length} não lida(s)</p></div>{notificacoes.length > 0 && <button type="button" onClick={() => void limparNotificacoesInternas().then(() => setNotificacoes([]))} className="text-[10px] font-semibold text-rose-300 hover:text-rose-200">Limpar todas</button>}</header><div className="max-h-[min(65vh,460px)] overflow-y-auto">{notificacoes.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">Você não tem notificações.</p> : notificacoes.map((item) => <article key={item.id} className={`border-b border-border/60 p-3 ${item.lido ? "opacity-70" : "bg-primary/[.04]"}`}><button type="button" onClick={() => aoAbrirNotificacao(item)} className="w-full text-left"><p className="text-xs leading-relaxed">{item.mensagem || "Notificação"}</p><p className="mt-1 text-[9px] text-muted-foreground">{new Date(item.criado_em).toLocaleString("pt-BR")}{item.relatorio_id || item.tarefa_titulo?.includes("[RELATORIO:") ? " · Abrir relatório" : ""}</p><ImagemAnexoRejeicao item={item} /></button><div className="mt-2 flex justify-end gap-3">{!item.lido && <button type="button" onClick={() => void marcarNotificacaoLida(item.id, item.origem_notificacao).then(atualizarNotificacoes)} className="flex items-center gap-1 text-[10px] font-semibold text-primary"><Check size={12} /> Marcar como lida</button>}<button type="button" onClick={() => void excluirNotificacaoInterna(item.id, item.origem_notificacao).then(() => setNotificacoes((items) => items.filter((value) => value.id !== item.id)))} aria-label="Excluir notificação" className="flex items-center gap-1 text-[10px] font-semibold text-rose-300"><Trash2 size={12} /> Excluir</button></div></article>)}</div></section>}</div><div className="relative ml-1"><button type="button" onClick={() => setPerfilAberto((aberto) => !aberto)} aria-label="Abrir meu perfil" aria-expanded={perfilAberto} className="h-9 w-9 overflow-hidden rounded-lg bg-[#0b4a78] ring-2 ring-primary/10"><img src={avatar} alt="Avatar do perfil" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = AVATAR_PADRAO; }} /></button>{perfilAberto && <div className="absolute right-0 top-[calc(100%+10px)] z-[1000] w-48 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_18px_45px_rgba(0,0,0,.35)]"><button type="button" onClick={() => { setPerfilAberto(false); aoAbrirPerfil(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-secondary"><UserRound size={15} className="text-primary" /> Meu perfil</button><button type="button" onClick={() => { setPerfilAberto(false); void aoSair(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#d96b72] transition-colors hover:bg-[#e77b80]/10"><LogOut size={15} /> Sair da conta</button></div>}</div></div></header>;
}
