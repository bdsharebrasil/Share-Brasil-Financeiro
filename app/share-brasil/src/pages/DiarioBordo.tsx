import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, ChevronDown, Edit3, List, Plus, RefreshCw, Search, Trash2, PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabecalhoSecao, EstadoVazio, EtiquetaStatus, IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
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
    return (
      <div className="route-enter space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button type="button" onClick={backToList} className="mb-3 flex items-center gap-1 text-[10px] font-bold text-muted-foreground transition-colors hover:text-primary"><ArrowLeft size={13} /> Voltar para aeronaves</button>
            <IndicadorPagina>Operações / Diário de bordo</IndicadorPagina>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Diário {selected.matricula_registro}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{[selected.fabricante, selected.modelo].filter(Boolean).join(" ") || "Aeronave"} · acompanhamento mensal operacional</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={`${period.ano}-${period.mes}`} onChange={(event) => changePeriod(event.target.value)} className="h-9 rounded-lg border border-border bg-card px-3 text-[10px] font-bold capitalize text-foreground outline-none focus:border-primary/60">
              {selectedMonthOptions.map((item) => <option key={`${item.ano}-${item.mes}`} value={`${item.ano}-${item.mes}`}>{monthName(item.mes)} {item.ano}</option>)}
            </select>
            <Button type="button" variant="outline" onClick={() => selected && void loadDetails(selected)} disabled={detailsLoading} className="h-9 gap-1.5 text-[10px]"><RefreshCw size={12} className={detailsLoading ? "animate-spin" : ""} /> Atualizar</Button>
          </div>
        </div>
        {(error || notice) && <div className={`rounded-lg border p-3 text-[11px] ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</div>}
        {detailsLoading && !details ? <div className="skeleton h-56 rounded-xl" /> : month ? <DiarioMesResumo diario={month} lancamentos={details?.lancamentos || []} horasCotistas={details?.horas_cotistas} horasEmprestadas={details?.horas_emprestadas} onEdit={() => setMonthEditor(true)} onToggleClosed={() => void toggleMonth()} /> : <section className={`${card} flex flex-col items-center justify-center p-10 text-center`}><BookOpenCheck className="mb-3 text-primary" size={28} /><h2 className="text-sm font-bold">Este mês ainda não foi aberto</h2><p className="mt-1 max-w-md text-[11px] text-muted-foreground">Abra o diário de {monthName(period.mes)} para registrar voos, tempos, célula e combustível da aeronave.</p><Button type="button" onClick={() => setMonthEditor(true)} className="mt-4 h-9 gap-2 text-[11px]"><Plus size={13} /> Abrir diário do mês</Button></section>}
        {monthEditor && <DiarioMesEditor aeronaveId={selected.id} initial={month} ano={period.ano} mes={period.mes} onSave={saveMonth} onCancel={() => setMonthEditor(false)} saving={saving} />}
        {entryEditor !== false && month && !closed && options && <DiarioLancamentoForm aeronaveId={selected.id} diarioMesId={month.id} opcoes={options} initialData={entryEditor || null} sugeridaCelula={Number(month.celula_atual_ttotal || 0)} sugestaoTrecho={details?.lancamentos?.length ? details.lancamentos[details.lancamentos.length - 1].trecho || `${details.lancamentos[details.lancamentos.length - 1].aerodromo_partida} X ${details.lancamentos[details.lancamentos.length - 1].aerodromo_chegada}` : undefined} onSubmit={saveEntry} onCancel={() => setEntryEditor(false)} saving={saving} />}
        {month && <LancamentosTable lancamentos={details?.lancamentos || []} closed={closed} onNew={() => setEntryEditor(null)} onEdit={(entry) => setEntryEditor(entry)} onDelete={(entry) => void removeEntry(entry)} />}
      </div>
    );
  }

  return (
    <div className="route-enter space-y-5">
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
  return <section className={`${card} overflow-hidden`}>
    <CabecalhoSecao icon={<BookOpenCheck size={15} />} title="Lançamentos do diário" detail={`${exibidos.length} registros exibidos`} action={<div className="flex flex-wrap items-center gap-2">{!closed ? <Button type="button" onClick={onNew} className="h-8 gap-1.5 text-[10px]"><Plus size={12} /> Novo voo</Button> : <EtiquetaStatus tone="amber">Mês fechado</EtiquetaStatus>}</div>} />
    <div className="flex flex-wrap gap-1 border-b border-border bg-secondary/10 px-3 pt-2"><button type="button" onClick={() => setAba("todos")} className={`rounded-t-lg px-3 py-2 text-[10px] font-bold ${aba === "todos" ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Tabela completa</button><button type="button" onClick={() => setAba("resumo")} className={`rounded-t-lg px-3 py-2 text-[10px] font-bold ${aba === "resumo" ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Visão resumida</button><button type="button" onClick={() => setAba("emprestimos")} className={`rounded-t-lg px-3 py-2 text-[10px] font-bold ${aba === "emprestimos" ? "bg-card text-amber-300" : "text-muted-foreground hover:text-foreground"}`}><PlaneTakeoff size={12} className="mr-1 inline" /> Voos empréstimo <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px]">{lancamentos.filter((entry) => Boolean(entry.voo_emprestado)).length}</span></button></div>
    {!exibidos.length ? <EstadoVazio label={aba === "emprestimos" ? "Nenhum voo empréstimo neste mês" : "Nenhum voo registrado neste mês"} /> : aba === "resumo" ? <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">{exibidos.map((entry) => <button type="button" key={entry.id} onClick={() => onEdit(entry)} className="group rounded-xl border border-border/70 bg-secondary/15 p-4 text-left transition hover:border-primary/40 hover:bg-primary/[.04]"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold text-muted-foreground">{date(entry.data_registro)}</span><span className="font-mono text-[10px] text-muted-foreground">#{entry.numero_sequencial}</span></div><p className="mt-3 truncate font-mono text-xs font-extrabold text-slate-100">{entry.aerodromo_partida_nome || entry.aerodromo_partida} X {entry.aerodromo_chegada_nome || entry.aerodromo_chegada}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">Voo para <strong className="text-foreground">{nomeDestino(entry)}</strong>{entry.voo_emprestado ? <span className="ml-1 text-amber-300">· empréstimo</span> : null}</p></button>)}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1480px] border-collapse text-left text-[10px]"><thead><tr className="border-b border-border bg-secondary/20 text-[9px] font-bold uppercase tracking-[.08em] text-muted-foreground"><th className={cell}>#</th><th className={cell}>Data</th><th className={cell}>De</th><th className={cell}>Para</th><th className={cell}>Voo para</th><th className={cell}>T VOO</th><th className={cell}>T DIA</th><th className={cell}>T NOIT</th><th className={cell}>IFR</th><th className={cell}>Pousos</th><th className={cell}>PIC</th><th className={cell}>SIC</th><th className={cell}>Ações</th></tr></thead><tbody>{exibidos.map((entry) => <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-primary/[.04]"><td className={`${cell} text-primary`}><button type="button" disabled={closed} onClick={() => onEdit(entry)} className="font-bold underline-offset-2 hover:underline">{entry.numero_sequencial}</button></td><td className={`${cell} font-semibold`}>{date(entry.data_registro)}</td><td className={`${cell} font-mono font-bold text-slate-300`}>{entry.aerodromo_partida_icao || entry.aerodromo_partida}</td><td className={`${cell} font-mono font-bold text-slate-300`}>{entry.aerodromo_chegada_icao || entry.aerodromo_chegada}</td><td className={`${cell} max-w-[180px] truncate font-semibold`}>{nomeDestino(entry)}{entry.voo_emprestado ? <span className="ml-1 text-amber-300">(emp.)</span> : null}</td><td className={`${cell} font-bold text-sky-400`}>{hours(entry.tempo_voo)}</td><td className={`${cell} font-bold text-teal-300`}>{hours(entry.tempo_total)}</td><td className={`${cell} font-bold text-violet-400`}>{hours(entry.horas_noturnas)}</td><td className={`${cell} font-bold text-amber-300`}>{hours(entry.tempo_ifr)}</td><td className={`${cell} font-bold text-emerald-300`}>{entry.pousos_total || 0}</td><td className={`${cell} max-w-[150px] truncate font-semibold text-slate-200`}>{entry.pic_nome_exibicao || entry.pic_nome || entry.pic_canac || "—"}</td><td className={`${cell} max-w-[150px] truncate text-slate-300`}>{entry.sic_nome_exibicao || entry.sic_nome || entry.sic_canac || "—"}</td><td className={cell}><div className="flex gap-1">{!closed && <><button type="button" onClick={() => onEdit(entry)} title="Editar" className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary"><Edit3 size={12} /></button><button type="button" onClick={() => onDelete(entry)} title="Excluir" className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-red-400/40 hover:text-red-300"><Trash2 size={12} /></button></>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}
