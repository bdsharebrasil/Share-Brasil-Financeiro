import { visualStatusAgendamento } from "@/components/agendamento/agendamentoVisual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buscarExtratoJornadaTripulante,
  type AeronaveAgendamento,
  type DisponibilidadeTripulacao,
  type EscalaAgendamento,
  type JornadaVoo as JornadaVooRegistro,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
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
type FiltroPeriodoAgenda = "Hoje" | "Amanhã" | "Próximos dias" | "Semana";

const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomesDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
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

export function CalendarioAgendamento({
  mes,
  semana,
  dias,
  visao,
  confirmados,
  pendentes,
  aeronaves,
  buscaVoo,
  aoMudarBuscaVoo,
  aoNavegarParaData,
  aoMudarMes,
  aoMudarSemana,
  aoMudarVisao,
  aoAbrir,
}: CalendarioAgendamentoProps) {
  const [modoExibicao, setModoExibicao] = useState<"lista-periodos" | "grade-calendario">("lista-periodos");
  const [periodoFiltro, setPeriodoFiltro] = useState<FiltroPeriodoAgenda>("Hoje");
  const [diaAberto, setDiaAberto] = useState<Date | null>(null);

  const hoje = dataIso(new Date());
  const amanhaDate = new Date();
  amanhaDate.setDate(amanhaDate.getDate() + 1);
  const amanha = dataIso(amanhaDate);

  const semanaFimDate = new Date();
  semanaFimDate.setDate(semanaFimDate.getDate() + 7);
  const semanaFim = dataIso(semanaFimDate);

  const todosVoos = useMemo(() => {
    return [...confirmados, ...pendentes];
  }, [confirmados, pendentes]);

  // Filtro por período conforme imagem de referência
  const voosDoPeriodo = useMemo(() => {
    return todosVoos.filter((v) => {
      const dataVoo = v.data_agendada;
      if (periodoFiltro === "Hoje") return dataVoo === hoje;
      if (periodoFiltro === "Amanhã") return dataVoo === amanha;
      if (periodoFiltro === "Próximos dias") return dataVoo >= amanha && dataVoo <= semanaFim;
      if (periodoFiltro === "Semana") return dataVoo >= hoje && dataVoo <= semanaFim;
      return true;
    });
  }, [todosVoos, periodoFiltro, hoje, amanha, semanaFim]);

  // Mapa de eventos por dia para o calendário tradicional
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, SolicitacaoVooInterna[]>();
    todosVoos.forEach((item) => {
      mapa.set(item.data_agendada, [...(mapa.get(item.data_agendada) || []), item]);
    });
    return mapa;
  }, [todosVoos]);

  const diasVisao = visao === "semanal"
    ? Array.from({ length: 7 }, (_, i) => new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + i))
    : dias;

  const rotuloPeriodoCalendario = visao === "semanal"
    ? `${diasVisao[0].getDate()} ${nomesMeses[diasVisao[0].getMonth()]} – ${diasVisao[6].getDate()} ${nomesMeses[diasVisao[6].getMonth()]} ${diasVisao[6].getFullYear()}`
    : `${nomesMeses[mes.getMonth()]} ${mes.getFullYear()}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Cabeçalho de Agenda de Voos */}
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Agenda de voos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {modoExibicao === "lista-periodos"
              ? `${voosDoPeriodo.length} voos encontrados para o período`
              : "Visualização mensal e semanal dos voos agendados"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador de Modo: Períodos vs Calendário Mensal */}
          <button
            type="button"
            onClick={() => setModoExibicao((m) => (m === "lista-periodos" ? "grade-calendario" : "lista-periodos"))}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            {modoExibicao === "lista-periodos" ? (
              <>
                <CalendarDays size={14} className="text-[#3867ed]" />
                Visualização Calendário
              </>
            ) : (
              <>
                <List size={14} className="text-[#3867ed]" />
                Visualização por Período
              </>
            )}
          </button>

          {/* Filtro por Período Segmentado (Hoje, Amanhã, Próximos dias, Semana) */}
          {modoExibicao === "lista-periodos" && (
            <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary p-1 text-xs font-semibold text-muted-foreground">
              {(["Hoje", "Amanhã", "Próximos dias", "Semana"] as FiltroPeriodoAgenda[]).map((periodo) => (
                <button
                  key={periodo}
                  type="button"
                  onClick={() => setPeriodoFiltro(periodo)}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    periodoFiltro === periodo
                      ? "bg-card text-foreground shadow-sm font-bold"
                      : "hover:text-foreground"
                  }`}
                >
                  {periodo}
                </button>
              ))}
            </div>
          )}

          {/* Controles do Calendário Mensal/Semanal */}
          {modoExibicao === "grade-calendario" && (
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-lg border border-border bg-secondary p-0.5 text-xs font-semibold text-muted-foreground">
                <button
                  type="button"
                  onClick={() => aoMudarVisao("semanal")}
                  className={`rounded-md px-2.5 py-1 ${visao === "semanal" ? "bg-card text-foreground shadow-sm" : ""}`}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => aoMudarVisao("mensal")}
                  className={`rounded-md px-2.5 py-1 ${visao === "mensal" ? "bg-card text-foreground shadow-sm" : ""}`}
                >
                  Mês
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => (visao === "semanal" ? aoMudarSemana(-1) : aoMudarMes(-1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="min-w-[130px] text-center text-xs font-bold text-foreground">
                  {rotuloPeriodoCalendario}
                </span>
                <button
                  type="button"
                  onClick={() => (visao === "semanal" ? aoMudarSemana(1) : aoMudarMes(1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODO 1: Lista por Períodos (Imagem dab36eab.png) */}
      {modoExibicao === "lista-periodos" && (
        <div className="divide-y divide-border">
          {voosDoPeriodo.length ? (
            voosDoPeriodo.map((flight) => {
              const statusLower = String(flight.status || "").toLowerCase();
              const concluido = ["concluida", "encerrada", "em_solo"].includes(statusLower);
              const emVoo = ["decolado", "em_voo", "em_rota"].includes(statusLower);

              return (
                <article
                  key={flight.id}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Ícone Verde e Dados do Voo */}
                  <div className="flex items-center gap-3.5 min-w-[200px]">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <Plane size={18} />
                    </div>
                    <div>
                      <strong className="block text-sm font-bold text-foreground">
                        {flight.numero_voo || "Voo"}{flight.solicitacao_origem_id ? " · Perna da mesma solicitação" : ""} · {formatarData(flight.data_agendada)}
                      </strong>
                      <span className="font-mono text-xs text-muted-foreground">
                        {flight.matricula_registro || "PR-AEX"}
                      </span>
                    </div>
                  </div>

                  {/* Trajeto Tracejado com Avião */}
                  <div className="flex items-center justify-center gap-4 py-2 sm:py-0">
                    <div className="text-center">
                      <strong className="block font-mono text-sm font-bold text-foreground">
                        {formatarHora(flight.horario_previsto_agendamento)}
                      </strong>
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">
                        {flight.origem}
                      </span>
                    </div>

                    <div className="relative flex w-32 items-center justify-center border-t-2 border-dashed border-border sm:w-44">
                      <div className="rounded-full bg-card px-2 text-muted-foreground">
                        <Plane size={15} className="rotate-45 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="text-center">
                      <strong className="block font-mono text-sm font-bold text-foreground">
                        {flight.perna_atual_horario_pouso ? formatarHora(flight.perna_atual_horario_pouso) : "--:--"}
                      </strong>
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">
                        {flight.destino}
                      </span>
                      {flight.perna_atual_horario_corte && (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          COR {formatarHora(flight.perna_atual_horario_corte)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status e Ação */}
                  <div className="flex items-center justify-end gap-4 min-w-[170px]">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        concluido
                          ? "bg-emerald-500/10 text-emerald-500"
                          : emVoo
                          ? "bg-[#3867ed]/10 text-[#3867ed]"
                          : "bg-secondary text-muted-foreground border border-border"
                      }`}
                    >
                      {concluido ? "Concluído" : emVoo ? "Em voo" : "Programado"}
                    </span>

                    <button
                      type="button"
                      onClick={() => aoAbrir(flight)}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-secondary"
                    >
                      Detalhes
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <CalendarDays size={32} className="text-muted-foreground/40" />
              <strong className="mt-3 block text-sm font-bold text-foreground">
                Nenhum voo agendado para {periodoFiltro.toLowerCase()}
              </strong>
              <span className="text-xs text-muted-foreground">
                Selecione outro período no topo ou cadastre um novo agendamento.
              </span>
            </div>
          )}
        </div>
      )}

      {/* MODO 2: Grade de Calendário Mensal/Semanal Tradicional */}
      {modoExibicao === "grade-calendario" && (
        <div>
          <div className="grid grid-cols-7 border-b border-border bg-secondary text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {nomesDias.map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {diasVisao.map((dia) => {
              const chave = dataIso(dia);
              const eventos = eventosPorDia.get(chave) || [];
              const ehHoje = chave === hoje;

              return (
                <div key={chave} className="min-h-[90px] p-2 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold ${
                        ehHoje ? "bg-[#3867ed] text-white" : "text-foreground"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                    {eventos.length > 0 && (
                      <span className="text-[10px] font-bold text-[#3867ed] bg-[#3867ed]/10 rounded-full px-1.5 py-0.2">
                        {eventos.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 space-y-1">
                    {eventos.slice(0, 2).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => aoAbrir(item)}
                        className="w-full truncate rounded bg-secondary px-1.5 py-0.5 text-left font-mono text-[10px] text-foreground hover:bg-[#3867ed]/15"
                      >
                        {item.numero_voo || item.origem} · {formatarData(item.data_agendada)} → {item.destino}
                      </button>
                    ))}
                    {eventos.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setDiaAberto(dia)}
                        className="block text-[10px] font-semibold text-[#3867ed]"
                      >
                        +{eventos.length - 2} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog para visualização dos voos de um dia específico */}
      <Dialog open={!!diaAberto} onOpenChange={(open) => !open && setDiaAberto(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Voos em {diaAberto?.toLocaleDateString("pt-BR")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecione o voo para abrir os detalhes operacionais.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            {diaAberto &&
              (eventosPorDia.get(dataIso(diaAberto)) || []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setDiaAberto(null);
                    aoAbrir(v);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left hover:bg-secondary"
                >
                  <div>
                    <strong className="block text-xs font-bold text-foreground">
                      {v.numero_voo || "Voo a gerar"} · {formatarData(v.data_agendada)} · {v.origem} → {v.destino}
                    </strong>
                    <span className="text-[11px] text-muted-foreground">
                      {v.socio_nome || v.cliente_razao_social || "Cotista"} · {formatarHora(v.horario_previsto_agendamento)} UTC
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// === ESCALA DA TRIPULAÇÃO SEMANAL (Imagem 510d2973.png) ===
export function Escala({
  tripulacao,
  escala,
  disponibilidades,
  aoMarcar,
  aoAbrirVoo,
}: {
  tripulacao: TripulanteAgendamento[];
  escala: EscalaAgendamento[];
  disponibilidades: DisponibilidadeTripulacao[];
  aoMarcar: () => void;
  aoAbrirVoo: (id: string) => void;
}) {
  const [semanaInicio, setSemanaInicio] = useState(() => {
    const hoje = new Date();
    const diaSemana = (hoje.getDay() + 6) % 7; // Segunda = 0
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() - diaSemana);
    return seg;
  });

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(semanaInicio);
      d.setDate(semanaInicio.getDate() + i);
      return d;
    });
  }, [semanaInicio]);

  const periodoRotulo = `${diasSemana[0].getDate()} – ${diasSemana[6].getDate()} ${nomesMeses[diasSemana[6].getMonth()].slice(0, 3)}`;

  // Exibe somente voos e disponibilidades registrados na API. Ausência de registro permanece vazia.
  const tripulantesComEscala = useMemo(() => tripulacao.map((t) => {
    const voosDoTripulante = escala.filter((e) => e.piloto_id === t.id || e.copiloto_id === t.id);
    const turnos = diasSemana.map((dia) => {
      const chaveDia = dataIso(dia);
      const vooNoDia = voosDoTripulante.find((v) => chaveDia >= v.data_agendada && chaveDia <= v.data_fim);
      const disp = disponibilidades.find((d) => d.tripulante_id === t.id && chaveDia >= d.data_inicio && chaveDia <= d.data_fim);
      if (vooNoDia) {
        const hora = formatarHora(vooNoDia.horario_previsto_agendamento);
        return { tipo: "voo", label: `${vooNoDia.numero_voo || "Voo"}${hora !== "--:--" ? ` · ${hora}` : ""}`, vooId: vooNoDia.id };
      }
      if (!disp || disp.status === "disponivel") return { tipo: "vazio", label: "—" };
      const rotulos: Record<string, string> = { aviso: "Sob aviso", folga: "Folga", ferias: "Férias", atestado_medico: "Atestado", treinamento: "Treinamento", acompanhando_manutencao: "Manutenção" };
      return { tipo: disp.status, label: rotulos[disp.status] || disp.status };
    });
    return { ...t, turnos };
  }), [tripulacao, escala, disponibilidades, diasSemana]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Cabeçalho da Escala */}
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Escala da tripulação</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Semana {periodoRotulo} · dados registrados de voos e disponibilidade
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Legenda Exata da Imagem */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#3867ed]" /> Voo
            </span>
            <span className="flex items-center gap-1.5">
              Disponibilidade exibida somente quando registrada
            </span>
          </div>

          <Button
            type="button"
            onClick={aoMarcar}
            className="h-9 gap-1.5 rounded-lg bg-[#3867ed] text-xs font-semibold text-white shadow-sm hover:bg-[#2959df]"
          >
            <Plus size={15} /> Nova escala
          </Button>
        </div>
      </div>

      {/* Tabela Semanal da Tripulação */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="p-3.5 pl-5">Tripulante</th>
              {diasSemana.map((dia, idx) => (
                <th key={dia.toISOString()} className="p-3.5 text-center">
                  {nomesDias[idx]} {dia.getDate()}
                </th>
              ))}

            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tripulantesComEscala.map((trip) => {
              return (
                <tr key={trip.id} className="transition-colors hover:bg-secondary/60">
                  {/* Nome e Função */}
                  <td className="p-3.5 pl-5">
                    <strong className="block font-bold text-foreground">{trip.nome_completo}</strong>
                    <span className="text-[11px] text-muted-foreground">
                      {trip.origem === "freelancer" ? "Freelancer" : "Comandante / Copiloto"} · CANAC {trip.canac}
                    </span>
                  </td>

                  {/* 7 Dias da Semana */}
                  {trip.turnos.map((turno, idx) => (
                    <td key={idx} className="p-2 text-center">
                      <span
                        className={`inline-block w-full max-w-[100px] truncate rounded-lg py-1.5 px-1 text-center font-mono text-[11px] font-semibold transition-all ${
                          turno.tipo === "voo"
                            ? "border border-[#3867ed]/30 bg-[#3867ed]/10 text-[#3867ed]"
                            : turno.tipo === "vazio"
                            ? "border border-dashed border-border text-muted-foreground bg-transparent"
                            : "border border-amber-500/30 bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {turno.label}
                      </span>
                    </td>
                  ))}


                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
