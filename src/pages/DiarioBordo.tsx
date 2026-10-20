import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpenCheck, CalendarDays, Check, ChevronDown, Edit3, Fuel, List, Plus, RefreshCw, Search, Trash2, X, PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, EtiquetaStatus, IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import DiarioAeronaveCard from "@/components/diario/DiarioAeronaveCard";
import { CreateMonthDialog } from "@/components/diario/CreateMonthDialog";
import DiarioBancoHoras from "@/components/diario/DiarioBancoHoras";
import DiarioLancamentoFormIntegrado from "@/components/diario/DiarioLancamentoForm";
import { atualizarHorimetroDiario, atualizarLancamentoDiario, atualizarMesDiario, buscarDetalhesDiario, buscarOpcoesDiario, buscarResumoDiario, criarLancamentoDiario, criarMesDiario, excluirLancamentoDiario, type DiarioAeronaveResumo, type DiarioDetalhesResponse, type DiarioLancamento, type DiarioOpcoesResponse } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/75 shadow-sm";
const monthName = (month: number) => new Date(2000, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
const decimal = (value: number | string | null | undefined, digits = 1) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const duration = (value: number | string | null | undefined) => {
  const totalMinutes = Math.max(0, Math.round(Number(value || 0) * 60));
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
};
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const time = (value?: string | null) => value ? value.slice(0, 5) : "—";

export default function DiarioBordo({ aoVoltar, aoAbrirAerodromos }: { aoVoltar?: () => void; aoAbrirAerodromos?: () => void }) {
  const now = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(now.getFullYear());
  const [aeronaves, setAeronaves] = useState<DiarioAeronaveResumo[]>([]);
  const [options, setOptions] = useState<DiarioOpcoesResponse | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const optionsRequest = useRef<Promise<boolean> | null>(null);
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
  const [modoCelulaCabecalho, setModoCelulaCabecalho] = useState<"celula" | "tvoo">("celula");
  const [editingHorimeter, setEditingHorimeter] = useState(false);
  const [horimeterDraft, setHorimeterDraft] = useState({ inicio: "", final: "", ativo: "" });

  const loadList = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const summary = await buscarResumoDiario(ano);
      setAeronaves(Array.isArray(summary.aeronaves) ? summary.aeronaves : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os diários de bordo.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [ano]);

  const loadOptions = useCallback(async () => {
    if (options) return true;
    if (optionsRequest.current) return optionsRequest.current;
    setOptionsLoading(true);
    setOptionsError(null);
    const request = buscarOpcoesDiario()
      .then((loaded) => { setOptions(loaded); return true; })
      .catch((cause) => {
        setOptionsError(cause instanceof Error ? cause.message : "Não foi possível carregar as opções do formulário.");
        return false;
      })
      .finally(() => {
        setOptionsLoading(false);
        optionsRequest.current = null;
      });
    optionsRequest.current = request;
    return request;
  }, [options]);

  const openEntryEditor = (entry: DiarioLancamento | null = null) => {
    setEntryEditor(entry);
    if (!options) void loadOptions();
  };

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
  }, [details?.meses_disponiveis, period, now]);

  const openAircraft = (aircraft: DiarioAeronaveResumo) => {
    const nextPeriod = { ano, mes: aircraft.mes_referencia || now.getMonth() + 1 };
    setSelected(aircraft); setPeriod(nextPeriod); setDetails(null); setMonthEditor(false); setEntryEditor(false); setNotice(null); setModoCelulaCabecalho("celula"); void loadDetails(aircraft, nextPeriod);
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
    } catch (cause) {
      const message = cause instanceof Error && cause.message.trim() ? cause.message : "Não foi possível salvar o lançamento.";
      setError(message);
      setSaving(false);
      return;
    }
    setEntryEditor(false);
    setNotice(entryEditor ? "Lançamento atualizado." : "Voo registrado no diário.");
    try {
      await Promise.all([loadDetails(selected, period), loadList(true)]);
      setError(null);
    } catch {
      // A gravação já foi confirmada pelo D1; uma falha de atualização não deve
      // apresentar o lançamento salvo como se a operação tivesse falhado.
      setNotice("Lançamento salvo. Atualize a página se a tabela ainda não refletir a alteração.");
    }
    finally { setSaving(false); }
  };

  const saveHorimeter = async () => {
    if (!details?.diario_mes || !selected) return;
    const inicio = Number(horimeterDraft.inicio);
    const final = Number(horimeterDraft.final);
    const ativo = Number(horimeterDraft.ativo);
    if (![inicio, final, ativo].every(Number.isFinite) || [inicio, final, ativo].some((value) => value < 0)) {
      setError("Informe valores válidos e não negativos para o horímetro.");
      return;
    }
    setSaving(true); setError(null);
    try {
      await atualizarHorimetroDiario(details.diario_mes.id, { horimetro_inicio: inicio, horimetro_final: final, horimetro_ativo: ativo });
      setEditingHorimeter(false); setNotice("Horímetro atualizado.");
      await loadDetails(selected, period); await loadList(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o horímetro."); }
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
      <div className="diario-bordo route-enter mx-auto w-full min-w-0 max-w-[1440px] space-y-4 pb-6 lg:space-y-5">
        <section className={`${card} relative overflow-hidden p-3 sm:p-4 md:p-5`}>
          <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <button type="button" onClick={backToList} aria-label="Voltar para os diários" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"><ArrowLeft size={16} /></button>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Diário de bordo</p>
                <p className="mt-0.5 truncate text-base font-extrabold text-foreground sm:text-sm">{selected.matricula_registro}</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap gap-2 2xl:w-auto 2xl:justify-end">
              <div className="grid min-w-0 flex-1 basis-auto grid-cols-2 gap-2 sm:basis-[22rem] 2xl:flex 2xl:flex-wrap">
                {!closed && month && <Button type="button" onClick={() => openEntryEditor(null)} className="h-11 w-full justify-center gap-1.5 rounded-lg border border-orange-400/35 bg-orange-500/15 px-3 text-xs font-extrabold text-orange-300 hover:bg-orange-500/25 hover:text-orange-200 sm:h-9 sm:w-auto"><Plus size={14} strokeWidth={2.5} /><span className="hidden xs:inline">Novo lançamento</span><span className="xs:hidden">Novo</span></Button>}
                <Button type="button" variant="outline" onClick={() => selected && void loadDetails(selected)} disabled={detailsLoading} className="h-11 w-full justify-center gap-1.5 text-xs sm:h-9 sm:w-auto"><RefreshCw size={14} className={detailsLoading ? "animate-spin" : ""} /> Atualizar</Button>
              </div>

              <div className="grid min-w-0 flex-1 basis-auto grid-cols-2 gap-2 sm:basis-[22rem] 2xl:flex 2xl:flex-wrap">
                <Button type="button" variant="outline" onClick={() => setMonthEditor(true)} className="h-11 w-full justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/15 text-xs font-extrabold text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 sm:h-9 sm:w-auto"><CalendarDays size={14} /> Novo mês</Button>
                <div className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 sm:h-9">
                  <span className="h-4 w-[2px] shrink-0 rounded-full bg-primary" />
                  <select value={`${period.ano}-${period.mes}`} onChange={(event) => changePeriod(event.target.value)} className="campo h-full min-w-0 flex-1 !w-full !border-0 !bg-transparent !px-1 !py-1 text-xs font-bold uppercase shadow-none focus:ring-0 sm:w-auto">
                    <option value={`${period.ano}-${period.mes}`}>{monthName(period.mes)} {period.ano}</option>
                    {selectedMonthOptions.filter((item) => `${item.ano}-${item.mes}` !== `${period.ano}-${period.mes}`).map((item) => <option key={`${item.ano}-${item.mes}`} value={`${item.ano}-${item.mes}`}>{monthName(item.mes)} {item.ano}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>


          <div className="diario-resumo-grid mt-4 min-w-0 gap-3 sm:mt-6">
            <div className={`${card} p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Aeronave</span>
              </div>
              <div className="diario-stat-grid gap-3">
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
                {month && !editingHorimeter && <Button type="button" variant="outline" onClick={() => { setHorimeterDraft({ inicio: String(month.horimetro_inicio ?? 0), final: String(month.horimetro_final ?? 0), ativo: String(month.horimetro_ativo ?? 0) }); setEditingHorimeter(true); }} className="ml-auto h-7 gap-1 px-2 text-[10px]"><Edit3 size={12} /> Editar</Button>}
              </div>
              {editingHorimeter && month ? <div className="space-y-3">
                <div className="diario-stat-grid gap-2">
                  {(["inicio", "final", "ativo"] as const).map((field) => <label key={field} className="min-w-0 rounded-lg border border-border bg-card/60 p-2.5"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{field === "inicio" ? "Inicial" : field === "final" ? "Final" : "Ativo"}</span><input type="number" min="0" step="0.01" value={horimeterDraft[field]} onChange={(event) => setHorimeterDraft((current) => { const value = event.target.value; if (field === "ativo") return { ...current, ativo: value }; const next = { ...current, [field]: value }; const inicio = Number(field === "inicio" ? value : next.inicio); const final = Number(field === "final" ? value : next.final); next.ativo = String(Number.isFinite(inicio) && Number.isFinite(final) ? Math.max(0, final - inicio).toFixed(2) : 0); return next; })} className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm text-foreground" /></label>)}
                </div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditingHorimeter(false)} disabled={saving} className="h-8 gap-1 text-xs"><X size={13} /> Cancelar</Button><Button type="button" onClick={() => void saveHorimeter()} disabled={saving} className="h-8 gap-1 text-xs"><Check size={13} /> Salvar</Button></div>
              </div> : <div className="diario-stat-grid gap-2">
                <StatTile label="Inicial" value={`${decimal(month?.horimetro_inicio)}h`} />
                <StatTile label="Final" value={`${decimal(month?.horimetro_final)}h`} />
                <StatTile label="Ativo" value={`${decimal(month?.horimetro_ativo)}h`} />
              </div>}
            </div>
          </div>

          <div className={`mt-3 ${card} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-violet-400" />
              <button type="button" onClick={() => setModoCelulaCabecalho((modo) => modo === "celula" ? "tvoo" : "celula")} className="flex items-center gap-1 rounded-md px-1 text-[10px] font-bold uppercase tracking-[.16em] text-violet-400 transition-colors hover:bg-violet-400/10" title="Alternar entre CÉLULA e CÉLULA TVOO">{modoCelulaCabecalho === "celula" ? "Célula" : "Célula TVOO"}<span className="text-[9px] normal-case tracking-normal opacity-70">(clique para alternar)</span></button>
            </div>
            {(() => {
              const usaTvoo = modoCelulaCabecalho === "tvoo";
              const atual = usaTvoo ? Number(month?.celula_atual_tvoo || 0) : Number(month?.celula_atual_ttotal || selected.celula_atual_ttotal || 0);
              const revisao = usaTvoo ? Number(month?.celula_prox_revisao_tvoo || 0) : Number(month?.celula_prox_revisao_ttotal || 0);
              const disponivel = usaTvoo ? Number(month?.celula_disponivel_tvoo ?? (revisao - atual)) : Number(month?.celula_disponivel_ttotal ?? (revisao - atual));
              return <div className="diario-stat-grid gap-3">
                <StatTile label="Anterior" value={`${decimal(usaTvoo ? month?.celula_anterior_tvoo : month?.celula_anterior_ttotal)}h`} />
                <StatTile label="Atual" value={`${decimal(atual)}h`} accent="text-foreground" />
                <StatTile label="Próx. revisão" value={`${decimal(revisao)}h`} />
                <StatTile label="Disponível" value={`${decimal(disponivel)}h`} accent={disponivel <= 10 ? "text-amber-400" : "text-emerald-500"} />
              </div>;
            })()}
          </div>
        </section>

        {(error || notice) && <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{error || notice}</div>}
        {optionsLoading && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">Carregando opções do formulário de voo…</div>}
        {optionsError && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground"><span>Os dados do diário foram carregados, mas as opções para incluir/editar voo não estão disponíveis: {optionsError}</span><Button type="button" variant="outline" onClick={() => void loadOptions()} disabled={optionsLoading} className="h-8">Tentar novamente</Button></div>}
        {detailsLoading && !details ? <div className="skeleton h-56 rounded-xl" /> : details && !month && <section className={`${card} flex flex-col items-center justify-center p-10 text-center`}><BookOpenCheck className="mb-3 text-primary" size={28} /><h2 className="text-sm font-bold">Este mês ainda não foi aberto</h2><p className="mt-1 max-w-md text-[11px] text-muted-foreground">Abra o diário de {monthName(period.mes)} para registrar voos, tempos, célula e combustível da aeronave.</p><Button type="button" onClick={() => setMonthEditor(true)} className="mt-4 h-9 gap-2 text-[11px]"><Plus size={13} /> Abrir diário do mês</Button></section>}
        {month && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-amber-400"><Fuel size={14} /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-amber-400">Consumo de combustível</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">Histórico registrado no mês <span className="mx-1 text-muted-foreground/60">·</span> {decimal(fuelTotal)} L abastecidos</p></div></div><ChevronDown size={15} className="shrink-0 text-amber-400/70" /></div>}
        {monthEditor && <CreateMonthDialog open={monthEditor} onOpenChange={setMonthEditor} aircraftId={selected.id} aircraftRegistration={selected.matricula_registro} month={period.mes} year={period.ano} currentModoCelula={month?.modo_celula || null} previousMonthData={month ? { celula_atual_ttotal: month.celula_atual_ttotal, celula_prox_revisao_ttotal: month.celula_prox_revisao_ttotal, celula_atual_tvoo: month.celula_atual_tvoo, celula_prox_revisao_tvoo: month.celula_prox_revisao_tvoo, horimetro_final: month.horimetro_final, aerodromo_base: month.aerodromo_base, consumo_combustivel: month.consumo_combustivel, tem_tarifa_diaria: Boolean(month.tem_tarifa_diaria), tarifa_diaria: month.tarifa_diaria } : null} onCreate={(payload) => saveMonth(payload)} />}
        {entryEditor !== false && month && !closed && options && <DiarioLancamentoFormIntegrado aeronaveId={selected.id} consumoCombustivel={selected.consumo_combustivel} diarioMesId={month.id} opcoes={options} initialData={entryEditor || null} sugestaoTrecho={details?.lancamentos?.length ? details.lancamentos[details.lancamentos.length - 1].trecho || `${details.lancamentos[details.lancamentos.length - 1].aerodromo_partida} X ${details.lancamentos[details.lancamentos.length - 1].aerodromo_chegada}` : undefined} temDiaria={Boolean(month.tem_tarifa_diaria)} onSubmit={saveEntry} onCancel={() => setEntryEditor(false)} saving={saving} />}
        {month && (
          <div className="space-y-4">
            <LancamentosTableConfigurada modoCelula={modoCelulaCabecalho} onToggleModoCelula={() => setModoCelulaCabecalho((modo) => modo === "celula" ? "tvoo" : "celula")} lancamentos={details?.lancamentos || []} closed={closed} onEdit={(entry) => openEntryEditor(entry)} onDelete={(entry) => void removeEntry(entry)} />
          </div>
        )}
        {month && <DiarioBancoHoras lancamentos={details?.lancamentos || []} horasCotistas={details?.horas_cotistas} horasEmprestadas={details?.horas_emprestadas} />}
      </div>
    );
  }

  return (
    <div className="diario-bordo route-enter mx-auto w-full min-w-0 max-w-[1440px] space-y-4 pb-6 lg:space-y-5">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div><IndicadorPagina>Operações / Diário de bordo</IndicadorPagina><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><BookOpenCheck className="text-primary" size={26} /> Diários de bordo</h1><p className="mt-1.5 text-xs text-muted-foreground">Gerencie os diários digitais, horas de voo, célula e registros operacionais das aeronaves.</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">{aoVoltar && <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-1.5 text-[10px]"><ArrowLeft size={13} /> Voltar</Button>}{aoAbrirAerodromos && <Button type="button" variant="outline" onClick={aoAbrirAerodromos} className="h-9 gap-1.5 text-[10px]">Aeródromos</Button>}</div>
      </div>
      {(error || notice) && <div className={`rounded-lg border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{error || notice}</div>}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] text-muted-foreground sm:flex-none"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aeronave..." className="w-full min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/70 sm:w-40" /></label><select value={ano} onChange={(event) => setAno(Number(event.target.value))} className="campo !h-9 !w-auto !py-1 !px-3 text-[10px] font-bold"><option value={ano}>{ano}</option><option value={ano - 1}>{ano - 1}</option><option value={ano + 1}>{ano + 1}</option></select></div><Button type="button" variant="outline" onClick={() => void loadList(true)} disabled={refreshing} className="h-9 gap-1.5 text-[10px]"><RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Atualizar</Button></div>
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

function LancamentosTableConfigurada({ modoCelula, onToggleModoCelula, lancamentos, closed, onEdit, onDelete }: { modoCelula: "celula" | "tvoo"; onToggleModoCelula: () => void; lancamentos: DiarioLancamento[]; closed: boolean; onEdit: (entry: DiarioLancamento) => void; onDelete: (entry: DiarioLancamento) => void }) {
  const [aba, setAba] = useState<"todos" | "resumo" | "emprestimos">("todos");
  const [acoesAberta, setAcoesAberta] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const iniciarArraste = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      drag.current.moved = false;
      return;
    }
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
  const nomeDestino = (entry: DiarioLancamento) => {
    if (entry.natureza_voo === "TR - Traslado" || entry.natureza_voo === "VT - Voo Teste") return entry.natureza_voo;
    return entry.voo_emprestado ? (entry.socio_tomador_nome || entry.cliente_tomador_nome || entry.socio_nome || entry.cliente_nome || "Não informado") : (entry.socio_nome || entry.cliente_nome || "Não informado");
  };
  const colunas = [
    { key: "ref", label: "", width: 52, className: "text-center text-primary", render: (entry: DiarioLancamento) => `#${entry.numero_sequencial}` },
    { key: "data", label: "DATA", width: 76, render: (entry: DiarioLancamento) => date(entry.data_registro) },
    { key: "de", label: "DE", width: 54, render: (entry: DiarioLancamento) => entry.aerodromo_partida },
    { key: "para", label: "PARA", width: 54, render: (entry: DiarioLancamento) => entry.aerodromo_chegada },
    { key: "ac", label: "AC", width: 50, render: (entry: DiarioLancamento) => time(entry.tempo_ac) },
    { key: "dep", label: "DEP", width: 50, render: (entry: DiarioLancamento) => time(entry.tempo_dep) },
    { key: "pou", label: "POU", width: 50, render: (entry: DiarioLancamento) => time(entry.tempo_pou) },
    { key: "cor", label: "COR", width: 50, render: (entry: DiarioLancamento) => time(entry.tempo_cor) },
    { key: "tvoo", label: "T VOO", width: 92, className: "text-primary", render: (entry: DiarioLancamento) => duration(entry.tempo_voo) },
    { key: "tdia", label: "T DIA", width: 92, className: "text-primary", render: (entry: DiarioLancamento) => duration(entry.horas_diurnas) },
    { key: "tnoit", label: "T NOIT", width: 92, className: "text-violet-400", render: (entry: DiarioLancamento) => duration(entry.horas_noturnas) },
    { key: "ifr", label: "IFR", width: 92, className: "text-amber-400", render: (entry: DiarioLancamento) => duration(entry.tempo_ifr) },
    { key: "pousos", label: "POUSOS", width: 58, className: "text-center text-emerald-400", render: (entry: DiarioLancamento) => entry.pousos_total },
    { key: "abast", label: "ABAST+", width: 58, className: "text-amber-400", render: (entry: DiarioLancamento) => decimal(entry.litros_combustivel_abastecido, 1) },
    { key: "fuel", label: "FUEL", width: 54, className: "text-amber-400", render: (entry: DiarioLancamento) => decimal(entry.litros_combustivel_inicio_voo, 1) },
    { key: "celula", label: modoCelula === "celula" ? "CÉLULA" : "CÉLULA TVOO", width: 92, render: (entry: DiarioLancamento) => { const valor = modoCelula === "celula" ? entry.celula : entry.celula_tvoo; return valor == null ? "—" : `${decimal(valor, 1)}h`; } },
    { key: "pic", label: "PIC", width: 100, render: (entry: DiarioLancamento) => entry.pic_nome_exibicao || entry.pic_nome || entry.pic_canac || "—" },
    { key: "sic", label: "SIC", width: 100, render: (entry: DiarioLancamento) => entry.sic_nome_exibicao || entry.sic_nome || entry.sic_canac || "—" },
    { key: "voopara", label: "VOO PARA", width: 120, render: (entry: DiarioLancamento) => nomeDestino(entry) },
  ];
  const totais = exibidos.reduce((acc, entry) => ({ voo: acc.voo + Number(entry.tempo_voo || 0), pousos: acc.pousos + Number(entry.pousos_total || 0), abast: acc.abast + Number(entry.litros_combustivel_abastecido || 0), fuel: acc.fuel + Number(entry.litros_combustivel_inicio_voo || 0) }), { voo: 0, pousos: 0, abast: 0, fuel: 0 });
  const [largurasColunas, setLargurasColunas] = useState<Record<string, number>>(() => Object.fromEntries(colunas.map((coluna) => [coluna.key, coluna.width])));
  const iniciarRedimensionamento = (event: React.PointerEvent<HTMLSpanElement>, key: string, larguraAtual: number) => {
    event.preventDefault();
    event.stopPropagation();
    const inicioX = event.clientX;
    const mover = (moveEvent: PointerEvent) => setLargurasColunas((current) => ({ ...current, [key]: Math.max(44, larguraAtual + moveEvent.clientX - inicioX) }));
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const finalizar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", finalizar);
      window.removeEventListener("pointercancel", finalizar);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", finalizar, { once: true });
    window.addEventListener("pointercancel", finalizar, { once: true });
  };
  return <section className={`${card} overflow-hidden`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 md:px-5"><div className="flex items-center gap-2.5"><span className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpenCheck size={15} /></span><div><h2 className="text-sm font-bold text-foreground">Registros de voo</h2><p className="mt-0.5 text-xs text-muted-foreground">{exibidos.length} voos exibidos nesta visão</p></div></div><div className="flex items-center gap-2">{closed && <EtiquetaStatus tone="amber">Mês fechado</EtiquetaStatus>}</div></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground"><div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-bold">!</span><span>Clique no <strong className="font-semibold text-primary">código de referência</strong> para editar ou excluir.</span></div><span className="hidden h-4 w-px bg-border sm:block" /><div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-bold">↔</span><span>Arraste a tabela horizontalmente para consultar todas as colunas. Clique no título CÉLULA para alternar entre os horímetros. Use a divisória do cabeçalho para redimensionar uma coluna.</span></div></div>
    <div className="flex flex-wrap gap-1 border-b border-border bg-muted/20 px-3 pt-2"><button type="button" onClick={() => setAba("todos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "todos" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Tabela completa</button><button type="button" onClick={() => setAba("resumo")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "resumo" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Resumo de voo</button><button type="button" onClick={() => setAba("emprestimos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "emprestimos" ? "border-amber-400 bg-card text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}><PlaneTakeoff size={12} className="mr-1 inline" /> Voos empréstimo <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[11px]">{lancamentos.filter((entry) => Boolean(entry.voo_emprestado)).length}</span></button></div>
    {!exibidos.length ? <EstadoVazio label={aba === "emprestimos" ? "Nenhum voo empréstimo neste mês" : "Nenhum voo registrado neste mês"} /> : aba === "resumo" ? <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="responsive-table"><table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[10px] lg:min-w-0"><thead className="border-b border-border bg-muted/40"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground"><th className="px-4 py-3" /><th className="px-4 py-3">DATA</th><th className="px-4 py-3">TRECHO</th><th className="px-4 py-3">DEP</th><th className="px-4 py-3">POU</th><th className="px-4 py-3 text-primary">T VOO</th><th className="px-4 py-3">VOO PARA</th></tr></thead><tbody>{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-border/60 ${index % 2 === 0 ? "bg-card/40" : "bg-card/10"} hover:bg-primary/5`}><td className="px-4 py-3"><button type="button" onClick={() => onEdit(entry)} className="font-mono font-bold text-primary underline decoration-primary/50 underline-offset-2 hover:text-primary/80">#{entry.numero_sequencial}</button></td><td className="whitespace-nowrap px-4 py-3 text-foreground">{date(entry.data_registro)}</td><td className="px-4 py-3 font-mono font-bold text-foreground">{entry.trecho || `${entry.aerodromo_partida} X ${entry.aerodromo_chegada}`}</td><td className="px-4 py-3 font-mono text-muted-foreground">{time(entry.tempo_dep)}</td><td className="px-4 py-3 font-mono text-muted-foreground">{time(entry.tempo_pou)}</td><td className="px-4 py-3 font-mono font-bold text-primary">{duration(entry.tempo_voo)}</td><td className="max-w-[260px] truncate px-4 py-3 font-bold text-foreground">{nomeDestino(entry)}</td></tr>)}</tbody></table></div></div> : <div className="overflow-hidden rounded-xl border border-border bg-card"><div ref={scrollRef} className="responsive-table cursor-grab select-none active:cursor-grabbing" onPointerDown={iniciarArraste} onPointerMove={moverArraste} onPointerUp={pararArraste} onPointerCancel={pararArraste} onClickCapture={bloquearCliqueAposArraste}><table className="w-full min-w-[1080px] border-collapse text-left text-xs lg:min-w-0" style={{ tableLayout: "fixed" }}><colgroup>{colunas.map((coluna) => <col key={coluna.key} style={{ width: largurasColunas[coluna.key] ?? coluna.width }} />)}</colgroup><thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{colunas.map((coluna) => <th key={coluna.key} className={`relative whitespace-nowrap text-ellipsis border-r border-border px-1.5 py-2 text-[8px] select-none sm:px-2 sm:py-3 sm:text-[9px] ${coluna.className || ""}`} style={{ width: largurasColunas[coluna.key] ?? coluna.width }}>{coluna.key === "celula" ? <button type="button" title="Clique para alternar entre CÉLULA e CÉLULA TVOO" aria-label={`Alternar leitura da coluna: ${coluna.label}`} onClick={onToggleModoCelula} className={`block max-w-full truncate rounded-md border px-1 py-0.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${modoCelula === "celula" ? "border-amber-300/25 bg-amber-300/10 text-amber-300 hover:bg-amber-300/15" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/15"}`}>{coluna.label}</button> : <span className="block truncate pr-2">{coluna.label}</span>}<span role="separator" aria-label={`Redimensionar coluna ${coluna.label || "de referência"}`} onPointerDown={(event) => iniciarRedimensionamento(event, coluna.key, largurasColunas[coluna.key] ?? coluna.width)} className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize rounded-sm bg-transparent transition-colors hover:bg-primary/70 active:bg-primary" /></th>)}</tr></thead><tbody className="text-xs text-foreground">{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-border/50 ${index % 2 === 0 ? "bg-card/40" : "bg-card/10"} hover:bg-primary/5`}><td className="relative border-r border-border px-2 py-2 text-center font-mono font-bold text-primary sm:px-3 sm:py-3"><button type="button" onClick={() => setAcoesAberta(acoesAberta === entry.id ? null : entry.id)} className="underline decoration-primary/50 underline-offset-2 hover:text-primary/80">#{entry.numero_sequencial}</button>{acoesAberta === entry.id && <div className="absolute left-2 top-10 z-20 flex w-36 flex-col gap-1 rounded-xl border border-border bg-card p-1.5 text-left shadow-xl"><button type="button" onClick={() => { setAcoesAberta(null); onEdit(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-primary/10 hover:text-primary"><Edit3 size={13} /> Editar</button><button type="button" onClick={() => { setAcoesAberta(null); onDelete(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /> Excluir</button></div>}</td>{colunas.slice(1).map((coluna) => <td key={coluna.key} className={`whitespace-nowrap overflow-hidden text-ellipsis border-r border-border/60 px-1.5 py-2 font-mono text-[8px] sm:px-2 sm:py-3 sm:text-[9px] ${coluna.className || ""}`}>{coluna.render(entry)}</td>)}</tr>)}</tbody><tfoot className="sticky bottom-0 border-t-2 border-primary/30 bg-card text-xs font-bold"><tr><td className="px-2 py-2 text-center text-primary sm:px-3 sm:py-3">TOTAL</td><td colSpan={7} /><td className="px-3 py-3 font-mono text-primary">{duration(totais.voo)}</td><td colSpan={3} /><td className="px-3 py-3 text-center text-emerald-400">{totais.pousos}</td><td className="px-3 py-3 text-amber-400">{decimal(totais.abast, 1)}</td><td className="px-3 py-3 text-amber-400">{decimal(totais.fuel, 1)}</td><td colSpan={4} /></tr></tfoot></table></div></div>}
  </section>;
}
