import { ArrowLeft, ChevronRight, Folder, Plane, Plus, Radio } from "lucide-react";
import { useState, lazy, Suspense } from "react";
import { buscarPlanosVoo, type PlanoVooSalvo, type SolicitacaoVooInterna, type VooEmOperacao } from "@/lib/colaborador-api";
import { useQuery } from "@tanstack/react-query";
import { vooComSinalNoAr } from "@/lib/rastreio";
import { hojeBrasilia, operacaoNaData } from "@/lib/agendamentos-hoje";
import { agruparHistoricoAgenda, dataAgenda, duracaoAgenda, instanteAgenda, emVooAgenda, filtrarAgenda, horaAgenda, statusNormalizado, planoAgenda, type FiltroAgenda } from "./agendaOperacionalModel";
import { botaoAgenda, cardAgenda, pillAgenda } from "./AgendamentoShell";
const MapaAoVivo = lazy(() => import("@/components/dashboard/operacoes/VooEmOperacaoMapa"));

const classes = {
  verde: "bg-[rgba(104,238,93,0.63)] text-[#1F2723] border-[rgba(126,211,33,0.72)] dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  azul: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  amarelo: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  neutro: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-700",
};
export function StatusAgenda({ item }: { item: SolicitacaoVooInterna }) {
  const status = statusNormalizado(item.status);
  const [rotulo, cor] = emVooAgenda(item) ? ["Em voo", "azul"] as const :
    status === "pendente" ? ["Pendente", "amarelo"] as const :
    ["acionado", "em_solo"].includes(status) ? ["Em operação", "azul"] as const :
    status === "aprovada" ? (operacaoNaData(item, hojeBrasilia()) ? ["No dia", "azul"] as const : ["Confirmado", "verde"] as const) :
    [({ encerrada: "Encerrado", concluida: "Concluído", cancelada: "Cancelado", reprovada: "Reprovado" } as Record<string,string>)[status] || status || "Não informado", "neutro"] as const;
  return <span className={"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " + classes[cor]}><span className="h-1.5 w-1.5 rounded-full bg-current" />{rotulo}</span>;
}

