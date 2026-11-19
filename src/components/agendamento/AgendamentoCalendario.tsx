import "@/components/agendamento/agendamento-layout.css";
import { visualStatusAgendamento } from "@/components/agendamento/agendamentoVisual";
import { CabecalhoSecao } from "@/components/dashboard/ComponentesDashboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buscarExtratoJornadaTripulante, type AeronaveAgendamento, type DisponibilidadeTripulacao, type EscalaAgendamento, type JornadaVoo as JornadaVooRegistro, type SolicitacaoVooInterna, type TripulanteAgendamento } from "@/lib/colaborador-api";
import EscalaCalendario from "@/components/agendamento/EscalaCalendario";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plane, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CalendarioAgendamentoProps = {
  mes: Date;
  semana: Date;
  dias: Date[];
  visao: VisaoEscala;
  confirmados: SolicitacaoVooInterna[];
  pendentes: SolicitacaoVooInterna[];
  aeronaves: AeronaveAgendamento[];
  aoMudarMes: (delta: number) => void;
  aoMudarSemana: (delta: number) => void;
  aoMudarVisao: (visao: VisaoEscala) => void;
  buscaVoo: string;
  aoMudarBuscaVoo: (busca: string) => void;
  aoNavegarParaData: (data: string) => void;
  aoAbrir: (item: SolicitacaoVooInterna) => void;
};

export type VisaoEscala = "semanal" | "mensal";

const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function formatarHorarioAgendamento(valor: string | null | undefined) {
  if (!valor) return { utc: "—", brasilia: "—" };
  const texto = String(valor).trim();
  const instante = /^\d{4}-\d{2}-\d{2}T/.test(texto) ? new Date(texto) : (() => {
    const partes = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!partes) return new Date(NaN);
    return new Date(Date.UTC(1970, 0, 1, Number(partes[1]), Number(partes[2]), Number(partes[3] || 0)));
  })();
  if (!Number.isFinite(instante.getTime())) return { utc: "—", brasilia: "—" };
  const utc = instante.toISOString().slice(11, 16);
  const brasilia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(instante);
  return { utc, brasilia };
}

