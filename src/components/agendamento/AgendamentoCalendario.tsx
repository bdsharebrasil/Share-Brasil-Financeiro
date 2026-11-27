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
  const data = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
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
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function rotuloDia(iso: string, hoje: string) {
  const data = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const texto = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
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
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return texto.includes(termo);
    });
  }, [confirmados, pendentes, buscaVoo]);

  const intervaloDoPeriodo = (periodo: FiltroPeriodoAgenda): [string, string] =>
    periodo === "Hoje"
      ? [hoje, hoje]
      : periodo === "Amanhã"
        ? [amanha, amanha]
        : periodo === "Próximos 7 dias"
          ? [hoje, em7dias]
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

  const diasVisao =
    visao === "semanal"
      ? Array.from({ length: 7 }, (_, i) => new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + i))
      : dias;

  const rotuloPeriodoCalendario =
    visao === "semanal"
      ? `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()].slice(0, 3)} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()].slice(0, 3)} ${diasVisao[6].getFullYear()}`
      : `${nomesMeses[mes.getMonth()]} ${mes.getFullYear()}`;

  const aguardando = todosVoos.filter((voo) => rotuloStatusAgenda(voo.status).tom === "amarelo").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-2.5 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {modoExibicao === "lista-periodos" ? "Voos programados" : "Grade do calendário"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {modoExibicao === "lista-periodos"
                ? `${voosDoPeriodo.length} ${voosDoPeriodo.length === 1 ? "voo" : "voos"} em “${periodoFiltro}”`
                : "Clique em um voo para abrir ou no “+” de um dia para agendar"}
              {aguardando > 0 && (
                <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">
                  · {aguardando} pendente{aguardando === 1 ? "" : "s"}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModoExibicao((m) => (m === "lista-periodos" ? "grade-calendario" : "lista-periodos"))}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            {modoExibicao === "lista-periodos" ? (
              <>
                <CalendarDays size={14} className="text-primary" />
                Ver calendário
              </>
            ) : (
              <>
                <List size={14} className="text-primary" />
                Ver lista
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaVoo}
              onChange={(event) => aoMudarBuscaVoo(event.target.value)}
              placeholder="Buscar voo, rota, matrícula ou titular"
              aria-label="Buscar na agenda"
              className="h-9 rounded-lg border-border bg-secondary/40 pl-9 text-xs"
            />
          </div>

          {modoExibicao === "lista-periodos" && (
            <div
              role="group"
              aria-label="Período"
              className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-secondary/60 p-0.5 text-xs font-semibold text-muted-foreground"
            >
              {PERIODOS.map((periodo) => {
                const labelCurta = periodo === "Próximos 7 dias" ? "Próx. 7 dias" : periodo;
                return (
                  <button
                    key={periodo}
                    type="button"
                    aria-pressed={periodoFiltro === periodo}
                    onClick={() => setPeriodoFiltro(periodo)}
                    className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 transition-all ${
                      periodoFiltro === periodo ? "bg-card font-bold text-foreground shadow-2xs" : "hover:text-foreground"
                    }`}
                  >
                    {labelCurta}
                    <span className="rounded bg-background/70 px-1.5 text-[11px] font-bold">{voosPorPeriodo[periodo].length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {modoExibicao === "grade-calendario" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-lg border border-border bg-secondary/60 p-0.5 text-xs font-semibold text-muted-foreground">
                <button
                  type="button"
                  onClick={() => aoMudarVisao("semanal")}
                  className={`h-7 rounded-md px-2.5 ${visao === "semanal" ? "bg-card text-foreground shadow-2xs" : ""}`}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => aoMudarVisao("mensal")}
                  className={`h-7 rounded-md px-2.5 ${visao === "mensal" ? "bg-card text-foreground shadow-2xs" : ""}`}
                >
                  Mês
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Período anterior"
                  onClick={() => (visao === "semanal" ? aoMudarSemana(-1) : aoMudarMes(-1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="min-w-[130px] text-center text-xs font-bold text-foreground">{rotuloPeriodoCalendario}</span>
                <button
                  type="button"
                  aria-label="Próximo período"
                  onClick={() => (visao === "semanal" ? aoMudarSemana(1) : aoMudarMes(1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => aoNavegarParaData(hoje)}
                  className="h-8 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-secondary"
                >
                  Hoje
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modoExibicao === "lista-periodos" && (
        <div>
          {voosDoPeriodo.length ? (
            voosDoPeriodo.map((flight, indice) => {
              const { rotulo, tom } = rotuloStatusAgenda(flight.status);
              const pendente = tom === "amarelo";
              const novoDia =
                indice === 0 || flight.data_agendada.slice(0, 10) !== voosDoPeriodo[indice - 1].data_agendada.slice(0, 10);
              return (
                <div key={flight.id}>
                  {novoDia && periodoFiltro !== "Hoje" && periodoFiltro !== "Amanhã" && (
                    <div className="border-y border-border bg-secondary/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground first:border-t-0">
                      {rotuloDia(flight.data_agendada.slice(0, 10), hoje)}
                    </div>
                  )}
                  <article
                    className={`flex flex-col gap-2.5 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between ${
                      pendente ? "bg-amber-500/[.03]" : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          pendente
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        <Plane size={16} />
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-bold leading-snug text-foreground">
                          {flight.numero_voo || "Voo sem número"} · {formatarData(flight.data_agendada)}
                        </strong>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {flight.matricula_registro || "Aeronave a definir"} ·{" "}
                          {flight.socio_nome || flight.cliente_razao_social || "Titular não informado"}
                        </span>
                        {flight.solicitacao_origem_id && (
                          <span className="block text-[11px] font-semibold text-primary">Agendamento da mesma operação</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-center">
                      <div className="text-center">
                        <strong className="block font-mono text-sm font-bold leading-tight text-foreground">
                          {formatarHora(flight.horario_previsto_agendamento)}
                          <small className="ml-1 text-[10px] font-semibold text-muted-foreground">UTC</small>
                        </strong>
                        <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">{flight.origem}</span>
                      </div>
                      <div className="relative flex w-20 items-center justify-center border-t border-dashed border-border sm:w-28">
                        <div className="rounded-full bg-card px-1.5 text-muted-foreground">
                          <Plane size={14} className="rotate-45" />
                        </div>
                      </div>
                      <div className="text-center">
                        <strong className="block font-mono text-sm font-bold leading-tight text-foreground">
                          {flight.perna_atual_horario_pouso ? formatarHora(flight.perna_atual_horario_pouso) : "--:--"}
                        </strong>
                        <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">{flight.destino}</span>
                        {flight.perna_atual_horario_corte && (
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            COR {formatarHora(flight.perna_atual_horario_corte)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2.5 sm:min-w-[185px]">
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${CLASSE_TOM_STATUS[tom]}`}>{rotulo}</span>
                      <button
                        type="button"
                        onClick={() => aoAbrir(flight)}
                        className={`inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold shadow-2xs transition-all ${
                          pendente
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border border-border bg-card text-foreground hover:bg-secondary"
                        }`}
                      >
                        {pendente ? "Analisar" : "Detalhes"}
                      </button>
                    </div>
                  </article>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <CalendarDays size={28} className="text-muted-foreground/40" />
              <strong className="mt-2.5 block text-sm font-bold text-foreground">
                {buscaVoo.trim() ? "Nenhum voo encontrado para a busca" : `Nenhum voo agendado em “${periodoFiltro}”`}
              </strong>
              <span className="mt-1 text-xs text-muted-foreground">Escolha outro período acima ou cadastre um novo agendamento.</span>
              <Button type="button" onClick={() => aoNovoAgendamento()} className="mt-3.5 h-8 gap-1.5 rounded-lg px-3 text-xs">
                <Plus size={14} /> Novo agendamento
              </Button>
            </div>
          )}
        </div>
      )}

      {modoExibicao === "grade-calendario" && (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-border bg-secondary/50 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {nomesDias.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {diasVisao.map((dia) => {
                const chave = dataIso(dia);
                const eventos = eventosPorDia.get(chave) || [];
                const ehHoje = chave === hoje;
                const foraDoMes = visao === "mensal" && dia.getMonth() !== mes.getMonth();
                return (
                  <div
                    key={chave}
                    className={`group min-h-[96px] p-1.5 transition-colors hover:bg-secondary/40 ${foraDoMes ? "bg-secondary/20 opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold ${
                          ehHoje ? "bg-primary text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {dia.getDate()}
                      </span>
                      <div className="flex items-center gap-1">
                        {eventos.length > 0 && (
                          <span className="rounded bg-primary/10 px-1.5 text-[10px] font-bold text-primary">{eventos.length}</span>
                        )}
                        <button
                          type="button"
                          aria-label={`Novo agendamento em ${dia.toLocaleDateString("pt-BR")}`}
                          title="Agendar neste dia"
                          onClick={() => aoNovoAgendamento(chave)}
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 space-y-1">
                      {eventos.slice(0, 3).map((item) => {
                        const { tom } = rotuloStatusAgenda(item.status);
                        const continuacao = item.data_agendada.slice(0, 10) !== chave;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => aoAbrir(item)}
                            title={`${item.numero_voo || "Voo sem número"} · ${item.origem} → ${item.destino} · ${rotuloStatusAgenda(item.status).rotulo}`}
                            className={`w-full truncate rounded border px-1.5 py-0.5 text-left font-mono text-[11px] leading-snug hover:brightness-95 ${CLASSE_TOM_STATUS[tom]}`}
                          >
                            {continuacao ? "↳ " : `${formatarHora(item.horario_previsto_agendamento)} `}
                            {item.origem}→{item.destino}
                          </button>
                        );
                      })}
                      {eventos.length > 3 && (
                        <button type="button" onClick={() => setDiaAberto(chave)} className="block text-[11px] font-semibold text-primary">
                          +{eventos.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-amber-500" />
              Aguardando aprovação
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-emerald-500" />
              Confirmado / encerrado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-sky-500" />
              Em operação
            </span>
          </div>
        </div>
      )}

      <Dialog open={!!diaAberto} onOpenChange={(open) => !open && setDiaAberto(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Voos em {diaAberto ? formatarData(diaAberto) : ""}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Selecione o voo para abrir os detalhes operacionais.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto">
            {diaAberto &&
              (eventosPorDia.get(diaAberto) || []).map((v) => {
                const { rotulo, tom } = rotuloStatusAgenda(v.status);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setDiaAberto(null);
                      aoAbrir(v);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-xs font-bold text-foreground">
                        {v.numero_voo || "Voo a gerar"} · {v.origem} → {v.destino}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        {v.socio_nome || v.cliente_razao_social || "Cotista"} · {formatarHora(v.horario_previsto_agendamento)} UTC
                      </span>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold ${CLASSE_TOM_STATUS[tom]}`}>{rotulo}</span>
                  </button>
                );
              })}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const dia = diaAberto;
              setDiaAberto(null);
              aoNovoAgendamento(dia || undefined);
            }}
            className="mt-2 h-8 gap-1.5 text-xs"
          >
            <Plus size={14} /> Agendar neste dia
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}