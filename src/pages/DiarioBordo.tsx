import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, BookOpenCheck, CalendarDays, ChevronDown, Edit3, Fuel, List, Plus, RefreshCw, Search, Trash2, PlaneTakeoff, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, EtiquetaStatus, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import DiarioAeronaveCard from "@/components/diario/DiarioAeronaveCard";
import { CreateMonthDialog } from "@/components/diario/CreateMonthDialog";
import DiarioBancoHoras from "@/components/diario/DiarioBancoHoras";
import { atualizarLancamentoDiario, atualizarMesDiario, buscarDetalhesDiario, buscarOpcoesDiario, buscarResumoDiario, criarLancamentoDiario, criarMesDiario, excluirLancamentoDiario, type DiarioAeronaveResumo, type DiarioDetalhesResponse, type DiarioLancamento, type DiarioOpcoesResponse } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const monthName = (month: number) => new Date(2000, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
const decimal = (value: number | string | null | undefined, digits = 1) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const time = (value?: string | null) => value ? value.slice(0, 5) : "—";
const naturezas = ["AE - Aérea/Regular", "CQ - Cheque", "EX - Executivo", "NR - Não remunerado", "RE - Retorno/Reposição", "PV - Privado", "SA - Serviço aéreo", "TN - Táxi aéreo", "TR - Traslado", "VOO_TESTE"];

export default function DiarioBordo({ aoVoltar, aoAbrirAerodromos }: { aoVoltar?: () => void; aoAbrirAerodromos?: () => void }) {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [aeronaves, setAeronaves] = useState<DiarioAeronaveResumo[]>([]);
  const [options, setOptions] = useState<DiarioOpcoesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DiarioAeronaveResumo | null>(null);
  const [period, setPeriod] = useState({ ano, mes: now.getMonth() + 1 });
  const [details, setDetails] = useState<DiarioDetalhesResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [monthEditor, setMonthEditor] = useState(false);
  const [entryEditor, setEntryEditor] = useState<DiarioLancamento | null | false>(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const loadList = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [summary, opcoes] = await Promise.all([buscarResumoDiario(ano), options ? Promise.resolve(options) : buscarOpcoesDiario()]);
      setAeronaves(Array.isArray(summary.aeronaves) ? summary.aeronaves : []);
      setOptions(opcoes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os diários de bordo.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [ano, options]);

  const loadDetails = useCallback(async (aircraft: DiarioAeronaveResumo, target = period) => {
    setDetailsLoading(true); setError(null);
    try { setDetails(await buscarDetalhesDiario(aircraft.id, target.ano, target.mes)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar este diário."); }
    finally { setDetailsLoading(false); }
  }, [period]);

  useEffect(() => { void loadList(); }, [loadList]);

  const filteredAircraft = useMemo(() => aeronaves.filter((aircraft) => `${aircraft.matricula_registro} ${aircraft.fabricante || ""} ${aircraft.modelo || ""}`.toLowerCase().includes(search.toLowerCase())), [aeronaves, search]);
  const selectedMonthOptions = useMemo(() => {
    const values = new Map<string, { ano: number; mes: number }>();
    values.set(`${period.ano}-${period.mes}`, period);
    values.set(`${now.getFullYear()}-${now.getMonth() + 1}`, { ano: now.getFullYear(), mes: now.getMonth() + 1 });
    for (const item of details?.meses_disponiveis || []) values.set(`${item.ano}-${item.mes}`, { ano: item.ano, mes: item.mes });
    return [...values.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes);
  }, [details?.meses_disponiveis, period]);

  const openAircraft = (aircraft: DiarioAeronaveResumo) => {
    const nextPeriod = { ano, mes: aircraft.mes_referencia || now.getMonth() + 1 };
    setSelected(aircraft); setPeriod(nextPeriod); setDetails(null); setMonthEditor(false); setEntryEditor(false); setNotice(null); void loadDetails(aircraft, nextPeriod);
  };
  const backToList = () => { setSelected(null); setDetails(null); setEntryEditor(false); setMonthEditor(false); setNotice(null); void loadList(true); };
  const changePeriod = (value: string) => { const [year, month] = value.split("-").map(Number); const next = { ano: year, mes: month }; setPeriod(next); if (selected) void loadDetails(selected, next); setEntryEditor(false); setMonthEditor(false); };

  const saveMonth = async (payload: Record<string, unknown>, id?: string) => {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      if (id) await atualizarMesDiario(id, payload); else await criarMesDiario(payload);
      const next = { ano: Number(payload.ano), mes: Number(payload.mes) }; setPeriod(next); setMonthEditor(false); setNotice(id ? "Parâmetros do diário atualizados." : "Diário mensal aberto."); await loadDetails(selected, next); await loadList(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o diário mensal."); }
    finally { setSaving(false); }
  };

  const saveEntry = async (payload: Record<string, unknown>) => {
    if (!selected || !details?.diario_mes) return;
    setSaving(true); setError(null);
    try {
      if (entryEditor) await atualizarLancamentoDiario(entryEditor.id, payload); else await criarLancamentoDiario(payload);
      setEntryEditor(false); setNotice(entryEditor ? "Lançamento atualizado." : "Voo registrado no diário.");
      await loadDetails(selected, period); await loadList(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o lançamento."); }
    finally { setSaving(false); }
  };

  const removeEntry = async (entry: DiarioLancamento) => {
    if (!window.confirm(`Excluir o lançamento ${entry.numero_sequencial || "selecionado"}? Esta ação não pode ser desfeita.`)) return;
    setError(null);
    try { await excluirLancamentoDiario(entry.id); setNotice("Lançamento excluído."); if (selected) await loadDetails(selected, period); await loadList(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o lançamento."); }
  };

  if (selected) {
    const month = details?.diario_mes;
    const closed = Boolean(month?.fechado);
    const fuelTotal = (details?.lancamentos || []).reduce((total, entry) => total + Number(entry.litros_combustivel_abastecido || 0), 0);
    return (
      <div className="diario-bordo route-enter space-y-6">
        <section className={`${card} p-4 md:p-5 relative overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button type="button" onClick={backToList} aria-label="Voltar para os diários" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"><ArrowLeft size={13} /></button>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                <span className="h-4 w-[2px] rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">Período</span>
                <select value={`${period.ano}-${period.mes}`} onChange={(event) => changePeriod(event.target.value)} className="campo !w-auto !py-1 !px-2 text-[10px] font-bold uppercase">
                  <option value={`${period.ano}-${period.mes}`}>{monthName(period.mes)} {period.ano}</option>
                  {selectedMonthOptions.filter((item) => `${item.ano}-${item.mes}` !== `${period.ano}-${period.mes}`).map((item) => <option key={`${item.ano}-${item.mes}`} value={`${item.ano}-${item.mes}`}>{monthName(item.mes)} {item.ano}</option>)}
                </select>
              </div>
              {!closed && month && <Button type="button" onClick={() => setEntryEditor(null)} className="h-9 gap-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-extrabold"><Plus size={13} /> Novo Voo</Button>}
              <Button type="button" variant="outline" onClick={() => selected && void loadDetails(selected)} disabled={detailsLoading} className="h-9 gap-1.5 text-[10px]"><RefreshCw size={12} className={detailsLoading ? "animate-spin" : ""} /> Atualizar</Button>
              <Button type="button" variant="outline" onClick={() => setMonthEditor(true)} className="h-9 gap-1.5 text-[10px]"><CalendarDays size={12} /> Novo Mês</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
            <div className={`${card} p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Aeronave</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Matrícula" value={selected.matricula_registro} mono />
                <StatTile label="Modelo" value={selected.modelo || "Não informado"} />
                <StatTile label="Ano" value={selected.fabricante || "—"} />
                <StatTile label="Base" value={month?.aerodromo_base || "—"} mono />
              </div>
            </div>

            <div className={`${card} p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-400">Horímetro</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Inicial" value={`${decimal(month?.horimetro_inicio)}h`} />
                <StatTile label="Final" value={`${decimal(month?.horimetro_final)}h`} />
                <StatTile label="Ativo" value={`${decimal(month?.horimetro_ativo)}h`} />
              </div>
            </div>
          </div>

          <div className={`mt-3 ${card} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-400">Célula</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Anterior" value={`${decimal(month?.celula_anterior_ttotal)}h`} />
              <StatTile label="Atual" value={`${decimal(month?.celula_atual_ttotal || selected.celula_atual_ttotal)}h`} accent="text-foreground" />
              <StatTile label="Próx. revisão" value={`${decimal(month?.celula_prox_revisao_ttotal)}h`} />
              <StatTile label="Disponível" value={`${decimal(month?.celula_disponivel_ttotal)}h`} accent="text-emerald-500" />
            </div>
          </div>
        </section>

        {(error || notice) && <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{error || notice}</div>}
        {detailsLoading && !details ? <div className="skeleton h-56 rounded-xl" /> : !month && <section className={`${card} flex flex-col items-center justify-center p-10 text-center`}><BookOpenCheck className="mb-3 text-primary" size={28} /><h2 className="text-sm font-bold">Este mês ainda não foi aberto</h2><p className="mt-1 max-w-md text-[11px] text-muted-foreground">Abra o diário de {monthName(period.mes)} para registrar voos, tempos, célula e combustível da aeronave.</p><Button type="button" onClick={() => setMonthEditor(true)} className="mt-4 h-9 gap-2 text-[11px]"><Plus size={13} /> Abrir diário do mês</Button></section>}
        {month && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-amber-400"><Fuel size={14} /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-amber-400">Consumo de combustível</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">Histórico registrado no mês <span className="mx-1 text-muted-foreground/60">·</span> {decimal(fuelTotal)} L abastecidos</p></div></div><ChevronDown size={15} className="shrink-0 text-amber-400/70" /></div>}
        {monthEditor && <CreateMonthDialog open={monthEditor} onOpenChange={setMonthEditor} aircraftId={selected.id} aircraftRegistration={selected.matricula_registro} month={period.mes} year={period.ano} currentModoCelula={month?.modo_celula || null} previousMonthData={month ? { celula_atual_ttotal: month.celula_atual_ttotal, celula_prox_revisao_ttotal: month.celula_prox_revisao_ttotal, horimetro_final: month.horimetro_final, aerodromo_base: month.aerodromo_base, consumo_combustivel: month.consumo_combustivel, tem_tarifa_diaria: Boolean(month.tem_tarifa_diaria), tarifa_diaria: month.tarifa_diaria } : null} onCreate={(payload) => saveMonth(payload)} />}
        {entryEditor !== false && month && !closed && options && <DiarioLancamentoForm aeronaveId={selected.id} diarioMesId={month.id} opcoes={options} initialData={entryEditor || null} sugeridaCelula={Number(month.celula_atual_ttotal || 0)} sugestaoTrecho={details?.lancamentos?.length ? details.lancamentos[details.lancamentos.length - 1].trecho || `${details.lancamentos[details.lancamentos.length - 1].aerodromo_partida} X ${details.lancamentos[details.lancamentos.length - 1].aerodromo_chegada}` : undefined} onSubmit={saveEntry} onCancel={() => setEntryEditor(false)} saving={saving} />}
        {month && (
          <div className="space-y-4">
            <LancamentosTableConfigurada lancamentos={details?.lancamentos || []} closed={closed} onEdit={(entry) => setEntryEditor(entry)} onDelete={(entry) => void removeEntry(entry)} />
          </div>
        )}
        {month && <DiarioBancoHoras lancamentos={details?.lancamentos || []} horasCotistas={details?.horas_cotistas} horasEmprestadas={details?.horas_emprestadas} />}
      </div>
    );
  }

  return (
    <div className="diario-bordo route-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><IndicadorPagina>Operações / Diário de bordo</IndicadorPagina><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><BookOpenCheck className="text-primary" size={26} /> Diários de bordo</h1><p className="mt-1.5 text-xs text-muted-foreground">Gerencie os diários digitais, horas de voo, célula e registros operacionais das aeronaves.</p></div>
        <div className="flex gap-2">{aoVoltar && <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-1.5 text-[10px]"><ArrowLeft size={13} /> Voltar</Button>}{aoAbrirAerodromos && <Button type="button" variant="outline" onClick={aoAbrirAerodromos} className="h-9 gap-1.5 text-[10px]">Aeródromos</Button>}</div>
      </div>
      {(error || notice) && <div className={`rounded-lg border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{error || notice}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] text-muted-foreground"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aeronave..." className="w-40 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/70" /></label><select value={ano} onChange={(event) => setAno(Number(event.target.value))} className="campo !w-auto !h-9 !py-1 !px-3 text-[10px] font-bold"><option value={ano}>{ano}</option><option value={ano - 1}>{ano - 1}</option><option value={ano + 1}>{ano + 1}</option></select></div><Button type="button" variant="outline" onClick={() => void loadList(true)} disabled={refreshing} className="h-9 gap-1.5 text-[10px]"><RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Atualizar</Button></div>
      <AircraftListContent loading={loading} aeronaves={filteredAircraft} ano={ano} search={search} onOpen={openAircraft} />
    </div>
  );
}

function StatTile({ label, value, mono = false, accent = "text-foreground" }: { label: string; value: string; mono?: boolean; accent?: string }) { return <div className="min-w-0 rounded-lg border border-border bg-card/60 p-2.5"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className={`mt-2 truncate text-[15px] font-bold ${mono ? "font-mono" : ""} ${accent}`}>{value}</p></div>; }

function AircraftListContent({ loading, aeronaves, ano, search, onOpen }: { loading: boolean; aeronaves: DiarioAeronaveResumo[]; ano: number; search: string; onOpen: (aeronave: DiarioAeronaveResumo) => void }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-64 rounded-2xl" />)}</div>;
  if (aeronaves.length > 0) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{aeronaves.map((aircraft) => <DiarioAeronaveCard key={aircraft.id} aeronave={aircraft} ano={ano} onOpen={() => onOpen(aircraft)} />)}</div>;
  return <EstadoVazio label={search ? "Nenhuma aeronave corresponde à busca" : "Nenhuma aeronave ativa encontrada"} />;
}

function LancamentosTableConfigurada({ lancamentos, closed, onEdit, onDelete }: { lancamentos: DiarioLancamento[]; closed: boolean; onEdit: (entry: DiarioLancamento) => void; onDelete: (entry: DiarioLancamento) => void }) {
  const [aba, setAba] = useState<"todos" | "resumo" | "emprestimos">("todos");
  const [acoesAberta, setAcoesAberta] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const iniciarArraste = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const area = event.currentTarget;
    drag.current = { active: true, moved: false, startX: event.clientX, startScroll: area.scrollLeft };
    area.setPointerCapture(event.pointerId);
  };
  const moverArraste = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !scrollRef.current) return;
    const deslocamento = event.clientX - drag.current.startX;
    if (Math.abs(deslocamento) > 3) drag.current.moved = true;
    scrollRef.current.scrollLeft = drag.current.startScroll - deslocamento;
  };
  const pararArraste = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.active && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current.active = false;
  };
  const bloquearCliqueAposArraste = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  };
  const exibidos = aba === "emprestimos" ? lancamentos.filter((entry) => Boolean(entry.voo_emprestado)) : lancamentos;
  const nomeDestino = (entry: DiarioLancamento) => entry.voo_emprestado ? (entry.socio_tomador_nome || entry.cliente_tomador_nome || entry.socio_nome || entry.cliente_nome || "Não informado") : (entry.socio_nome || entry.cliente_nome || "Não informado");
  const colunas = [
    { key: "ref", label: "", width: 82, className: "text-center text-primary", render: (entry: DiarioLancamento) => `#${entry.numero_sequencial}` },
    { key: "data", label: "DATA", width: 72, render: (entry: DiarioLancamento) => date(entry.data_registro) },
    { key: "de", label: "DE", width: 62, render: (entry: DiarioLancamento) => entry.aerodromo_partida },
    { key: "para", label: "PARA", width: 70, render: (entry: DiarioLancamento) => entry.aerodromo_chegada },
    { key: "ac", label: "AC", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_ac) },
    { key: "dep", label: "DEP", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_dep) },
    { key: "pou", label: "POU", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_pou) },
    { key: "cor", label: "COR", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_cor) },
    { key: "tvoo", label: "T VOO", width: 72, className: "text-primary", render: (entry: DiarioLancamento) => decimal(entry.tempo_voo, 2) },
    { key: "tdia", label: "T DIA", width: 72, className: "text-primary", render: (entry: DiarioLancamento) => decimal(entry.horas_diurnas, 2) },
    { key: "tnoit", label: "T NOIT", width: 76, className: "text-violet-400", render: (entry: DiarioLancamento) => decimal(entry.horas_noturnas, 2) },
    { key: "ifr", label: "IFR", width: 64, className: "text-amber-400", render: (entry: DiarioLancamento) => decimal(entry.tempo_ifr, 2) },
    { key: "pousos", label: "POUSOS", width: 72, className: "text-center text-emerald-400", render: (entry: DiarioLancamento) => entry.pousos_total },
    { key: "abast", label: "ABAST+", width: 76, className: "text-amber-400", render: (entry: DiarioLancamento) => decimal(entry.litros_combustivel_abastecido, 1) },
    { key: "fuel", label: "FUEL", width: 68, className: "text-amber-400", render: (entry: DiarioLancamento) => decimal(entry.litros_combustivel_inicio_voo, 1) },
    { key: "celula", label: "CÉLULA", width: 88, render: (entry: DiarioLancamento) => `${decimal(entry.celula, 1)}h` },
    { key: "pic", label: "PIC", width: 140, render: (entry: DiarioLancamento) => entry.pic_nome_exibicao || entry.pic_nome || entry.pic_canac || "—" },
    { key: "sic", label: "SIC", width: 140, render: (entry: DiarioLancamento) => entry.sic_nome_exibicao || entry.sic_nome || entry.sic_canac || "—" },
    { key: "voopara", label: "VOO PARA", width: 180, render: (entry: DiarioLancamento) => nomeDestino(entry) },
  ];
  const totais = exibidos.reduce((acc, entry) => ({ voo: acc.voo + Number(entry.tempo_voo || 0), pousos: acc.pousos + Number(entry.pousos_total || 0), abast: acc.abast + Number(entry.litros_combustivel_abastecido || 0), fuel: acc.fuel + Number(entry.litros_combustivel_inicio_voo || 0) }), { voo: 0, pousos: 0, abast: 0, fuel: 0 });
  return <section className={`${card} overflow-hidden`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 md:px-5"><div className="flex items-center gap-2.5"><span className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpenCheck size={15} /></span><div><h2 className="text-sm font-bold text-foreground">Registros de voo</h2><p className="mt-0.5 text-xs text-muted-foreground">{exibidos.length} voos exibidos nesta visão</p></div></div><div className="flex items-center gap-2">{closed && <EtiquetaStatus tone="amber">Mês fechado</EtiquetaStatus>}</div></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-bold">!</span><span>Clique no <strong className="font-semibold text-primary">código de referência</strong> para editar ou excluir.</span></div><span className="hidden h-4 w-px bg-border sm:block" /><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-bold">↔</span><span>Arraste a tabela horizontalmente para consultar todas as colunas.</span></div></div>
    <div className="flex flex-wrap gap-1 border-b border-border bg-muted/20 px-3 pt-2"><button type="button" onClick={() => setAba("todos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "todos" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Tabela completa</button><button type="button" onClick={() => setAba("resumo")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "resumo" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Resumo de voo</button><button type="button" onClick={() => setAba("emprestimos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "emprestimos" ? "border-amber-400 bg-card text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}><PlaneTakeoff size={12} className="mr-1 inline" /> Voos empréstimo <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[11px]">{lancamentos.filter((entry) => Boolean(entry.voo_emprestado)).length}</span></button></div>
    {!exibidos.length ? <EstadoVazio label={aba === "emprestimos" ? "Nenhum voo empréstimo neste mês" : "Nenhum voo registrado neste mês"} /> : aba === "resumo" ? <div className="w-full overflow-hidden"><table className="w-full table-fixed border-collapse text-left text-[10px]"><thead className="border-b border-border bg-muted/40"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground"><th className="px-4 py-3" /><th className="px-4 py-3">DATA</th><th className="px-4 py-3">TRECHO</th><th className="px-4 py-3">DEP</th><th className="px-4 py-3">POU</th><th className="px-4 py-3 text-primary">T VOO</th><th className="px-4 py-3">VOO PARA</th></tr></thead><tbody>{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-border/60 ${index % 2 === 0 ? "bg-card/40" : "bg-card/10"} hover:bg-primary/5`}><td className="px-4 py-3"><button type="button" onClick={() => onEdit(entry)} className="font-mono font-bold text-primary underline decoration-primary/50 underline-offset-2 hover:text-primary/80">#{entry.numero_sequencial}</button></td><td className="whitespace-nowrap px-4 py-3 text-foreground">{date(entry.data_registro)}</td><td className="px-4 py-3 font-mono font-bold text-foreground">{entry.trecho || `${entry.aerodromo_partida} X ${entry.aerodromo_chegada}`}</td><td className="px-4 py-3 font-mono text-muted-foreground">{time(entry.tempo_dep)}</td><td className="px-4 py-3 font-mono text-muted-foreground">{time(entry.tempo_pou)}</td><td className="px-4 py-3 font-mono font-bold text-primary">{decimal(entry.tempo_voo, 2)}</td><td className="max-w-[260px] truncate px-4 py-3 font-bold text-foreground">{nomeDestino(entry)}</td></tr>)}</tbody></table></div> : <div ref={scrollRef} className="diario-table-scroll w-full cursor-grab select-none overflow-auto active:cursor-grabbing" onPointerDown={iniciarArraste} onPointerMove={moverArraste} onPointerUp={pararArraste} onPointerCancel={pararArraste} onClickCapture={bloquearCliqueAposArraste}><table className="w-full min-w-[1480px] border-collapse text-left text-xs" style={{ tableLayout: "fixed" }}><thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{colunas.map((coluna) => <th key={coluna.key} className={`relative whitespace-nowrap overflow-hidden text-ellipsis border-r border-border px-2 py-3 text-[9px] sm:px-3 sm:text-[10px] ${coluna.className || ""}`} style={{ width: coluna.width }}>{coluna.label}</th>)}</tr></thead><tbody className="text-xs text-foreground">{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-border/50 ${index % 2 === 0 ? "bg-card/40" : "bg-card/10"} hover:bg-primary/5`}><td className="relative border-r border-border px-3 py-3 text-center font-mono font-bold text-primary"><button type="button" onClick={() => setAcoesAberta(acoesAberta === entry.id ? null : entry.id)} className="underline decoration-primary/50 underline-offset-2 hover:text-primary/80">#{entry.numero_sequencial}</button>{acoesAberta === entry.id && <div className="absolute left-2 top-10 z-20 flex w-36 flex-col gap-1 rounded-xl border border-border bg-card p-1.5 text-left shadow-xl"><button type="button" onClick={() => { setAcoesAberta(null); onEdit(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-primary/10 hover:text-primary"><Edit3 size={13} /> Editar</button><button type="button" onClick={() => { setAcoesAberta(null); onDelete(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /> Excluir</button></div>}</td>{colunas.slice(1).map((coluna) => <td key={coluna.key} className={`whitespace-nowrap overflow-hidden text-ellipsis border-r border-border/60 px-2 py-3 font-mono text-[9px] sm:px-3 sm:text-[10px] ${coluna.className || ""}`}>{coluna.render(entry)}</td>)}</tr>)}</tbody><tfoot className="sticky bottom-0 border-t-2 border-primary/30 bg-card text-xs font-bold"><tr><td className="px-3 py-3 text-center text-primary">TOTAL</td><td colSpan={7} /><td className="px-3 py-3 font-mono text-primary">{decimal(totais.voo, 2)}</td><td colSpan={3} /><td className="px-3 py-3 text-center text-emerald-400">{totais.pousos}</td><td className="px-3 py-3 text-amber-400">{decimal(totais.abast, 1)}</td><td className="px-3 py-3 text-amber-400">{decimal(totais.fuel, 1)}</td><td colSpan={4} /></tr></tfoot></table></div>}
  </section>;
}

function formFromEntry(entry: Partial<DiarioLancamento> | undefined, date: string, celula: number, sugestaoTrecho = "") {
  return {
    data_registro: entry?.data_registro?.slice(0, 10) || date,
    numero_voo: entry?.numero_voo || "",
    natureza_voo: entry?.natureza_voo || "EX - Executivo",
    aerodromo_partida: entry?.aerodromo_partida || "",
    aerodromo_chegada: entry?.aerodromo_chegada || "",
    trecho: entry?.trecho || sugestaoTrecho,
    pic_canac: entry?.pic_canac || "",
    sic_canac: entry?.sic_canac || "",
    cliente_id: entry?.cliente_id || "",
    socio_id: entry?.socio_id || "",
    voo_emprestado: Boolean(entry?.voo_emprestado),
    cliente_tomador_emprestimo_id: entry?.cliente_tomador_emprestimo_id || "",
    socio_tomador_emprestimo_id: entry?.socio_tomador_emprestimo_id || "",
    tripulacao_checkin_hora: entry?.tempo_ac?.slice(0, 5) || "",
    tempo_ac: entry?.tempo_ac?.slice(0, 5) || "",
    tempo_dep: entry?.tempo_dep?.slice(0, 5) || "",
    tempo_pou: entry?.tempo_pou?.slice(0, 5) || "",
    tempo_cor: entry?.tempo_cor?.slice(0, 5) || "",
    tempo_ifr: String(entry?.tempo_ifr ?? ""),
    tempo_voo: String(entry?.tempo_voo ?? ""),
    tempo_total: String(entry?.tempo_total ?? ""),
    horas_diurnas: String(entry?.horas_diurnas ?? ""),
    horas_noturnas: String(entry?.horas_noturnas ?? ""),
    pousos_total: String(entry?.pousos_total ?? 1),
    distancia_nm: String(entry?.distancia_nm ?? ""),
    litros_combustivel_inicio_voo: String(entry?.litros_combustivel_inicio_voo ?? ""),
    litros_combustivel_abastecido: String(entry?.litros_combustivel_abastecido ?? ""),
    local_combustivel: entry?.local_combustivel || "",
    celula: String(entry?.celula ?? celula),
    passageiros: String(entry?.passageiros ?? 0),
    carga_kg: entry?.carga_kg || "",
    ocorrencias: entry?.ocorrencias || "",
    discrepancias: entry?.discrepancias || "",
    acoes_corretivas: entry?.acoes_corretivas || "",
    abastecimento_litros: "",
    abastecimento_data: date,
    abastecimento_cliente_id: "",
    abastecimento_socio_id: "",
    abastecimento_local: "",
    abastecimento_numero_comanda: "",
    abastecimento_numero_nf: "",
    abastecimento_auto_trecho: true,
  };
}

export function DiarioLancamentoForm({ aeronaveId, diarioMesId, opcoes, initialData, sugeridaCelula, sugestaoTrecho, onSubmit, onCancel, saving }: { aeronaveId: string; diarioMesId: string; opcoes: DiarioOpcoesResponse; initialData?: DiarioLancamento | null; sugeridaCelula: number; sugestaoTrecho?: string; onSubmit: (payload: Record<string, unknown>) => Promise<void>; onCancel: () => void; saving: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => formFromEntry(initialData || undefined, today, sugeridaCelula, sugestaoTrecho));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setForm(formFromEntry(initialData || undefined, today, sugeridaCelula, sugestaoTrecho)); setError(null); }, [initialData, diarioMesId, sugeridaCelula, sugestaoTrecho]);
  const setField = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const value = (key: string) => String(form[key] ?? "");
  const tripulacaoInterna = useMemo(() => opcoes.tripulantes.filter((tripulante) => tripulante.origem === "tripulacao"), [opcoes.tripulantes]);
  const selectedPic = useMemo(() => tripulacaoInterna.find((tripulante) => tripulante.canac?.toUpperCase() === value("pic_canac").toUpperCase()), [tripulacaoInterna, form.pic_canac]);
  const selectedSic = useMemo(() => tripulacaoInterna.find((tripulante) => tripulante.canac?.toUpperCase() === value("sic_canac").toUpperCase()), [tripulacaoInterna, form.sic_canac]);
  const clientesSocios = useMemo(() => opcoes.socios.filter((socio) => !value("cliente_id") || socio.cliente_id === value("cliente_id")), [opcoes.socios, form.cliente_id]);

  const submit = async () => {
    setError(null);
    if (!value("data_registro") || !value("aerodromo_partida") || !value("aerodromo_chegada") || !value("pic_canac") || !value("natureza_voo")) {
      setError("Informe data, origem, destino, PIC e natureza do voo.");
      return;
    }
    const number = (key: string) => value(key) === "" ? 0 : Number(value(key));
    const payload: Record<string, unknown> = {
      diario_mes_id: diarioMesId, aeronave_id: aeronaveId, data_registro: value("data_registro"), numero_voo: value("numero_voo") || null, natureza_voo: value("natureza_voo"),
      aerodromo_partida: value("aerodromo_partida").toUpperCase(), aerodromo_chegada: value("aerodromo_chegada").toUpperCase(), trecho: value("trecho") || null,
      pic_canac: value("pic_canac").toUpperCase(), pic_nome: selectedPic?.nome_completo || null, sic_canac: value("sic_canac").toUpperCase() || null, sic_nome: selectedSic?.nome_completo || null,
      cliente_id: value("cliente_id") || null, socio_id: value("socio_id") || null, voo_emprestado: Boolean(form.voo_emprestado), cliente_tomador_emprestimo_id: value("cliente_tomador_emprestimo_id") || null, socio_tomador_emprestimo_id: value("socio_tomador_emprestimo_id") || null,
      tripulacao_checkin_hora: value("tripulacao_checkin_hora") || null, tempo_ac: value("tempo_ac") || null, tempo_dep: value("tempo_dep") || null, tempo_pou: value("tempo_pou") || null, tempo_cor: value("tempo_cor") || null,
      tempo_ifr: number("tempo_ifr"), tempo_voo: number("tempo_voo"), tempo_total: number("tempo_total") || number("tempo_voo"), horas_diurnas: number("horas_diurnas") || number("tempo_voo"), horas_noturnas: number("horas_noturnas"), pousos_total: number("pousos_total"), distancia_nm: number("distancia_nm"),
      litros_combustivel_inicio_voo: number("litros_combustivel_inicio_voo"), litros_combustivel_abastecido: number("litros_combustivel_abastecido"), local_combustivel: value("local_combustivel") || null, celula: number("celula"), passageiros: number("passageiros"), carga_kg: value("carga_kg") || null,
      ocorrencias: value("ocorrencias") || null, discrepancias: value("discrepancias") || null, acoes_corretivas: value("acoes_corretivas") || null,
      abastecimento: number("abastecimento_litros") > 0 ? { litros: number("abastecimento_litros"), data: value("abastecimento_data") || value("data_registro"), cliente_id: value("abastecimento_cliente_id") || null, socio_id: value("abastecimento_socio_id") || null, local: value("abastecimento_local") || value("local_combustivel") || value("aerodromo_partida"), trecho: Boolean(form.abastecimento_auto_trecho) ? `${value("aerodromo_partida").toUpperCase()} X ${value("aerodromo_chegada").toUpperCase()}` : value("trecho"), numero_comanda: value("abastecimento_numero_comanda") || null, numero_nf: value("abastecimento_numero_nf") || null } : null,
    };
    if (Object.values(payload).some((item) => typeof item === "number" && !Number.isFinite(item as number))) { setError("Revise os campos numéricos do lançamento."); return; }
    await onSubmit(payload);
  };

  return (
    <section className="task-compose relative overflow-hidden rounded-2xl border p-5 shadow-2xl">
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3 border-b border-border/60 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-primary/10 p-2 text-primary"><BookOpen size={16} /></span>
          <div>
            <h2 className="text-sm font-bold text-foreground">{initialData ? "Editar lançamento de voo" : "Novo lançamento de voo"}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Campos do diário digital · dados gravados no D1</p>
          </div>
        </div>
        <button type="button" onClick={onCancel} className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"><X size={15} /></button>
      </div>

      <div className="relative space-y-6">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive-foreground">{error}</div>}
        <FormSection icon={<PlaneTakeoff size={13} />} title="Voo e rota"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Data *"><input type="date" value={value("data_registro")} onChange={(e) => setField("data_registro", e.target.value)} className="campo font-mono" /></Field><Field label="Número do voo"><input value={value("numero_voo")} onChange={(e) => setField("numero_voo", e.target.value)} placeholder="Ex.: SBR-012" className="campo font-mono" /></Field><Field label="Natureza *"><select value={value("natureza_voo")} onChange={(e) => setField("natureza_voo", e.target.value)} className="campo">{naturezas.map((natureza) => <option key={natureza}>{natureza}</option>)}</select></Field><Field label="Trecho"><input value={value("trecho")} onChange={(e) => setField("trecho", e.target.value)} placeholder="SBSP X SBGR" className="campo font-mono" /></Field><Field label="Origem ICAO *"><select value={value("aerodromo_partida")} onChange={(e) => setField("aerodromo_partida", e.target.value)} className="campo"><option value="">Selecionar aeródromo</option>{opcoes.aerodromos.map((aero) => <option key={aero.id} value={aero.designativo}>{aero.designativo} · {aero.nome}</option>)}</select></Field><Field label="Destino ICAO *"><select value={value("aerodromo_chegada")} onChange={(e) => setField("aerodromo_chegada", e.target.value)} className="campo"><option value="">Selecionar aeródromo</option>{opcoes.aerodromos.map((aero) => <option key={aero.id} value={aero.designativo}>{aero.designativo} · {aero.nome}</option>)}</select></Field><Field label="Passageiros"><input type="number" min="0" value={value("passageiros")} onChange={(e) => setField("passageiros", e.target.value)} className="campo font-mono" /></Field><Field label="Carga (kg)"><input value={value("carga_kg")} onChange={(e) => setField("carga_kg", e.target.value)} className="campo font-mono" /></Field></div></FormSection>
        <FormSection icon={<Users size={13} />} title="Tripulação e cotista"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="PIC *"><select value={value("pic_canac")} onChange={(e) => setField("pic_canac", e.target.value)} className="campo"><option value="">Selecionar PIC</option>{tripulacaoInterna.map((tripulante) => <option key={`${tripulante.origem}-${tripulante.id}`} value={tripulante.canac}>{tripulante.nome_completo} · {tripulante.canac}</option>)}</select></Field><Field label="SIC"><select value={value("sic_canac")} onChange={(e) => setField("sic_canac", e.target.value)} className="campo"><option value="">Sem SIC</option>{tripulacaoInterna.map((tripulante) => <option key={`${tripulante.origem}-${tripulante.id}`} value={tripulante.canac}>{tripulante.nome_completo} · {tripulante.canac}</option>)}</select></Field><Field label="Cliente"><select value={value("cliente_id")} onChange={(e) => { setField("cliente_id", e.target.value); setField("socio_id", ""); }} className="campo"><option value="">Selecionar cliente</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.proprietario || "Sem nome"}{cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""}</option>)}</select></Field><Field label="Sócio"><select value={value("socio_id")} onChange={(e) => setField("socio_id", e.target.value)} className="campo"><option value="">Selecionar sócio</option>{clientesSocios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}</select></Field></div><label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer"><input type="checkbox" checked={Boolean(form.voo_emprestado)} onChange={(e) => setField("voo_emprestado", e.target.checked)} className="h-4 w-4 rounded border-border bg-secondary accent-primary" /> Voo emprestado</label>{Boolean(form.voo_emprestado) && <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Cliente tomador do empréstimo"><select value={value("cliente_tomador_emprestimo_id")} onChange={(e) => { setField("cliente_tomador_emprestimo_id", e.target.value); setField("socio_tomador_emprestimo_id", ""); }} className="campo"><option value="">Selecionar cliente tomador</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.proprietario || "Sem nome"}</option>)}</select></Field><Field label="Sócio tomador do empréstimo"><select value={value("socio_tomador_emprestimo_id")} onChange={(e) => setField("socio_tomador_emprestimo_id", e.target.value)} className="campo"><option value="">Selecionar sócio tomador</option>{opcoes.socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}</select></Field></div>}</FormSection>
        <FormSection icon={<TimerIcon />} title="Tempos e célula"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Tempo AC"><input type="time" value={value("tempo_ac")} onChange={(e) => setField("tempo_ac", e.target.value)} className="campo font-mono" /></Field><Field label="Decolagem"><input type="time" value={value("tempo_dep")} onChange={(e) => setField("tempo_dep", e.target.value)} className="campo font-mono" /></Field><Field label="Pouso"><input type="time" value={value("tempo_pou")} onChange={(e) => setField("tempo_pou", e.target.value)} className="campo font-mono" /></Field><Field label="Corte"><input type="time" value={value("tempo_cor")} onChange={(e) => setField("tempo_cor", e.target.value)} className="campo font-mono" /></Field><NumberField label="Tempo de voo (h)" value={value("tempo_voo")} onChange={(v) => setField("tempo_voo", v)} step="0.01" /><NumberField label="Tempo total (h)" value={value("tempo_total")} onChange={(v) => setField("tempo_total", v)} step="0.01" /><NumberField label="Horas diurnas" value={value("horas_diurnas")} onChange={(v) => setField("horas_diurnas", v)} step="0.01" /><NumberField label="Horas noturnas" value={value("horas_noturnas")} onChange={(v) => setField("horas_noturnas", v)} step="0.01" /><NumberField label="Tempo IFR" value={value("tempo_ifr")} onChange={(v) => setField("tempo_ifr", v)} step="0.01" /><NumberField label="Pousos" value={value("pousos_total")} onChange={(v) => setField("pousos_total", v)} step="1" /><NumberField label="Distância (NM)" value={value("distancia_nm")} onChange={(v) => setField("distancia_nm", v)} step="0.1" /><NumberField label="Célula após voo" value={value("celula")} onChange={(v) => setField("celula", v)} step="0.01" /></div></FormSection>
        <FormSection icon={<Fuel size={13} />} title="Combustível e abastecimento"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Litros no início" value={value("litros_combustivel_inicio_voo")} onChange={(v) => setField("litros_combustivel_inicio_voo", v)} step="0.01" /><NumberField label="Litros abastecidos" value={value("litros_combustivel_abastecido")} onChange={(v) => setField("litros_combustivel_abastecido", v)} step="0.01" /><Field label="Local do combustível"><input value={value("local_combustivel")} onChange={(e) => setField("local_combustivel", e.target.value)} placeholder="ICAO / fornecedor" className="campo" /></Field><NumberField label="Novo abastecimento (litros)" value={value("abastecimento_litros")} onChange={(v) => setField("abastecimento_litros", v)} step="0.01" /></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Data do abastecimento"><input type="date" value={value("abastecimento_data")} onChange={(e) => setField("abastecimento_data", e.target.value)} className="campo font-mono" /></Field><Field label="Pagador cliente"><select value={value("abastecimento_cliente_id")} onChange={(e) => { setField("abastecimento_cliente_id", e.target.value); setField("abastecimento_socio_id", ""); }} className="campo"><option value="">Cliente do voo anterior</option>{opcoes.clientes.map((item) => <option key={item.id} value={item.id}>{item.nome || item.proprietario || "Sem nome"}</option>)}</select></Field><Field label="Pagador sócio"><select value={value("abastecimento_socio_id")} onChange={(e) => { setField("abastecimento_socio_id", e.target.value); setField("abastecimento_cliente_id", ""); }} className="campo"><option value="">Sócio do voo anterior</option>{opcoes.socios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Local do abastecimento"><input value={value("abastecimento_local")} onChange={(e) => setField("abastecimento_local", e.target.value)} placeholder="ICAO / posto" className="campo" /></Field><Field label="Comanda"><input value={value("abastecimento_numero_comanda")} onChange={(e) => setField("abastecimento_numero_comanda", e.target.value)} className="campo" /></Field><Field label="Nota fiscal"><input value={value("abastecimento_numero_nf")} onChange={(e) => setField("abastecimento_numero_nf", e.target.value)} className="campo" /></Field></div><label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer"><input type="checkbox" checked={Boolean(form.abastecimento_auto_trecho)} onChange={(e) => setField("abastecimento_auto_trecho", e.target.checked)} className="h-4 w-4 accent-primary" /> Preencher trecho do abastecimento automaticamente com este voo</label><div className="mt-3 grid gap-3 lg:grid-cols-3"><TextField label="Ocorrências" value={value("ocorrencias")} onChange={(v) => setField("ocorrencias", v)} /><TextField label="Discrepâncias" value={value("discrepancias")} onChange={(v) => setField("discrepancias", v)} /><TextField label="Ações corretivas" value={value("acoes_corretivas")} onChange={(v) => setField("acoes_corretivas", v)} /></div></FormSection>
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur"><Button type="button" variant="outline" onClick={onCancel} className="h-9">Cancelar</Button><Button type="button" disabled={saving} onClick={() => void submit()} className="h-9 gap-2 rounded-lg bg-primary text-primary-foreground font-extrabold"><SaveIcon />{saving ? "Salvando..." : initialData ? "Atualizar lançamento" : "Registrar lançamento"}</Button></div>
      </div>
    </section>
  );
}

function FormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="rounded-2xl border border-border/80 bg-muted/20 p-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-primary"><span>{icon}</span>{title}</div>{children}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</span>{children}</label>; }
function NumberField({ label, value, onChange, step }: { label: string; value: string; onChange: (value: string) => void; step: string }) { return <Field label={label}><input type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="campo font-mono" /></Field>; }
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><textarea value={value} onChange={(e) => onChange(e.target.value)} className="campo min-h-[76px] resize-y" placeholder="Sem registro" /></Field>; }
function TimerIcon() { return <span className="font-mono text-[11px]">T</span>; }
function SaveIcon() { return <Plus size={13} />; }