export function CalendarioAgendamento({ mes, semana, dias, visao, confirmados, pendentes, aeronaves, buscaVoo, aoMudarBuscaVoo, aoNavegarParaData, aoMudarMes, aoMudarSemana, aoMudarVisao, aoAbrir }: CalendarioAgendamentoProps) {
  const [diaAberto, setDiaAberto] = useState<Date | null>(null);
  const termoVoo = buscaVoo.trim().toLowerCase();
  const todosEventos = useMemo(() => [...confirmados, ...pendentes], [confirmados, pendentes]);
  const resultadosBusca = useMemo(() => {
    if (!termoVoo) return [];
    return todosEventos.filter((item) => [item.numero_voo, item.codigo_cliente, item.cliente_razao_social, item.socio_nome, item.origem, item.destino].filter(Boolean).join(" ").toLowerCase().includes(termoVoo)).slice(0, 8);
  }, [todosEventos, termoVoo]);
  const resultadoPrincipal = resultadosBusca[0];

  useEffect(() => {
    if (termoVoo.length >= 2 && resultadoPrincipal?.data_agendada) aoNavegarParaData(resultadoPrincipal.data_agendada);
  }, [termoVoo, resultadoPrincipal?.data_agendada, aoNavegarParaData]);

  const eventosPorDia = new Map<string, SolicitacaoVooInterna[]>();
  todosEventos
    .filter((item) => !termoVoo || [item.numero_voo, item.codigo_cliente, item.cliente_razao_social, item.socio_nome, item.origem, item.destino].filter(Boolean).join(" ").toLowerCase().includes(termoVoo))
    .forEach((item) => eventosPorDia.set(item.data_agendada, [...(eventosPorDia.get(item.data_agendada) || []), item]));
  const diasVisao = visao === "semanal" ? Array.from({ length: 7 }, (_, indice) => new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + indice)) : dias;
  const periodo = visao === "semanal"
    ? `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()]} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()]} ${diasVisao[6].getFullYear()}`
    : `${nomesMeses[mes.getMonth()]} ${mes.getFullYear()}`;
  const mudarPeriodo = visao === "semanal" ? aoMudarSemana : aoMudarMes;
  const descricao = visao === "semanal" ? "Visão semanal dos voos e solicitações" : "Visão mensal dos voos e solicitações";

  return <div className="agenda-calendario">
    <section className="agenda-calendario-painel overflow-hidden rounded-xl border border-border bg-card/75">
      <CabecalhoSecao icon={<CalendarDays size={15} />} title="Calendário de agendamento" detail={descricao} action={<div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative"><Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar voo agendado por número" value={buscaVoo} onChange={(event) => aoMudarBuscaVoo(event.target.value)} placeholder="Buscar nº do voo..." className="h-8 w-full pl-8 text-[10px] sm:w-44" /></div>
        <div className="flex rounded-md border border-border p-0.5"><button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "semanal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Semanal</button><button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded px-2 py-1 text-[9px] font-bold ${visao === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>Mensal</button></div>
        <div className="flex items-center gap-1"><button type="button" onClick={() => mudarPeriodo(-1)} aria-label={visao === "semanal" ? "Semana anterior" : "Mês anterior"} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronLeft size={15} /></button><span className="min-w-[110px] text-center text-[10px] font-bold sm:min-w-[150px]">{periodo}</span><button type="button" onClick={() => mudarPeriodo(1)} aria-label={visao === "semanal" ? "Próxima semana" : "Próximo mês"} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><ChevronRight size={15} /></button></div>
      </div>} />
      {termoVoo && <div className="border-b border-border bg-secondary/10 px-3 py-2"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">Resultados relacionados</p>{resultadosBusca.length ? <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">{resultadosBusca.map((item) => <button key={item.id} type="button" onClick={() => { aoNavegarParaData(item.data_agendada); aoAbrir(item); }} className="rounded-md border border-border/70 bg-card/60 p-2 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40"><p className="truncate text-[10px] font-bold text-primary">{item.numero_voo || "Sem número de voo"}</p><p className="truncate text-[9px] text-foreground">{item.codigo_cliente || item.cliente_razao_social || item.socio_nome || "Cliente não informado"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino} · {formatarData(item.data_agendada)}</p></button>)}</div> : <p className="text-[10px] text-muted-foreground">Nenhum voo encontrado para “{buscaVoo}”.</p>}</div>}
      <div className="agenda-calendario-semana grid grid-cols-7 border-b border-border bg-secondary/20">{nomesDias.map((dia) => <div key={dia} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{dia}</div>)}</div>
      <div className="agenda-calendario-dias grid grid-cols-7" data-modo={visao} style={{ gridTemplateRows: `repeat(${Math.ceil(diasVisao.length / 7)},minmax(0,1fr))` }}>
        {diasVisao.map((dia) => {
          const chave = dataIso(dia);
          const eventos = eventosPorDia.get(chave) || [];
          const noMes = visao === "semanal" || dia.getMonth() === mes.getMonth();
          const hoje = chave === dataIso(new Date());
          return <div key={chave} className={`agenda-calendario-dia border-b border-r border-border/60 p-2 ${noMes ? "bg-card/25" : "bg-background/25"}`}>
            <button type="button" onClick={() => setDiaAberto(dia)} aria-label={`${eventos.length} voo(s) em ${dia.toLocaleDateString("pt-BR")}`} className={`agenda-calendario-numero mb-2 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${hoje ? "bg-primary text-primary-foreground" : noMes ? "text-foreground" : "text-muted-foreground"}`}>{dia.getDate()}{eventos.length > 0 && <small className="agenda-calendario-contagem">{eventos.length}</small>}</button>
            <div className="space-y-1.5">{eventos.slice(0, visao === "mensal" ? 1 : 3).map((item) => <ResumoVooCalendario compacto={visao === "mensal"} key={item.id} item={item} aeronave={item.matricula_registro || aeronaves.find((aeronave) => aeronave.id === item.aeronave_id)?.matricula_registro || "Aeronave a definir"} aoAbrir={aoAbrir} />)}{eventos.length > (visao === "mensal" ? 1 : 3) && <button type="button" className="agenda-calendario-mais" onClick={() => setDiaAberto(dia)}>+{eventos.length - (visao === "mensal" ? 1 : 3)} voos</button>}</div>
          </div>;
        })}
      </div>
    </section>
    <Dialog open={!!diaAberto} onOpenChange={(open) => { if (!open) setDiaAberto(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-xl"><DialogHeader><DialogTitle>Voos de {diaAberto?.toLocaleDateString("pt-BR")}</DialogTitle><DialogDescription>Selecione um voo para abrir seus detalhes.</DialogDescription></DialogHeader><div className="grid gap-2">{diaAberto && (eventosPorDia.get(dataIso(diaAberto)) || []).map((item) => <ResumoVooCalendario key={item.id} item={item} aeronave={item.matricula_registro || "Aeronave a definir"} aoAbrir={(voo) => { setDiaAberto(null); aoAbrir(voo); }} />)}</div></DialogContent></Dialog>
  </div>;
}

function ResumoVooCalendario({ item, aeronave, aoAbrir, compacto = false }: { compacto?: boolean; item: SolicitacaoVooInterna; aeronave: string; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  const visual = visualStatusAgendamento(item.status);
  const horario = formatarHorarioAgendamento(item.horario_previsto_agendamento);
  if (compacto) return <button type="button" onClick={() => aoAbrir(item)} title={`${item.numero_voo || "Solicitação"} · ${item.origem} → ${item.destino} · ${aeronave} · ${horario.utc} UTC`} className={`agenda-calendario-evento-compacto w-full truncate rounded border px-1 py-0.5 text-left text-[10px] ${visual.evento}`}>{item.numero_voo || horario.utc} · {item.origem}–{item.destino}</button>;
  return <button type="button" onClick={() => aoAbrir(item)} className={`agenda-calendario-evento w-full rounded-md border p-2 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${visual.evento}`}><div className="flex items-start gap-1.5"><Plane size={12} className={`mt-0.5 shrink-0 ${visual.icone}`} /><div className="min-w-0"><p className="truncate text-[10px] font-bold">{item.numero_voo || "Solicitação sem número"}</p><p className="truncate text-[9px] text-muted-foreground">{item.origem} → {item.destino}</p><p className="truncate text-[9px] text-muted-foreground">{aeronave}</p><p className="mt-1 text-[9px] font-semibold leading-tight text-foreground">UTC: {horario.utc}</p><p className="text-[9px] font-semibold leading-tight text-foreground">Brasília: {horario.brasilia}</p></div></div></button>;
}

export function Escala({ tripulacao, escala, disponibilidades, aoMarcar, aoAbrirVoo }: { tripulacao: TripulanteAgendamento[]; escala: EscalaAgendamento[]; disponibilidades: DisponibilidadeTripulacao[]; aoMarcar: () => void; aoAbrirVoo: (id: string) => void }) {
  const [extratoTripulante, setExtratoTripulante] = useState<TripulanteAgendamento | null>(null);
  const [extratoPeriodo, setExtratoPeriodo] = useState("");
  const [extratoJornadas, setExtratoJornadas] = useState<JornadaVooRegistro[]>([]);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [erroExtrato, setErroExtrato] = useState("");

  const abrirExtrato = async (item: TripulanteAgendamento, inicio: string, fim: string) => {
    setExtratoTripulante(item);
    setExtratoPeriodo(`${formatarData(inicio)} – ${formatarData(fim)}`);
    setExtratoJornadas([]);
    setErroExtrato("");
    setCarregandoExtrato(true);
    try {
      const resposta = await buscarExtratoJornadaTripulante(item.id, inicio, fim);
      setExtratoJornadas(Array.isArray(resposta?.jornadas) ? resposta.jornadas : []);
    } catch (error) {
      setErroExtrato(error instanceof Error ? error.message : "Não foi possível carregar o extrato de jornada.");
    } finally {
      setCarregandoExtrato(false);
    }
  };

  return <>
    <EscalaCalendario tripulacao={tripulacao} escala={escala} disponibilidades={disponibilidades} aoCriarEscala={aoMarcar} aoAbrirVoo={aoAbrirVoo} aoAbrirExtrato={abrirExtrato} />
    <Dialog open={Boolean(extratoTripulante)} onOpenChange={(aberto) => { if (!aberto && !carregandoExtrato) setExtratoTripulante(null); }}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border-cyan-300/20 bg-card dark:bg-card sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-base text-white">Extrato de jornada</DialogTitle><DialogDescription className="text-xs text-muted-foreground dark:text-slate-400">{extratoTripulante?.nome_completo} · {extratoTripulante?.canac} · {extratoPeriodo}</DialogDescription></DialogHeader>
        {carregandoExtrato && <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground dark:text-slate-400"><RefreshCw size={14} className="animate-spin" /> Carregando jornadas do tripulante...</div>}
        {!carregandoExtrato && erroExtrato && <div className="rounded-lg border border-red-300/20 bg-red-300/10 p-3 text-xs text-red-200">{erroExtrato}</div>}
        {!carregandoExtrato && !erroExtrato && !extratoJornadas.length && <div className="rounded-lg border border-border dark:border-white/[.08] bg-white/[.03] p-6 text-center text-xs text-muted-foreground dark:text-slate-400">Nenhuma jornada registrada para este tripulante no período selecionado.</div>}
        {!carregandoExtrato && !erroExtrato && extratoJornadas.length > 0 && <div className="space-y-2">{extratoJornadas.map((jornada) => <div key={jornada.id} className="rounded-xl border border-border dark:border-white/[.08] bg-white/[.03] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-white">{jornada.numero_voo || "Jornada operacional"} · Jornada {jornada.numero_jornada}</p><p className="mt-1 text-[10px] text-muted-foreground dark:text-slate-400">{formatarData(jornada.data)} · {jornada.origem || "—"} → {jornada.destino || "—"} · {jornada.matricula_registro || "Aeronave não informada"}</p><p className="mt-1 text-[10px] font-semibold text-cyan-200">{jornada.tripulante_nome || extratoTripulante?.nome_completo} · {jornada.funcao_tripulante}</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] font-bold text-emerald-200">{jornada.status === "encerrada" ? "Encerrada" : "Em andamento"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div><span className="block text-[9px] text-slate-500">Apresentação</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_apresentacao ? jornada.horario_apresentacao.slice(11, 16) : "—"}</strong></div><div><span className="block text-[9px] text-slate-500">Acionamento</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_acionamento ? jornada.horario_acionamento.slice(11, 16) : "—"}</strong></div><div><span className="block text-[9px] text-slate-500">Pouso</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_pouso ? jornada.horario_pouso.slice(11, 16) : "—"}</strong></div><div><span className="block text-[9px] text-slate-500">Corte</span><strong className="text-[10px] text-foreground dark:text-slate-200">{jornada.horario_corte ? jornada.horario_corte.slice(11, 16) : "—"}</strong></div></div>{jornada.pernas?.length > 0 && <div className="mt-3 space-y-1.5">{jornada.pernas.map((perna) => <div key={perna.id} className="rounded-lg border border-border dark:border-white/[.06] px-2.5 py-2 text-[10px] text-muted-foreground dark:text-slate-300">Perna {perna.numero}: {perna.origem} → {perna.destino} · AC {perna.horario_ac?.slice(11, 16) || "—"} · COR {perna.horario_corte?.slice(11, 16) || "—"}</div>)}</div>}</div>)}</div>}
      </DialogContent>
    </Dialog>
  </>;
}

export function AgendaHojeResumo({ voos, pendentes, carregando, aoAbrir }: { voos: SolicitacaoVooInterna[]; pendentes: SolicitacaoVooInterna[]; carregando: boolean; aoAbrir: (item: SolicitacaoVooInterna) => void }) {
  return <aside className="agenda-hoje-card rounded-2xl border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4"><div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-primary">Acompanhamento</p><h2 className="mt-1 text-sm font-extrabold tracking-tight">Agenda de hoje</h2><p className="mt-1 text-[10px] text-muted-foreground">Rotas com checklist concluído</p></div><span className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(" de ", " ")}</span></div>
    <div className="agenda-hoje-lista">
      {carregando && <div className="agenda-hoje-empty">Carregando voos...</div>}
      {!carregando && !voos.length && <div className="agenda-hoje-empty"><CalendarDays size={18} /><span>Nenhum voo confirmado para hoje.</span></div>}
      {!carregando && voos.slice(0, 5).map((voo) => <button key={voo.id} type="button" onClick={() => aoAbrir(voo)} className="agenda-hoje-flight" title="Abrir agendamento"><span className="agenda-hoje-time">{voo.horario_previsto_agendamento ? voo.horario_previsto_agendamento.slice(11, 16) : "—"}</span><span className="min-w-0 flex-1"><strong>{voo.origem || "—"} <span>→</span> {voo.destino || "—"}</strong><small>{voo.numero_voo || "Aguardando número"} · {voo.matricula_registro || "Aeronave a definir"}</small></span><ChevronRight size={14} /></button>)}
      {!carregando && pendentes.map((pendente) => <button key={`pendente-${pendente.id}`} type="button" onClick={() => aoAbrir(pendente)} className="agenda-hoje-flight agenda-hoje-pending" title="Abrir solicitação pendente"><span className="agenda-hoje-time">{pendente.horario_previsto_agendamento ? pendente.horario_previsto_agendamento.slice(11, 16) : "—"}</span><span className="min-w-0 flex-1"><strong>{pendente.origem || "—"} <span>→</span> {pendente.destino || "—"}</strong><small>Pendente · {pendente.cliente_razao_social || pendente.socio_nome || "Titular não informado"}</small></span><ChevronRight size={14} /></button>)}
    </div>
    {pendentes.length > 3 && <button type="button" onClick={() => aoAbrir(pendentes[0])} className="agenda-hoje-alert"><Clock3 size={15} /><span><strong>{pendentes.length} solicitação(ões)</strong><small>abrir a primeira pendência</small></span><ChevronRight size={14} /></button>}
  </aside>;
}
