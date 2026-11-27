import { lazy, Suspense, useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import MapLibre, { Source, Layer, Marker, NavigationControl } from "react-map-gl/maplibre";
import type { FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plane, Clock3, Navigation, Play, ChevronRight, FileText, Trash2, CheckCircle2, Circle } from "lucide-react";
import { buscarJornadaVoo, buscarPlanosVoo, buscarRotaerOperacao, buscarHistoricoRastreio, type SolicitacaoVooInterna, type AeronaveAgendamento, type VooEmOperacao } from "@/lib/colaborador-api";
import { vooComSinalNoAr } from "@/lib/rastreio";
import ChecklistPreVoo from "./ChecklistPreVoo";
import JornadaVoo from "./JornadaVoo";
import PesoBalanceamentoFicha from "./PesoBalanceamentoFicha";
import { calcularProgressoChecklist, obterAcoesAgendamento, statusPermiteAbrirJornada } from "./agendamentoCardFlow";
import { botaoAgenda, cardAgenda, subcardAgenda, pillAgenda } from "./AgendamentoShell";
import { dataAgenda, duracaoAgenda, horaAgenda, instanteAgenda, historicoAgenda, proximoAgenda, planoAgenda } from "./agendaOperacionalModel";
import { StatusAgenda } from "./ListaAgendaOperacional";
import { AvisoCartaAgenda, SeletorMapaAgenda, estiloMapaAgenda, type ModoMapaAgenda } from "./MapaAgendaCamadas";
import { buscarEstadoPlanoPreparacao, planoConferidoNaPreparacao } from "./estadoPlanoPreparacao";
import { cn } from "@/lib/utils";
const MapaRastreio = lazy(() => import("@/components/dashboard/operacoes/VooEmOperacaoMapa"));

type Coord = { lat: number; lon: number };
function coord(valor: any): Coord | null {
  if (valor?.lat == null || (valor.lon ?? valor.lng) == null) return null;
  const lat = Number(valor.lat), lon = Number(valor.lon ?? valor.lng);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0) ? { lat, lon } : null;
}
function distanciaDireta(a: Coord, b: Coord) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
}
function positivo(valor: unknown) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function MapaPlanejado({ origem, destino, a, b, modo }: { origem: string; destino: string; a: Coord; b: Coord; modo: ModoMapaAgenda }) {
  const [erro, setErro] = useState(false);
  const estilo = useMemo(() => estiloMapaAgenda(modo), [modo]);
  const geojson: FeatureCollection<LineString> = { type:"FeatureCollection",features:[{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:[[a.lon,a.lat],[b.lon,b.lat]]}}] };
  const bounds: [[number,number],[number,number]] = [[Math.min(a.lon,b.lon),Math.min(a.lat,b.lat)],[Math.max(a.lon,b.lon),Math.max(a.lat,b.lat)]];
  return <div className="relative h-[300px] w-full sm:h-[340px]">
    <MapLibre initialViewState={{bounds,fitBoundsOptions:{padding:45,maxZoom:12}}} mapStyle={estilo} attributionControl={{compact:true}} style={{width:"100%",height:"100%"}} scrollZoom={false} onError={e => { if (["carta","base","imagem"].includes(String((e as { sourceId?: string }).sourceId))) setErro(true); }}>
      <NavigationControl position="top-right" showCompass={false}/>
      <Source id="rota-agenda" type="geojson" data={geojson}><Layer id="rota-sombra" type="line" paint={{"line-color":"#0D213A","line-width":6}}/><Layer id="rota-linha" type="line" paint={{"line-color":"#38bdf8","line-width":3,"line-dasharray":[2,1]}}/></Source>
      {([{c:a,nome:origem,tipo:"Partida"},{c:b,nome:destino,tipo:"Chegada"}]).map(p => <Marker key={p.tipo} longitude={p.c.lon} latitude={p.c.lat} anchor="center"><div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow"/><span className="rounded bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-white">{p.nome}</span></div></Marker>)}
    </MapLibre>
    <div className="pointer-events-none absolute bottom-6 left-3 rounded-lg border border-white/20 bg-slate-950/80 px-2.5 py-2 text-[10px] text-white"><p className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-sky-400"/> Rota de referência</p><p className="mt-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-white bg-sky-500"/> Partida / chegada</p></div>
    <AvisoCartaAgenda modo={modo} erro={erro}/>
  </div>;
}
function Campo({ nome, valor }: { nome: string; valor: ReactNode }) {
  return <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 py-2 text-xs last:border-0 dark:border-slate-800/80"><dt className="shrink-0 text-slate-500 dark:text-slate-400">{nome}</dt><dd className="break-words text-right font-semibold">{valor || "—"}</dd></div>;
}
function instanteTexto(valor?: string | null) {
  if (!valor) return "—";
  return (dataAgenda(valor) === "—" ? "" : dataAgenda(valor) + " · ") + horaAgenda(valor);
}
function estimativaChegada(inicio: number | null, minutos: number | null) {
  if (inicio == null || minutos == null) return null;
  return new Date(inicio + minutos*60000).toISOString();
}
function duracaoReal(dep?: string | null, pou?: string | null) {
  const a = instanteAgenda(null, dep), b = instanteAgenda(null, pou);
  return a != null && b != null && b >= a ? duracaoAgenda((b-a)/60000) : "—";
}

export default function FichaAgendaOperacional({ item, operacao, aeronave, itens, voosAoVivo, erroAoVivo, detalhes, processando, aoAbrir, aoAbrirPlano, aoAtualizar, aoFinalizar, aoExcluir }: {
  item: SolicitacaoVooInterna; operacao: SolicitacaoVooInterna; aeronave?: AeronaveAgendamento; itens: SolicitacaoVooInterna[];
  voosAoVivo: VooEmOperacao[]; erroAoVivo: string | null; detalhes: ReactNode; processando: boolean;
  aoAbrir: (v: SolicitacaoVooInterna) => void; aoAbrirPlano?: (id: string) => void; aoAtualizar: () => Promise<void>;
  aoFinalizar: (v: SolicitacaoVooInterna) => void; aoExcluir: (v: SolicitacaoVooInterna) => void;
}) {
  const [tab, setTab] = useState<"jornada" | "perna" | "proximo">("jornada");
  const [acao, setAcao] = useState<"checklist" | "horarios" | "dados" | null>(null);
  const [progresso, setProgresso] = useState<number | undefined>();
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const [modoMapa, setModoMapa] = useState<ModoMapaAgenda>("satelite");
  const encerrado = historicoAgenda(item);
  const acoes = obterAcoesAgendamento(item, calcularProgressoChecklist(item, progresso));
  const planejada = item.solicitacao_origem_id ? operacao.pernas_planejadas?.find(p => p.id === item.id) : undefined;
  const vinculoValido = !item.solicitacao_origem_id || (operacao.id === item.solicitacao_origem_id && Boolean(planejada) && !historicoAgenda(operacao));
  const permiteJornada = statusPermiteAbrirJornada(operacao.status) && vinculoValido;
  const consultaJornada = useQuery({ queryKey:["agenda-shell-jornada",operacao.id], queryFn:() => buscarJornadaVoo(operacao.id), enabled:permiteJornada });
  const consultaPlanos = useQuery({ queryKey:["agenda-shell-planos"], queryFn:buscarPlanosVoo, staleTime:30000 });
  const consultaHistorico = useQuery({ queryKey:["agenda-shell-rastreio",operacao.id], queryFn:() => buscarHistoricoRastreio(operacao.id), enabled:permiteJornada && !item.solicitacao_origem_id, staleTime:30000, retry:1 });
  const consultaPreparacao = useQuery({ queryKey:["agenda-preparacao-plano",item.id], queryFn:() => buscarEstadoPlanoPreparacao(item.id), enabled:statusPermiteAbrirJornada(item.status), staleTime:0, retry:1 });
  const planoAprovado = !consultaPreparacao.isError && planoConferidoNaPreparacao(consultaPreparacao.data);
  const plano = planoAgenda(consultaPlanos.data || [],item);
  const coordenadasSalvas = plano?.payload?.coordenadas || {};
  const vivo = voosAoVivo.find(v => v.id === operacao.id);
  const rastreio = !item.solicitacao_origem_id ? vivo || consultaHistorico.data : undefined;
  const coordA = coord(coordenadasSalvas[item.origem]) || (rastreio?.origem === item.origem ? coord(rastreio.origem_coord) : null);
  const coordB = coord(coordenadasSalvas[item.destino]) || (rastreio?.destino === item.destino ? coord(rastreio.destino_coord) : null);
  const consultaOrigem = useQuery({ queryKey:["agenda-shell-rotaer",item.origem], queryFn:() => buscarRotaerOperacao(item.origem), enabled:Boolean(item.origem && !coordA), staleTime:300000, retry:1 });
  const consultaDestino = useQuery({ queryKey:["agenda-shell-rotaer",item.destino], queryFn:() => buscarRotaerOperacao(item.destino), enabled:Boolean(item.destino && !coordB), staleTime:300000, retry:1 });
  const a = coordA || coord(consultaOrigem.data?.airport?.coordinates), b = coordB || coord(consultaDestino.data?.airport?.coordinates);
  const km = positivo(plano?.payload?.distancia_total_nm) != null ? Number(plano?.payload?.distancia_total_nm)*1.852 : a && b ? distanciaDireta(a,b) : null;
  const velocidade = positivo(aeronave?.performance_velocidade_cruzeiro_kt) || positivo(aeronave?.velocidade_cruzeiro);
  const minutos = positivo(plano?.payload?.minutos_voo) || (km != null && velocidade ? km/1.852/velocidade*60 : null);
  const partida = instanteAgenda(item.data_agendada,item.horario_previsto_agendamento);
  const chegada = estimativaChegada(partida,minutos);
  const proximo = proximoAgenda(item,itens);
  const inicioProximo = proximo ? instanteAgenda(proximo.data_agendada,proximo.horario_previsto_agendamento) : null;
  const jornadaAtual = consultaJornada.data;
  const jornadas = jornadaAtual ? [jornadaAtual,...(jornadaAtual.historico || [])].filter((j,i,arr) => arr.findIndex(x => x.id === j.id) === i) : [];
  const jornadasDia = jornadas.filter(j => j.data?.slice(0,10) === item.data_agendada.slice(0,10) || (!planejada && item.jornada_id === j.id));
  const pernas = jornadasDia.flatMap(j => (j.pernas || []).map(p => ({ ...p, jornada:j.numero_jornada }))).filter((p,i,arr) => arr.findIndex(x=>x.id===p.id)===i).sort((a,b) => a.jornada-b.jornada || a.numero-b.numero);
  const futuros = (operacao.pernas_planejadas || []).filter(p => p.status === "PLANEJADA" && p.data_prevista.slice(0,10) === item.data_agendada.slice(0,10));
  const sinalAoVivo = Boolean(vivo && !erroAoVivo && vooComSinalNoAr(vivo));
  const mapaReal = !item.solicitacao_origem_id && rastreio && (sinalAoVivo || rastreio.trilha?.length);
  const podeHorarios = permiteJornada && (acoes.mostrarJornada || (planejada && acoes.checklistConcluido));
  const abrirAcao = (nova: typeof acao) => { setTab("perna"); setAcao(nova); };
  const atualizar = async () => {
    await aoAtualizar();
    await Promise.all([permiteJornada ? consultaJornada.refetch() : Promise.resolve(), permiteJornada && !item.solicitacao_origem_id ? consultaHistorico.refetch() : Promise.resolve(), statusPermiteAbrirJornada(item.status) ? consultaPreparacao.refetch() : Promise.resolve()]);
  };
  const correspondentes = pernas.filter(p => p.origem === item.origem && p.destino === item.destino);
  const real = !item.solicitacao_origem_id ? pernas.find(p => p.id === item.perna_atual_id && p.origem === item.origem && p.destino === item.destino) || (correspondentes.length === 1 ? correspondentes[0] : undefined) : undefined;
  const pernaAtualCorresponde = !item.solicitacao_origem_id && item.perna_atual_origem === item.origem && item.perna_atual_destino === item.destino;
  const depReal = real?.horario_dep || (pernaAtualCorresponde ? item.perna_atual_horario_dep : null);
  const pouReal = real?.horario_pouso || (pernaAtualCorresponde ? item.perna_atual_horario_pouso : null);
  const fimEstimado = instanteAgenda(null,pouReal) ?? (chegada ? Date.parse(chegada) : null);
  const solo = inicioProximo != null && fimEstimado != null && inicioProximo >= fimEstimado && proximo?.origem === item.destino ? (inicioProximo-fimEstimado)/60000 : null;
  const abas = [{id:"jornada",label:"Jornada"},{id:"perna",label:"Perna de Voo"},{id:"proximo",label:"Próximo Agendamento"}] as const;
  return <div className="space-y-3">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-transparent bg-[#0D213A] p-3 text-white dark:border-slate-800 dark:bg-[#081220]">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-semibold tracking-wider text-sky-200">PLANO DE VOO</p><h2 className="text-base font-bold">Mapa de voo – {mapaReal ? "Rastreio registrado" : "Rota traçada"}</h2></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">{dataAgenda(item.data_agendada)} · {horaAgenda(item.horario_previsto_agendamento)}</span></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><SeletorMapaAgenda modo={modoMapa} aoMudar={setModoMapa}/><span className="text-[10px] text-slate-300">Visualização de referência · UTC</span></div>
        <div className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#081220]">
          {mapaReal && rastreio ? <Suspense fallback={<p className="grid h-[300px] place-items-center text-sm">Carregando mapa…</p>}><MapaRastreio voo={rastreio} historico={!sinalAoVivo} compacto altura={340} modoMapa={modoMapa} /></Suspense> : a && b ? <MapaPlanejado key={modoMapa+":"+a.lat+":"+a.lon+":"+b.lat+":"+b.lon} origem={item.origem} destino={item.destino} a={a} b={b} modo={modoMapa} /> : <div className="grid h-[300px] place-items-center px-4 text-center text-sm text-slate-300">{consultaOrigem.isLoading || consultaDestino.isLoading ? "Consultando coordenadas dos aeródromos…" : "Coordenadas da rota indisponíveis."}</div>}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-black/25 px-3 py-2 text-xs text-[#b6c1d1]"><span className="flex items-center gap-1.5"><Clock3 size={14}/> Tempo estimado: <strong>{duracaoAgenda(minutos)}</strong></span><span className="flex items-center gap-1.5"><Navigation size={14}/> Distância: <strong>{km == null ? "—" : Math.round(km).toLocaleString("pt-BR")+" km"}</strong></span><span className="text-[11px] text-slate-400">{mapaReal ? sinalAoVivo ? "ADS-B" : "Histórico de sinal" : "Traçado direto de referência"} · {planoAprovado ? "Plano conferido no checklist" : "Estimativa, não é rota autorizada"}</span></div>
      </section>
      <section className={cn(cardAgenda, "-my-[9px] flex min-w-0 flex-col gap-2 border-[rgba(132,137,139,0.66)] px-4 py-[44px] dark:border-[rgba(132,137,139,0.66)]")}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">FICHA DO VOO</p><h2 className="text-xl font-bold">Voo {item.numero_voo ? "#"+item.numero_voo.replace(/^#/,"") : "sem número"}</h2></div><StatusAgenda item={item}/></div>
        <div className={subcardAgenda + " flex min-h-20 items-center gap-3 px-3 py-2"}>{aeronave?.url_imagem && !fotoFalhou ? <img src={aeronave.url_imagem} alt="" className="h-16 w-28 shrink-0 object-contain" onError={() => setFotoFalhou(true)}/> : <Plane size={37} className="mx-3 shrink-0 text-[#1D6CE0] dark:text-sky-300"/>}<div className="min-w-0"><strong className="block text-base">{item.matricula_registro || aeronave?.matricula_registro || "Sem aeronave"}</strong><span className="block text-xs text-slate-500 dark:text-slate-400">{item.modelo || aeronave?.modelo || "—"}</span></div></div>
        {!vinculoValido && !encerrado && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">O vínculo com a operação original não está disponível. Confira o agendamento antes de iniciar horários.</p>}
        <dl className="flex-1"><Campo nome="Origem" valor={item.origem}/><Campo nome="Destino" valor={item.destino}/><Campo nome="Partida (prev. UTC)" valor={dataAgenda(item.data_agendada)+" · "+horaAgenda(item.horario_previsto_agendamento)}/><Campo nome="Chegada (prev. UTC)" valor={instanteTexto(chegada)}/><Campo nome="Duração (prev.)" valor={duracaoAgenda(minutos)}/></dl>
        {planoAprovado && <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" title="Conferência interna registrada no checklist; não representa autorização ATC"><CheckCircle2 size={14}/> Plano de voo aprovado</div>}
        {encerrado ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("dados")}>Ver detalhes do voo</button> :
        item.status === "pendente" ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("dados")}>Analisar solicitação</button> :
        acoes.podeFinalizar && !item.solicitacao_origem_id ? <button type="button" className={botaoAgenda} disabled={processando} onClick={() => aoFinalizar(item)}>Encerrar operação</button> :
        podeHorarios ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("horarios")}><Play size={15}/> {acoes.jornadaIniciada ? "Atualizar horários" : "Iniciar operação"}</button> :
        acoes.mostrarChecklist ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("checklist")}><Play size={15}/> Iniciar checklist de preparação</button> :
        <button type="button" className={botaoAgenda} onClick={() => abrirAcao("dados")}>Ver detalhes do voo</button>}
        {acao !== "dados" && !encerrado && <button type="button" className="my-[13px] flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(85,88,93,0.7)] bg-[rgba(235,243,243,1)] py-2 text-xs font-semibold hover:bg-slate-100 dark:border-[rgba(85,88,93,0.7)] dark:bg-[#182640] dark:hover:bg-slate-800" onClick={() => abrirAcao("dados")}><FileText size={13}/> Ver detalhes do voo <ChevronRight size={13}/></button>}
      </section>
    </div>
    <section className={cardAgenda + " min-w-0 p-3 sm:p-4"}>
      <div className="grid gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 lg:grid-cols-[155px_minmax(0,1fr)]"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Histórico do voo</p><h3 className="text-sm font-bold">Jornada e pernas</h3><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Acompanhe as etapas do voo.</p></div><nav className="grid grid-cols-1 gap-1.5 sm:grid-cols-3" aria-label="Detalhes operacionais">{abas.map((t,i) => <button type="button" key={t.id} aria-pressed={tab === t.id} onClick={() => { setTab(t.id); setAcao(null); }} className={"flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition "+(tab===t.id ? "border-sky-300 bg-[#CCECF8] text-[#1D6CE0] dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current">{tab===t.id ? <CheckCircle2 size={15}/> : <Circle size={12}/>}</span><span className="min-w-0"><strong className="block text-xs">{t.label}</strong><span className="block truncate text-[10px] opacity-75">{i===0 ? pernas.length+" registrada(s)" : i===1 ? item.origem+" → "+item.destino : proximo ? proximo.origem+" → "+proximo.destino : "Sem próximo voo"}</span></span></button>)}</nav></div>
      <div className="pt-3">
        {tab === "jornada" && <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-xs"><thead className="text-slate-500 dark:text-slate-400"><tr>{["#","Trecho","Partida (UTC)","Chegada (UTC)","Duração","Status"].map(t => <th key={t} className="px-2 py-2 font-medium">{t}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{pernas.map(p => <tr key={p.id}>{[p.jornada+"."+p.numero,p.origem+" → "+p.destino,instanteTexto(p.horario_dep),instanteTexto(p.horario_pouso),duracaoReal(p.horario_dep,p.horario_pouso),p.status].map((v,i) => <td className="px-2 py-2.5" key={i}>{v}</td>)}</tr>)}{futuros.map(p => <tr key={p.id}><td className="px-2 py-2.5">—</td><td className="px-2 py-2.5 font-semibold">{p.origem} → {p.destino}</td><td className="px-2 py-2.5">{dataAgenda(p.data_prevista)} · {horaAgenda(p.horario_previsto)}</td><td className="px-2 py-2.5">—</td><td className="px-2 py-2.5">—</td><td className="px-2 py-2.5">Planejada</td></tr>)}</tbody></table>
          {consultaJornada.isError ? <p role="alert" className="py-3 text-sm text-amber-700 dark:text-amber-300">Não foi possível consultar a jornada. <button className="underline" onClick={() => void consultaJornada.refetch()}>Tentar novamente</button></p> : consultaJornada.isLoading ? <p className="py-3 text-sm text-slate-500">Carregando jornada…</p> : !pernas.length && !futuros.length && <p className="py-3 text-sm text-slate-500 dark:text-slate-400">Ainda não há pernas registradas nesta jornada.</p>}
          {permiteJornada && (encerrado || podeHorarios) && <button type="button" className="mt-2 text-xs font-semibold text-[#1D6CE0] dark:text-sky-300" onClick={() => abrirAcao("horarios")}>{encerrado ? "Ver histórico completo" : "Abrir horários e jornada"} →</button>}
        </div>}
        {tab === "perna" && <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><div className={subcardAgenda+" p-3"}><p className="text-xs text-slate-500 dark:text-slate-400">Janela prevista (UTC)</p><strong className="text-sm">{horaAgenda(item.horario_previsto_agendamento)} → {horaAgenda(chegada)}</strong></div><div className={subcardAgenda+" p-3"}><p className="text-xs text-slate-500 dark:text-slate-400">Horários reais (UTC)</p><strong className="text-sm">{horaAgenda(depReal)} → {horaAgenda(pouReal)}</strong></div><div className={subcardAgenda+" p-3"}><p className="text-xs text-slate-500 dark:text-slate-400">Aeronave alocada</p><strong className="text-sm">{item.matricula_registro || "—"}</strong></div></div>
          <div className="flex flex-wrap items-center gap-2">{acoes.mostrarChecklist && <button type="button" className={pillAgenda(acao==="checklist")} onClick={() => setAcao("checklist")}>Checklist</button>}{(podeHorarios || (encerrado && permiteJornada)) && <button type="button" className={pillAgenda(acao==="horarios")} onClick={() => setAcao("horarios")}>Horários e jornada</button>}{aoAbrirPlano && !encerrado && <button type="button" className={pillAgenda(false)} onClick={() => aoAbrirPlano(item.id)}><FileText size={13} className="mr-1 inline"/> {planoAprovado ? "Abrir plano de voo" : "Preparar plano de voo"}</button>}{acoes.checklistConcluido && !encerrado && <PesoBalanceamentoFicha item={item} rotuloBotao="Peso e balanceamento"/>}<button type="button" className={pillAgenda(acao==="dados")} onClick={() => setAcao("dados")}>Dados do voo</button>{!encerrado && <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10" onClick={() => aoExcluir(item)}><Trash2 size={13}/> Remover</button>}</div>
          {acao === "checklist" && acoes.mostrarChecklist && <ChecklistPreVoo item={item} aoAtualizarProgresso={setProgresso} aoConcluir={atualizar}/>}
          {acao === "horarios" && (podeHorarios || (encerrado && permiteJornada)) && <JornadaVoo incorporadoNaFicha item={operacao} agendamentoSelecionado={planejada} modo={encerrado ? "historico" : "atualizar"} permitirMapa={false} voosEmOperacao={voosAoVivo} aoAbrirAgendamento={id => { const v=itens.find(x=>x.id===id); if(v) aoAbrir(v); }} aoAtualizarAgendamento={atualizar} aoFechar={() => setAcao(null)}/>}
          {acao === "dados" && detalhes}
        </div>}
        {tab === "proximo" && (proximo ? <div className={subcardAgenda+" flex flex-wrap items-center justify-between gap-3 p-4"}><div><p className="text-xs text-slate-500 dark:text-slate-400">Próximo voo da aeronave</p><strong>{proximo.numero_voo || "Sem número"} · {proximo.origem} → {proximo.destino}</strong><p className="mt-1 text-xs">Decolagem (UTC): {dataAgenda(proximo.data_agendada)} · {horaAgenda(proximo.horario_previsto_agendamento)}</p><p className="text-xs text-slate-500 dark:text-slate-400">Tempo de solo estimado: {duracaoAgenda(solo)}</p></div><button type="button" className={botaoAgenda} onClick={() => aoAbrir(proximo)}>Abrir próximo voo <ChevronRight size={15}/></button></div> : <p className="py-3 text-sm text-slate-500 dark:text-slate-400">Nenhum próximo agendamento confirmado identificado para esta aeronave.</p>)}
      </div>
    </section>
  </div>;
}
