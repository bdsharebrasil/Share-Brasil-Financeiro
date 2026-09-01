import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CalendarDays, ChevronDown, Edit3, Fuel, List, Plus, RefreshCw, Search, Trash2, PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, EtiquetaStatus, IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import DiarioAeronaveCard from "@/components/diario/DiarioAeronaveCard";
import DiarioLancamentoForm from "@/components/diario/DiarioLancamentoForm";
import DiarioMesEditor from "@/components/diario/DiarioMesEditor";
import DiarioMesResumo from "@/components/diario/DiarioMesResumo";
import { atualizarLancamentoDiario, atualizarMesDiario, buscarDetalhesDiario, buscarOpcoesDiario, buscarResumoDiario, criarLancamentoDiario, criarMesDiario, excluirLancamentoDiario, type DiarioAeronaveResumo, type DiarioDetalhesResponse, type DiarioLancamento, type DiarioOpcoesResponse } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const monthName = (month: number) => new Date(2000, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
const decimal = (value: number | string | null | undefined, digits = 1) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const time = (value?: string | null) => value ? value.slice(0, 5) : "—";

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
      setAeronaves(summary.aeronaves);
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
  const toggleMonth = async () => {
    if (!details?.diario_mes || !selected) return;
    setSaving(true); setError(null);
    try { await atualizarMesDiario(details.diario_mes.id, { fechado: details.diario_mes.fechado ? 0 : 1 }); setNotice(details.diario_mes.fechado ? "Diário reaberto para edição." : "Diário fechado com sucesso."); await loadDetails(selected, period); await loadList(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o estado do diário."); }
    finally { setSaving(false); }
  };
  const saveEntry = async (payload: Record<string, unknown>) => {
    if (!selected || !details?.diario_mes) return;
    setSaving(true); setError(null);
    try { if (entryEditor) await atualizarLancamentoDiario(entryEditor.id, payload); else await criarLancamentoDiario(payload); setEntryEditor(false); setNotice(entryEditor ? "Lançamento atualizado." : "Voo registrado no diário."); await loadDetails(selected, period); await loadList(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o lançamento."); }
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
        <section className="relative overflow-hidden rounded-2xl border border-white/[.08] bg-[#101722] shadow-[0_20px_60px_rgba(0,0,0,.18)]">
          <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-cyan-400/[.07] blur-3xl" />
          <div className="relative p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <button type="button" onClick={backToList} className="mb-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 transition-colors hover:text-cyan-300"><ArrowLeft size={13} /> Voltar para aeronaves</button>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-cyan-300"><BookOpenCheck size={12} /> Diário operacional</div>
                <h1 className="mt-1 text-2xl font-extrabold tracking-[-.045em] text-white md:text-[30px]">Diário {monthName(period.mes)} {period.ano} <span className="text-slate-500">—</span> {selected.matricula_registro}</h1>
                <p className="mt-1.5 text-xs text-slate-400">{[selected.fabricante, selected.modelo].filter(Boolean).join(" ") || "Aeronave"} <span className="mx-1.5 text-slate-600">·</span> registro mensal operacional</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-9 items-center gap-2 rounded-lg border border-white/[.1] bg-white/[.04] px-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400"><CalendarDays size={12} className="text-cyan-300" /><select value={`${period.ano}-${period.mes}`} onChange={(event) => changePeriod(event.target.value)} className="bg-transparent text-[10px] font-bold capitalize text-white outline-none"><option value={`${period.ano}-${period.mes}`}>{monthName(period.mes)} {period.ano}</option>{selectedMonthOptions.filter((item) => `${item.ano}-${item.mes}` !== `${period.ano}-${period.mes}`).map((item) => <option key={`${item.ano}-${item.mes}`} value={`${item.ano}-${item.mes}`}>{monthName(item.mes)} {item.ano}</option>)}</select></label>
                {!closed && month && <Button type="button" onClick={() => setEntryEditor(null)} className="h-9 gap-1.5 rounded-lg bg-cyan-400 px-3 text-[10px] font-extrabold text-slate-950 hover:bg-cyan-300"><Plus size={13} /> Novo voo</Button>}
                <Button type="button" variant="outline" onClick={() => selected && void loadDetails(selected)} disabled={detailsLoading} className="h-9 gap-1.5 border-white/[.1] bg-white/[.03] text-[10px] text-slate-300 hover:bg-white/[.08] hover:text-white"><RefreshCw size={12} className={detailsLoading ? "animate-spin" : ""} /> Atualizar</Button>
              </div>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[.08] bg-white/[.07] sm:grid-cols-3 lg:grid-cols-6">
              <div className="bg-[#111b29] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-slate-500">Aeronave</p><p className="mt-1 font-mono text-sm font-bold text-white">{selected.matricula_registro}</p></div>
              <div className="bg-[#111b29] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-slate-500">Modelo</p><p className="mt-1 truncate text-[11px] font-bold text-white">{selected.modelo || "Não informado"}</p></div>
              <div className="bg-[#111b29] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-slate-500">Fabricante</p><p className="mt-1 truncate text-[11px] font-bold text-white">{selected.fabricante || "Não informado"}</p></div>
              <div className="bg-[#111b29] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-slate-500">Base</p><p className="mt-1 font-mono text-sm font-bold text-white">{month?.aerodromo_base || "—"}</p></div>
              <div className="bg-[#111b29] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-slate-500">Célula atual</p><p className="mt-1 font-mono text-sm font-bold text-cyan-300">{decimal(month?.celula_atual_ttotal || selected.celula_atual_ttotal)}h</p></div>
              <div className="bg-[#111b29] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-slate-500">Status</p><p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {closed ? "Fechado" : "Aberto"}</p></div>
            </div>
          </div>
        </section>
        {(error || notice) && <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</div>}
        {detailsLoading && !details ? <div className="skeleton h-56 rounded-xl" /> : month ? <DiarioMesResumo diario={month} lancamentos={details?.lancamentos || []} horasCotistas={details?.horas_cotistas} horasEmprestadas={details?.horas_emprestadas} onEdit={() => setMonthEditor(true)} onToggleClosed={() => void toggleMonth()} /> : <section className={`${card} flex flex-col items-center justify-center p-10 text-center`}><BookOpenCheck className="mb-3 text-primary" size={28} /><h2 className="text-sm font-bold">Este mês ainda não foi aberto</h2><p className="mt-1 max-w-md text-[11px] text-muted-foreground">Abra o diário de {monthName(period.mes)} para registrar voos, tempos, célula e combustível da aeronave.</p><Button type="button" onClick={() => setMonthEditor(true)} className="mt-4 h-9 gap-2 text-[11px]"><Plus size={13} /> Abrir diário do mês</Button></section>}
        {month && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[.04] px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-amber-300"><Fuel size={14} /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-amber-200">Consumo de combustível</p><p className="mt-0.5 truncate text-[10px] text-slate-400">Histórico registrado no mês <span className="mx-1 text-slate-600">·</span> {decimal(fuelTotal)} L abastecidos</p></div></div><ChevronDown size={15} className="shrink-0 text-amber-200/70" /></div>}
        {monthEditor && <DiarioMesEditor aeronaveId={selected.id} initial={month} ano={period.ano} mes={period.mes} onSave={saveMonth} onCancel={() => setMonthEditor(false)} saving={saving} />}
        {entryEditor !== false && month && !closed && options && <DiarioLancamentoForm aeronaveId={selected.id} diarioMesId={month.id} opcoes={options} initialData={entryEditor || null} sugeridaCelula={Number(month.celula_atual_ttotal || 0)} sugestaoTrecho={details?.lancamentos?.length ? details.lancamentos[details.lancamentos.length - 1].trecho || `${details.lancamentos[details.lancamentos.length - 1].aerodromo_partida} X ${details.lancamentos[details.lancamentos.length - 1].aerodromo_chegada}` : undefined} onSubmit={saveEntry} onCancel={() => setEntryEditor(false)} saving={saving} />}
        {month && <LancamentosTableConfigurada lancamentos={details?.lancamentos || []} closed={closed} onNew={() => setEntryEditor(null)} onEdit={(entry) => setEntryEditor(entry)} onDelete={(entry) => void removeEntry(entry)} />}
      </div>
    );
  }

  return (
    <div className="diario-bordo route-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><IndicadorPagina>Operações / Diário de bordo</IndicadorPagina><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><BookOpenCheck className="text-primary" size={26} /> Diários de bordo</h1><p className="mt-1.5 text-xs text-muted-foreground">Gerencie os diários digitais, horas de voo, célula e registros operacionais das aeronaves.</p></div>
        <div className="flex gap-2">{aoVoltar && <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-1.5 text-[10px]"><ArrowLeft size={13} /> Voltar</Button>}{aoAbrirAerodromos && <Button type="button" variant="outline" onClick={aoAbrirAerodromos} className="h-9 gap-1.5 text-[10px]">Aeródromos</Button>}</div>
      </div>
      {(error || notice) && <div className={`rounded-lg border p-3 text-[11px] ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card/75 px-3 text-[10px] text-muted-foreground"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aeronave..." className="w-40 bg-transparent outline-none placeholder:text-muted-foreground/70" /></label><select value={ano} onChange={(event) => setAno(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-card px-3 text-[10px] font-bold text-foreground outline-none focus:border-primary/60"><option value={ano}>{ano}</option><option value={ano - 1}>{ano - 1}</option><option value={ano + 1}>{ano + 1}</option></select></div><Button type="button" variant="outline" onClick={() => void loadList(true)} disabled={refreshing} className="h-9 gap-1.5 text-[10px]"><RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Atualizar</Button></div>
      <AircraftListContent loading={loading} aeronaves={filteredAircraft} ano={ano} search={search} onOpen={openAircraft} />
    </div>
  );
}

function AircraftListContent({ loading, aeronaves, ano, search, onOpen }: { loading: boolean; aeronaves: DiarioAeronaveResumo[]; ano: number; search: string; onOpen: (aeronave: DiarioAeronaveResumo) => void }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-64 rounded-2xl" />)}</div>;
  if (aeronaves.length > 0) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{aeronaves.map((aircraft) => <DiarioAeronaveCard key={aircraft.id} aeronave={aircraft} ano={ano} onOpen={() => onOpen(aircraft)} />)}</div>;
  return <EstadoVazio label={search ? "Nenhuma aeronave corresponde à busca" : "Nenhuma aeronave ativa encontrada"} />;
}

function LancamentosTable({ lancamentos, closed, onNew, onEdit, onDelete }: { lancamentos: DiarioLancamento[]; closed: boolean; onNew: () => void; onEdit: (entry: DiarioLancamento) => void; onDelete: (entry: DiarioLancamento) => void }) {
  const [aba, setAba] = useState<"todos" | "resumo" | "emprestimos">("todos");
  const hours = (value: number | null | undefined) => { const total = Math.max(0, Math.round(Number(value || 0) * 60)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; };
  const exibidos = aba === "emprestimos" ? lancamentos.filter((entry) => Boolean(entry.voo_emprestado)) : lancamentos;
  const cell = "whitespace-nowrap px-3 py-3 font-mono text-[10px]";
  const nomeDestino = (entry: DiarioLancamento) => entry.voo_emprestado ? (entry.socio_tomador_nome || entry.cliente_tomador_nome || entry.socio_nome || entry.cliente_nome || "Não informado") : (entry.socio_nome || entry.cliente_nome || "Não informado");
  return <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101722] shadow-[0_18px_55px_rgba(0,0,0,.14)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-4 py-3.5 md:px-5"><div className="flex items-center gap-2.5"><span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><BookOpenCheck size={15} /></span><div><h2 className="text-xs font-bold text-white">Registros de voo</h2><p className="mt-0.5 text-[10px] text-slate-500">{exibidos.length} registros exibidos nesta visão</p></div></div><div className="flex items-center gap-2">{!closed ? <Button type="button" onClick={onNew} className="h-8 gap-1.5 rounded-lg bg-cyan-400 px-3 text-[10px] font-extrabold text-slate-950 hover:bg-cyan-300"><Plus size={12} /> Novo voo</Button> : <EtiquetaStatus tone="amber">Mês fechado</EtiquetaStatus>}</div></div>
    <div className="flex flex-wrap gap-1 border-b border-white/[.08] bg-[#0d1521] px-3 pt-2"><button type="button" onClick={() => setAba("todos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-[10px] font-bold transition-colors ${aba === "todos" ? "border-cyan-300 bg-[#101722] text-cyan-300" : "border-transparent text-slate-500 hover:text-slate-200"}`}><List size={12} className="mr-1 inline" /> Tabela completa</button><button type="button" onClick={() => setAba("resumo")} className={`rounded-t-lg border-b-2 px-3 py-2 text-[10px] font-bold transition-colors ${aba === "resumo" ? "border-cyan-300 bg-[#101722] text-cyan-300" : "border-transparent text-slate-500 hover:text-slate-200"}`}><List size={12} className="mr-1 inline" /> Resumo de voo</button><button type="button" onClick={() => setAba("emprestimos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-[10px] font-bold transition-colors ${aba === "emprestimos" ? "border-amber-300 bg-[#101722] text-amber-300" : "border-transparent text-slate-500 hover:text-slate-200"}`}><PlaneTakeoff size={12} className="mr-1 inline" /> Voos empréstimo <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px]">{lancamentos.filter((entry) => Boolean(entry.voo_emprestado)).length}</span></button></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/[.08] bg-[#0d1521] px-4 py-3 text-xs text-slate-300"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 text-[11px] font-bold text-slate-300">!</span><span>Clique no <strong className="font-semibold text-cyan-300">código de referência</strong> para editar ou excluir o registro.</span></div><span className="hidden h-4 w-px bg-white/[.12] sm:block" /><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 text-[11px] font-bold text-slate-300">↔</span><span>Use a barra horizontal para consultar todas as colunas.</span></div></div>
    {!exibidos.length ? <EstadoVazio label={aba === "emprestimos" ? "Nenhum voo empréstimo neste mês" : "Nenhum voo registrado neste mês"} /> : aba === "resumo" ? <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">{exibidos.map((entry) => <button type="button" key={entry.id} onClick={() => onEdit(entry)} className="group rounded-xl border border-border/70 bg-secondary/15 p-4 text-left transition hover:border-primary/40 hover:bg-primary/[.04]"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold text-muted-foreground">{date(entry.data_registro)}</span><span className="font-mono text-xs font-bold text-cyan-300">Cód. ref. #{entry.numero_sequencial}</span></div><p className="mt-3 truncate font-mono text-xs font-extrabold text-slate-100">{entry.aerodromo_partida_nome || entry.aerodromo_partida} X {entry.aerodromo_chegada_nome || entry.aerodromo_chegada}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">Voo para <strong className="text-foreground">{nomeDestino(entry)}</strong>{entry.voo_emprestado ? <span className="ml-1 text-amber-300">· empréstimo</span> : null}</p></button>)}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1480px] border-collapse text-left text-[10px]"><thead><tr className="border-b border-white/[.08] bg-[#121d2c] text-[9px] font-bold uppercase tracking-[.08em] text-slate-500"><th className={cell}>CÓD. REF.</th><th className={cell}>Data</th><th className={cell}>De</th><th className={cell}>Para</th><th className={cell}>Voo para</th><th className={cell}>T VOO</th><th className={cell}>T DIA</th><th className={cell}>T NOIT</th><th className={cell}>IFR</th><th className={cell}>Pousos</th><th className={cell}>PIC</th><th className={cell}>SIC</th><th className={cell}>Ações</th></tr></thead><tbody>{exibidos.map((entry) => <tr key={entry.id} className="border-b border-white/[.06] last:border-0 hover:bg-cyan-300/[.04]"><td className={`${cell} text-primary`}><button type="button" disabled={closed} onClick={() => onEdit(entry)} className="font-bold underline-offset-2 hover:underline">{entry.numero_sequencial}</button></td><td className={`${cell} font-semibold`}>{date(entry.data_registro)}</td><td className={`${cell} font-mono font-bold text-slate-300`}>{entry.aerodromo_partida_icao || entry.aerodromo_partida}</td><td className={`${cell} font-mono font-bold text-slate-300`}>{entry.aerodromo_chegada_icao || entry.aerodromo_chegada}</td><td className={`${cell} max-w-[180px] truncate font-semibold`}>{nomeDestino(entry)}{entry.voo_emprestado ? <span className="ml-1 text-amber-300">(emp.)</span> : null}</td><td className={`${cell} font-bold text-sky-400`}>{hours(entry.tempo_voo)}</td><td className={`${cell} font-bold text-teal-300`}>{hours(entry.tempo_total)}</td><td className={`${cell} font-bold text-violet-400`}>{hours(entry.horas_noturnas)}</td><td className={`${cell} font-bold text-amber-300`}>{hours(entry.tempo_ifr)}</td><td className={`${cell} font-bold text-emerald-300`}>{entry.pousos_total || 0}</td><td className={`${cell} max-w-[150px] truncate font-semibold text-slate-200`}>{entry.pic_nome_exibicao || entry.pic_nome || entry.pic_canac || "—"}</td><td className={`${cell} max-w-[150px] truncate text-slate-300`}>{entry.sic_nome_exibicao || entry.sic_nome || entry.sic_canac || "—"}</td><td className={cell}><div className="flex gap-1">{!closed && <><button type="button" onClick={() => onEdit(entry)} title="Editar" className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary"><Edit3 size={12} /></button><button type="button" onClick={() => onDelete(entry)} title="Excluir" className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-red-400/40 hover:text-red-300"><Trash2 size={12} /></button></>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function LancamentosTableConfigurada({ lancamentos, closed, onNew, onEdit, onDelete }: { lancamentos: DiarioLancamento[]; closed: boolean; onNew: () => void; onEdit: (entry: DiarioLancamento) => void; onDelete: (entry: DiarioLancamento) => void }) {
  const [aba, setAba] = useState<"todos" | "resumo" | "emprestimos">("todos");
  const [acoesAberta, setAcoesAberta] = useState<string | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const exibidos = aba === "emprestimos" ? lancamentos.filter((entry) => Boolean(entry.voo_emprestado)) : lancamentos;
  const nomeDestino = (entry: DiarioLancamento) => entry.voo_emprestado ? (entry.socio_tomador_nome || entry.cliente_tomador_nome || entry.socio_nome || entry.cliente_nome || "Não informado") : (entry.socio_nome || entry.cliente_nome || "Não informado");
  const colunas = [
    { key: "ref", label: "CÓD. REF.", width: 82, className: "text-center text-cyan-300", render: (entry: DiarioLancamento) => `#${entry.numero_sequencial}` },
    { key: "data", label: "DATA", width: 72, render: (entry: DiarioLancamento) => date(entry.data_registro) },
    { key: "de", label: "DE", width: 62, render: (entry: DiarioLancamento) => entry.aerodromo_partida },
    { key: "para", label: "PARA", width: 70, render: (entry: DiarioLancamento) => entry.aerodromo_chegada },
    { key: "ac", label: "AC", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_ac) },
    { key: "dep", label: "DEP", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_dep) },
    { key: "pou", label: "POU", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_pou) },
    { key: "cor", label: "COR", width: 64, render: (entry: DiarioLancamento) => time(entry.tempo_cor) },
    { key: "tvoo", label: "T VOO", width: 72, className: "text-blue-300", render: (entry: DiarioLancamento) => decimal(entry.tempo_voo, 2) },
    { key: "tdia", label: "T DIA", width: 72, className: "text-cyan-300", render: (entry: DiarioLancamento) => decimal(entry.horas_diurnas, 2) },
    { key: "tnoit", label: "T NOIT", width: 76, className: "text-violet-300", render: (entry: DiarioLancamento) => decimal(entry.horas_noturnas, 2) },
    { key: "ifr", label: "IFR", width: 64, className: "text-amber-300", render: (entry: DiarioLancamento) => decimal(entry.tempo_ifr, 2) },
    { key: "pousos", label: "POUSOS", width: 72, className: "text-center text-emerald-300", render: (entry: DiarioLancamento) => entry.pousos_total },
    { key: "abast", label: "ABAST+", width: 76, className: "text-amber-300", render: (entry: DiarioLancamento) => decimal(entry.litros_combustivel_abastecido, 1) },
    { key: "fuel", label: "FUEL", width: 68, className: "text-amber-300", render: (entry: DiarioLancamento) => decimal(entry.litros_combustivel_inicio_voo, 1) },
    { key: "celula", label: "CÉLULA", width: 88, render: (entry: DiarioLancamento) => `${decimal(entry.celula, 1)}h` },
    { key: "pic", label: "PIC", width: 140, render: (entry: DiarioLancamento) => entry.pic_nome_exibicao || entry.pic_nome || entry.pic_canac || "—" },
    { key: "sic", label: "SIC", width: 140, render: (entry: DiarioLancamento) => entry.sic_nome_exibicao || entry.sic_nome || entry.sic_canac || "—" },
    { key: "voopara", label: "VOO PARA", width: 180, render: (entry: DiarioLancamento) => nomeDestino(entry) },
  ];
  const iniciarResize = (event: React.PointerEvent<HTMLButtonElement>, key: string, base: number) => {
    event.preventDefault();
    const inicio = event.clientX;
    const larguraInicial = widths[key] || base;
    const mover = (movimento: PointerEvent) => setWidths((atual) => ({ ...atual, [key]: Math.max(48, larguraInicial + movimento.clientX - inicio) }));
    const parar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", parar); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", parar);
  };
  const totais = exibidos.reduce((acc, entry) => ({ voo: acc.voo + Number(entry.tempo_voo || 0), pousos: acc.pousos + Number(entry.pousos_total || 0), abast: acc.abast + Number(entry.litros_combustivel_abastecido || 0), fuel: acc.fuel + Number(entry.litros_combustivel_inicio_voo || 0) }), { voo: 0, pousos: 0, abast: 0, fuel: 0 });
  return <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101722] shadow-[0_18px_55px_rgba(0,0,0,.14)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-4 py-3.5 md:px-5"><div className="flex items-center gap-2.5"><span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><BookOpenCheck size={15} /></span><div><h2 className="text-sm font-bold text-white">Registros de voo</h2><p className="mt-0.5 text-xs text-slate-400">{exibidos.length} voos exibidos nesta visão</p></div></div><div className="flex items-center gap-2">{!closed ? <Button type="button" onClick={onNew} className="h-8 gap-1.5 rounded-lg bg-cyan-400 px-3 text-xs font-extrabold text-slate-950 hover:bg-cyan-300"><Plus size={12} /> Novo voo</Button> : <EtiquetaStatus tone="amber">Mês fechado</EtiquetaStatus>}</div></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/[.08] bg-[#0d1521] px-4 py-3 text-xs text-slate-300"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 text-[11px] font-bold">!</span><span>Clique no <strong className="font-semibold text-cyan-300">código de referência</strong> para editar ou excluir.</span></div><span className="hidden h-4 w-px bg-white/[.12] sm:block" /><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 text-[11px] font-bold">↔</span><span>Arraste a borda do cabeçalho para redimensionar.</span></div></div>
    <div className="flex flex-wrap gap-1 border-b border-white/[.08] bg-[#0d1521] px-3 pt-2"><button type="button" onClick={() => setAba("todos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "todos" ? "border-cyan-300 bg-[#101722] text-cyan-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}><List size={12} className="mr-1 inline" /> Tabela completa</button><button type="button" onClick={() => setAba("resumo")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "resumo" ? "border-cyan-300 bg-[#101722] text-cyan-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}><List size={12} className="mr-1 inline" /> Resumo de voo</button><button type="button" onClick={() => setAba("emprestimos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "emprestimos" ? "border-amber-300 bg-[#101722] text-amber-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}><PlaneTakeoff size={12} className="mr-1 inline" /> Voos empréstimo <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[11px]">{lancamentos.filter((entry) => Boolean(entry.voo_emprestado)).length}</span></button></div>
    {!exibidos.length ? <EstadoVazio label={aba === "emprestimos" ? "Nenhum voo empréstimo neste mês" : "Nenhum voo registrado neste mês"} /> : aba === "resumo" ? <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">{exibidos.map((entry) => <button type="button" key={entry.id} onClick={() => onEdit(entry)} className="group rounded-xl border border-white/[.1] bg-[#111b29] p-4 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/[.04]"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-300">{date(entry.data_registro)}</span><span className="font-mono text-xs font-bold text-cyan-300">Cód. ref. #{entry.numero_sequencial}</span></div><p className="mt-3 truncate font-mono text-sm font-extrabold text-slate-100">{entry.aerodromo_partida_nome || entry.aerodromo_partida} X {entry.aerodromo_chegada_nome || entry.aerodromo_chegada}</p><p className="mt-1 truncate text-xs text-slate-300">Voo para <strong className="text-white">{nomeDestino(entry)}</strong>{entry.voo_emprestado ? <span className="ml-1 text-amber-300">· empréstimo</span> : null}</p></button>)}</div> : <div className="overflow-auto"><table className="w-full min-w-[1480px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 border-b border-white/[.08] bg-[#121d2c]"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-300">{colunas.map((coluna) => <th key={coluna.key} className={`relative whitespace-nowrap border-r border-white/[.08] px-3 py-3 ${coluna.className || ""}`} style={{ width: widths[coluna.key] || coluna.width }}>{coluna.label}<button type="button" aria-label={`Redimensionar coluna ${coluna.label}`} onPointerDown={(event) => iniciarResize(event, coluna.key, coluna.width)} className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-cyan-300/30" /></th>)}</tr></thead><tbody className="text-xs text-slate-200">{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-white/[.06] ${index % 2 === 0 ? "bg-[#101a28]" : "bg-[#0d1521]"} hover:bg-cyan-300/[.06]`}><td className="relative border-r border-white/[.06] px-3 py-3 text-center font-mono font-bold text-cyan-300"><button type="button" onClick={() => setAcoesAberta(acoesAberta === entry.id ? null : entry.id)} className="underline decoration-cyan-300/50 underline-offset-2 hover:text-cyan-100">#{entry.numero_sequencial}</button>{acoesAberta === entry.id && <div className="absolute left-2 top-10 z-20 flex w-36 flex-col gap-1 rounded-xl border border-white/[.12] bg-[#182333] p-1.5 text-left shadow-xl"><button type="button" onClick={() => { setAcoesAberta(null); onEdit(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-cyan-300/10 hover:text-cyan-300"><Edit3 size={13} /> Editar</button><button type="button" onClick={() => { setAcoesAberta(null); onDelete(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-red-400/10 hover:text-red-300"><Trash2 size={13} /> Excluir</button></div>}</td>{colunas.slice(1).map((coluna) => <td key={coluna.key} className={`whitespace-nowrap border-r border-white/[.06] px-3 py-3 font-mono ${coluna.className || ""}`}>{coluna.render(entry)}</td>)}</tr>)}</tbody><tfoot className="sticky bottom-0 border-t-2 border-cyan-300/20 bg-[#182333] text-xs font-bold"><tr><td className="px-3 py-3 text-center text-cyan-300">TOTAL</td><td colSpan={7} /><td className="px-3 py-3 font-mono text-blue-300">{decimal(totais.voo, 2)}</td><td colSpan={3} /><td className="px-3 py-3 text-center text-emerald-300">{totais.pousos}</td><td className="px-3 py-3 text-amber-300">{decimal(totais.abast, 1)}</td><td className="px-3 py-3 text-amber-300">{decimal(totais.fuel, 1)}</td><td colSpan={4} /></tr></tfoot></table></div>}
  </section>;
}
