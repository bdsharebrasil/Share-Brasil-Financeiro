import { ChevronRight, Folder, Plane, Plus, Radio } from "lucide-react";
import { useState, lazy, Suspense } from "react";
import type { SolicitacaoVooInterna, VooEmOperacao } from "@/lib/colaborador-api";
import { vooComSinalNoAr } from "@/lib/rastreio";
import { hojeBrasilia, operacaoNaData } from "@/lib/agendamentos-hoje";
import { agruparHistoricoAgenda, dataAgenda, emVooAgenda, filtrarAgenda, horaAgenda, statusNormalizado, type FiltroAgenda } from "./agendaOperacionalModel";
import { botaoAgenda, cardAgenda, pillAgenda } from "./AgendamentoShell";
const MapaAoVivo = lazy(() => import("@/components/dashboard/operacoes/VooEmOperacaoMapa"));

const classes = {
  verde: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
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

export function LinhaAgenda({ item, aoAbrir }: { item: SolicitacaoVooInterna; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  return <button type="button" onClick={() => aoAbrir(item)} className={cardAgenda + " grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left transition hover:border-[#1D6CE0]/50 hover:bg-sky-50/40 dark:hover:bg-[#182640] sm:grid-cols-[minmax(0,1fr)_140px_150px] sm:px-4"}>
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#1D6CE0] dark:bg-sky-500/10 dark:text-sky-300"><Plane size={19} /></span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5"><strong className="text-sm font-bold">{item.numero_voo ? "#" + item.numero_voo.replace(/^#/,"") : "Sem número"}</strong><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-[#182640] dark:text-slate-300">{item.matricula_registro || "Sem aeronave"}</span></span>
        <span className="mt-1 block font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{item.origem || "—"} → {item.destino || "—"}</span>
        <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400 sm:hidden">{dataAgenda(item.data_agendada)} · {horaAgenda(item.horario_previsto_agendamento)}</span>
      </span>
    </span>
    <span className="hidden text-center sm:block"><span className="block text-[10px] text-slate-500 dark:text-slate-400">Decolagem prevista (UTC)</span><strong className="block text-sm tabular-nums">{horaAgenda(item.horario_previsto_agendamento)}</strong><span className="block text-[10px] text-slate-500 dark:text-slate-400">{dataAgenda(item.data_agendada)}</span></span>
    <span className="flex items-center justify-end gap-2"><StatusAgenda item={item} /><ChevronRight size={16} className="shrink-0 text-slate-400" /></span>
  </button>;
}

export function ListaAgenda({ itens, filtro, aoFiltro, aoAbrir, aoNovo, carregando }: { itens: SolicitacaoVooInterna[]; filtro: FiltroAgenda; aoFiltro: (f: FiltroAgenda) => void; aoAbrir: (v: SolicitacaoVooInterna) => void; aoNovo: () => void; carregando: boolean }) {
  const voos = filtrarAgenda(itens, filtro, hojeBrasilia());
  const filtros = [{ id:"todos", label:"Todos" }, { id:"dia", label:"No Dia" }, { id:"confirmados", label:"Confirmados" }, { id:"pendentes", label:"Pendentes" }] as const;
  return <section className="mx-auto max-w-5xl space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Filtrar agendamentos">{filtros.map(f => <button key={f.id} type="button" aria-pressed={filtro === f.id} className={pillAgenda(filtro === f.id)} onClick={() => aoFiltro(f.id)}>{f.label}</button>)}</div>
      <button type="button" className={botaoAgenda} onClick={aoNovo}><Plus size={15}/> Novo agendamento</button>
    </div>
    <div className="space-y-2">{voos.map(item => <LinhaAgenda key={item.id} item={item} aoAbrir={aoAbrir} />)}</div>
    {carregando ? <p role="status" className="py-10 text-center text-sm text-slate-500">Carregando agendamentos…</p> : voos.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum agendamento neste filtro.</p> : null}
  </section>;
}

export function HistoricoAgenda({ itens, clientes, socios, aoAbrir, carregando }: { itens: SolicitacaoVooInterna[]; clientes: { id: string; nome: string }[]; socios: { id: string; cliente_id?: string | null }[]; aoAbrir: (v: SolicitacaoVooInterna) => void; carregando: boolean }) {
  const grupos = agruparHistoricoAgenda(itens, clientes, socios);
  return <section className="mx-auto max-w-5xl space-y-2.5">
    {grupos.map(([id, grupo]) => <details key={id} className={cardAgenda + " group p-3"}><summary className="flex cursor-pointer list-none items-center gap-3 px-1 py-2 font-semibold"><Folder size={20} className="text-[#1D6CE0]"/><span className="flex-1">{grupo.nome}</span><span className="text-xs font-normal text-slate-500 dark:text-slate-400">{grupo.voos.length} voo(s)</span><ChevronRight size={16} className="transition group-open:rotate-90"/></summary><div className="mt-3 space-y-2">{grupo.voos.map(item => <LinhaAgenda key={item.id} item={item} aoAbrir={aoAbrir} />)}</div></details>)}
    {!grupos.length && <p className="py-10 text-center text-sm text-slate-500">{carregando ? "Carregando histórico…" : "Nenhum voo no histórico."}</p>}
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
