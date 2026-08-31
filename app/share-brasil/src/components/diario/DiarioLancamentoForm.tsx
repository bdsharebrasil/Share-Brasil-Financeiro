import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, Fuel, PlaneTakeoff, Save, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiarioLancamento, DiarioOpcoesResponse } from "@/lib/colaborador-api";

const inputClass = "h-9 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60";
const selectClass = `${inputClass} appearance-none`;
const naturezas = ["AE - Aérea/Regular", "CQ - Cheque", "EX - Executivo", "NR - Não remunerado", "RE - Retorno/Reposição", "PV - Privado", "SA - Serviço aéreo", "TN - Táxi aéreo", "TR - Traslado", "VOO_TESTE"];

type FormValues = Record<string, string | boolean>;

function formFromEntry(entry: Partial<DiarioLancamento> | undefined, date: string, celula: number, sugestaoTrecho = ""): FormValues {
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

export default function DiarioLancamentoForm({ aeronaveId, diarioMesId, opcoes, initialData, sugeridaCelula, sugestaoTrecho, onSubmit, onCancel, saving }: { aeronaveId: string; diarioMesId: string; opcoes: DiarioOpcoesResponse; initialData?: DiarioLancamento | null; sugeridaCelula: number; sugestaoTrecho?: string; onSubmit: (payload: Record<string, unknown>) => Promise<void>; onCancel: () => void; saving: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormValues>(() => formFromEntry(initialData || undefined, today, sugeridaCelula, sugestaoTrecho));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setForm(formFromEntry(initialData || undefined, today, sugeridaCelula, sugestaoTrecho)); setError(null); }, [initialData, diarioMesId, sugeridaCelula, sugestaoTrecho]);
  const setField = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const value = (key: string) => String(form[key] ?? "");
  const selectedPic = useMemo(() => opcoes.tripulantes.find((tripulante) => tripulante.canac === value("pic_canac")), [opcoes.tripulantes, form.pic_canac]);
  const selectedSic = useMemo(() => opcoes.tripulantes.find((tripulante) => tripulante.canac === value("sic_canac")), [opcoes.tripulantes, form.sic_canac]);
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

  return <section className="rounded-xl border border-primary/25 bg-card/85 shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpen size={15} /></span><div><h2 className="text-xs font-bold">{initialData ? "Editar lançamento" : "Novo lançamento"}</h2><p className="text-[10px] text-muted-foreground">Campos do diário digital · dados gravados no D1</p></div></div><button type="button" onClick={onCancel} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={15} /></button></div><div className="space-y-5 p-4">
    {error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200">{error}</div>}
    <FormSection icon={<PlaneTakeoff size={13} />} title="Voo e rota"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Data *"><input type="date" value={value("data_registro")} onChange={(e) => setField("data_registro", e.target.value)} className={inputClass} /></Field><Field label="Número do voo"><input value={value("numero_voo")} onChange={(e) => setField("numero_voo", e.target.value)} placeholder="Ex.: SBR-012" className={inputClass} /></Field><Field label="Natureza *"><select value={value("natureza_voo")} onChange={(e) => setField("natureza_voo", e.target.value)} className={selectClass}>{naturezas.map((natureza) => <option key={natureza}>{natureza}</option>)}</select></Field><Field label="Trecho"><input value={value("trecho")} onChange={(e) => setField("trecho", e.target.value)} placeholder="SBSP X SBGR" className={inputClass} /></Field><Field label="Origem ICAO *"><select value={value("aerodromo_partida")} onChange={(e) => setField("aerodromo_partida", e.target.value)} className={selectClass}><option value="">Selecionar aeródromo</option>{opcoes.aerodromos.map((aero) => <option key={aero.id} value={aero.designativo}>{aero.designativo} · {aero.nome}</option>)}</select></Field><Field label="Destino ICAO *"><select value={value("aerodromo_chegada")} onChange={(e) => setField("aerodromo_chegada", e.target.value)} className={selectClass}><option value="">Selecionar aeródromo</option>{opcoes.aerodromos.map((aero) => <option key={aero.id} value={aero.designativo}>{aero.designativo} · {aero.nome}</option>)}</select></Field><Field label="Passageiros"><input type="number" min="0" value={value("passageiros")} onChange={(e) => setField("passageiros", e.target.value)} className={inputClass} /></Field><Field label="Carga (kg)"><input value={value("carga_kg")} onChange={(e) => setField("carga_kg", e.target.value)} className={inputClass} /></Field></div></FormSection>
    <FormSection icon={<Users size={13} />} title="Tripulação e cotista"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="PIC *"><select value={value("pic_canac")} onChange={(e) => setField("pic_canac", e.target.value)} className={selectClass}><option value="">Selecionar PIC</option>{opcoes.tripulantes.map((tripulante) => <option key={`${tripulante.origem}-${tripulante.id}`} value={tripulante.canac}>{tripulante.nome_completo} · {tripulante.canac}</option>)}</select></Field><Field label="SIC"><select value={value("sic_canac")} onChange={(e) => setField("sic_canac", e.target.value)} className={selectClass}><option value="">Sem SIC</option>{opcoes.tripulantes.map((tripulante) => <option key={`${tripulante.origem}-${tripulante.id}`} value={tripulante.canac}>{tripulante.nome_completo} · {tripulante.canac}</option>)}</select></Field><Field label="Cliente"><select value={value("cliente_id")} onChange={(e) => { setField("cliente_id", e.target.value); setField("socio_id", ""); }} className={selectClass}><option value="">Selecionar cliente</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.proprietario || "Sem nome"}{cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""}</option>)}</select></Field><Field label="Sócio"><select value={value("socio_id")} onChange={(e) => setField("socio_id", e.target.value)} className={selectClass}><option value="">Selecionar sócio</option>{clientesSocios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}</select></Field></div><label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={Boolean(form.voo_emprestado)} onChange={(e) => setField("voo_emprestado", e.target.checked)} className="h-4 w-4 rounded border-border bg-secondary accent-primary" /> Voo emprestado</label>{Boolean(form.voo_emprestado) && <div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Cliente tomador do empréstimo"><select value={value("cliente_tomador_emprestimo_id")} onChange={(e) => { setField("cliente_tomador_emprestimo_id", e.target.value); setField("socio_tomador_emprestimo_id", ""); }} className={selectClass}><option value="">Selecionar cliente tomador</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome || cliente.proprietario || "Sem nome"}</option>)}</select></Field><Field label="Sócio tomador do empréstimo"><select value={value("socio_tomador_emprestimo_id")} onChange={(e) => setField("socio_tomador_emprestimo_id", e.target.value)} className={selectClass}><option value="">Selecionar sócio tomador</option>{opcoes.socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}</select></Field></div>}</FormSection>
    <FormSection icon={<TimerIcon />} title="Tempos e célula"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Tempo AC"><input type="time" value={value("tempo_ac")} onChange={(e) => setField("tempo_ac", e.target.value)} className={inputClass} /></Field><Field label="Decolagem"><input type="time" value={value("tempo_dep")} onChange={(e) => setField("tempo_dep", e.target.value)} className={inputClass} /></Field><Field label="Pouso"><input type="time" value={value("tempo_pou")} onChange={(e) => setField("tempo_pou", e.target.value)} className={inputClass} /></Field><Field label="Corte"><input type="time" value={value("tempo_cor")} onChange={(e) => setField("tempo_cor", e.target.value)} className={inputClass} /></Field><NumberField label="Tempo de voo (h)" value={value("tempo_voo")} onChange={(v) => setField("tempo_voo", v)} step="0.01" /><NumberField label="Tempo total (h)" value={value("tempo_total")} onChange={(v) => setField("tempo_total", v)} step="0.01" /><NumberField label="Horas diurnas" value={value("horas_diurnas")} onChange={(v) => setField("horas_diurnas", v)} step="0.01" /><NumberField label="Horas noturnas" value={value("horas_noturnas")} onChange={(v) => setField("horas_noturnas", v)} step="0.01" /><NumberField label="Tempo IFR" value={value("tempo_ifr")} onChange={(v) => setField("tempo_ifr", v)} step="0.01" /><NumberField label="Pousos" value={value("pousos_total")} onChange={(v) => setField("pousos_total", v)} step="1" /><NumberField label="Distância (NM)" value={value("distancia_nm")} onChange={(v) => setField("distancia_nm", v)} step="0.1" /><NumberField label="Célula após voo" value={value("celula")} onChange={(v) => setField("celula", v)} step="0.01" /></div></FormSection>
    <FormSection icon={<Fuel size={13} />} title="Combustível e abastecimento"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Litros no início" value={value("litros_combustivel_inicio_voo")} onChange={(v) => setField("litros_combustivel_inicio_voo", v)} step="0.01" /><NumberField label="Litros abastecidos" value={value("litros_combustivel_abastecido")} onChange={(v) => setField("litros_combustivel_abastecido", v)} step="0.01" /><Field label="Local do combustível"><input value={value("local_combustivel")} onChange={(e) => setField("local_combustivel", e.target.value)} placeholder="ICAO / fornecedor" className={inputClass} /></Field><NumberField label="Novo abastecimento (litros)" value={value("abastecimento_litros")} onChange={(v) => setField("abastecimento_litros", v)} step="0.01" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Data do abastecimento"><input type="date" value={value("abastecimento_data")} onChange={(e) => setField("abastecimento_data", e.target.value)} className={inputClass} /></Field><Field label="Pagador cliente"><select value={value("abastecimento_cliente_id")} onChange={(e) => { setField("abastecimento_cliente_id", e.target.value); setField("abastecimento_socio_id", ""); }} className={selectClass}><option value="">Cliente do voo anterior</option>{opcoes.clientes.map((item) => <option key={item.id} value={item.id}>{item.nome || item.proprietario || "Sem nome"}</option>)}</select></Field><Field label="Pagador sócio"><select value={value("abastecimento_socio_id")} onChange={(e) => { setField("abastecimento_socio_id", e.target.value); setField("abastecimento_cliente_id", ""); }} className={selectClass}><option value="">Sócio do voo anterior</option>{opcoes.socios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Local do abastecimento"><input value={value("abastecimento_local")} onChange={(e) => setField("abastecimento_local", e.target.value)} placeholder="ICAO / posto" className={inputClass} /></Field><Field label="Comanda"><input value={value("abastecimento_numero_comanda")} onChange={(e) => setField("abastecimento_numero_comanda", e.target.value)} className={inputClass} /></Field><Field label="Nota fiscal"><input value={value("abastecimento_numero_nf")} onChange={(e) => setField("abastecimento_numero_nf", e.target.value)} className={inputClass} /></Field></div><label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground"><input type="checkbox" checked={Boolean(form.abastecimento_auto_trecho)} onChange={(e) => setField("abastecimento_auto_trecho", e.target.checked)} className="h-4 w-4 accent-primary" /> Preencher trecho do abastecimento automaticamente com este voo</label><div className="mt-3 grid gap-3 lg:grid-cols-3"><TextField label="Ocorrências" value={value("ocorrencias")} onChange={(v) => setField("ocorrencias", v)} /><TextField label="Discrepâncias" value={value("discrepancias")} onChange={(v) => setField("discrepancias", v)} /><TextField label="Ações corretivas" value={value("acoes_corretivas")} onChange={(v) => setField("acoes_corretivas", v)} /></div></FormSection>
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onCancel} className="h-9 text-[11px]">Cancelar</Button><Button type="button" disabled={saving} onClick={() => void submit()} className="h-9 gap-2 text-[11px]"><Save size={13} />{saving ? "Salvando..." : initialData ? "Atualizar lançamento" : "Registrar lançamento"}</Button></div>
  </div></section>;
}

function FormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-primary"><span>{icon}</span>{title}</div>{children}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</span>{children}</label>; }
function NumberField({ label, value, onChange, step }: { label: string; value: string; onChange: (value: string) => void; step: string }) { return <Field label={label}><input type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} /></Field>; }
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[70px] w-full resize-y rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-[11px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/60" placeholder="Sem registro" /></Field>; }
function TimerIcon() { return <span className="font-mono text-[11px]">T</span>; }
