import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DisponibilidadeTripulacao, EscalaAgendamento, TripulanteAgendamento } from "@/lib/colaborador-api";
import { DIA, HORA, montarBlocos, posicionarColisoes, type BlocoEscala } from "@/lib/escala-tempo";

type Visao = "mes" | "semana" | "dia" | "lista";
type OrigemTripulacao = "todos" | TripulanteAgendamento["origem"];
type Fuso = "UTC" | "BRT";
type Coluna = { chave: string; titulo: string; subtitulo: string; hoje: boolean; inicio: number; blocos: BlocoEscala[] };

const HORA_PX = 36;
const HORAS = Array.from({ length: 24 }, (_, i) => i);
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const VISOES: Array<[Visao, string]> = [
  ["mes", "Mês"],
  ["semana", "Semana"],
  ["dia", "Dia"],
  ["lista", "Lista"],
];
const COR: Record<string, string> = {
  pic: "border-cyan-600 bg-cyan-100 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-500/25 dark:text-cyan-100",
  sic: "border-violet-600 bg-violet-100 text-violet-950 dark:border-violet-400 dark:bg-violet-500/25 dark:text-violet-100",
  ferias: "border-rose-600 bg-rose-100 text-rose-950 dark:border-rose-400 dark:bg-rose-500/25 dark:text-rose-100",
  folga: "border-slate-600 bg-slate-100 text-slate-900 dark:border-slate-400 dark:bg-slate-500/25 dark:text-slate-100",
  atestado_medico: "border-red-600 bg-red-100 text-red-950 dark:border-red-400 dark:bg-red-500/25 dark:text-red-100",
  treinamento: "border-fuchsia-600 bg-fuchsia-100 text-fuchsia-950 dark:border-fuchsia-400 dark:bg-fuchsia-500/25 dark:text-fuchsia-100",
  acompanhando_manutencao: "border-sky-600 bg-sky-100 text-sky-950 dark:border-sky-400 dark:bg-sky-500/25 dark:text-sky-100",
  aviso: "border-amber-600 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-500/25 dark:text-amber-100",
};
const corBloco = (b: BlocoEscala) => COR[b.variante] ?? COR.folga;

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const inicioDia = (ms: number) => Math.floor(ms / DIA) * DIA;
const dow = (ms: number) => (new Date(ms).getUTCDay() + 6) % 7;
const inicioSemana = (ms: number) => inicioDia(ms) - dow(ms) * DIA;
const inicioMes = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const somarMeses = (ms: number, n: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
};
const diasNoMes = (ms: number) => {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
};
const isoData = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fmtDia = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
};
const primeiroNome = (n: string) => n.split(" ")[0];
const duracao = (ms: number) => {
  const min = Math.round(ms / 60_000);
  const h = min / 60;
  return min < 60 ? `${min} min` : `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
};

type Props = {
  tripulacao: TripulanteAgendamento[];
  escala: EscalaAgendamento[];
  disponibilidades: DisponibilidadeTripulacao[];
  aoCriarEscala: () => void;
  aoAbrirVoo?: (solicitacaoId: string) => void;
  aoAbrirExtrato: (tripulante: TripulanteAgendamento, inicio: string, fim: string) => void;
};

export default function EscalaCalendario({ tripulacao, escala, disponibilidades, aoCriarEscala, aoAbrirVoo, aoAbrirExtrato }: Props) {
  const [visao, setVisao] = useState<Visao>("mes");
  const [fuso, setFuso] = useState<Fuso>("UTC");
  const [origemTripulacao, setOrigemTripulacao] = useState<OrigemTripulacao>("todos");
  const [tripulanteId, setTripulanteId] = useState("todos");
  const [ref, setRef] = useState(() => inicioDia(Date.now()));

  const tripulacaoFiltrada = useMemo(
    () => tripulacao.filter((t) => origemTripulacao === "todos" || t.origem === origemTripulacao),
    [tripulacao, origemTripulacao],
  );
  const idsVisiveis = useMemo(() => new Set(tripulacaoFiltrada.map((t) => t.id)), [tripulacaoFiltrada]);
  useEffect(() => {
    if (tripulanteId !== "todos" && !idsVisiveis.has(tripulanteId)) setTripulanteId("todos");
  }, [idsVisiveis, tripulanteId]);

  const off = fuso === "BRT" ? -3 * HORA : 0;
  const agora = Date.now() + off;
  const hojeMs = inicioDia(agora);
  const todos = tripulanteId === "todos";

  const blocos = useMemo(
    () =>
      montarBlocos(
        escala,
        disponibilidades.filter((d) => origemTripulacao === "todos" || d.tripulante_origem === origemTripulacao),
        tripulacao,
      )
        .filter((b) => (origemTripulacao === "todos" || idsVisiveis.has(b.tripulanteId)) && (todos || b.tripulanteId === tripulanteId))
        .map((b) => (b.diaInteiro ? b : { ...b, inicio: b.inicio + off, fim: b.fim + off })),
    [escala, disponibilidades, tripulacao, tripulanteId, todos, off, origemTripulacao, idsVisiveis],
  );

  const inicioPeriodo = visao === "mes" ? inicioSemana(inicioMes(ref)) : visao === "dia" ? ref : inicioSemana(ref);
  const nDias = visao === "mes" ? Math.ceil((dow(inicioMes(ref)) + diasNoMes(ref)) / 7) * 7 : visao === "dia" ? 1 : 7;
  const fimPeriodo = inicioPeriodo + nDias * DIA;

  const colunas = useMemo<Coluna[]>(() => {
    const noDia = (ini: number) => blocos.filter((b) => b.inicio < ini + DIA && b.fim > ini);
    if (visao === "dia" && todos) {
      return tripulacaoFiltrada.map((t) => ({
        chave: t.id,
        titulo: primeiroNome(t.nome_completo),
        subtitulo: t.canac,
        hoje: ref === hojeMs,
        inicio: ref,
        blocos: noDia(ref).filter((b) => b.tripulanteId === t.id),
      }));
    }
    return Array.from({ length: visao === "dia" ? 1 : 7 }, (_, i) => {
      const ini = inicioPeriodo + i * DIA;
      const d = new Date(ini);
      return {
        chave: String(ini),
        titulo: DIAS[dow(ini)],
        subtitulo: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`,
        hoje: ini === hojeMs,
        inicio: ini,
        blocos: noDia(ini),
      };
    });
  }, [blocos, visao, todos, tripulacaoFiltrada, ref, inicioPeriodo, hojeMs]);

  const dRef = new Date(ref);
  const titulo =
    visao === "mes"
      ? `${MESES[dRef.getUTCMonth()]} ${dRef.getUTCFullYear()}`
      : visao === "dia"
        ? `${fmtDia(ref)} ${dRef.getUTCFullYear()}`
        : `${fmtDia(inicioPeriodo)} – ${fmtDia(fimPeriodo - DIA)} ${new Date(fimPeriodo - DIA).getUTCFullYear()}`;

  const navegar = (delta: number) =>
    setRef((atual) => (visao === "mes" ? somarMeses(atual, delta) : visao === "dia" ? atual + delta * DIA : atual + delta * 7 * DIA));
  const irParaDia = (dia: number) => {
    setRef(dia);
    setVisao("dia");
  };
  const clicarBloco = (b: BlocoEscala) => {
    if (b.vooId) aoAbrirVoo?.(b.vooId);
  };
  const mostrarNome = todos && visao !== "dia";
  const tripulanteSelecionado = tripulacaoFiltrada.find((t) => t.id === tripulanteId);

  const btnSeg = (ativo: boolean) =>
    `h-7 rounded-md px-2.5 text-xs font-semibold transition-all ${
      ativo ? "bg-card font-bold text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <section className="agenda-escala overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="agenda-escala-toolbar space-y-2.5 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">Escala da tripulação</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{titulo}</p>
          </div>
          <Button type="button" onClick={aoCriarEscala} className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold">
            <Plus size={14} /> Criar escala
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => navegar(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Próximo"
              onClick={() => navegar(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight size={14} />
            </button>
            <Button type="button" variant="outline" onClick={() => setRef(hojeMs)} className="h-8 rounded-lg px-2.5 text-xs font-semibold">
              Hoje
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={origemTripulacao}
              onValueChange={(value) => {
                setOrigemTripulacao(value as OrigemTripulacao);
                setTripulanteId("todos");
              }}
            >
              <SelectTrigger aria-label="Origem da tripulação" className="h-8 w-[180px] rounded-lg border-border bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as equipes</SelectItem>
                <SelectItem value="tripulacao">Tripulação Share Brasil</SelectItem>
                <SelectItem value="freelancer">Tripulação externa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tripulanteId} onValueChange={setTripulanteId}>
              <SelectTrigger aria-label="Tripulante" className="h-8 w-[190px] max-w-[200px] rounded-lg border-border bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda a tripulação</SelectItem>
                {tripulacaoFiltrada
                  .filter((t) => Boolean(t.id))
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome_completo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {tripulanteSelecionado && (
              <Button
                type="button"
                variant="outline"
                onClick={() => aoAbrirExtrato(tripulanteSelecionado, isoData(inicioPeriodo), isoData(fimPeriodo - DIA))}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
              >
                Extrato de jornada
              </Button>
            )}

            <div className="flex rounded-lg border border-border bg-secondary/60 p-0.5">
              {(["UTC", "BRT"] as Fuso[]).map((f) => (
                <button key={f} type="button" onClick={() => setFuso(f)} className={btnSeg(fuso === f)}>
                  {f === "BRT" ? "Brasília" : "UTC"}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-border bg-secondary/60 p-0.5">
              {VISOES.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setVisao(id)} className={btnSeg(visao === id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {tripulacaoFiltrada.length === 0 && (
        <p role="status" className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
          Nenhum tripulante encontrado para esta equipe.
        </p>
      )}
      {(visao === "semana" || visao === "dia") && (
        <GradeHoraria key={visao} colunas={colunas} agora={agora} fuso={fuso} mostrarNome={mostrarNome} aoClicar={clicarBloco} />
      )}
      {visao === "mes" && (
        <VisaoMes
          inicio={inicioPeriodo}
          nDias={nDias}
          mesRef={dRef.getUTCMonth()}
          blocos={blocos}
          hojeMs={hojeMs}
          mostrarNome={todos}
          aoAbrirDia={irParaDia}
        />
      )}
      {visao === "lista" && (
        <VisaoLista inicio={inicioPeriodo} ref={ref} blocos={blocos} mostrarNome={todos} aoMudarData={setRef} aoClicar={clicarBloco} />
      )}

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        Horários em {fuso === "UTC" ? "UTC" : "Brasília"}. Bloco tracejado (~) = fim estimado; informe o pouso previsto no agendamento para ficar exato.
      </p>
    </section>
  );
}

function GradeHoraria({
  colunas,
  agora,
  fuso,
  mostrarNome,
  aoClicar,
}: {
  colunas: Coluna[];
  agora: number;
  fuso: Fuso;
  mostrarNome: boolean;
  aoClicar: (b: BlocoEscala) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 6 * HORA_PX;
  }, []);
  const template = { gridTemplateColumns: `56px repeat(${colunas.length}, minmax(${colunas.length > 7 ? 150 : 110}px, 1fr))` };

  return (
    <div ref={scroll} className="agenda-escala-horarios overflow-auto">
      <div style={{ minWidth: 56 + colunas.length * (colunas.length > 7 ? 150 : 110) }}>
        <div className="sticky top-0 z-30 bg-card">
          <div className="grid border-b border-border" style={template}>
            <div className="sticky left-0 z-10 bg-card px-2 py-1.5 text-[11px] font-bold text-muted-foreground">{fuso}</div>
            {colunas.map((c) => (
              <div key={c.chave} className={`border-l border-border/60 px-2 py-1.5 ${c.hoje ? "bg-primary/10" : ""}`}>
                <p className="truncate text-xs font-bold leading-tight">{c.titulo}</p>
                <p className="text-[11px] text-muted-foreground">{c.subtitulo}</p>
              </div>
            ))}
          </div>
          <div className="grid border-b border-border" style={template}>
            <div className="sticky left-0 z-10 bg-card px-1.5 py-1 text-[11px] text-muted-foreground">Dia todo</div>
            {colunas.map((c) => (
              <div key={c.chave} className="min-h-[26px] space-y-1 border-l border-border/60 p-1">
                {c.blocos
                  .filter((b) => b.diaInteiro)
                  .map((b) => (
                    <div key={b.id} className={`truncate rounded border px-1.5 py-0.5 text-[11px] font-bold ${corBloco(b)}`}>
                      {mostrarNome ? `${primeiroNome(b.tripulanteNome)} · ` : ""}
                      {b.titulo}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>

        <div className="grid" style={template}>
          <div className="sticky left-0 z-10 bg-card" style={{ height: 24 * HORA_PX }}>
            {HORAS.slice(1).map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 font-mono text-[11px] text-muted-foreground" style={{ top: h * HORA_PX }}>
                {pad(h)}:00
              </span>
            ))}
          </div>
          {colunas.map((c) => {
            const itens = posicionarColisoes(
              c.blocos
                .filter((b) => !b.diaInteiro)
                .map((b) => ({ b, inicio: Math.max(b.inicio, c.inicio), fim: Math.min(b.fim, c.inicio + DIA) })),
            );
            return (
              <div key={c.chave} className={`relative border-l border-border/60 ${c.hoje ? "bg-primary/[.04]" : ""}`} style={{ height: 24 * HORA_PX }}>
                {HORAS.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/40" style={{ top: h * HORA_PX }} />
                ))}
                {itens.map(({ b, inicio, fim, lane, lanes }) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => aoClicar(b)}
                    title={`${b.tripulanteNome} · ${b.titulo} · ${b.detalhe} · ${hhmm(b.inicio)}–${hhmm(b.fim)} ${fuso}`}
                    className={`absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-snug transition hover:opacity-90 ${corBloco(
                      b,
                    )} ${b.estimado ? "border-dashed" : ""}`}
                    style={{
                      top: ((inicio - c.inicio) / HORA) * HORA_PX,
                      height: Math.max(((fim - inicio) / HORA) * HORA_PX - 1, 20),
                      left: `calc(${(lane / lanes) * 100}% + 1px)`,
                      width: `calc(${100 / lanes}% - 2px)`,
                    }}
                  >
                    <p className="truncate font-bold">
                      {hhmm(b.inicio)}–{hhmm(b.fim)}
                      {b.estimado ? " ~" : ""}
                    </p>
                    <p className="truncate font-medium">{b.titulo}</p>
                    {mostrarNome && <p className="truncate opacity-80">{primeiroNome(b.tripulanteNome)}</p>}
                    <p className="truncate opacity-70">{b.detalhe}</p>
                  </button>
                ))}
                {c.hoje && agora >= c.inicio && agora < c.inicio + DIA && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-400"
                    style={{ top: ((agora - c.inicio) / HORA) * HORA_PX }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VisaoMes({
  inicio,
  nDias,
  mesRef,
  blocos,
  hojeMs,
  mostrarNome,
  aoAbrirDia,
}: {
  inicio: number;
  nDias: number;
  mesRef: number;
  blocos: BlocoEscala[];
  hojeMs: number;
  mostrarNome: boolean;
  aoAbrirDia: (dia: number) => void;
}) {
  return (
    <div className="agenda-escala-mes overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/50">
          {DIAS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div
          className="agenda-escala-dias grid grid-cols-7 divide-x divide-y divide-border"
          style={{ gridTemplateRows: `repeat(${Math.ceil(nDias / 7)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: nDias }, (_, i) => {
            const dia = inicio + i * DIA;
            const d = new Date(dia);
            const evs = blocos.filter((b) => b.inicio < dia + DIA && b.fim > dia).sort((a, b) => a.inicio - b.inicio);
            return (
              <div
                key={dia}
                className={`agenda-escala-dia min-h-[96px] p-1.5 transition-colors hover:bg-secondary/40 ${
                  d.getUTCMonth() === mesRef ? "" : "bg-secondary/20 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => aoAbrirDia(dia)}
                    className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold hover:bg-secondary ${
                      dia === hojeMs ? "bg-primary text-primary-foreground hover:bg-primary" : "text-foreground"
                    }`}
                  >
                    {d.getUTCDate()}
                  </button>
                  {evs.length > 0 && <span className="rounded bg-primary/10 px-1.5 text-[10px] font-bold text-primary">{evs.length}</span>}
                </div>
                <div className="mt-1 space-y-1">
                  {evs.slice(0, 2).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => aoAbrirDia(dia)}
                      className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-snug ${corBloco(b)}`}
                    >
                      {!b.diaInteiro && `${hhmm(Math.max(b.inicio, dia))} `}
                      {mostrarNome ? `${primeiroNome(b.tripulanteNome)} · ` : ""}
                      {b.titulo}
                    </button>
                  ))}
                  {evs.length > 2 && (
                    <button type="button" onClick={() => aoAbrirDia(dia)} className="block text-[11px] font-semibold text-primary">
                      +{evs.length - 2} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VisaoLista({
  inicio,
  ref,
  blocos,
  mostrarNome,
  aoMudarData,
  aoClicar,
}: {
  inicio: number;
  ref: number;
  blocos: BlocoEscala[];
  mostrarNome: boolean;
  aoMudarData: (ms: number) => void;
  aoClicar: (b: BlocoEscala) => void;
}) {
  const d = new Date(ref);
  const dias = Array.from({ length: 7 }, (_, i) => inicio + i * DIA)
    .map((dia) => ({ dia, evs: blocos.filter((b) => b.inicio < dia + DIA && b.fim > dia).sort((a, b) => a.inicio - b.inicio) }))
    .filter((x) => x.evs.length);

  return (
    <div className="agenda-escala-lista grid gap-3 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <DateCalendar
          value={new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())}
          onChange={(data) => aoMudarData(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()))}
        />
      </aside>
      <div className="space-y-2">
        {!dias.length && <p className="p-8 text-center text-xs text-muted-foreground">Nenhum compromisso nesta semana.</p>}
        {dias.map(({ dia, evs }) => {
          const dd = new Date(dia);
          return (
            <div key={dia} className="flex gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-2xs">
              <div className="w-14 shrink-0 pt-0.5">
                <p className="font-mono text-base font-extrabold leading-none text-foreground">{pad(dd.getUTCDate())}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase text-muted-foreground">
                  {MESES[dd.getUTCMonth()].slice(0, 3)}, {DIAS[dow(dia)]}
                </p>
              </div>
              <div className="min-w-0 flex-1 divide-y divide-border/60">
                {evs.map((b) => {
                  const ini = Math.max(b.inicio, dia);
                  const fim = Math.min(b.fim, dia + DIA);
                  const diaTodo = ini <= dia && fim >= dia + DIA - 60_000;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => aoClicar(b)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary/50"
                    >
                      <span className={`h-7 w-1 shrink-0 rounded-full border ${corBloco(b)}`} />
                      <span className="w-28 shrink-0">
                        <span className="block font-mono text-[11px] font-bold leading-tight text-foreground">
                          {diaTodo ? "Dia todo" : `${hhmm(ini)} – ${hhmm(fim)}`}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {duracao(fim - ini)}
                          {b.estimado ? " (estimado)" : ""}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold leading-snug text-foreground">{b.titulo}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {mostrarNome ? `${b.tripulanteNome} · ` : ""}
                          {b.detalhe}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
