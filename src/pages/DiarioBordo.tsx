import DiarioConsumo, { DiarioDiscrepancias } from "@/components/diario/DiarioConsumo";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ArrowDown, ChevronDown, Droplets, FileText, Map as MapIcon, BookOpenCheck, CalendarDays, Check, Edit3, List, Plus, RefreshCw, Search, Trash2, X, PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, EtiquetaStatus } from "@/components/dashboard/ComponentesDashboard";
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
  const [flightSearch, setFlightSearch] = useState("");
  const [ascending, setAscending] = useState(true);
  const [tableTab, setTableTab] = useState<"todos" | "resumo" | "emprestimos" | "discrepancias">("todos");
  const [cellEditor, setCellEditor] = useState<"anterior" | "revisao" | null>(null);
  const [cellDraft, setCellDraft] = useState("");
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
    setFlightSearch(""); setAscending(true); setTableTab("todos"); setEditingHorimeter(false); setCellEditor(null); setSelected(aircraft); setPeriod(nextPeriod); setDetails(null); setMonthEditor(false); setEntryEditor(false); setNotice(null); setModoCelulaCabecalho("celula"); void loadDetails(aircraft, nextPeriod);
  };
  const backToList = () => { setSelected(null); setDetails(null); setEntryEditor(false); setMonthEditor(false); setNotice(null); void loadList(true); };
  const changePeriod = (value: string) => { const [year, month] = value.split("-").map(Number); const next = { ano: year, mes: month }; setEditingHorimeter(false); setCellEditor(null); setPeriod(next); if (selected) void loadDetails(selected, next); setEntryEditor(false); setMonthEditor(false); };

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
    const usaTvoo = modoCelulaCabecalho === "tvoo";
    const atual = Number(usaTvoo ? month?.celula_atual_tvoo ?? 0 : month?.celula_atual_ttotal ?? selected.celula_atual_ttotal ?? 0);
    const revisao = Number(usaTvoo ? month?.celula_prox_revisao_tvoo ?? 0 : month?.celula_prox_revisao_ttotal ?? 0);
    const disponivel = Number(usaTvoo ? month?.celula_disponivel_tvoo ?? (revisao - atual) : month?.celula_disponivel_ttotal ?? (revisao - atual));
    const anterior = usaTvoo ? month?.celula_anterior_tvoo : month?.celula_anterior_ttotal;
    const years = [...new Set(selectedMonthOptions.map((item) => item.ano).concat(period.ano - 1, period.ano, period.ano + 1))].sort((a, b) => b - a);
    // O resumo original não declara o ano: só exibir se o Worker o fornecer.
    const aircraftYear = "ano_fabricacao" in selected ? selected.ano_fabricacao : "ano" in selected ? selected.ano : null;
    const visibleEntries = (details?.lancamentos || []).filter((entry) => {
      const query = flightSearch.trim().toLocaleLowerCase("pt-BR");
      return !query || [entry.numero_sequencial, entry.data_registro, date(entry.data_registro), entry.trecho, entry.aerodromo_partida, entry.aerodromo_chegada, entry.pic_nome_exibicao, entry.pic_nome, entry.sic_nome, entry.socio_nome, entry.cliente_nome, entry.socio_tomador_nome, entry.cliente_tomador_nome, entry.natureza_voo].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(query));
    }).sort((a, b) => {
      const result = String(a.data_registro || "").localeCompare(String(b.data_registro || "")) || Number(a.numero_sequencial || 0) - Number(b.numero_sequencial || 0);
      return ascending ? result : -result;
    });
    const editHorimeter = () => {
      if (!month || closed || detailsLoading) return;
      setHorimeterDraft({ inicio: String(month.horimetro_inicio ?? 0), final: String(month.horimetro_final ?? 0), ativo: String(month.horimetro_ativo ?? 0) });
      setEditingHorimeter(true);
    };
    const editCell = (field: "anterior" | "revisao") => {
      setCellDraft(String(field === "anterior" ? anterior ?? 0 : revisao));
      setCellEditor(field);
    };
    const saveCell = async () => {
      if (!month || !cellEditor || closed || detailsLoading) return;
      const value = Number(cellDraft.replace(",", "."));
      if (!cellDraft.trim() || !Number.isFinite(value) || value < 0) { setError("Informe um valor válido e não negativo para a célula."); return; }
      const field = `celula_${cellEditor === "anterior" ? "anterior" : "prox_revisao"}_${usaTvoo ? "tvoo" : "ttotal"}`;
      setSaving(true); setError(null);
      try {
        await atualizarMesDiario(month.id, { [field]: value });
        setCellEditor(null); setNotice("Célula atualizada.");
        await loadDetails(selected, period); await loadList(true);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a célula."); }
      finally { setSaving(false); }
    };
    const theme = { "--background": "222 25% 9%", "--foreground": "220 20% 96%", "--card": "222 23% 10%", "--card-foreground": "220 20% 96%", "--border": "220 23% 15%", "--input": "220 23% 21%", "--muted": "220 23% 13%", "--muted-foreground": "218 14% 65%", "--primary": "188 95% 47%", "--secondary": "220 23% 13%" } as CSSProperties;
    return (
      <div className="diario-bordo db-month route-enter" style={theme} aria-busy={detailsLoading}>
        <style>{diarioStyles}</style>
        <header className="db-topbar">
          <div className="db-heading">
            <button type="button" onClick={backToList} className="db-btn db-back"><ArrowLeft size={12} /> Voltar</button>
            <h1>Diário {monthName(period.mes)} {period.ano} — {selected.matricula_registro}</h1>
          </div>
          <div className="db-actions">
            <div className="db-period">
              <span>PERÍODO</span>
              <select aria-label="Mês do diário" value={period.mes} onChange={(event) => changePeriod(`${period.ano}-${event.target.value}`)} disabled={saving}>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1} style={{ paddingLeft: 10 }}>{monthName(i + 1).slice(0, 3).toUpperCase()}</option>)}
              </select>
              <select aria-label="Ano do diário" value={period.ano} onChange={(event) => changePeriod(`${event.target.value}-${period.mes}`)} disabled={saving} style={{ paddingLeft: 15, paddingRight: 15 }}>
                {years.map((year) => <option key={year} value={year} style={{ paddingLeft: 9 }}>{year}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => openEntryEditor(null)} disabled={!month || closed || detailsLoading || saving} className="db-btn db-cyan" style={{ paddingLeft: 20, paddingRight: 20 }}><Plus size={13} /> Novo Voo</button>
            <button type="button" onClick={() => window.print()} disabled={!month || detailsLoading} className="db-btn db-amber" title="Imprimir ou salvar como PDF"><FileText size={12} /> PDF</button>
            <button type="button" onClick={() => setMonthEditor(true)} disabled={detailsLoading || saving} className="db-btn db-green"><CalendarDays size={12} /> Novo Mês</button>
          </div>
        </header>

        <div className="db-summary">
          <section className="db-panel db-aircraft">
            <div className="db-section-title db-title-cyan"><span>Aeronave</span><small>{selected.matricula_registro} · {selected.modelo || "—"}</small></div>
            <div className="db-stats db-four db-aircraft-stats">
              <StatTile label="Matrícula" value={selected.matricula_registro} />
              <StatTile label="Modelo" value={selected.modelo || "—"} />
              <StatTile label="Ano" value={typeof aircraftYear === "number" || typeof aircraftYear === "string" ? String(aircraftYear) : "—"} />
              <StatTile label="Base" value={month?.aerodromo_base || "—"} />
            </div>
            <div className="db-cell">
              <div className="db-section-title db-title-violet"><button type="button" disabled={cellEditor !== null} onClick={() => setModoCelulaCabecalho((modo) => modo === "celula" ? "tvoo" : "celula")} title="Alternar entre Célula e Célula TVOO">{usaTvoo ? "Célula TVOO" : "Célula"}</button></div>
              <div className="db-stats db-four db-cell-stats">
                <StatTile label="Anterior" value={`${decimal(anterior)}h`} onClick={month && !closed && !detailsLoading ? () => editCell("anterior") : undefined} />
                <StatTile label="Atual" value={`${decimal(atual)}h`} />
                <StatTile label="Próx. Revisão" value={`${decimal(revisao)}h`} onClick={month && !closed && !detailsLoading ? () => editCell("revisao") : undefined} />
                <StatTile label="Disponível" value={`${decimal(disponivel)}h`} accent={disponivel < 0 ? "db-overdue" : "db-available"} />
              </div>
              {cellEditor && <form className="db-inline-editor" onSubmit={(event) => { event.preventDefault(); void saveCell(); }}>
                <label>{cellEditor === "anterior" ? "Célula anterior" : "Próxima revisão"}<input aria-label="Horas de célula" type="text" inputMode="decimal" value={cellDraft} onChange={(event) => setCellDraft(event.target.value)} autoFocus /></label>
                <button type="button" className="db-btn" disabled={saving} onClick={() => setCellEditor(null)}>Cancelar</button>
                <button type="submit" className="db-btn db-cyan" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
              </form>}
            </div>
            <div className="db-cell db-horimeter">
            <div className="db-section-title db-title-amber"><span>Horímetro</span></div>
            {editingHorimeter && month ? <form onSubmit={(event) => { event.preventDefault(); void saveHorimeter(); }}>
              <div className="db-stats db-three">
                {(["inicio", "final", "ativo"] as const).map((field) => <label key={field} className="db-stat db-horimeter-input"><span>{field === "inicio" ? "Inicial" : field === "final" ? "Final" : "Ativo"}</span><input aria-label={`Horímetro ${field}`} type="number" min="0" step="0.01" required value={horimeterDraft[field]} onChange={(event) => setHorimeterDraft((current) => { const value = event.target.value; if (field === "ativo") return { ...current, ativo: value }; const next = { ...current, [field]: value }; next.ativo = String(Math.max(0, Number(next.final) - Number(next.inicio)).toFixed(2)); return next; })} /></label>)}
              </div>
              <div className="db-editor-actions"><button type="button" className="db-btn" onClick={() => setEditingHorimeter(false)} disabled={saving}><X size={12} /> Cancelar</button><button type="submit" className="db-btn db-cyan" disabled={saving}><Check size={12} /> Salvar</button></div>
            </form> : <div className="db-stats db-three">
              <StatTile label="Inicial" value={`${decimal(month?.horimetro_inicio)}h`} onClick={month && !closed && !detailsLoading ? editHorimeter : undefined} />
              <StatTile label="Final" value={`${decimal(month?.horimetro_final)}h`} onClick={month && !closed && !detailsLoading ? editHorimeter : undefined} />
              <StatTile label="Ativo" value={`${decimal(month?.horimetro_ativo)}h`} onClick={month && !closed && !detailsLoading ? editHorimeter : undefined} />
            </div>}
            </div>
          </section>
        </div>

        {(error || notice) && <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{error || notice}</div>}
        {optionsLoading && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">Carregando opções do formulário de voo…</div>}
        {optionsError && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground"><span>Os dados do diário foram carregados, mas as opções para incluir/editar voo não estão disponíveis: {optionsError}</span><Button type="button" variant="outline" onClick={() => void loadOptions()} disabled={optionsLoading} className="h-8">Tentar novamente</Button></div>}
        {detailsLoading && !details ? <div className="skeleton h-56 rounded-xl" /> : details && !month && <section className={`${card} flex flex-col items-center justify-center p-10 text-center`}><BookOpenCheck className="mb-3 text-primary" size={28} /><h2 className="text-sm font-bold">Este mês ainda não foi aberto</h2><p className="mt-1 max-w-md text-[11px] text-muted-foreground">Abra o diário de {monthName(period.mes)} para registrar voos, tempos, célula e combustível da aeronave.</p><Button type="button" onClick={() => setMonthEditor(true)} className="mt-4 h-9 gap-2 text-[11px]"><Plus size={13} /> Abrir diário do mês</Button></section>}
        {month && <details className="db-consumption">
          <summary><span className="db-fuel-icon"><Droplets size={16} /></span><span><strong>Consumo de combustível</strong><small>Referência: <b>{selected.consumo_combustivel == null ? "—" : decimal(selected.consumo_combustivel)} L/H</b><span>Detalhes do mês</span></small></span><ChevronDown size={14} className="db-chevron" /></summary>
          <div className="db-consumption-body"><DiarioConsumo lancamentos={details?.lancamentos || []} modo={modoCelulaCabecalho} /></div>
        </details>}
        {monthEditor && <CreateMonthDialog open={monthEditor} onOpenChange={setMonthEditor} aircraftId={selected.id} aircraftRegistration={selected.matricula_registro} month={period.mes} year={period.ano} currentModoCelula={month?.modo_celula || null} previousMonthData={month ? { celula_atual_ttotal: month.celula_atual_ttotal, celula_prox_revisao_ttotal: month.celula_prox_revisao_ttotal, celula_atual_tvoo: month.celula_atual_tvoo, celula_prox_revisao_tvoo: month.celula_prox_revisao_tvoo, horimetro_final: month.horimetro_final, aerodromo_base: month.aerodromo_base, consumo_combustivel: month.consumo_combustivel, tem_tarifa_diaria: Boolean(month.tem_tarifa_diaria), tarifa_diaria: month.tarifa_diaria } : null} onCreate={(payload) => saveMonth(payload)} />}
        {entryEditor !== false && month && !closed && options && <DiarioLancamentoFormIntegrado aeronaveId={selected.id} consumoCombustivel={selected.consumo_combustivel} diarioMesId={month.id} opcoes={options} initialData={entryEditor || null} sugestaoTrecho={details?.lancamentos?.length ? details.lancamentos[details.lancamentos.length - 1].trecho || `${details.lancamentos[details.lancamentos.length - 1].aerodromo_partida} X ${details.lancamentos[details.lancamentos.length - 1].aerodromo_chegada}` : undefined} temDiaria={Boolean(month.tem_tarifa_diaria)} onSubmit={saveEntry} onCancel={() => setEntryEditor(false)} saving={saving} />}
        {month && (
          <div className="db-records">
            <div className="db-toolbar">
              <label className="db-search"><Search size={13} /><input aria-label="Filtrar registros de voo" value={flightSearch} onChange={(event) => setFlightSearch(event.target.value)} placeholder="Filtrar registros..." /></label>
              <button type="button" className="db-btn" onClick={() => setAscending((value) => !value)}>{ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{ascending ? "Crescente" : "Decrescente"}</button>
              <button type="button" className={`db-btn ${tableTab === "resumo" ? "db-cyan" : ""}`} aria-pressed={tableTab === "resumo"} onClick={() => setTableTab((value) => value === "resumo" ? "todos" : "resumo")}><MapIcon size={12} className="db-icon-cyan" /> Resumo</button>
              <button type="button" className="db-btn db-refresh" aria-label="Atualizar diário" title="Atualizar diário" onClick={() => void loadDetails(selected)} disabled={detailsLoading}><RefreshCw size={12} className={detailsLoading ? "animate-spin" : ""} /></button>
            </div>
            <LancamentosTableConfigurada aba={tableTab} setAba={setTableTab} modoCelula={modoCelulaCabecalho} onToggleModoCelula={() => setModoCelulaCabecalho((modo) => modo === "celula" ? "tvoo" : "celula")} lancamentos={visibleEntries} closed={closed} onEdit={(entry) => openEntryEditor(entry)} onDelete={(entry) => void removeEntry(entry)} />
          </div>
        )}
        {month && <DiarioBancoHoras lancamentos={details?.lancamentos || []} horasCotistas={details?.horas_cotistas} horasEmprestadas={details?.horas_emprestadas} />}
      </div>
    );
  }

  return (
    <div className="diario-bordo route-enter mx-[6px] my-[10px] w-full min-w-0 max-w-[1440px] space-y-4 pb-6 pl-[12px] pr-[25px] lg:space-y-5">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="pl-[14px] pr-[15px] pt-[7px]"><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><BookOpenCheck className="text-primary" size={26} /> Diários de bordo</h1><p className="mt-1.5 text-xs text-muted-foreground">Gerencie os diários digitais, horas de voo, célula e registros operacionais das aeronaves.</p></div>
        <div className="flex w-full flex-wrap gap-2 px-[123px] sm:w-auto">{aoVoltar && <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-1.5 text-[10px]"><ArrowLeft size={13} /> Voltar</Button>}{aoAbrirAerodromos && <Button type="button" variant="outline" onClick={aoAbrirAerodromos} className="mx-[4px] min-h-[38px] h-9 gap-1.5 px-[40px] text-[10px] [border-color:rgba(5,197,41,0.58)]">Aeródromos</Button>}</div>
      </div>
      {(error || notice) && <div className={`rounded-lg border p-3 text-[11px] ${error ? "border-destructive/40 bg-destructive/10 text-destructive-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>{error || notice}</div>}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] text-muted-foreground sm:flex-none"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aeronave..." className="w-full min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/70 sm:w-40" /></label><select value={ano} onChange={(event) => setAno(Number(event.target.value))} className="campo !h-9 !w-auto !py-1 !px-3 text-[10px] font-bold"><option value={ano}>{ano}</option><option value={ano - 1}>{ano - 1}</option><option value={ano + 1}>{ano + 1}</option></select></div><Button type="button" variant="outline" onClick={() => void loadList(true)} disabled={refreshing} className="mx-[122px] h-9 gap-1.5 px-[41px] text-[10px]"><RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Atualizar</Button></div>
      <AircraftListContent loading={loading} aeronaves={filteredAircraft} ano={ano} search={search} onOpen={openAircraft} />
    </div>
  );
}

function StatTile({ label, value, accent = "", onClick }: { label: string; value: string; accent?: string; onClick?: () => void }) {
  const content = <><span className="db-stat-label">{label}</span>{onClick && <small>clique para editar</small>}<strong>{value}</strong></>;
  return onClick ? <button type="button" className={`db-stat ${accent}`} onClick={onClick} aria-label={`Editar ${label}: ${value}`}>{content}</button> : <div className={`db-stat ${accent}`}>{content}</div>;
}

function AircraftListContent({ loading, aeronaves, ano, search, onOpen }: { loading: boolean; aeronaves: DiarioAeronaveResumo[]; ano: number; search: string; onOpen: (aeronave: DiarioAeronaveResumo) => void }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-64 rounded-2xl" />)}</div>;
  if (aeronaves.length > 0) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{aeronaves.map((aircraft) => <DiarioAeronaveCard key={aircraft.id} aeronave={aircraft} ano={ano} onOpen={() => onOpen(aircraft)} />)}</div>;
  return <EstadoVazio label={search ? "Nenhuma aeronave corresponde à busca" : "Nenhuma aeronave ativa encontrada"} />;
}

function LancamentosTableConfigurada({ aba, setAba, modoCelula, onToggleModoCelula, lancamentos, closed, onEdit, onDelete }: { aba: "todos" | "resumo" | "emprestimos" | "discrepancias"; setAba: (value: "todos" | "resumo" | "emprestimos" | "discrepancias") => void; modoCelula: "celula" | "tvoo"; onToggleModoCelula: () => void; lancamentos: DiarioLancamento[]; closed: boolean; onEdit: (entry: DiarioLancamento) => void; onDelete: (entry: DiarioLancamento) => void }) {
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
  const exibidos = aba === "emprestimos" ? lancamentos.filter((entry) => Boolean(entry.voo_emprestado)) : aba === "discrepancias" ? lancamentos.filter((entry) => entry.discrepancias?.trim() || entry.acoes_corretivas?.trim()) : lancamentos;
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
  return <section className="rounded-xl border border-border bg-[rgba(22,26,36,1)] shadow-sm overflow-hidden">
    <div className="db-table-heading"><h2><PlaneTakeoff size={13} /> Registros de Voo</h2><div>{closed && <EtiquetaStatus tone="amber">Mês fechado</EtiquetaStatus>}<span className="db-count">{exibidos.length} {exibidos.length === 1 ? "voo" : "voos"}</span></div></div>
    <details className="db-table-options"><summary>Visões e opções da tabela</summary>
      <p>Use o código de referência para editar ou excluir. Arraste a tabela para ver todas as colunas e as divisórias do cabeçalho para ajustar as larguras.</p>
    <div className="flex flex-wrap gap-1 border-b border-border bg-muted/20 px-3 pt-2">
      <button type="button" onClick={() => setAba("todos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "todos" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Tabela completa</button>
      <button type="button" onClick={() => setAba("resumo")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "resumo" ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><List size={12} className="mr-1 inline" /> Resumo de voo</button>
      <button type="button" onClick={() => setAba("emprestimos")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "emprestimos" ? "border-amber-400 bg-card text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}><PlaneTakeoff size={12} className="mr-1 inline" /> Voos empréstimo <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[11px]">{lancamentos.filter((entry) => Boolean(entry.voo_emprestado)).length}</span></button>
      <button type="button" onClick={() => setAba("discrepancias")} className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-colors ${aba === "discrepancias" ? "border-amber-400 bg-card text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Registro de discrepâncias <span className="ml-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[11px]">{lancamentos.filter((entry) => entry.discrepancias?.trim() || entry.acoes_corretivas?.trim()).length}</span></button>
    </div>
    </details>
    <div className={aba === "discrepancias" ? "hidden" : ""}>
    {!exibidos.length ? <EstadoVazio label={aba === "emprestimos" ? "Nenhum voo empréstimo neste mês" : "Nenhum voo registrado neste mês"} /> : aba === "resumo" ? <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="db-table-scroll responsive-table"><table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[10px] lg:min-w-0"><thead className="border-b border-border bg-muted/40"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground"><th className="px-4 py-3" /><th className="px-4 py-3">DATA</th><th className="px-4 py-3">TRECHO</th><th className="px-4 py-3">DEP</th><th className="px-4 py-3">POU</th><th className="px-4 py-3 text-primary">T VOO</th><th className="px-4 py-3">VOO PARA</th></tr></thead><tbody>{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-border/60 ${index % 2 === 0 ? "bg-card/40" : "bg-card/10"} hover:bg-primary/5`}><td className="px-4 py-3"><button type="button" disabled={closed} onClick={() => onEdit(entry)} className="font-mono font-bold text-primary underline decoration-primary/50 underline-offset-2 hover:text-primary/80">#{entry.numero_sequencial}</button></td><td className="whitespace-nowrap px-4 py-3 text-foreground">{date(entry.data_registro)}</td><td className="px-4 py-3 font-mono font-bold text-foreground">{entry.trecho || `${entry.aerodromo_partida} X ${entry.aerodromo_chegada}`}</td><td className="px-4 py-3 font-mono text-muted-foreground">{time(entry.tempo_dep)}</td><td className="px-4 py-3 font-mono text-muted-foreground">{time(entry.tempo_pou)}</td><td className="px-4 py-3 font-mono font-bold text-primary">{duration(entry.tempo_voo)}</td><td className="max-w-[260px] truncate px-4 py-3 font-bold text-foreground">{nomeDestino(entry)}</td></tr>)}</tbody></table></div></div> : <div className="overflow-hidden rounded-xl border border-border bg-card"><div ref={scrollRef} className="db-table-scroll responsive-table cursor-grab select-none active:cursor-grabbing" onPointerDown={iniciarArraste} onPointerMove={moverArraste} onPointerUp={pararArraste} onPointerCancel={pararArraste} onClickCapture={bloquearCliqueAposArraste}><table className="w-full min-w-[1080px] border-collapse text-left text-xs lg:min-w-0" style={{ tableLayout: "fixed" }}><colgroup>{colunas.map((coluna) => <col key={coluna.key} style={{ width: largurasColunas[coluna.key] ?? coluna.width }} />)}</colgroup><thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur"><tr className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{colunas.map((coluna) => <th key={coluna.key} className={`relative whitespace-nowrap text-ellipsis border-r border-border px-1.5 py-2 text-[8px] select-none sm:px-2 sm:py-3 sm:text-[9px] ${coluna.className || ""}`} style={{ width: largurasColunas[coluna.key] ?? coluna.width }}>{coluna.key === "celula" ? <button type="button" title="Clique para alternar entre CÉLULA e CÉLULA TVOO" aria-label={`Alternar leitura da coluna: ${coluna.label}`} onClick={onToggleModoCelula} className={`block max-w-full truncate rounded-md border px-1 py-0.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${modoCelula === "celula" ? "border-amber-300/25 bg-amber-300/10 text-amber-300 hover:bg-amber-300/15" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/15"}`}>{coluna.label}</button> : <span className="block truncate pr-2">{coluna.label}</span>}<span role="separator" aria-label={`Redimensionar coluna ${coluna.label || "de referência"}`} onPointerDown={(event) => iniciarRedimensionamento(event, coluna.key, largurasColunas[coluna.key] ?? coluna.width)} className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize rounded-sm bg-transparent transition-colors hover:bg-primary/70 active:bg-primary" /></th>)}</tr></thead><tbody className="text-xs text-foreground">{exibidos.map((entry, index) => <tr key={entry.id} className={`border-b border-border/50 ${index % 2 === 0 ? "bg-card/40" : "bg-card/10"} hover:bg-primary/5`}><td className="relative border-r border-border px-2 py-2 text-center font-mono font-bold text-primary sm:px-3 sm:py-3"><button type="button" onClick={() => setAcoesAberta(acoesAberta === entry.id ? null : entry.id)} className="underline decoration-primary/50 underline-offset-2 hover:text-primary/80">#{entry.numero_sequencial}</button>{acoesAberta === entry.id && <div className="absolute left-2 top-10 z-20 flex w-36 flex-col gap-1 rounded-xl border border-border bg-card p-1.5 text-left shadow-xl"><button type="button" disabled={closed} onClick={() => { setAcoesAberta(null); onEdit(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-primary/10 hover:text-primary"><Edit3 size={13} /> Editar</button><button type="button" disabled={closed} onClick={() => { setAcoesAberta(null); onDelete(entry); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /> Excluir</button></div>}</td>{colunas.slice(1).map((coluna) => <td key={coluna.key} className={`whitespace-nowrap overflow-hidden text-ellipsis border-r border-border/60 px-1.5 py-2 font-mono text-[8px] sm:px-2 sm:py-3 sm:text-[9px] ${coluna.className || ""}`}>{coluna.render(entry)}</td>)}</tr>)}</tbody><tfoot className="sticky bottom-0 border-t-2 border-primary/30 bg-card text-xs font-bold"><tr><td className="px-2 py-2 text-center text-primary sm:px-3 sm:py-3">TOTAL</td><td colSpan={7} /><td className="px-3 py-3 font-mono text-primary">{duration(totais.voo)}</td><td colSpan={3} /><td className="px-3 py-3 text-center text-emerald-400">{totais.pousos}</td><td className="px-3 py-3 text-amber-400">{decimal(totais.abast, 1)}</td><td className="px-3 py-3 text-amber-400">{decimal(totais.fuel, 1)}</td><td colSpan={4} /></tr></tfoot></table></div></div>}
    </div>
    {aba === "discrepancias" && <DiarioDiscrepancias lancamentos={lancamentos} fechado={closed} onEdit={onEdit} />}
  </section>;
}

// Estilos locais: o restante do dashboard mantém o tema que já utiliza.
const diarioStyles = `
.db-month{width:100%;max-width:1486px;min-width:0;margin:0;padding:14px 6px 24px 17px;background:#060a13;color:#f1f3f8;font-family:inherit;color-scheme:dark;font-size:12px}
.db-month,.db-month *{box-sizing:border-box}
.db-month> *+*{margin-top:15px}
.db-month .db-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:38px;margin-bottom:15px}
.db-heading{display:flex;align-items:center;gap:12px;min-width:0}
.db-heading h1{font-size:15px;font-weight:800;line-height:1.35;margin:0}
.db-actions{display:flex;align-items:center;gap:23px;flex-shrink:0;margin:0 -34px;padding:0 142px}
.db-month .db-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;border:1px solid #293445;border-radius:9px;padding:0 12px;background:#141b25;color:#98a4b6;font-size:11px;font-weight:500;white-space:nowrap;cursor:pointer;line-height:1}
.db-month button:disabled{opacity:.45;cursor:not-allowed}
.db-month button:not(:disabled):hover{filter:brightness(1.15)}
.db-month :is(button,input,select,summary):focus-visible{outline:2px solid #22d3ee;outline-offset:3px}
.db-month .db-cyan{color:#08d4f3;background:#0bcedb14;border-color:#0e6174}
.db-month .db-amber{color:#ffbf00;background:#fbbf240d;border-color:#65501b}
.db-month .db-green{color:#26dca4;background:#10b98112;border-color:#145c4b}
.db-month .db-period{display:flex;align-items:center;gap:4px;height:38px;border:1px solid #222c3a;background:#131923;border-radius:10px;margin:0 16px;padding:6px 23px}
.db-period>span{display:flex;align-items:center;gap:6px;margin-right:4px;color:#60a5fa;font-size:9px;font-weight:700;letter-spacing:.7px}
.db-period>span:before{content:"";width:4px;height:14px;background:#60a5fa;border-radius:2px}
.db-period select{height:23px;width:auto;min-width:59px;border:1px solid #293445;background:#10151e;color:#f1f3f8;border-radius:7px;margin:0 7px;padding:0 17px;font-size:11px}
.db-month .db-summary{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin-top:0;background:rgba(22,11,11,0)}
.db-panel{min-width:0;border:1px solid #1e2633;background:#131821;border-radius:14px;padding:14px}
.db-aircraft{background:#06080f}
.db-section-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:750;letter-spacing:1px;text-transform:uppercase;line-height:15px;margin-bottom:10px}
.db-section-title:before{content:"";width:4px;height:15px;border-radius:2px;background:currentColor;flex-shrink:0}
.db-section-title small{margin-left:auto;color:#929eaf;text-transform:none;letter-spacing:0;font-size:11px;font-weight:400}
.db-section-title button{border:0;padding:0;color:inherit;background:none;font:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer;text-align:left}
.db-title-cyan,.db-icon-cyan{color:#04d2ed}.db-title-violet{color:#ad88ff}.db-title-amber{color:#ffbf00}
.db-stats{display:grid;gap:8px;min-width:0}.db-four{grid-template-columns:repeat(4,minmax(0,1fr))}.db-three{grid-template-columns:repeat(3,minmax(0,1fr))}
.db-month .db-stat{display:flex;flex-direction:column;align-items:flex-start;min-width:0;min-height:76px;text-align:left;border:1px solid #1d2531;border-radius:10px;background:#141a23;padding:10px;color:#f1f3f8;line-height:1.35;overflow:hidden}
.db-month button.db-stat{width:100%;cursor:pointer}
.db-stat-label,.db-stat>span{font-size:9px;font-weight:400;color:#9ba6b6}
.db-stat strong{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;letter-spacing:-.3px;font-weight:750;margin-top:5px;font-variant-numeric:tabular-nums}
.db-stat small{font-size:8px;color:#686764;margin-top:5px;margin-bottom:5px}
.db-aircraft-stats .db-stat{min-height:54px;padding:9px 10px}
.db-aircraft-stats .db-stat-label{color:#04d2ed}
.db-cell{border-top:1px solid #1e2633;margin-top:10px;padding-top:10px}
.db-cell .db-section-title:before{height:11px}
.db-cell-stats .db-stat-label{color:#ad88ff}
.db-month .db-available{background:#0b553426;border-color:#075646;color:#57e8b7}.db-available .db-stat-label{color:#21b38a}
.db-month .db-overdue{background:#ef444414;border-color:#ef444450;color:#f87171}.db-overdue .db-stat-label{color:#f87171}
.db-horimeter .db-stat-label,.db-horimeter-input>span{color:#ffbf00}
.db-horimeter-input input,.db-inline-editor input{min-width:0;width:100%;height:30px;margin-top:8px;border:1px solid #344154;background:#10151e;border-radius:5px;color:#f1f3f8;padding:4px 6px;font-size:12px}
.db-editor-actions,.db-inline-editor{display:flex;align-items:end;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap}
.db-inline-editor label{flex:1;min-width:120px;color:#ad88ff;font-size:10px}
.db-month .db-consumption{overflow:hidden;border:1px solid #534017;background:#1e1f20;border-radius:13px}
.db-consumption>summary{display:flex;align-items:center;gap:11px;min-height:59px;padding:12px 14px;color:#ffbf00;cursor:pointer;list-style:none}
.db-month summary::-webkit-details-marker{display:none}
.db-consumption strong{display:block;text-transform:uppercase;letter-spacing:1px;font-size:11px;line-height:16px}
.db-consumption small{display:flex;flex-wrap:wrap;gap:4px;color:#929eaf;font-size:11px;line-height:16px}
.db-consumption small b{color:#f1f3f8}.db-consumption small span{margin-left:10px}
.db-fuel-icon{width:31px;height:31px;display:flex;align-items:center;justify-content:center;border:1px solid #6b5018;border-radius:9px;background:#e3a81a22;flex-shrink:0}
.db-chevron{margin-left:auto;flex-shrink:0}.db-consumption[open] .db-chevron{transform:rotate(180deg)}
.db-consumption-body{border-top:1px solid #534017;padding:12px}
.db-toolbar{display:flex;align-items:center;gap:7px;margin-bottom:14px}
.db-search{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:28px;padding:0 10px;border:1px solid #293445;border-radius:9px;background:#141b25;color:#98a4b6}
.db-search input{border:0;outline:none;background:transparent;color:#f1f3f8;min-width:0;width:100%;font-size:11px}.db-search input::placeholder{color:#98a4b6}
.db-month .db-refresh{padding:0;width:28px}
.db-records>section{border:1px solid #1e2633;border-radius:13px;overflow:hidden;background:#131821}
.db-table-heading{min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px;border-bottom:1px solid #1e2633}
.db-table-heading h2{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:750;margin:0}.db-table-heading h2 svg{color:#04d2ed}
.db-table-heading>div{display:flex;align-items:center;gap:8px}
.db-count{border:1px solid #293445;border-radius:999px;padding:2px 9px;font-size:11px;line-height:14px;color:#98a4b6}
.db-table-options{border-bottom:1px solid #1e2633;color:#98a4b6;font-size:10px}.db-table-options>summary{padding:7px 14px;cursor:pointer}.db-table-options p{padding:0 14px;font-size:10px}
.db-table-scroll{overflow-x:auto;max-width:100%;touch-action:pan-y}
.db-month .db-table-scroll table{font-size:11px}.db-month .db-table-scroll :is(td,th){padding-top:8px;padding-bottom:8px}
@media(max-width:1100px){.db-month .db-topbar{flex-wrap:wrap}.db-actions{margin-left:auto}.db-heading h1{font-size:14px}}
@media(max-width:700px){.db-month .db-summary{grid-template-columns:1fr}.db-actions{width:100%;flex-wrap:wrap;margin-left:0}.db-actions .db-period{margin-right:auto}.db-four{grid-template-columns:repeat(2,minmax(0,1fr))}.db-panel{padding:12px}.db-toolbar{flex-wrap:wrap}.db-search{flex-basis:100%}.db-heading{align-items:flex-start}.db-heading h1{padding-top:4px}.db-month .db-back{flex-shrink:0}.db-section-title small{font-size:10px}}
@media print{
 @page{size:A4 landscape;margin:8mm}
 body *{visibility:hidden}
 .db-month,.db-month *{visibility:visible}
 .db-month{position:absolute;left:0;top:0;max-width:none;width:100%;padding:0;background:white;color:black;print-color-adjust:exact;-webkit-print-color-adjust:exact}
 .db-month .db-topbar{display:block}.db-heading h1{color:black}
 .db-month :is(.db-actions,.db-back,.db-toolbar,.db-table-options,.db-inline-editor,.db-editor-actions){display:none!important}
 .db-month .db-summary{grid-template-columns:minmax(0,1fr)}.db-month .db-four{grid-template-columns:repeat(4,minmax(0,1fr))}
 .db-month .db-table-scroll{overflow:visible;max-width:none}.db-month .db-table-scroll table{min-width:0!important;width:100%!important}.db-month .db-table-scroll col{width:auto!important}.db-month .db-table-scroll :is(th,td){position:static!important;width:auto!important;padding:3px 2px!important;font-size:7px!important;white-space:normal!important;overflow:visible!important}
 .db-month .db-panel,.db-month tr{break-inside:avoid}.db-month thead{display:table-header-group}.db-month tfoot{position:static!important}.db-month .db-stat small{display:none}
}
`;
