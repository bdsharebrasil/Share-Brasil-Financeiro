import { lazy, Suspense, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { latLngBounds, type LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plane, Clock3, Navigation, Play, ChevronRight, FileText, Trash2 } from "lucide-react";
import { buscarJornadaVoo, buscarPlanosVoo, buscarRotaerOperacao, buscarHistoricoRastreio, type SolicitacaoVooInterna, type AeronaveAgendamento, type VooEmOperacao, type PlanoVooSalvo } from "@/lib/colaborador-api";
import { vooComSinalNoAr } from "@/lib/rastreio";
import ChecklistPreVoo from "./ChecklistPreVoo";
import JornadaVoo from "./JornadaVoo";
import PesoBalanceamentoFicha from "./PesoBalanceamentoFicha";
import { calcularProgressoChecklist, obterAcoesAgendamento, statusPermiteAbrirJornada } from "./agendamentoCardFlow";
import { botaoAgenda, cardAgenda, subcardAgenda, pillAgenda } from "./AgendamentoShell";
import { dataAgenda, duracaoAgenda, horaAgenda, instanteAgenda, historicoAgenda, proximoAgenda } from "./agendaOperacionalModel";
import { StatusAgenda } from "./ListaAgendaOperacional";
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
function planoDoVoo(planos: PlanoVooSalvo[], item: SolicitacaoVooInterna) {
  return planos.filter(p => p.payload?.contexto?.solicitacao?.id === item.id &&
    p.adep?.toUpperCase() === item.origem?.toUpperCase() && p.ades?.toUpperCase() === item.destino?.toUpperCase() &&
    (!p.data_voo || p.data_voo.slice(0,10) === item.data_agendada.slice(0,10)))
    .sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
}
function positivo(valor: unknown) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function MapaPlanejado({ origem, destino, a, b }: { origem: string; destino: string; a: Coord; b: Coord }) {
  const pontos: LatLngTuple[] = [[a.lat,a.lon],[b.lat,b.lon]];
  return <MapContainer key={pontos.flat().join(",")} bounds={latLngBounds(pontos)} boundsOptions={{ padding:[35,35], maxZoom:12 }} scrollWheelZoom={false} style={{ height: 300, width: "100%", background:"#081220" }}>
    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Imagens © Esri" maxZoom={18} />
    <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Rótulos © Esri" maxZoom={18} />
    <Polyline positions={pontos} pathOptions={{ color:"#38bdf8", weight:3, dashArray:"8 6" }} />
    {pontos.map((p,i) => <CircleMarker key={i} center={p} radius={6} pathOptions={{ color:"white", fillColor:i ? "#1D6CE0" : "#ffffff", fillOpacity:1, weight:2 }}><Tooltip permanent direction={i ? "left" : "right"}>{i ? destino : origem}</Tooltip></CircleMarker>)}
  </MapContainer>;
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
  const encerrado = historicoAgenda(item);
  const acoes = obterAcoesAgendamento(item, progresso ?? calcularProgressoChecklist(item));
  const planejada = item.solicitacao_origem_id ? operacao.pernas_planejadas?.find(p => p.id === item.id) : undefined;
  const vinculoValido = !item.solicitacao_origem_id || (operacao.id === item.solicitacao_origem_id && Boolean(planejada) && !historicoAgenda(operacao));
  const permiteJornada = statusPermiteAbrirJornada(operacao.status) && vinculoValido;
  const consultaJornada = useQuery({ queryKey:["agenda-shell-jornada",operacao.id], queryFn:() => buscarJornadaVoo(operacao.id), enabled:permiteJornada });
  const consultaPlanos = useQuery({ queryKey:["agenda-shell-planos"], queryFn:buscarPlanosVoo, staleTime:30000 });
  const consultaHistorico = useQuery({ queryKey:["agenda-shell-rastreio",operacao.id], queryFn:() => buscarHistoricoRastreio(operacao.id), enabled:permiteJornada && !item.solicitacao_origem_id, staleTime:30000, retry:1 });
  const plano = planoDoVoo(consultaPlanos.data || [],item);
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
    await Promise.all([permiteJornada ? consultaJornada.refetch() : Promise.resolve(), permiteJornada && !item.solicitacao_origem_id ? consultaHistorico.refetch() : Promise.resolve()]);
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
    <div className="grid gap-3 lg:grid-cols-12">
      <section className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-transparent bg-[#0D213A] p-3 text-white dark:border-slate-800 dark:bg-[#081220] lg:col-span-8">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-semibold tracking-wider text-sky-200">PLANO DE VOO</p><h2 className="text-base font-bold">Mapa de voo – {mapaReal ? "Rastreio registrado" : "Rota traçada"}</h2></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">{dataAgenda(item.data_agendada)} · {horaAgenda(item.horario_previsto_agendamento)}</span></div>
        <div className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#081220]">
          {mapaReal && rastreio ? <Suspense fallback={<p className="grid h-[300px] place-items-center text-sm">Carregando mapa…</p>}><MapaRastreio voo={rastreio} historico={!sinalAoVivo} compacto altura={300} /></Suspense> : a && b ? <MapaPlanejado origem={item.origem} destino={item.destino} a={a} b={b} /> : <div className="grid h-[300px] place-items-center px-4 text-center text-sm text-slate-300">{consultaOrigem.isLoading || consultaDestino.isLoading ? "Consultando coordenadas dos aeródromos…" : "Coordenadas da rota indisponíveis."}</div>}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-black/25 px-3 py-2 text-xs text-slate-200"><span className="flex items-center gap-1.5"><Clock3 size={14}/> Tempo estimado: <strong>{duracaoAgenda(minutos)}</strong></span><span className="flex items-center gap-1.5"><Navigation size={14}/> Distância: <strong>{km == null ? "—" : Math.round(km).toLocaleString("pt-BR")+" km"}</strong></span><span className="text-[11px] text-slate-400">{mapaReal ? sinalAoVivo ? "ADS-B" : "Histórico de sinal" : "Traçado direto de referência"} · {plano ? "Plano salvo" : "Estimativa, não é rota autorizada"}</span></div>
      </section>
      <section className={cardAgenda + " flex min-w-0 flex-col gap-3 p-4 lg:col-span-4"}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">FICHA DO VOO</p><h2 className="text-xl font-bold">Voo {item.numero_voo ? "#"+item.numero_voo.replace(/^#/,"") : "sem número"}</h2></div><StatusAgenda item={item}/></div>
        <div className={subcardAgenda + " flex min-h-20 items-center gap-3 px-3 py-2"}>{aeronave?.url_imagem && !fotoFalhou ? <img src={aeronave.url_imagem} alt="" className="h-16 w-28 shrink-0 object-contain" onError={() => setFotoFalhou(true)}/> : <Plane size={37} className="mx-3 shrink-0 text-[#1D6CE0] dark:text-sky-300"/>}<div className="min-w-0"><strong className="block text-base">{item.matricula_registro || aeronave?.matricula_registro || "Sem aeronave"}</strong><span className="block text-xs text-slate-500 dark:text-slate-400">{item.modelo || aeronave?.modelo || "—"}</span></div></div>
        {!vinculoValido && !encerrado && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">O vínculo com a operação original não está disponível. Confira o agendamento antes de iniciar horários.</p>}
        <dl className="flex-1"><Campo nome="Origem" valor={item.origem}/><Campo nome="Destino" valor={item.destino}/><Campo nome="Partida (prev. UTC)" valor={dataAgenda(item.data_agendada)+" · "+horaAgenda(item.horario_previsto_agendamento)}/><Campo nome="Chegada (prev. UTC)" valor={instanteTexto(chegada)}/><Campo nome="Duração (prev.)" valor={duracaoAgenda(minutos)}/></dl>
        {encerrado ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("dados")}>Ver detalhes do voo</button> :
        item.status === "pendente" ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("dados")}>Analisar solicitação</button> :
        acoes.podeFinalizar && !item.solicitacao_origem_id ? <button type="button" className={botaoAgenda} disabled={processando} onClick={() => aoFinalizar(item)}>Encerrar operação</button> :
        podeHorarios ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("horarios")}><Play size={15}/> {acoes.jornadaIniciada ? "Atualizar horários" : "Iniciar operação"}</button> :
        acoes.mostrarChecklist ? <button type="button" className={botaoAgenda} onClick={() => abrirAcao("checklist")}><Play size={15}/> Iniciar checklist de preparação</button> :
        <button type="button" className={botaoAgenda} onClick={() => abrirAcao("dados")}>Ver detalhes do voo</button>}
      </section>
    </div>
    <section className={cardAgenda + " min-w-0 p-3 sm:p-4"}>
      <nav className="flex flex-wrap gap-2 border-b border-slate-100 pb-3 dark:border-slate-800" aria-label="Detalhes operacionais">{abas.map(t => <button type="button" key={t.id} aria-pressed={tab === t.id} onClick={() => { setTab(t.id); setAcao(null); }} className={pillAgenda(tab === t.id)}>{t.label}</button>)}</nav>
      <div className="pt-3">
        {tab === "jornada" && <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-xs"><thead className="text-slate-500 dark:text-slate-400"><tr>{["#","Trecho","Partida (UTC)","Chegada (UTC)","Duração","Status"].map(t => <th key={t} className="px-2 py-2 font-medium">{t}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{pernas.map(p => <tr key={p.id}>{[p.jornada+"."+p.numero,p.origem+" → "+p.destino,instanteTexto(p.horario_dep),instanteTexto(p.horario_pouso),duracaoReal(p.horario_dep,p.horario_pouso),p.status].map((v,i) => <td className="px-2 py-2.5" key={i}>{v}</td>)}</tr>)}{futuros.map(p => <tr key={p.id}><td className="px-2 py-2.5">—</td><td className="px-2 py-2.5 font-semibold">{p.origem} → {p.destino}</td><td className="px-2 py-2.5">{dataAgenda(p.data_prevista)} · {horaAgenda(p.horario_previsto)}</td><td className="px-2 py-2.5">—</td><td className="px-2 py-2.5">—</td><td className="px-2 py-2.5">Planejada</td></tr>)}</tbody></table>
          {consultaJornada.isError ? <p role="alert" className="py-3 text-sm text-amber-700 dark:text-amber-300">Não foi possível consultar a jornada. <button className="underline" onClick={() => void consultaJornada.refetch()}>Tentar novamente</button></p> : consultaJornada.isLoading ? <p className="py-3 text-sm text-slate-500">Carregando jornada…</p> : !pernas.length && !futuros.length && <p className="py-3 text-sm text-slate-500 dark:text-slate-400">Ainda não há pernas registradas nesta jornada.</p>}
          {permiteJornada && (encerrado || podeHorarios) && <button type="button" className="mt-2 text-xs font-semibold text-[#1D6CE0] dark:text-sky-300" onClick={() => abrirAcao("horarios")}>{encerrado ? "Ver histórico completo" : "Abrir horários e jornada"} →</button>}
        </div>}
        {tab === "perna" && <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><div className={subcardAgenda+" p-3"}><p className="text-xs text-slate-500 dark:text-slate-400">Janela prevista (UTC)</p><strong className="text-sm">{horaAgenda(item.horario_previsto_agendamento)} → {horaAgenda(chegada)}</strong></div><div className={subcardAgenda+" p-3"}><p className="text-xs text-slate-500 dark:text-slate-400">Horários reais (UTC)</p><strong className="text-sm">{horaAgenda(depReal)} → {horaAgenda(pouReal)}</strong></div><div className={subcardAgenda+" p-3"}><p className="text-xs text-slate-500 dark:text-slate-400">Aeronave alocada</p><strong className="text-sm">{item.matricula_registro || "—"}</strong></div></div>
          <div className="grid gap-2 sm:grid-cols-2"><div className={subcardAgenda+" p-3 text-xs"}><strong>Plano de voo</strong><p className="mt-1 text-slate-500 dark:text-slate-400">{consultaPlanos.isError ? "Consulta indisponível" : consultaPlanos.isLoading ? "Consultando…" : plano ? "Plano salvo vinculado" : "Nenhum plano vinculado identificado"}</p>{plano?.payload?.rota?.flightplan?.route && <p className="mt-1 break-words">{String(plano.payload.rota.flightplan.route)}</p>}</div><div className={subcardAgenda+" p-3 text-xs"}><strong>Combustível do plano</strong><p className="mt-1 text-slate-500 dark:text-slate-400">{positivo(plano?.payload?.contexto?.aeronave?.consumo_combustivel) && positivo(plano?.payload?.combustivel?.total) ? Math.round(Number(plano.payload.combustivel.total)).toLocaleString("pt-BR") + " L previstos (etapa, reserva e táxi)" : "Sem cálculo de combustível vinculado"}</p></div></div>
          <div className="flex flex-wrap items-center gap-2">{acoes.mostrarChecklist && <button type="button" className={pillAgenda(acao==="checklist")} onClick={() => setAcao("checklist")}>Checklist</button>}{(podeHorarios || (encerrado && permiteJornada)) && <button type="button" className={pillAgenda(acao==="horarios")} onClick={() => setAcao("horarios")}>Horários e jornada</button>}{aoAbrirPlano && !encerrado && <button type="button" className={pillAgenda(false)} onClick={() => aoAbrirPlano(item.id)}><FileText size={13} className="mr-1 inline"/> Plano de voo</button>}{acoes.checklistConcluido && !encerrado && <PesoBalanceamentoFicha item={item} rotuloBotao="Peso e balanceamento"/>}<button type="button" className={pillAgenda(acao==="dados")} onClick={() => setAcao("dados")}>Dados do voo</button>{!encerrado && <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10" onClick={() => aoExcluir(item)}><Trash2 size={13}/> Remover</button>}</div>
          {acao === "checklist" && acoes.mostrarChecklist && <ChecklistPreVoo item={item} aoAtualizarProgresso={setProgresso} aoConcluir={atualizar}/>}
          {acao === "horarios" && (podeHorarios || (encerrado && permiteJornada)) && <JornadaVoo item={operacao} agendamentoSelecionado={planejada} modo={encerrado ? "historico" : "atualizar"} permitirMapa={false} voosEmOperacao={voosAoVivo} aoAbrirAgendamento={id => { const v=itens.find(x=>x.id===id); if(v) aoAbrir(v); }} aoAtualizarAgendamento={atualizar} aoFechar={() => setAcao(null)}/>}
          {acao === "dados" && detalhes}
        </div>}
        {tab === "proximo" && (proximo ? <div className={subcardAgenda+" flex flex-wrap items-center justify-between gap-3 p-4"}><div><p className="text-xs text-slate-500 dark:text-slate-400">Próximo voo da aeronave</p><strong>{proximo.numero_voo || "Sem número"} · {proximo.origem} → {proximo.destino}</strong><p className="mt-1 text-xs">Decolagem (UTC): {dataAgenda(proximo.data_agendada)} · {horaAgenda(proximo.horario_previsto_agendamento)}</p><p className="text-xs text-slate-500 dark:text-slate-400">Tempo de solo estimado: {duracaoAgenda(solo)}</p></div><button type="button" className={botaoAgenda} onClick={() => aoAbrir(proximo)}>Abrir próximo voo <ChevronRight size={15}/></button></div> : <p className="py-3 text-sm text-slate-500 dark:text-slate-400">Nenhum próximo agendamento confirmado identificado para esta aeronave.</p>)}
      </div>
    </section>
  </div>;
}
