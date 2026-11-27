import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, Flag, Gauge, Loader2, MapPin, Pencil, Plane, Route, Save, Timer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import { planejarPernaVoo, cancelarPernaPlanejada, atualizarJornadaVoo, atualizarPernaJornada, adicionarPernaJornada, buscarJornadaVoo, buscarLimitesJornada, encerrarJornadaVoo, excluirJornadaVoo, excluirPernaJornada, iniciarJornadaVoo, type JornadaVoo as Jornada, type LimitesJornada, type NivelAlertaJornada } from "@/lib/colaborador-api";
import type { SolicitacaoVooInterna, VooEmOperacao, PernaPlanejada } from "@/lib/colaborador-api";
import ResumoJornadaOperacaoCard from "@/components/agendamento/ResumoJornadaOperacao";
import { prepararProximaJornada } from "./proximaJornada";
import AcompanhamentoVooAgendado from "@/components/agendamento/AcompanhamentoVooAgendado";

const input = "h-10 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-secondary/30 disabled:opacity-50";
const box = "rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm";
const hoje = () => new Date().toISOString().slice(0, 10);
// Horários operacionais são sempre informados e transmitidos em UTC/Zulu.
const iso = (data: string, hora: string) => `${data}T${hora}:00Z`;
function utc(data: string, hora?: string | null) {
  if (!hora) return null;
  const instante = new Date(iso(data, hora));
  return Number.isFinite(instante.getTime()) ? instante.toISOString() : null;
}
function utcDepois(data: string, hora: string | null | undefined, referencia?: string | null) {
  const candidato = utc(data, hora);
  if (!candidato) return null;
  let tempo = new Date(candidato).getTime();
  const base = referencia ? new Date(referencia).getTime() : NaN;
  if (Number.isFinite(base) && tempo < base) tempo += Math.ceil((base - tempo) / 86_400_000) * 86_400_000;
  return new Date(tempo).toISOString();
}
function pernaUtc(data: string, valor: PernaForm, referencia?: string | null) {
  const ac = utcDepois(data, valor.horario_ac, referencia);
  const dep = utcDepois(data, valor.horario_dep, ac);
  const pou = utcDepois(data, valor.horario_pouso, dep || ac);
  const cor = utcDepois(data, valor.horario_corte, pou || dep || ac);
  return { ...valor, horario_ac: ac, horario_dep: dep, horario_pouso: pou, horario_corte: cor };
}
const tomAlerta: Record<NivelAlertaJornada, string> = { normal: "border-emerald-600/30 bg-emerald-500/45 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", atencao: "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300", critico: "border-orange-600/30 bg-orange-500/10 text-orange-800 dark:text-orange-300", excedido: "border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-300" };
function hora(valor?: string | null) { if (!valor) return ""; const match = valor.match(/T(\d{2}:\d{2})/); return match?.[1] || valor.slice(0, 5); }
function dataBr(valor?: string | null) { if (!valor) return "—"; const [ano, mes, dia] = valor.slice(0, 10).split("-"); return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor; }
function fasePerna(perna?: Jornada["pernas"][number] | null) {
  if (!perna) return "Programada";
  if (perna.horario_pouso || perna.status === "pousado") return "Em solo · pousado";
  if (perna.horario_dep || perna.status === "em_voo") return "Decolado";
  if (perna.horario_ac) return "Acionado";
  return "Programada";
}
function dataDoUltimoLancamento(perna: Jornada["pernas"][number] | undefined, fallback: string) {
  const ultimoHorario = perna?.horario_corte || perna?.horario_pouso || perna?.horario_dep || perna?.horario_ac;
  return ultimoHorario?.slice(0, 10) || fallback;
}
function Campo({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1"><span className="text-[11px] font-bold text-muted-foreground">{label}</span>{children}</label>; }
type JornadaEditForm = { data: string; apresentacao: string; acionamento: string; pouso: string; corte: string };
type PernaForm = { origem: string; destino: string; numero_passageiros: string; horario_ac: string; horario_dep: string; horario_pouso: string; horario_corte: string };
const pernaVazia = (): PernaForm => ({ origem: "", destino: "", numero_passageiros: "0", horario_ac: "", horario_dep: "", horario_pouso: "", horario_corte: "" });

function AeroportoCampo({ label, value, aerodromos, carregando, onChange }: { label: string; value: string; aerodromos: AerodromoOption[]; carregando: boolean; onChange: (value: string) => void }) {
  return <Campo label={label}><SearchableCombobox items={aerodromos.map((aero) => ({ id: aero.id, label: aero.label || `${aero.id} · ${aero.name}` }))} value={value} onChange={onChange} placeholder={carregando ? "Carregando aeródromos..." : "Selecione o aeródromo"} searchPlaceholder="Buscar por nome ou ICAO" emptyMessage="Nenhum aeródromo encontrado no D1." disabled={carregando} /></Campo>;
}
function minutosArmazenados(valor: unknown) {
  if (valor === null || valor === undefined || valor === "" || (typeof valor !== "number" && typeof valor !== "string")) return null;
  const minutos = Number(valor);
  return Number.isFinite(minutos) && minutos >= 0 ? minutos : null;
}
function horaHistorico(valor?: string | null) {
  if (!valor) return "—";
  return valor.match(/T(\d{2}:\d{2})/)?.[1] || valor.match(/^(\d{1,2}):(\d{2})/)?.slice(1).map((parte) => parte.padStart(2, "0")).join(":") || "—";
}
function dataHistorico(valor?: string | null) { return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—"; }
function duracaoHistorico(jornada: Jornada) {
  if (jornada.status === "programada") return "Aguardando horários";
  if (jornada.status !== "encerrada") return "Em andamento";
  // Usa o valor efetivamente computado e salvo. Não recalcula com +30 fixos,
  // não troca apresentação por AC e não troca corte por pouso.
  const minutos = minutosArmazenados(jornada.minutos_jornada);
  if (minutos === null) return "Tempo não registrado";
  const arredondado = Math.round(minutos);
  return `${Math.floor(arredondado / 60)}h${String(arredondado % 60).padStart(2, "0")}`;
}
function JornadaInlineForm({ form, onChange, onSave, onCancel, salvando }: { form: JornadaEditForm; onChange: (campo: keyof JornadaEditForm, valor: string) => void; onSave: () => void; onCancel: () => void; salvando: boolean }) {
  return <div className="grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:grid-cols-5"><Campo label="Data"><input type="date" value={form.data} onChange={(e) => onChange("data", e.target.value)} className={input} /></Campo><Campo label="Check-in UTC"><input type="time" value={form.apresentacao} onChange={(e) => onChange("apresentacao", e.target.value)} className={input} /></Campo><Campo label="Acionamento AC UTC"><input type="time" value={form.acionamento} onChange={(e) => onChange("acionamento", e.target.value)} className={input} /></Campo><Campo label="Pouso POU UTC"><input type="time" value={form.pouso} onChange={(e) => onChange("pouso", e.target.value)} className={input} /></Campo><Campo label="Corte COR UTC"><input type="time" value={form.corte} onChange={(e) => onChange("corte", e.target.value)} className={input} /></Campo><div className="flex gap-2 sm:col-span-5"><Button type="button" size="sm" disabled={salvando} onClick={onSave} className="gap-1.5 text-[11px]"><Save size={13} /> Salvar jornada</Button><Button type="button" size="sm" variant="outline" disabled={salvando} onClick={onCancel} className="text-[11px]">Cancelar</Button></div></div>;
}
function PernaInlineForm({ form, onChange, onSave, onCancel, salvando }: { form: PernaForm; onChange: (campo: keyof PernaForm, valor: string) => void; onSave: () => void; onCancel: () => void; salvando: boolean }) {
  return <div className="grid w-full gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:grid-cols-2 lg:grid-cols-7"><Campo label="Origem"><input value={form.origem} onChange={(e) => onChange("origem", e.target.value.toUpperCase())} className={input} /></Campo><Campo label="Destino"><input value={form.destino} onChange={(e) => onChange("destino", e.target.value.toUpperCase())} className={input} /></Campo><Campo label="Passageiros"><input type="number" min="0" step="1" value={form.numero_passageiros} onChange={(e) => onChange("numero_passageiros", e.target.value)} className={input} /></Campo><Campo label="AC UTC"><input type="time" value={form.horario_ac} onChange={(e) => onChange("horario_ac", e.target.value)} className={input} /></Campo><Campo label="DEP UTC"><input type="time" value={form.horario_dep} onChange={(e) => onChange("horario_dep", e.target.value)} className={input} /></Campo><Campo label="POU UTC"><input type="time" value={form.horario_pouso} onChange={(e) => onChange("horario_pouso", e.target.value)} className={input} /></Campo><Campo label="COR UTC"><input type="time" value={form.horario_corte} onChange={(e) => onChange("horario_corte", e.target.value)} className={input} /></Campo><div className="flex gap-2 sm:col-span-2 lg:col-span-7"><Button type="button" size="sm" disabled={salvando} onClick={onSave} className="gap-1.5 text-[11px]"><Save size={13} /> Salvar perna</Button><Button type="button" size="sm" variant="outline" disabled={salvando} onClick={onCancel} className="text-[11px]">Cancelar</Button></div></div>;
}
function HistoricoJornadaItem({ registro, aberto = false, aoSalvarJornada, aoSalvarPerna, aoExcluirJornada, aoExcluirPerna, salvando, somenteLeitura = false }: { registro: Jornada; aberto?: boolean; aoSalvarJornada: (registro: Jornada, form: JornadaEditForm) => void; aoSalvarPerna: (jornada: Jornada, perna: Jornada["pernas"][number], form: PernaForm) => void; aoExcluirJornada: (registro: Jornada) => void; aoExcluirPerna: (jornada: Jornada, perna: Jornada["pernas"][number]) => void; salvando: boolean; somenteLeitura?: boolean }) {
  const [expandido, setExpandido] = useState(aberto);
  const [editandoJornada, setEditandoJornada] = useState(false);
  const [pernaEditandoId, setPernaEditandoId] = useState<string | null>(null);
  const [formJornada, setFormJornada] = useState<JornadaEditForm>(() => ({ data: registro.data?.slice(0, 10) || "", apresentacao: hora(registro.horario_apresentacao), acionamento: hora(registro.horario_acionamento), pouso: hora(registro.horario_pouso), corte: hora(registro.horario_corte) }));
  const [formPerna, setFormPerna] = useState<PernaForm>(pernaVazia());
  const encerrada = registro.status === "encerrada";
  const iniciarEdicaoJornada = () => { setExpandido(true); setFormJornada({ data: registro.data?.slice(0, 10) || "", apresentacao: hora(registro.horario_apresentacao), acionamento: hora(registro.horario_acionamento), pouso: hora(registro.horario_pouso), corte: hora(registro.horario_corte) }); setEditandoJornada(true); };
  const iniciarEdicaoPerna = (perna: Jornada["pernas"][number]) => { setExpandido(true); setPernaEditandoId(perna.id); setFormPerna({ origem: perna.origem || "", destino: perna.destino || "", numero_passageiros: String(perna.numero_passageiros ?? 0), horario_ac: hora(perna.horario_ac), horario_dep: hora(perna.horario_dep), horario_pouso: hora(perna.horario_pouso), horario_corte: hora(perna.horario_corte) }); };
  return <div className="overflow-hidden rounded-xl border border-border/70 bg-secondary/20">
    <div className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40"><button type="button" onClick={() => setExpandido((atual) => !atual)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-foreground sm:text-base">Jornada {registro.numero_jornada}</strong><span className="mt-0.5 block text-xs font-semibold text-foreground">{registro.tripulante_nome || "Tripulante histórico"} · {registro.funcao_tripulante || "Tripulação"}</span><span className="mt-0.5 block text-xs font-medium text-muted-foreground">{dataHistorico(registro.data)} · {duracaoHistorico(registro)} · {registro.pernas?.length || 0} perna{registro.pernas?.length === 1 ? "" : "s"}</span></span><span className={`rounded-md border px-2.5 py-1 text-[11px] font-bold ${encerrada ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300"}`}>{encerrada ? "Encerrada" : registro.status === "programada" ? "Aguardando horários" : "Em andamento"}</span><ChevronDown size={15} className={`shrink-0 text-muted-foreground transition-transform ${expandido ? "rotate-180" : ""}`} /></button>{!somenteLeitura && <div className="flex shrink-0 gap-1"><button type="button" title="Editar jornada" aria-label="Editar jornada" onClick={iniciarEdicaoJornada} className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Pencil size={14} /></button><button type="button" title="Excluir jornada" aria-label="Excluir jornada" onClick={() => aoExcluirJornada(registro)} className="rounded-md p-2 text-red-600 hover:bg-red-500/10 dark:text-red-300"><Trash2 size={14} /></button></div>}</div>
    {expandido && <div className="border-t border-border/60 p-3">{editandoJornada ? <JornadaInlineForm form={formJornada} onChange={(campo, valor) => setFormJornada((atual) => ({ ...atual, [campo]: valor }))} onSave={() => { aoSalvarJornada(registro, formJornada); setEditandoJornada(false); }} onCancel={() => setEditandoJornada(false)} salvando={salvando} /> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><HistoricoDetalhe label="Check-in" valor={horaHistorico(registro.horario_apresentacao)} icon={<Clock3 size={12} />} /><HistoricoDetalhe label="AC" valor={horaHistorico(registro.horario_acionamento)} icon={<Gauge size={12} />} /><HistoricoDetalhe label="POU" valor={horaHistorico(registro.horario_pouso)} icon={<Plane size={12} />} /><HistoricoDetalhe label="COR" valor={horaHistorico(registro.horario_corte)} icon={<Timer size={12} />} /><HistoricoDetalhe label="Tempo registrado" valor={duracaoHistorico(registro)} icon={<Clock3 size={12} />} /></div>}{registro.pernas?.length ? <div className="mt-3 space-y-2"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-primary">Trajeto percorrido</p>{registro.pernas.map((perna) => pernaEditandoId === perna.id ? <PernaInlineForm key={perna.id} form={formPerna} onChange={(campo, valor) => setFormPerna((atual) => ({ ...atual, [campo]: valor }))} onSave={() => { aoSalvarPerna(registro, perna, formPerna); setPernaEditandoId(null); }} onCancel={() => setPernaEditandoId(null)} salvando={salvando} /> : <div key={perna.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-[11px]"><span className="font-semibold">{dataHistorico(perna.horario_ac || registro.data)}</span><MapPin size={12} className="text-primary" /><strong>Perna {perna.numero}</strong><span>{perna.origem} → {perna.destino}</span><span className="text-[11px] text-muted-foreground">{perna.numero_passageiros} pax · AC {horaHistorico(perna.horario_ac)} · DEP {horaHistorico(perna.horario_dep)} · POU {horaHistorico(perna.horario_pouso)} · COR {horaHistorico(perna.horario_corte)}</span><span className="w-full break-all text-[11px] text-muted-foreground">{[{label:"AC",id:perna.horario_ac_user_id,valor:perna.horario_ac},{label:"DEP",id:perna.horario_dep_user_id,valor:perna.horario_dep},{label:"POU",id:perna.horario_pouso_user_id,valor:perna.horario_pouso},{label:"COR",id:perna.horario_corte_user_id,valor:perna.horario_corte}].map(({label,id,valor}) => <span key={label} className="mr-2">{label}: {id ? id : valor ? "autoria não registrada" : "—"}</span>)}</span>{!somenteLeitura && <span className="ml-auto flex gap-1"><button type="button" title={perna.status === "programada" ? "Informar horários da perna" : "Editar perna"} aria-label={perna.status === "programada" ? "Informar horários da perna" : "Editar perna"} onClick={() => iniciarEdicaoPerna(perna)} className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Pencil size={13} /></button><button type="button" title="Excluir perna" aria-label="Excluir perna" onClick={() => aoExcluirPerna(registro, perna)} className="rounded p-1.5 text-red-600 hover:bg-red-500/10 dark:text-red-300"><Trash2 size={13} /></button></span>}</div>)}</div> : <p className="mt-3 text-[11px] text-muted-foreground">Nenhuma perna registrada.</p>}</div>}
  </div>;
}
function SecaoRecolhivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberta, setAberta] = useState(true);
  return <div className="rounded-xl border border-primary/25 bg-secondary/35">
    <button type="button" onClick={() => setAberta((atual) => !atual)} aria-expanded={aberta} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-primary">{titulo}</span><ChevronDown size={14} className={`text-muted-foreground transition-transform ${aberta ? "rotate-180" : ""}`} /></button>
    {aberta && <div className="border-t border-border/60 p-3">{children}</div>}
  </div>;
}
function HistoricoJornadas({ jornadas, ...acoes }: { jornadas: Jornada[]; aoSalvarJornada: (registro: Jornada, form: JornadaEditForm) => void; aoSalvarPerna: (jornada: Jornada, perna: Jornada["pernas"][number], form: PernaForm) => void; aoExcluirJornada: (registro: Jornada) => void; aoExcluirPerna: (jornada: Jornada, perna: Jornada["pernas"][number]) => void; salvando: boolean; somenteLeitura?: boolean }) {
  return <SecaoRecolhivel titulo="Horários registrados pela tripulação · UTC/Zulu">{jornadas.length ? <div className="space-y-2">{[...jornadas].sort((a, b) => Number(a.numero_jornada) - Number(b.numero_jornada)).map((registro, indice) => <HistoricoJornadaItem key={registro.id} registro={registro} aberto={indice === 0} {...acoes} />)}</div> : <p className="text-[11px] text-muted-foreground">Nenhuma jornada registrada.</p>}</SecaoRecolhivel>;
}
function HistoricoDetalhe({ label, valor, icon }: { label: string; valor: string; icon?: ReactNode }) { return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground">{icon}{label}</div><p className="mt-1.5 truncate text-[11px] font-semibold">{valor}</p></div>; }

export default function JornadaVoo({ item, agendamentoSelecionado, aoAbrirAgendamento, voosEmOperacao = [], aoFechar, aoAtualizarAgendamento, modo = "historico", permitirMapa = true }: { item: SolicitacaoVooInterna; agendamentoSelecionado?: PernaPlanejada; aoAbrirAgendamento?: (id: string) => void; voosEmOperacao?: VooEmOperacao[]; aoFechar?: () => void; aoAtualizarAgendamento?: (status?: string) => void | Promise<void>; modo?: "historico" | "atualizar"; permitirMapa?: boolean }) {
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [planejadaIniciandoId, setPlanejadaIniciandoId] = useState<string | null>(null);
  const [horarioPrevistoPlanejado, setHorarioPrevistoPlanejado] = useState("");
  const chavePlanejamento = useRef(crypto.randomUUID());
  const [mensagem, setMensagem] = useState("");
  const [confirmarExcedente, setConfirmarExcedente] = useState<{ tipo: "perna" | "encerrar"; mensagem: string } | null>(null);
  const [exclusao, setExclusao] = useState<{ tipo: "jornada" | "perna"; jornadaId: string; pernaId?: string; resumo: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [criandoPerna, setCriandoPerna] = useState(false);
  const [agendandoProximaJornada, setAgendandoProximaJornada] = useState(false);
  const [editandoPernaAtual, setEditandoPernaAtual] = useState(false);
  const [formPernaAtual, setFormPernaAtual] = useState<PernaForm>(pernaVazia());
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
  const [data, setData] = useState(item.data_agendada || hoje());
  const [dataNovaPerna, setDataNovaPerna] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [posCorte, setPosCorte] = useState<30 | 45>(30);
  const [perna, setPerna] = useState<PernaForm>({ ...pernaVazia(), origem: item.origem || "", destino: item.destino || "", numero_passageiros: String(item.numero_passageiros ?? 0) });
  const [limites, setLimites] = useState<LimitesJornada | null>(null);
  const somenteLeitura = ["encerrada", "concluida"].includes(String(item.status || "").trim().toLowerCase());
  const modoHistorico = modo === "historico";
  const [abaHistorico, setAbaHistorico] = useState<"historico" | "mapa" | "jornada">("historico");
  const nomesTripulantes = useMemo(() => new Map([[item.piloto_id || "", item.piloto_nome || ""], [item.copiloto_id || "", item.copiloto_nome || ""]]), [item.copiloto_id, item.copiloto_nome, item.piloto_id, item.piloto_nome]);

  const opcoesAerodromos = useMemo(() => aerodromos, [aerodromos]);
  const carregar = useCallback(async () => {
    const atual = await buscarJornadaVoo(item.id).catch(error => { setErroCarregamento(error instanceof Error ? error.message : "Falha ao carregar jornada."); throw error; });
    setErroCarregamento("");
    setErro("");
    const jornadaNormalizada = atual ? {
      ...atual,
      pernas: Array.isArray(atual.pernas) ? atual.pernas : [],
      historico: Array.isArray(atual.historico) ? atual.historico.map((registro) => ({
        ...registro,
        pernas: Array.isArray(registro.pernas) ? registro.pernas : [],
      })) : [],
      tripulantes: Array.isArray(atual.tripulantes) ? atual.tripulantes : [],
    } : null;
    setJornada(jornadaNormalizada);
    if (jornadaNormalizada) {
      setData(jornadaNormalizada.data || item.data_agendada || hoje());
      setAcionamento(hora(jornadaNormalizada.horario_acionamento));
      setApresentacao(hora(jornadaNormalizada.horario_apresentacao));
      setPosCorte(jornadaNormalizada.minutos_pos_corte === 45 ? 45 : 30);
      const ultima = jornadaNormalizada.pernas[jornadaNormalizada.pernas.length - 1];
      if (ultima) setPerna({ origem: ultima.origem || "", destino: ultima.destino || "", numero_passageiros: String(ultima.numero_passageiros ?? item.numero_passageiros ?? 0), horario_ac: hora(ultima.horario_ac), horario_dep: hora(ultima.horario_dep), horario_pouso: hora(ultima.horario_pouso), horario_corte: hora(ultima.horario_corte) });
    }
  }, [item.data_agendada, item.id, item.numero_passageiros]);
  useEffect(() => { void carregar().catch(() => undefined).finally(() => setCarregando(false)); }, [carregar]);
  useEffect(() => {
    let ativo = true;
    setAerodromosCarregando(true);
    void buscarAerodromos().then((resposta) => { if (ativo) setAerodromos(resposta.aerodromos || []); }).catch(() => { if (ativo) setAerodromos([]); }).finally(() => { if (ativo) setAerodromosCarregando(false); });
    return () => { ativo = false; };
  }, []);
  useEffect(() => { if (!acionamento) { if (apresentacao) setApresentacao(""); return; } if (apresentacao) return; const d = new Date(iso(data, acionamento)); if (!Number.isNaN(d.getTime())) setApresentacao(new Date(d.getTime() - 30 * 60000).toISOString().slice(11, 16)); }, [data, acionamento, apresentacao]);
  const atualizarLimites = useCallback(async (jornadaId: string) => { try { setLimites(await buscarLimitesJornada(jornadaId)); } catch { setLimites(null); } }, []);
  useEffect(() => { if (jornada?.id) void atualizarLimites(jornada.id); }, [jornada?.id, atualizarLimites]);
  useEffect(() => { if (!jornada?.id || jornada.status === "encerrada") return; const timer = window.setInterval(() => void atualizarLimites(jornada.id), 60_000); return () => window.clearInterval(timer); }, [jornada?.id, jornada?.status, atualizarLimites]);

  const ultimaPerna = jornada?.pernas?.[jornada.pernas.length - 1];
  const pernaCortada = Boolean(ultimaPerna?.horario_pouso && ultimaPerna?.horario_corte);
  const pernaEmVoo = Boolean(ultimaPerna?.horario_dep) && !pernaCortada;
  const pernaAguardandoDecolagem = Boolean(ultimaPerna?.horario_ac && !ultimaPerna?.horario_dep && !ultimaPerna?.horario_pouso && !pernaCortada);
  const planejadas = (item.pernas_planejadas || []).filter(perna => perna.status === "PLANEJADA");
  const agendarProximaJornada = () => {
    const ultimaPlanejada = [...planejadas].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista) || a.criado_em.localeCompare(b.criado_em)).at(-1);
    const proxima = jornada ? prepararProximaJornada(jornada, item, hoje()) : null;
    setErro(""); setMensagem(""); setHorarioPrevistoPlanejado("");
    setData(ultimaPlanejada?.data_prevista || proxima?.data || hoje());
    setPerna({ ...pernaVazia(), origem: ultimaPlanejada?.destino || proxima?.origem || ultimaPerna?.destino || item.destino || item.origem,
      numero_passageiros: String(ultimaPlanejada?.numero_passageiros ?? proxima?.numero_passageiros ?? ultimaPerna?.numero_passageiros ?? item.numero_passageiros ?? 0) });
    setAcionamento(""); setApresentacao(""); setPlanejadaIniciandoId(null);
    chavePlanejamento.current = crypto.randomUUID();
    setAgendandoProximaJornada(true);
  };
  const salvarPlanejamento = async () => {
    if (!data || !perna.origem || !perna.destino) { setErro("Confirme a data, a origem e o destino da próxima perna."); return; }
    setSalvando(true); setErro("");
    try {
      await planejarPernaVoo(item.id, { data_prevista: data, origem: perna.origem, destino: perna.destino,
        numero_passageiros: Number(perna.numero_passageiros), chave_reenvio: chavePlanejamento.current,
        horario_previsto: horarioPrevistoPlanejado ? utc(data, horarioPrevistoPlanejado) || undefined : undefined });
      setAgendandoProximaJornada(false);
      setMensagem("Agendamento confirmado na mesma operação. Abra o voo para preencher a preparação.");
      await aoAtualizarAgendamento?.();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar o planejamento."); }
    finally { setSalvando(false); }
  };
  const iniciarPlanejada = (planejada: PernaPlanejada) => {
    setErro(""); setMensagem(""); setAgendandoProximaJornada(false);
    setPlanejadaIniciandoId(planejada.id);
    setPerna({ ...pernaVazia(), origem: planejada.origem, destino: planejada.destino, numero_passageiros: String(planejada.numero_passageiros) });
    setAcionamento(""); setApresentacao("");
    if (jornada && jornada.status !== "encerrada") {
      setDataNovaPerna(planejada.data_prevista); setCriandoPerna(true);
    } else { setData(planejada.data_prevista); setJornada(null); }
  };
  const cancelarPlanejamento = async (planejada: PernaPlanejada) => {
    setSalvando(true); setErro("");
    try { await cancelarPernaPlanejada(item.id, planejada.id); await aoAtualizarAgendamento?.(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível cancelar o planejamento."); }
    finally { setSalvando(false); }
  };
  const iniciarEdicaoPernaAtual = () => {
    if (!ultimaPerna) return;
    setFormPernaAtual({ origem: ultimaPerna.origem || "", destino: ultimaPerna.destino || "", numero_passageiros: String(ultimaPerna.numero_passageiros ?? 0), horario_ac: hora(ultimaPerna.horario_ac), horario_dep: hora(ultimaPerna.horario_dep), horario_pouso: hora(ultimaPerna.horario_pouso), horario_corte: hora(ultimaPerna.horario_corte) });
    setEditandoPernaAtual(true);
  };
  const salvarInicio = async () => {
    if (!data || !perna.origem || !perna.destino || !apresentacao || !acionamento) { setErro("Confirme a data, os aeródromos e o acionamento."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    const horarioAcionamento = utc(data, acionamento);
    const horarioApresentacao = horarioAcionamento ? new Date(new Date(horarioAcionamento).getTime() - 30 * 60_000).toISOString() : null;
    const horarioDep = utcDepois(data, perna.horario_dep, horarioAcionamento);
    if (!horarioApresentacao || !horarioAcionamento || (perna.horario_dep && !horarioDep)) { setErro("Os horários informados não são válidos em UTC."); setSalvando(false); return; }
    try {
      await iniciarJornadaVoo(item.id, { data: horarioApresentacao.slice(0, 10), data_jornada: horarioApresentacao.slice(0, 10),
        minutos_pos_corte: posCorte, origem: perna.origem, destino: perna.destino, numero_passageiros: Number(perna.numero_passageiros),
        perna_planejada_id: planejadaIniciandoId || undefined, horario_apresentacao: horarioApresentacao,
        horario_acionamento: horarioAcionamento, horario_dep: horarioDep,
        tripulantes: [item.piloto_id && { tripulante_id: item.piloto_id, funcao: "PIC" as const }, item.copiloto_id && { tripulante_id: item.copiloto_id, funcao: "SIC" as const }].filter((tripulante): tripulante is { tripulante_id: string; funcao: "PIC" | "SIC" } => Boolean(tripulante)) });
      setPlanejadaIniciandoId(null); await carregar();
      await aoAtualizarAgendamento?.(horarioDep ? "decolado" : "acionado");
      setMensagem(horarioDep ? "Check-in, AC e DEP salvos." : "Acionamento registrado. A jornada foi iniciada.");
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível iniciar a jornada."); }
    finally { setSalvando(false); }
  };
  const salvarDecolagem = async () => {
    if (!jornada || !ultimaPerna || !perna.horario_dep) { setErro("Informe o horário de decolagem (DEP)."); return; }
    const horarioDep = utcDepois(ultimaPerna.horario_ac?.slice(0, 10) || jornada.data, perna.horario_dep, ultimaPerna.horario_ac || jornada.horario_apresentacao);
    if (!horarioDep) { setErro("O horário de decolagem não é válido em UTC."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    try {
      await atualizarPernaJornada(ultimaPerna.jornada_id || jornada.id, ultimaPerna.id, { horario_dep: horarioDep });
      await carregar();
      await aoAtualizarAgendamento?.("decolado");
      setMensagem("Decolagem registrada. O status do voo foi atualizado para Decolado.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível registrar a decolagem."); }
    finally { setSalvando(false); }
  };
  const salvarCorte = async () => {
    if (!jornada || !ultimaPerna || !perna.horario_pouso || !perna.horario_corte) return;
    setSalvando(true); setErro(""); setMensagem("");
    const horarioPouso = utcDepois(ultimaPerna.horario_dep?.slice(0, 10) || jornada.data, perna.horario_pouso, ultimaPerna.horario_dep || ultimaPerna.horario_ac);
    const horarioCorte = utcDepois(horarioPouso?.slice(0, 10) || jornada.data, perna.horario_corte, horarioPouso);
    if (!horarioPouso || !horarioCorte) { setErro("Os horários POU/COR não são válidos em UTC."); setSalvando(false); return; }
    try { const atualizada = await atualizarPernaJornada(jornada.id, ultimaPerna.id, { numero_passageiros: Number(perna.numero_passageiros), horario_pouso: horarioPouso, tempo_pou: horarioPouso, horario_corte: horarioCorte, tempo_cor: horarioCorte }); await carregar(); await aoAtualizarAgendamento?.(atualizada.status_agendamento || "em_solo"); setMensagem("POU e corte salvos. Você pode agendar outro voo ou encerrar a jornada."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar pouso e corte."); } finally { setSalvando(false); }
  };
  const salvarNovaPerna = async (confirmar = false) => {
    if (!jornada) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const dataPerna = dataNovaPerna || dataDoUltimoLancamento(ultimaPerna, jornada.data);
      const criada = await adicionarPernaJornada(jornada.id, {
        ...pernaUtc(dataPerna, perna, ultimaPerna?.horario_corte || ultimaPerna?.horario_pouso || ultimaPerna?.horario_ac),
        perna_planejada_id: planejadaIniciandoId || undefined,
        ...(confirmar ? { confirmar_excedente: true } : {}),
      });
      await carregar(); await aoAtualizarAgendamento?.(criada.status_agendamento || (perna.horario_dep ? "decolado" : "acionado")); setCriandoPerna(false); setPlanejadaIniciandoId(null);
      setMensagem(confirmar
        ? (perna.horario_dep ? "Nova perna decolada com excedente confirmado." : "Nova perna acionada com excedente confirmado. Registre a DEP quando decolar.")
        : (perna.horario_dep ? "Nova perna decolada. Registre POU e COR após o pouso." : "Nova perna acionada. Registre a DEP quando a aeronave decolar."));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!confirmar && msg.startsWith("limite_jornada_excedido")) {
        setConfirmarExcedente({ tipo: "perna", mensagem: "Este tripulante já está no limite configurado de jornada. Deseja iniciar esta perna mesmo assim?" });
      } else {
        setErro(msg || "Não foi possível iniciar a nova perna.");
      }
    } finally { setSalvando(false); }
  };
  const encerrar = async (confirmar = false) => {
    if (!jornada || pernaEmVoo || !pernaCortada) return;
    const pouso = ultimaPerna?.horario_pouso; const corte = ultimaPerna?.horario_corte; if (!pouso || !corte) { setErro("Salve o pouso e o corte da última perna antes de encerrar a jornada."); return; }
    if (!/^\d{2}:\d{2}$/.test(hora(pouso)) || !/^\d{2}:\d{2}$/.test(hora(corte))) { setErro("Os horários POU/COR salvos são inválidos."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    const horarioPouso = pouso;
    const horarioCorte = corte;
    try {
      const atualizada = await encerrarJornadaVoo(jornada.id, {
        horario_pouso: horarioPouso,
        horario_corte: horarioCorte,
        ...(confirmar ? { confirmar_excedente: true } : {}),
      });
      setJornada({ ...jornada, ...atualizada, pernas: jornada.pernas });
      await aoAtualizarAgendamento?.(atualizada.status_agendamento || "em_solo");
      setMensagem(confirmar ? "Jornada encerrada com excedente confirmado." : "Jornada encerrada.");
    } catch (e) {
      const mensagemErro = e instanceof Error ? e.message : "";
      const tripulanteId = mensagemErro.match(/tripulante_id=([^\s|]+)/)?.[1];
      const nome = tripulanteId ? nomesTripulantes.get(tripulanteId) : undefined;
      if (!confirmar && mensagemErro.startsWith("limite_jornada")) {
        const aviso = nome ? `${nome} (${tripulanteId}) ultrapassa o limite configurado. Registrar mesmo assim?` : "Um tripulante ultrapassa o limite configurado. Registrar mesmo assim?";
        setConfirmarExcedente({ tipo: "encerrar", mensagem: aviso });
      } else {
        setErro(mensagemErro || "Não foi possível encerrar a jornada.");
      }
    } finally { setSalvando(false); }
  };
  const salvarEdicaoJornada = async (registro: Jornada, form: JornadaEditForm) => {
    if (!form.data || !form.apresentacao || !form.acionamento) { setErro("Informe data, check-in e acionamento da jornada."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    try { await atualizarJornadaVoo(registro.id, { data: form.data, horario_apresentacao: utc(form.data, form.apresentacao), horario_acionamento: form.acionamento, horario_pouso: form.pouso || null, horario_corte: form.corte || null }); await carregar(); setMensagem(`Jornada ${registro.numero_jornada} atualizada.`); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível editar a jornada."); } finally { setSalvando(false); }
  };
  const salvarEdicaoPerna = async (registro: Jornada, alvo: Jornada["pernas"][number], form: PernaForm) => {
    if (!form.origem || !form.destino) { setErro("Informe origem e destino da perna."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    try { await atualizarPernaJornada(alvo.jornada_id || registro.id, alvo.id, { origem: form.origem, destino: form.destino, numero_passageiros: Number(form.numero_passageiros), horario_ac: form.horario_ac || null, horario_dep: form.horario_dep || null, horario_pouso: form.horario_pouso || null, horario_corte: form.horario_corte || null }); await carregar(); setMensagem(`Perna ${alvo.numero} atualizada.`); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível editar a perna."); } finally { setSalvando(false); }
  };
  const pedirExclusaoJornada = (registro: Jornada) => setExclusao({ tipo: "jornada", jornadaId: registro.id, resumo: `Jornada ${registro.numero_jornada} · ${dataBr(registro.data)} · ${registro.tripulante_nome || registro.funcao_tripulante} · ${registro.pernas?.length || 0} perna(s)` });
  const pedirExclusaoPerna = (registro: Jornada, alvo: Jornada["pernas"][number]) => setExclusao({ tipo: "perna", jornadaId: alvo.jornada_id || registro.id, pernaId: alvo.id, resumo: `Perna ${alvo.numero} · ${alvo.origem} → ${alvo.destino} · ${alvo.numero_passageiros} passageiro(s)` });
  const confirmarExclusao = async () => { if (!exclusao || excluindo) return; setExcluindo(true); setErro(""); try { if (exclusao.tipo === "jornada") await excluirJornadaVoo(exclusao.jornadaId); else await excluirPernaJornada(exclusao.jornadaId, exclusao.pernaId!); await carregar(); setMensagem(exclusao.tipo === "jornada" ? "Jornada excluída." : "Perna excluída."); setExclusao(null); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível excluir o registro."); } finally { setExcluindo(false); } };
  const alterarPerna = (campo: keyof PernaForm, valor: string) => setPerna((atual) => ({ ...atual, [campo]: valor }));
  const horas = (min: number) => `${Math.floor(Math.abs(min) / 60)}h${String(Math.abs(min) % 60).padStart(2, "0")}`;
  if (carregando) return <div className={box}><Loader2 className="animate-spin" size={16} /></div>;
  if (erroCarregamento && !jornada && !somenteLeitura) return <section className={`${box} space-y-4`}><div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"><p className="text-xs font-bold text-red-700 dark:text-red-200">Não foi possível carregar o histórico da jornada.</p><p className="mt-2 break-words text-[11px] text-red-600 dark:text-red-200/80">{erroCarregamento}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => { setCarregando(true); setErroCarregamento(""); void carregar().catch(() => undefined).finally(() => setCarregando(false)); }} className="text-xs">Tentar novamente</Button><Button type="button" variant="outline" onClick={aoFechar} className="text-xs">Fechar</Button></div></div></section>;
  if (somenteLeitura && !jornada) return <section className={`${box} space-y-4`}><ResumoJornadaOperacaoCard solicitacaoId={item.id} /><p className="text-xs text-muted-foreground">O endpoint de jornada principal não retornou registros adicionais.</p>{aoFechar && <Button type="button" variant="outline" onClick={aoFechar} className="text-xs">Fechar</Button>}</section>;

  const tripulantesComLimites = jornada?.tripulantes ?? (jornada && limites ? [{ ...jornada, funcao_tripulante: jornada.funcao_tripulante, limites }] : []);
  return <section className={`${box} space-y-5`}>
    {somenteLeitura && aoFechar && <div className="flex justify-end"><button type="button" onClick={aoFechar} aria-label="Fechar resumo" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><X size={16} /></button></div>}
    {!somenteLeitura && !agendamentoSelecionado && <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/20 p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">{somenteLeitura ? "Operação concluída · histórico" : "Operação · UTC/Zulu"}</p><h2 className="mt-1 text-base font-bold">{somenteLeitura ? "Jornada realizada" : `${item.numero_voo || "Voo a gerar"} → ${item.matricula_registro || "Aeronave a definir"} → ${item.socio_nome || item.cliente_razao_social || item.codigo_cliente || "Não informado"}`}</h2><p className="mt-1 text-[11px] text-muted-foreground">{somenteLeitura ? "Visualização somente leitura da operação encerrada." : "Controle de apresentação, acionamento, voo, pouso e corte."}</p></div>{jornada?.status === "encerrada" && <span className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Encerrada</span>}<button type="button" onClick={aoFechar} aria-label="Fechar jornada de voo" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><X size={16} /></button></div></div>}
    {!somenteLeitura && !agendamentoSelecionado && <section className="rounded-xl border border-primary/25 bg-secondary/15 p-4" aria-label="Agendamentos da operação">
      <h3 className="text-xs font-bold">Agendamentos · {item.numero_voo || "Mesma solicitação"}</h3>
      {!planejadas.length && <p className="mt-2 text-xs text-muted-foreground">Nenhum próximo voo agendado.</p>}
      <div className="mt-3 space-y-2">{planejadas.map(planejada => <article key={planejada.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-xs">
        <div className="min-w-0 flex-1"><strong>{planejada.origem} → {planejada.destino}</strong><p className="mt-1 text-muted-foreground">{dataBr(planejada.data_prevista)} · {planejada.horario_previsto ? `${hora(planejada.horario_previsto)} UTC` : "Horário a definir"} · {planejada.numero_passageiros} passageiros · Confirmado</p></div>
        {aoAbrirAgendamento && <Button type="button" variant="outline" className="text-xs [border-color:rgba(17,99,134,0.88)]" onClick={() => aoAbrirAgendamento(planejada.id)}>Abrir agendamento</Button>}
        <Button type="button" variant="ghost" disabled={salvando} aria-label={`Cancelar planejamento ${planejada.origem} ${planejada.destino}`} onClick={() => void cancelarPlanejamento(planejada)}><X size={14} /></Button>
      </article>)}</div>
    </section>}
    {agendamentoSelecionado && !planejadaIniciandoId ? <section className="space-y-3">
      {jornada && jornada.status !== "encerrada" && !pernaCortada
        ? <p className="text-xs text-muted-foreground">Registre o pouso e o corte do voo anterior para iniciar este voo.</p>
        : <Button type="button" onClick={() => iniciarPlanejada(agendamentoSelecionado)}>Informar acionamento</Button>}
    </section> : agendandoProximaJornada ? <section className="rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label="Novo agendamento">
      <h3 className="mb-3 text-xs font-bold">Novo agendamento da operação</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Data prevista *"><input type="date" value={data} onChange={event => setData(event.target.value)} className={input} /></Campo>
        <Campo label="Horário previsto (UTC) · opcional"><input type="time" value={horarioPrevistoPlanejado} onChange={event => setHorarioPrevistoPlanejado(event.target.value)} className={input} /></Campo>
        <AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={valor => alterarPerna("origem", valor)} />
        <AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={valor => alterarPerna("destino", valor)} />
        <Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={event => alterarPerna("numero_passageiros", event.target.value)} className={input} /></Campo>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Preencha o checklist e o plano de voo no novo agendamento.</p>
      <div className="mt-3 flex gap-2"><Button type="button" disabled={salvando || !data || !perna.origem || !perna.destino} onClick={() => void salvarPlanejamento()} className="gap-2 text-xs"><CalendarDays size={14} />Criar agendamento</Button><Button type="button" variant="outline" disabled={salvando} onClick={() => setAgendandoProximaJornada(false)}>Cancelar</Button></div>
    </section> : <>
    {modoHistorico && jornada && <nav className="flex gap-1 overflow-x-auto rounded-[5px] border border-border bg-card/60 p-1">{([{ id: "historico", label: "Histórico de voo" }, { id: "mapa", label: "MAPA TRAJETO" }, { id: "jornada", label: "Jornada de voo" }] as const).filter((aba) => permitirMapa || aba.id !== "mapa").map((aba) => <button key={aba.id} type="button" onClick={() => setAbaHistorico(aba.id)} className={`rounded-[6px] px-4 py-2 text-[11px] font-bold uppercase transition-colors ${abaHistorico === aba.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{aba.label}</button>)}</nav>}
    {modoHistorico && jornada && abaHistorico === "jornada" && somenteLeitura && <ResumoJornadaOperacaoCard solicitacaoId={item.id} />}
    {modoHistorico && jornada && abaHistorico === "jornada" && <div className="grid gap-2 sm:grid-cols-2">{tripulantesComLimites.map((t) => <div key={t.id} className={`rounded-lg border px-3 py-2.5 ${t.limites.dados_incompletos ? "border-border bg-muted/20 text-muted-foreground" : tomAlerta[t.limites.nivel_alerta]}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wide">{nomesTripulantes.get(t.tripulante_id ?? "") || "Tempo Jornada"}</span></div><p className="mt-1 text-xs font-semibold text-foreground">{t.limites.dados_incompletos ? "Dados incompletos · " : ""}Janela semanal {horas(t.limites.semana.minutos)}/{horas(t.limites.semana.limite)} · Mês {horas(t.limites.mes.minutos)}/{horas(t.limites.mes.limite)}</p></div>)}</div>}
      {!jornada ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo label="Data da jornada *"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={input} /></Campo>
      <Campo label="Pós-corte / tipo de voo"><Select value={String(posCorte)} onValueChange={(value) => setPosCorte(value === "45" ? 45 : 30)}><SelectTrigger className={input}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">Doméstico · 30 minutos</SelectItem><SelectItem value="45">Internacional · 45 minutos</SelectItem></SelectContent></Select></Campo>
      <AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("origem", valor)} />
      <AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("destino", valor)} />
      <Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={(e) => alterarPerna("numero_passageiros", e.target.value)} className={input} /></Campo>
      <Campo label="Tripulação check-in automático"><input type="time" value={apresentacao} readOnly disabled={!acionamento} aria-describedby="checkin-automatico-ajuda" className={input} /><span id="checkin-automatico-ajuda" className="block text-[11px] text-muted-foreground">Preenchido 30 min antes do acionamento. Se ainda não há horários, crie o agendamento.</span></Campo>
      <Campo label="Horário de acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => { setAcionamento(e.target.value); setApresentacao(""); }} className={input} /></Campo>
      <Campo label="Decolagem / saída (DEP), se já ocorreu"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo>
      <div className="sm:col-span-2 lg:col-span-4"><p className="mb-2 text-[11px] text-muted-foreground">Registre o acionamento para iniciar a jornada desta perna.</p><Button onClick={() => void salvarInicio()} disabled={salvando || !data || !perna.origem || !perna.destino || !apresentacao || !acionamento} className="h-10 gap-2 text-xs"><Save size={14} /> Registrar acionamento</Button></div>
    </div> : <>
      {modoHistorico && abaHistorico === "historico" && !somenteLeitura && <SecaoRecolhivel titulo="Dados do voo"><AcompanhamentoVooAgendado item={item} voosEmOperacao={voosEmOperacao} secao="historico" /></SecaoRecolhivel>}
      {permitirMapa && modoHistorico && abaHistorico === "mapa" && !somenteLeitura && <AcompanhamentoVooAgendado item={item} voosEmOperacao={voosEmOperacao} secao="mapa" />}
      {modoHistorico && abaHistorico === "historico" && <HistoricoJornadas somenteLeitura={somenteLeitura} jornadas={jornada.historico?.length ? jornada.historico : [jornada]} aoSalvarJornada={salvarEdicaoJornada} aoSalvarPerna={salvarEdicaoPerna} salvando={salvando} aoExcluirJornada={pedirExclusaoJornada} aoExcluirPerna={pedirExclusaoPerna} />}
      {!modoHistorico && jornada.status !== "encerrada" && ultimaPerna && <div>{editandoPernaAtual ? <PernaInlineForm form={formPernaAtual} onChange={(campo, valor) => setFormPernaAtual((atual) => ({ ...atual, [campo]: valor }))} onSave={() => { void salvarEdicaoPerna(jornada, ultimaPerna, formPernaAtual); setEditandoPernaAtual(false); }} onCancel={() => setEditandoPernaAtual(false)} salvando={salvando} /> : <div className="flex justify-end"><Button type="button" variant="outline" onClick={iniciarEdicaoPernaAtual} className="gap-2 text-xs"><Pencil size={13} /> Editar trecho atual</Button></div>}</div>}
      {!modoHistorico && jornada.status !== "encerrada" && pernaAguardandoDecolagem && ultimaPerna && <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200"><Clock3 size={15} /> Acionado · aguardando decolagem</div><p className="mb-3 text-xs text-muted-foreground">A jornada foi iniciada. Registre o horário DEP para atualizar o status para Decolado.</p><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Campo label="Decolagem / saída (DEP) UTC *"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo><Button onClick={() => void salvarDecolagem()} disabled={salvando || !perna.horario_dep} className="h-10 gap-2 text-xs"><Plane size={14} /> Registrar decolagem</Button></div></div>}
      {!modoHistorico && jornada.status !== "encerrada" && pernaEmVoo && ultimaPerna && <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-200"><Clock3 size={15} /> Perna {ultimaPerna.numero} aguardando POU</div><div className="mb-4 grid gap-2 rounded-lg border border-border/60 bg-card p-3 text-xs sm:grid-cols-4"><div><span className="text-[11px] text-muted-foreground">Trecho</span><strong className="block">{ultimaPerna.origem} → {ultimaPerna.destino}</strong></div><div><span className="text-[11px] text-muted-foreground">AC</span><strong className="block">{hora(ultimaPerna.horario_ac) || hora(jornada.horario_acionamento)}</strong></div><div><span className="text-[11px] text-muted-foreground">DEP</span><strong className="block">{hora(ultimaPerna.horario_dep) || "—"}</strong></div><div><span className="text-[11px] text-muted-foreground">Data</span><strong className="block">{dataBr(jornada.data)}</strong></div></div><div className="grid gap-3 sm:grid-cols-3"><Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={(e) => alterarPerna("numero_passageiros", e.target.value)} className={input} /></Campo><Campo label="Pouso (POU) *"><input type="time" value={perna.horario_pouso} onChange={(e) => alterarPerna("horario_pouso", e.target.value)} className={input} /></Campo><Campo label="Corte (CORT) *"><input type="time" value={perna.horario_corte} onChange={(e) => alterarPerna("horario_corte", e.target.value)} className={input} /></Campo></div><Button onClick={() => void salvarCorte()} disabled={salvando || !perna.horario_pouso || !perna.horario_corte} className="mt-4 h-10 gap-2 text-xs"><CheckCircle2 size={14} /> Salvar POU e corte</Button></div>}
      {!modoHistorico && jornada.status !== "encerrada" && pernaCortada && !criandoPerna && <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4"><p className="w-full text-xs font-medium text-emerald-800 dark:text-emerald-200">POU e corte salvos. Escolha o próximo passo da jornada.</p><Button variant="outline" onClick={() => void encerrar()} disabled={salvando} className="h-10 gap-2 text-xs"><Flag size={14} /> Encerrar jornada</Button></div>}
      {!modoHistorico && jornada.status !== "encerrada" && pernaCortada && criandoPerna && <div className="rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="mb-1 text-xs font-bold">Nova perna</p><p className="mb-3 text-[11px] text-muted-foreground">A saída foi definida automaticamente como o destino da perna anterior.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Campo label="Data da perna"><input type="date" value={dataNovaPerna || jornada.data} readOnly disabled className={input} /></Campo><AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("origem", valor)} /><AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("destino", valor)} /><Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={(e) => alterarPerna("numero_passageiros", e.target.value)} className={input} /></Campo><Campo label="Acionamento / AC *"><input type="time" value={perna.horario_ac} onChange={(e) => alterarPerna("horario_ac", e.target.value)} className={input} /></Campo><Campo label="Decolagem / DEP, se já ocorreu"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo></div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => void salvarNovaPerna()} disabled={salvando || !perna.origem || !perna.destino || !perna.horario_ac} className="h-10 gap-2 text-xs"><Save size={14} /> Registrar acionamento da perna</Button><Button variant="outline" onClick={() => { setCriandoPerna(false); setPlanejadaIniciandoId(null); setDataNovaPerna(""); setPerna(pernaVazia()); }} className="h-10 text-xs">Cancelar</Button></div></div>}
    </>}
    </>}
    {(erro || mensagem) && <p className={`text-xs font-medium ${erro ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>{erro || mensagem}</p>}
    <Dialog open={Boolean(confirmarExcedente)} onOpenChange={(aberto) => { if (!aberto && !salvando) setConfirmarExcedente(null); }}>
      <DialogContent className="rounded-2xl border-amber-500/35 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">Confirmar excedente de jornada?</DialogTitle>
          <DialogDescription className="pt-1 text-xs text-muted-foreground">{confirmarExcedente?.mensagem}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={salvando} onClick={() => setConfirmarExcedente(null)}>Cancelar</Button>
          <Button
            type="button"
            disabled={salvando}
            onClick={() => {
              const acao = confirmarExcedente;
              setConfirmarExcedente(null);
              if (acao?.tipo === "perna") void salvarNovaPerna(true);
              if (acao?.tipo === "encerrar") void encerrar(true);
            }}
          >
            Confirmar e registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(exclusao)} onOpenChange={(aberto) => { if (!aberto && !excluindo) setExclusao(null); }}><DialogContent className="rounded-2xl border-red-500/30 bg-card sm:max-w-md"><DialogHeader><DialogTitle className="text-base font-bold text-red-700 dark:text-red-300">{exclusao?.tipo === "jornada" ? "Excluir esta jornada de voo?" : "Excluir esta perna de voo?"}</DialogTitle><DialogDescription className="pt-2 text-xs">Confira o resumo do registro que será excluído:</DialogDescription></DialogHeader><div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs font-semibold text-foreground">{exclusao?.resumo}</div><DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={excluindo} onClick={() => setExclusao(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={excluindo} onClick={() => void confirmarExclusao()} className="gap-2"><Trash2 size={14} />{excluindo ? "Excluindo..." : "Confirmar"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
