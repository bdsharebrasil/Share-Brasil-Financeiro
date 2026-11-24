import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hojeBrasilia } from "@/lib/agendamentos-hoje";
import type { AeronaveAgendamento, SolicitacaoVooInterna } from "@/lib/colaborador-api";
import {
  CLASSE_TOM_STATUS,
  ordenarPorDataHorario,
  rotuloStatusAgenda,
  vooTocaIntervalo,
} from "@/components/agendamento/agendamentoFluxo";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plane, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

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
  /** Abre o cadastro de novo agendamento; recebe a data quando o clique veio de um dia do calendário. */
  aoNovoAgendamento: (data?: string) => void;
};

export type VisaoEscala = "semanal" | "mensal";
type FiltroPeriodoAgenda = "Hoje" | "Amanhã" | "Próximos 7 dias" | "Todos";

const PERIODOS: FiltroPeriodoAgenda[] = ["Hoje", "Amanhã", "Próximos 7 dias", "Todos"];
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** Soma dias a uma data ISO sem depender do fuso do navegador. */
function somarDias(iso: string, dias: number) {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function formatarHora(valor: string | null | undefined) {
  if (!valor) return "--:--";
  const texto = String(valor).trim();
  const parte = texto.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return parte ? `${parte[1].padStart(2, "0")}:${parte[2]}` : texto.slice(0, 5);
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function rotuloDia(iso: string, hoje: string) {
  const data = new Date(`${iso}T12:00:00`);
  const texto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const prefixo = iso === hoje ? "Hoje · " : iso === somarDias(hoje, 1) ? "Amanhã · " : "";
  return `${prefixo}${texto}`;
}

export function CalendarioAgendamento({
  mes,
  semana,
  dias,
  visao,
  confirmados,
  pendentes,
  buscaVoo,
  aoMudarBuscaVoo,
  aoNavegarParaData,
  aoMudarMes,
  aoMudarSemana,
  aoMudarVisao,
  aoAbrir,
  aoNovoAgendamento,
}: CalendarioAgendamentoProps) {
  const [modoExibicao, setModoExibicao] = useState<"lista-periodos" | "grade-calendario">("lista-periodos");
  const [periodoFiltro, setPeriodoFiltro] = useState<FiltroPeriodoAgenda>("Hoje");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  // Tudo no fuso de Brasília, que é o fuso de quem coordena a operação.
  const hoje = hojeBrasilia();
  const amanha = somarDias(hoje, 1);
  const em7dias = somarDias(hoje, 7);

  const todosVoos = useMemo(() => {
    const termo = buscaVoo.trim().toLocaleLowerCase("pt-BR");
    const porId = new Map<string, SolicitacaoVooInterna>();
    [...confirmados, ...pendentes].forEach((voo) => porId.set(voo.id, voo));
    return [...porId.values()].filter((voo) => {
      if (!termo) return true;
      const texto = [voo.numero_voo, voo.matricula_registro, voo.origem, voo.destino, voo.cliente_razao_social, voo.socio_nome, voo.codigo_cliente]
        .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return texto.includes(termo);
    });
  }, [confirmados, pendentes, buscaVoo]);

  const intervaloDoPeriodo = (periodo: FiltroPeriodoAgenda): [string, string] =>
    periodo === "Hoje" ? [hoje, hoje]
      : periodo === "Amanhã" ? [amanha, amanha]
        : periodo === "Próximos 7 dias" ? [hoje, em7dias]
          : [hoje, "9999-12-31"];

  const voosPorPeriodo = useMemo(() => {
    const resultado = {} as Record<FiltroPeriodoAgenda, SolicitacaoVooInterna[]>;
    PERIODOS.forEach((periodo) => {
      const [de, ate] = intervaloDoPeriodo(periodo);
      resultado[periodo] = ordenarPorDataHorario(todosVoos.filter((voo) => vooTocaIntervalo(voo, de, ate)));
    });
    return resultado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosVoos, hoje]);
  const voosDoPeriodo = voosPorPeriodo[periodoFiltro];

  // Um voo de vários dias aparece em cada dia que ele ocupa.
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, SolicitacaoVooInterna[]>();
    todosVoos.forEach((item) => {
      const inicio = item.data_agendada.slice(0, 10);
      const fim = (item.data_fim || item.data_agendada).slice(0, 10);
      for (let dia = inicio, i = 0; dia <= fim && i < 31; dia = somarDias(dia, 1), i++) {
        mapa.set(dia, [...(mapa.get(dia) || []), item]);
      }
    });
    mapa.forEach((lista, chave) => mapa.set(chave, ordenarPorDataHorario(lista)));
    return mapa;
  }, [todosVoos]);

  const diasVisao = visao === "semanal"
    ? Array.from({ length: 7 }, (_, i) => new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + i))
    : dias;

  const rotuloPeriodoCalendario = visao === "semanal"
    ? `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()].slice(0, 3)} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()].slice(0, 3)} ${diasVisao[6].getFullYear()}`
    : `${nomesMeses[mes.getMonth()]} ${mes.getFullYear()}`;

  const aguardando = todosVoos.filter((voo) => rotuloStatusAgenda(voo.status).tom === "amarelo").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Agenda de voos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {modoExibicao === "lista-periodos"
              ? `${voosDoPeriodo.length} ${voosDoPeriodo.length === 1 ? "voo" : "voos"} em “${periodoFiltro}”`
              : "Clique em um voo para abrir ou no “+” de um dia para agendar nele"}
            {aguardando > 0 && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">· {aguardando} aguardando aprovação</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaVoo}
              onChange={(event) => aoMudarBuscaVoo(event.target.value)}
              placeholder="Buscar voo, rota, matrícula ou titular"
              aria-label="Buscar na agenda"
              className="h-9 rounded-lg border-border bg-secondary/40 pl-9 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setModoExibicao((m) => (m === "lista-periodos" ? "grade-calendario" : "lista-periodos"))}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            {modoExibicao === "lista-periodos" ? (
              <><CalendarDays size={14} className="text-[#3867ed]" />Ver calendário</>
            ) : (
              <><List size={14} className="text-[#3867ed]" />Ver lista</>
            )}
          </button>

          {modoExibicao === "lista-periodos" && (
            <div role="group" aria-label="Período" className="flex items-center gap-1 rounded-xl border border-border bg-secondary p-1 text-xs font-semibold text-muted-foreground">
              {PERIODOS.map((periodo) => (
                <button
                  key={periodo}
                  type="button"
                  aria-pressed={periodoFiltro === periodo}
                  onClick={() => setPeriodoFiltro(periodo)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${periodoFiltro === periodo ? "bg-card font-bold text-foreground shadow-sm" : "hover:text-foreground"}`}
                >
                  {periodo}
                  <span className="rounded-full bg-background/60 px-1.5 text-[10px] font-bold">{voosPorPeriodo[periodo].length}</span>
                </button>
              ))}
            </div>
          )}

          {modoExibicao === "grade-calendario" && (
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-lg border border-border bg-secondary p-0.5 text-xs font-semibold text-muted-foreground">
                <button type="button" onClick={() => aoMudarVisao("semanal")} className={`rounded-md px-2.5 py-1 ${visao === "semanal" ? "bg-card text-foreground shadow-sm" : ""}`}>Semana</button>
                <button type="button" onClick={() => aoMudarVisao("mensal")} className={`rounded-md px-2.5 py-1 ${visao === "mensal" ? "bg-card text-foreground shadow-sm" : ""}`}>Mês</button>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Período anterior" onClick={() => (visao === "semanal" ? aoMudarSemana(-1) : aoMudarMes(-1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"><ChevronLeft size={14} /></button>
                <span className="min-w-[150px] text-center text-xs font-bold text-foreground">{rotuloPeriodoCalendario}</span>
                <button type="button" aria-label="Próximo período" onClick={() => (visao === "semanal" ? aoMudarSemana(1) : aoMudarMes(1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"><ChevronRight size={14} /></button>
                <button type="button" onClick={() => aoNavegarParaData(hoje)} className="h-8 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-secondary">Hoje</button>
              </div>
            </div>
          )}

          <Button type="button" onClick={() => aoNovoAgendamento()} className="h-9 gap-1.5 rounded-lg bg-[#3867ed] text-xs font-semibold text-white shadow-sm hover:bg-[#2959df]">
            <Plus size={15} /> Novo agendamento
          </Button>
        </div>
      </div>

      {modoExibicao === "lista-periodos" && (
        <div>
          {voosDoPeriodo.length ? (
            voosDoPeriodo.map((flight, indice) => {
              const { rotulo, tom } = rotuloStatusAgenda(flight.status);
              const pendente = tom === "amarelo";
              const novoDia = indice === 0 || flight.data_agendada.slice(0, 10) !== voosDoPeriodo[indice - 1].data_agendada.slice(0, 10);
              return (
                <div key={flight.id}>
                  {novoDia && periodoFiltro !== "Hoje" && periodoFiltro !== "Amanhã" && (
                    <div className="border-y border-border bg-secondary/60 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground first:border-t-0">
                      {rotuloDia(flight.data_agendada.slice(0, 10), hoje)}
                    </div>
                  )}
                  <article className={`flex flex-col gap-4 border-b border-border p-5 transition-colors hover:bg-secondary/60 sm:flex-row sm:items-center sm:justify-between ${pendente ? "border-l-4 border-l-amber-500" : ""}`}>
                    <div className="flex min-w-[220px] items-center gap-3.5">
                      <div className={`grid h-10 w-10 place-items-center rounded-xl ${pendente ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-500"}`}>
                        <Plane size={18} />
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-bold text-foreground">
                          {flight.numero_voo || "Voo sem número"} · {formatarData(flight.data_agendada)}
                        </strong>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {flight.matricula_registro || "Aeronave a definir"} · {flight.socio_nome || flight.cliente_razao_social || "Titular não informado"}
                        </span>
                        {flight.solicitacao_origem_id && <span className="text-[10px] font-semibold text-primary">Agendamento da mesma operação</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 py-2 sm:py-0">
                      <div className="text-center">
                        <strong className="block font-mono text-sm font-bold text-foreground">
                          {formatarHora(flight.horario_previsto_agendamento)}<small className="ml-0.5 text-[9px] font-semibold text-muted-foreground">UTC</small>
                        </strong>
                        <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">{flight.origem}</span>
                      </div>
                      <div className="relative flex w-24 items-center justify-center border-t-2 border-dashed border-border sm:w-36">
                        <div className="rounded-full bg-card px-2 text-muted-foreground"><Plane size={15} className="rotate-45" /></div>
                      </div>
                      <div className="text-center">
                        <strong className="block font-mono text-sm font-bold text-foreground">
                          {flight.perna_atual_horario_pouso ? formatarHora(flight.perna_atual_horario_pouso) : "--:--"}
                        </strong>
                        <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">{flight.destino}</span>
                        {flight.perna_atual_horario_corte && <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">COR {formatarHora(flight.perna_atual_horario_corte)}</span>}
                      </div>
                    </div>

                    <div className="flex min-w-[200px] items-center justify-end gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${CLASSE_TOM_STATUS[tom]}`}>{rotulo}</span>
                      <button
                        type="button"
                        onClick={() => aoAbrir(flight)}
                        className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-semibold shadow-sm transition-all ${pendente ? "bg-[#3867ed] text-white hover:bg-[#2959df]" : "border border-border bg-card text-foreground hover:bg-secondary"}`}
                      >
                        {pendente ? "Analisar" : "Detalhes"}
                      </button>
                    </div>
                  </article>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <CalendarDays size={32} className="text-muted-foreground/40" />
              <strong className="mt-3 block text-sm font-bold text-foreground">
                {buscaVoo.trim() ? "Nenhum voo encontrado para a busca" : `Nenhum voo agendado em “${periodoFiltro}”`}
              </strong>
              <span className="mt-1 text-xs text-muted-foreground">Escolha outro período acima ou cadastre um novo agendamento.</span>
              <Button type="button" onClick={() => aoNovoAgendamento()} className="mt-4 h-9 gap-1.5 rounded-lg text-xs"><Plus size={14} /> Novo agendamento</Button>
            </div>
          )}
        </div>
      )}

      {modoExibicao === "grade-calendario" && (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-border bg-secondary text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {nomesDias.map((d) => <div key={d} className="py-2.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {diasVisao.map((dia) => {
                const chave = dataIso(dia);
                const eventos = eventosPorDia.get(chave) || [];
                const ehHoje = chave === hoje;
                const foraDoMes = visao === "mensal" && dia.getMonth() !== mes.getMonth();
                return (
                  <div key={chave} className={`group min-h-[110px] p-2 transition-colors hover:bg-secondary/50 ${foraDoMes ? "bg-secondary/20 opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold ${ehHoje ? "bg-[#3867ed] text-white" : "text-foreground"}`}>{dia.getDate()}</span>
                      <div className="flex items-center gap-1">
                        {eventos.length > 0 && <span className="rounded-full bg-[#3867ed]/10 px-1.5 text-[10px] font-bold text-[#3867ed]">{eventos.length}</span>}
                        <button
                          type="button"
                          aria-label={`Novo agendamento em ${dia.toLocaleDateString("pt-BR")}`}
                          title="Agendar neste dia"
                          onClick={() => aoNovoAgendamento(chave)}
                          className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-[#3867ed]/10 hover:text-[#3867ed] focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {eventos.slice(0, 3).map((item) => {
                        const { tom } = rotuloStatusAgenda(item.status);
                        const continuacao = item.data_agendada.slice(0, 10) !== chave;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => aoAbrir(item)}
                            title={`${item.numero_voo || "Voo sem número"} · ${item.origem} → ${item.destino} · ${rotuloStatusAgenda(item.status).rotulo}`}
                            className={`w-full truncate rounded border px-1.5 py-0.5 text-left font-mono text-[10px] hover:brightness-95 ${CLASSE_TOM_STATUS[tom]}`}
                          >
                            {continuacao ? "↳ " : `${formatarHora(item.horario_previsto_agendamento)} `}{item.origem}→{item.destino}
                          </button>
                        );
                      })}
                      {eventos.length > 3 && (
                        <button type="button" onClick={() => setDiaAberto(chave)} className="block text-[10px] font-semibold text-[#3867ed]">+{eventos.length - 3} mais</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Aguardando aprovação</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Confirmado / encerrado</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />Em operação</span>
          </div>
        </div>
      )}

      <Dialog open={!!diaAberto} onOpenChange={(open) => !open && setDiaAberto(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Voos em {diaAberto ? formatarData(diaAberto) : ""}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Selecione o voo para abrir os detalhes operacionais.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
            {diaAberto && (eventosPorDia.get(diaAberto) || []).map((v) => {
              const { rotulo, tom } = rotuloStatusAgenda(v.status);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setDiaAberto(null); aoAbrir(v); }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left hover:bg-secondary"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-xs font-bold text-foreground">{v.numero_voo || "Voo a gerar"} · {v.origem} → {v.destino}</strong>
                    <span className="text-[11px] text-muted-foreground">{v.socio_nome || v.cliente_razao_social || "Cotista"} · {formatarHora(v.horario_previsto_agendamento)} UTC</span>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${CLASSE_TOM_STATUS[tom]}`}>{rotulo}</span>
                </button>
              );
            })}
          </div>
          <Button type="button" variant="outline" onClick={() => { const dia = diaAberto; setDiaAberto(null); aoNovoAgendamento(dia || undefined); }} className="mt-2 h-9 gap-1.5 text-xs"><Plus size={14} /> Agendar neste dia</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