export function LinhaAgenda({ item, aoAbrir, planos = [] }: { item: SolicitacaoVooInterna; aoAbrir: (item: SolicitacaoVooInterna) => void; planos?: PlanoVooSalvo[] }) {
  const plano = planoAgenda(planos,item);
  const real = !item.solicitacao_origem_id && item.perna_atual_origem === item.origem && item.perna_atual_destino === item.destino;
  const partida = real && item.perna_atual_horario_dep ? item.perna_atual_horario_dep : item.horario_previsto_agendamento;
  const inicio = instanteAgenda(item.data_agendada,partida);
  const pouso = real ? instanteAgenda(item.data_agendada,item.perna_atual_horario_pouso) : null;
  const minPlano = Number(plano?.payload?.minutos_voo);
  const minutos = inicio != null && pouso != null && pouso >= inicio ? (pouso-inicio)/60000 : Number.isFinite(minPlano) && minPlano > 0 ? minPlano : null;
  const chegada = pouso ?? (inicio != null && minutos != null ? inicio+minutos*60000 : null);
  const dia = item.data_agendada.slice(8,10)+"-"+item.data_agendada.slice(5,7)+"-"+item.data_agendada.slice(2,4);
  return <button type="button" onClick={() => aoAbrir(item)} className="group w-full rounded-[24px] border border-[rgba(92,93,93,0.66)] bg-white/95 px-4 py-3 text-left shadow-[0_4px_20px_-4px_rgba(11,34,68,0.06)] transition hover:border-[#1D6CE0]/50 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-[#111C30] dark:hover:bg-[#182640]">
    <span className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="font-[family-name:__Inter_d65c78,sans-serif] text-[18px] font-bold uppercase tracking-wide text-[#272C35] dark:text-slate-400">{dia}</span><span className="flex items-center gap-2"><StatusAgenda item={item}/><ChevronRight size={15} className="text-slate-400 transition group-hover:translate-x-0.5"/></span></span>
    <span className="grid grid-cols-[auto_minmax(0,1fr)_minmax(48px,1.2fr)_minmax(0,1fr)] items-center gap-2 sm:gap-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#1D6CE0] dark:bg-sky-500/10 dark:text-sky-300"><Plane size={22} className="rotate-45"/></span>
      <span><strong className="block text-base tabular-nums">{horaAgenda(partida)}</strong><span className="block text-[15px] font-semibold">{item.origem || "—"}</span><span className="block text-[10px] text-slate-500 dark:text-slate-400">{real && item.perna_atual_horario_dep ? "Partida real" : "Partida prevista"}</span></span>
      <span className="text-center"><span className="block text-[11px] font-semibold">{duracaoAgenda(minutos)}</span><span className="my-1 flex items-center gap-1 text-sky-600 dark:text-sky-300"><span className="h-1.5 w-1.5 shrink-0 rounded-full border border-current"/><span className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600"/><Plane size={14} className="rotate-45"/></span><span className="block text-[10px] text-slate-500 dark:text-slate-400">{pouso != null ? "Real" : "Estimado"}</span></span>
      <span className="text-right"><strong className="block text-base tabular-nums">{chegada != null ? horaAgenda(new Date(chegada).toISOString()) : "—"}</strong><span className="block text-[15px] font-semibold">{item.destino || "—"}</span><span className="block text-[10px] text-slate-500 dark:text-slate-400">{pouso != null ? "Chegada real" : "Chegada prevista"}{chegada != null && inicio != null && new Date(chegada).toISOString().slice(0,10) !== new Date(inicio).toISOString().slice(0,10) ? " · "+dataAgenda(new Date(chegada).toISOString()) : ""}</span></span>
    </span>
    <span className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400"><span className="text-[14px] text-[#2B3647] dark:text-slate-400">{item.numero_voo || "Sem número"}</span><span className="text-[#50585F] dark:text-slate-400">·</span><span className="text-[12px] text-[#171C22] dark:text-slate-400">{item.matricula_registro || "Sem aeronave"}</span><span>coloque aqui a tripulação escalada</span><span className="ml-auto">UTC/Zulu</span></span>
  </button>;
}

export function ListaAgenda({ itens, filtro, aoFiltro, aoAbrir, aoNovo, carregando }: { itens: SolicitacaoVooInterna[]; filtro: FiltroAgenda; aoFiltro: (f: FiltroAgenda) => void; aoAbrir: (v: SolicitacaoVooInterna) => void; aoNovo: () => void; carregando: boolean }) {
  const voos = filtrarAgenda(itens, filtro, hojeBrasilia());
  const { data: planos = [] } = useQuery({ queryKey:["agenda-shell-planos"],queryFn:buscarPlanosVoo,staleTime:30000 });
  const filtros = [{ id:"todos", label:"Todos" }, { id:"dia", label:"Hoje" }, { id:"confirmados", label:"Confirmados" }, { id:"pendentes", label:"Pendentes" }] as const;
  return <section className="mx-auto max-w-5xl space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Filtrar agendamentos">{filtros.map(f => <button key={f.id} type="button" aria-pressed={filtro === f.id} className={"rounded-full bg-[#1366D9] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#0F54B5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 " + (filtro === f.id ? "shadow-md ring-2 ring-sky-300" : "")} onClick={() => aoFiltro(f.id)}>{f.label}</button>)}</div>
      <button type="button" className={botaoAgenda} onClick={aoNovo}><Plus size={15}/> Novo agendamento</button>
    </div>
    <div className="space-y-2">{voos.map(item => <LinhaAgenda key={item.id} item={item} aoAbrir={aoAbrir} planos={planos} />)}</div>
    {carregando ? <p role="status" className="py-10 text-center text-sm text-slate-500">Carregando agendamentos…</p> : voos.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum agendamento neste filtro.</p> : null}
  </section>;
}

export function HistoricoAgenda({ itens, clientes, socios, aoAbrir, carregando, clienteSelecionado, aoSelecionarCliente }: { itens: SolicitacaoVooInterna[]; clientes: { id: string; nome: string }[]; socios: { id: string; cliente_id?: string | null }[]; aoAbrir: (v: SolicitacaoVooInterna) => void; carregando: boolean; clienteSelecionado: string | null; aoSelecionarCliente: (id: string | null) => void }) {
  const grupos = agruparHistoricoAgenda(itens, clientes, socios);
  const grupo = grupos.find(([id]) => id === clienteSelecionado)?.[1];
  const { data: planos = [] } = useQuery({ queryKey:["agenda-shell-planos"],queryFn:buscarPlanosVoo,staleTime:30000,enabled:Boolean(grupo) });
  return <section className="mx-auto max-w-5xl space-y-2.5">
    {clienteSelecionado ? <><button type="button" onClick={() => aoSelecionarCliente(null)} className={pillAgenda(false)}><ArrowLeft size={14} className="mr-1 inline"/> Voltar aos clientes</button><h2 className="py-1 text-lg font-bold">{grupo?.nome || "Cliente"} <span className="text-xs font-normal text-slate-500">· {grupo?.voos.length || 0} voo(s)</span></h2>{grupo?.voos.map(item => <LinhaAgenda key={item.id} item={item} aoAbrir={aoAbrir} planos={planos}/>)}{!grupo?.voos.length && <p className="py-6 text-sm text-slate-500">Nenhum voo neste cliente.</p>}</> :
    <>{grupos.map(([id, g]) => <button type="button" key={id} onClick={() => aoSelecionarCliente(id)} className={cardAgenda+" flex w-full items-center gap-3 p-4 text-left font-semibold hover:border-sky-500/50"}><Folder size={21} className="text-[#1D6CE0]"/><span className="flex-1">{g.nome}</span><span className="text-xs font-normal text-slate-500 dark:text-slate-400">{g.voos.length} voo(s)</span><ChevronRight size={16}/></button>)}{!grupos.length && <p className="py-10 text-center text-sm text-slate-500">{carregando ? "Carregando histórico…" : "Nenhum voo no histórico."}</p>}</>}
  </section>;
}

export function AoVivoAgenda({ voos, carregando, erro, atualizado, itens, aoAbrir }: { voos: VooEmOperacao[]; carregando: boolean; erro: string | null; atualizado: string | null; itens: SolicitacaoVooInterna[]; aoAbrir: (v: SolicitacaoVooInterna) => void }) {
  const [id, setId] = useState<string | null>(null);
  const voo = voos.find(v => v.id === id) || voos[0];
  const agendamento = itens.find(v => v.id === voo?.id);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><h2 className="flex items-center gap-2 font-semibold"><Radio size={17}/> Voos em operação</h2><span className="text-xs text-slate-500 dark:text-slate-400">{atualizado ? "Atualizado: " + horaAgenda(atualizado) : "Aguardando atualização"}</span></div>
    {erro && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Rastreio indisponível: {erro}. A última informação pode estar desatualizada.</p>}
    {!voos.length && <p className="py-10 text-center text-sm text-slate-500">{carregando ? "Carregando operações…" : "Nenhum voo em operação neste momento."}</p>}
    {voo && <>
      <div className="flex flex-wrap gap-2">{voos.map(v => <button key={v.id} type="button" aria-pressed={v.id === voo.id} className={pillAgenda(v.id === voo.id)} onClick={() => setId(v.id)}>{v.numero_voo || v.matricula_registro || "Sem número"} · {v.origem || "—"} → {v.destino || "—"}</button>)}</div>
      <div className={cardAgenda + " p-3"}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><strong>{voo.matricula_registro || "Aeronave não informada"} · {voo.modelo || "—"}</strong><p className="text-xs text-slate-500 dark:text-slate-400">{!erro && vooComSinalNoAr(voo) ? "Sinal ADS-B em voo" : "Sem posição ao vivo confirmada"}</p></div>{agendamento && <button type="button" className={botaoAgenda} onClick={() => aoAbrir(agendamento)}>Abrir voo <ChevronRight size={15}/></button>}</div>
      <Suspense fallback={<p role="status">Carregando mapa…</p>}><MapaAoVivo key={voo.id} voo={voo} historico={Boolean(erro) || !vooComSinalNoAr(voo)} altura={400} /></Suspense></div>
    </>}
  </section>;
}
