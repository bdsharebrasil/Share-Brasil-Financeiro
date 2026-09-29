import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, Clock3, Flag, Gauge, Loader2, MapPin, Plane, Plus, Route, Save, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import { atualizarPernaJornada, adicionarPernaJornada, buscarJornadaVoo, buscarLimitesJornada, encerrarJornadaVoo, iniciarJornadaVoo, type JornadaVoo as Jornada, type LimitesJornada, type NivelAlertaJornada } from "@/lib/colaborador-api";
import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";

const input = "h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-secondary/30 disabled:opacity-50";
const box = "rounded-2xl border border-[rgba(34,44,57,0.96)] bg-card/80 p-5 shadow-sm";
const hoje = () => new Date().toISOString().slice(0, 10);
// Horários operacionais são sempre informados e transmitidos em UTC/Zulu.
const iso = (data: string, hora: string) => `${data}T${hora}:00Z`;
function utc(data: string, hora?: string | null) {
  if (!hora) return null;
  const instante = new Date(iso(data, hora));
  return Number.isFinite(instante.getTime()) ? instante.toISOString() : null;
}
function pernaUtc(data: string, valor: PernaForm) {
  return {
    ...valor,
    horario_ac: utc(data, valor.horario_ac),
    horario_dep: utc(data, valor.horario_dep),
    horario_pouso: utc(data, valor.horario_pouso),
    horario_corte: utc(data, valor.horario_corte),
  };
}
const tomAlerta: Record<NivelAlertaJornada, string> = { normal: "border-emerald-400/30 bg-emerald-400/5 text-emerald-200", atencao: "border-amber-400/30 bg-amber-400/5 text-amber-200", critico: "border-orange-400/40 bg-orange-400/10 text-orange-200", excedido: "border-red-400/40 bg-red-400/10 text-red-200" };
function hora(valor?: string | null) { if (!valor) return ""; const match = valor.match(/T(\d{2}:\d{2})/); return match?.[1] || valor.slice(0, 5); }
function dataBr(valor?: string | null) { if (!valor) return "—"; const [ano, mes, dia] = valor.slice(0, 10).split("-"); return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor; }
function dataDoUltimoLancamento(perna: Jornada["pernas"][number] | undefined, fallback: string) {
  const ultimoHorario = perna?.horario_corte || perna?.horario_pouso || perna?.horario_dep || perna?.horario_ac;
  return ultimoHorario?.slice(0, 10) || fallback;
}
function Campo({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1"><span className="text-[9px] font-bold text-muted-foreground">{label}</span>{children}</label>; }
type PernaForm = { origem: string; destino: string; numero_passageiros: string; horario_ac: string; horario_dep: string; horario_pouso: string; horario_corte: string };
const pernaVazia = (): PernaForm => ({ origem: "", destino: "", numero_passageiros: "0", horario_ac: "", horario_dep: "", horario_pouso: "", horario_corte: "" });

function AeroportoCampo({ label, value, aerodromos, carregando, onChange }: { label: string; value: string; aerodromos: AerodromoOption[]; carregando: boolean; onChange: (value: string) => void }) {
  return <Campo label={label}><SearchableCombobox items={aerodromos.map((aero) => ({ id: aero.id, label: aero.label || `${aero.id} · ${aero.name}` }))} value={value} onChange={onChange} placeholder={carregando ? "Carregando aeródromos..." : "Selecione o aeródromo"} searchPlaceholder="Buscar por nome ou ICAO" emptyMessage="Nenhum aeródromo encontrado no D1." disabled={carregando} /></Campo>;
}
function minutosEntreHistorico(inicio?: string | null, fim?: string | null) {
  if (!inicio || !fim) return null;
  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b >= a && b - a <= 86_400_000) return Math.round((b - a) / 60000);
  const horaFinal = String(fim).match(/T(\d{2}:\d{2})(?::\d{2})?/)?.[1];
  if (!horaFinal) return null;
  let ajustado = new Date(`${String(inicio).slice(0, 10)}T${horaFinal}:00Z`).getTime();
  while (ajustado < a) ajustado += 86_400_000;
  return ajustado - a <= 86_400_000 ? Math.round((ajustado - a) / 60000) : null;
}
function horaHistorico(valor?: string | null) {
  if (!valor) return "—";
  return valor.match(/T(\d{2}:\d{2})/)?.[1] || valor.match(/^(\d{1,2}):(\d{2})/)?.slice(1).map((parte) => parte.padStart(2, "0")).join(":") || "—";
}
function dataHistorico(valor?: string | null) { return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—"; }
function duracaoHistorico(jornada: Jornada) {
  const primeiraPerna = jornada.pernas?.[0];
  const ultimaPerna = jornada.pernas?.[jornada.pernas.length - 1];
  const calculada = minutosEntreHistorico(jornada.horario_apresentacao || primeiraPerna?.horario_ac, ultimaPerna?.horario_corte || ultimaPerna?.horario_pouso);
  const minutos = calculada !== null ? calculada + 30 : Number(jornada.minutos_jornada) > 0 ? Number(jornada.minutos_jornada) : 0;
  if (!minutos) return jornada.status !== "encerrada" ? "Em andamento" : "—";
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}
function HistoricoJornadaItem({ registro, aberto = false }: { registro: Jornada; aberto?: boolean }) {
  const [expandido, setExpandido] = useState(aberto);
  const encerrada = registro.status === "encerrada";
  return <div className="overflow-hidden rounded-xl border border-border/70 bg-background/35">
    <button type="button" onClick={() => setExpandido((atual) => !atual)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/30">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${encerrada ? "bg-emerald-400/10 text-emerald-300" : "bg-sky-400/10 text-sky-300"}`}><Route size={15} /></span>
      <span className="min-w-0 flex-1"><strong className="block text-[10px]">Jornada {registro.numero_jornada}</strong><span className="mt-0.5 block text-[9px] text-muted-foreground">{dataHistorico(registro.data)} · {duracaoHistorico(registro)} · {registro.pernas?.length || 0} perna{registro.pernas?.length === 1 ? "" : "s"}</span></span>
      <span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${encerrada ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-sky-400/25 bg-sky-400/10 text-sky-300"}`}>{encerrada ? "Encerrada" : "Em andamento"}</span><ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${expandido ? "rotate-180" : ""}`} />
    </button>
    {expandido && <div className="border-t border-border/60 p-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><HistoricoDetalhe label="Check-in" valor={horaHistorico(registro.horario_apresentacao)} icon={<Clock3 size={12} />} /><HistoricoDetalhe label="AC" valor={horaHistorico(registro.horario_acionamento)} icon={<Gauge size={12} />} /><HistoricoDetalhe label="POU" valor={horaHistorico(registro.horario_pouso)} icon={<Plane size={12} />} /><HistoricoDetalhe label="COR" valor={horaHistorico(registro.horario_corte)} icon={<Timer size={12} />} /><HistoricoDetalhe label="Tempo total" valor={duracaoHistorico(registro)} icon={<Clock3 size={12} />} /></div>{registro.pernas?.length ? <div className="mt-3 space-y-2"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-primary">Rota percorrida</p>{registro.pernas.map((perna) => <div key={perna.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-[10px]"><MapPin size={12} className="text-primary" /><strong>Perna {perna.numero}</strong><span>{perna.origem} → {perna.destino}</span><span className="text-muted-foreground">{perna.numero_passageiros} pax · AC {horaHistorico(perna.horario_ac)} · DEP {horaHistorico(perna.horario_dep)} · POU {horaHistorico(perna.horario_pouso)} · COR {horaHistorico(perna.horario_corte)}</span></div>)}</div> : <p className="mt-3 text-[10px] text-muted-foreground">Nenhuma perna registrada.</p>}</div>}
  </div>;
}
function HistoricoJornadas({ jornadas }: { jornadas: Jornada[] }) {
  return <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Histórico operacional</p><p className="mt-1 text-[10px] text-muted-foreground">Horários registrados em UTC/Zulu</p></div><CalendarDays size={16} className="text-primary" /></div>{jornadas.length ? <div className="mt-3 space-y-2">{[...jornadas].sort((a, b) => Number(a.numero_jornada) - Number(b.numero_jornada)).map((registro, indice) => <HistoricoJornadaItem key={registro.id} registro={registro} aberto={indice === 0} />)}</div> : <p className="mt-3 text-[10px] text-muted-foreground">Nenhuma jornada registrada.</p>}</div>;
}
function HistoricoDetalhe({ label, valor, icon }: { label: string; valor: string; icon?: ReactNode }) { return <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><div className="flex items-center gap-1 text-[9px] text-muted-foreground">{icon}{label}</div><p className="mt-1.5 truncate text-[10px] font-semibold">{valor}</p></div>; }

export default function JornadaVoo({ item, aoFechar, aoAtualizarAgendamento }: { item: SolicitacaoVooInterna; aoFechar?: () => void; aoAtualizarAgendamento?: () => void | Promise<void> }) {
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [criandoPerna, setCriandoPerna] = useState(false);
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
  const [data, setData] = useState(item.data_agendada || hoje());
  const [dataNovaPerna, setDataNovaPerna] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [perna, setPerna] = useState<PernaForm>({ ...pernaVazia(), origem: item.origem || "", destino: item.destino || "" });
  const [limites, setLimites] = useState<LimitesJornada | null>(null);
  const nomesTripulantes = useMemo(() => new Map([[item.piloto_id || "", item.piloto_nome || ""], [item.copiloto_id || "", item.copiloto_nome || ""]]), [item.copiloto_id, item.copiloto_nome, item.piloto_id, item.piloto_nome]);

  const opcoesAerodromos = useMemo(() => aerodromos, [aerodromos]);
  const carregar = async () => {
    const atual = await buscarJornadaVoo(item.id);
    setErro("");
    setJornada(atual);
    if (atual) {
      setData(atual.data || item.data_agendada || hoje());
      setAcionamento(hora(atual.horario_acionamento));
      setApresentacao(hora(atual.horario_apresentacao));
      const ultima = atual.pernas?.[atual.pernas.length - 1];
      if (ultima) setPerna({ origem: ultima.origem || "", destino: ultima.destino || "", numero_passageiros: String(ultima.numero_passageiros ?? 0), horario_ac: hora(ultima.horario_ac), horario_dep: hora(ultima.horario_dep), horario_pouso: hora(ultima.horario_pouso), horario_corte: hora(ultima.horario_corte) });
    }
  };
  useEffect(() => { void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar jornada.")).finally(() => setCarregando(false)); }, [item.id]);
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
  const pernaEmVoo = Boolean(ultimaPerna) && !pernaCortada;
  const prepararNovaPerna = () => {
    if (!jornada || !ultimaPerna) return;
    setDataNovaPerna(dataDoUltimoLancamento(ultimaPerna, jornada.data));
    setPerna({ ...pernaVazia(), origem: ultimaPerna.destino || "" });
    setCriandoPerna(true);
  };
  const salvarInicio = async () => {
    if (!data || !perna.origem || !perna.destino || !apresentacao || !acionamento || !perna.horario_dep) { setErro("Confirme a data, os aeródromos, a apresentação, o acionamento e a decolagem."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    const horarioApresentacao = utc(data, apresentacao);
    const horarioAcionamento = utc(data, acionamento);
    const horarioDep = utc(data, perna.horario_dep);
    if (!horarioApresentacao || !horarioAcionamento || !horarioDep) { setErro("Os horários informados não são válidos em UTC."); return; }
    try { await iniciarJornadaVoo(item.id, { data, data_jornada: data, horario_apresentacao: horarioApresentacao, tripulacao_checkin_hora: horarioApresentacao, horario_acionamento: horarioAcionamento, tempo_ac: horarioAcionamento, horario_ac: horarioAcionamento, horario_dep: horarioDep, tempo_dep: horarioDep, origem: perna.origem, aerodromo_partida: perna.origem, destino: perna.destino, aerodromo_chegada: perna.destino, numero_passageiros: Number(perna.numero_passageiros), tripulante_id: item.piloto_id, tripulantes: [item.piloto_id && { tripulante_id: item.piloto_id, funcao: "PIC" as const }, item.copiloto_id && { tripulante_id: item.copiloto_id, funcao: "SIC" as const }].filter((tripulante): tripulante is { tripulante_id: string; funcao: "PIC" | "SIC" } => Boolean(tripulante)) }); await carregar(); await aoAtualizarAgendamento?.(); setMensagem("Check-in, AC e DEP salvos. Volte depois para registrar POU e COR."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível iniciar a jornada."); } finally { setSalvando(false); }
  };
  const salvarCorte = async () => {
    if (!jornada || !ultimaPerna || !perna.horario_pouso || !perna.horario_corte) return;
    setSalvando(true); setErro(""); setMensagem("");
    const horarioPouso = utc(jornada.data, perna.horario_pouso);
    const horarioCorte = utc(jornada.data, perna.horario_corte);
    if (!horarioPouso || !horarioCorte) { setErro("Os horários POU/COR não são válidos em UTC."); return; }
    try { await atualizarPernaJornada(jornada.id, ultimaPerna.id, { numero_passageiros: Number(perna.numero_passageiros), horario_pouso: horarioPouso, tempo_pou: horarioPouso, horario_corte: horarioCorte, tempo_cor: horarioCorte }); await carregar(); setMensagem("POU e corte salvos. Agora você pode iniciar uma nova perna ou encerrar a jornada."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar pouso e corte."); } finally { setSalvando(false); }
  };
  const salvarNovaPerna = async () => {
    if (!jornada) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const dataPerna = dataNovaPerna || dataDoUltimoLancamento(ultimaPerna, jornada.data);
      await adicionarPernaJornada(jornada.id, pernaUtc(dataPerna, perna));
      await carregar(); setCriandoPerna(false); setMensagem("Nova perna iniciada. Informe o pouso e o corte desta perna.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("limite_jornada_excedido")) {
        if (window.confirm("Este tripulante já está no limite legal de jornada. Iniciar esta perna mesmo assim?")) {
          try {
            const dataPerna = dataNovaPerna || dataDoUltimoLancamento(ultimaPerna, jornada.data);
            await adicionarPernaJornada(jornada.id, { ...pernaUtc(dataPerna, perna), confirmar_excedente: true });
            await carregar(); setCriandoPerna(false); setMensagem("Perna iniciada com excedente confirmado.");
          } catch (e2) { setErro(e2 instanceof Error ? e2.message : "Não foi possível iniciar a perna."); }
        } else setErro(msg);
      } else setErro(msg || "Não foi possível iniciar a nova perna.");
    } finally { setSalvando(false); }
  };
  const encerrar = async () => {
    if (!jornada || pernaEmVoo || !pernaCortada) return;
    const pouso = ultimaPerna?.horario_pouso; const corte = ultimaPerna?.horario_corte; if (!pouso || !corte) { setErro("Salve o pouso e o corte da última perna antes de encerrar a jornada."); return; }
    if (!/^\d{2}:\d{2}$/.test(hora(pouso)) || !/^\d{2}:\d{2}$/.test(hora(corte))) { setErro("Os horários POU/COR salvos são inválidos."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    const horarioPouso = pouso;
    const horarioCorte = corte;
    try { const atualizada = await encerrarJornadaVoo(jornada.id, { horario_pouso: horarioPouso, horario_corte: horarioCorte }); setJornada({ ...jornada, ...atualizada, pernas: jornada.pernas }); setMensagem("Jornada encerrada."); }
    catch (e) { const mensagemErro = e instanceof Error ? e.message : ""; const tripulanteId = mensagemErro.match(/tripulante_id=([^\s|]+)/)?.[1]; const nome = tripulanteId ? nomesTripulantes.get(tripulanteId) : undefined; if (mensagemErro.startsWith("limite_jornada")) { const aviso = nome ? `${nome} (${tripulanteId}) ultrapassa o limite legal. Registrar mesmo assim?` : "Um tripulante ultrapassa o limite legal. Registrar mesmo assim?"; if (window.confirm(aviso)) { try { const atualizada = await encerrarJornadaVoo(jornada.id, { horario_pouso: horarioPouso, horario_corte: horarioCorte, confirmar_excedente: true }); setJornada({ ...jornada, ...atualizada, pernas: jornada.pernas }); setMensagem("Jornada encerrada com excedente confirmado."); } catch (confirmacao) { setErro(confirmacao instanceof Error ? confirmacao.message : "Não foi possível encerrar a jornada."); } } else setErro(mensagemErro); } else setErro(mensagemErro || "Não foi possível encerrar a jornada."); } finally { setSalvando(false); }
  };
  const alterarPerna = (campo: keyof PernaForm, valor: string) => setPerna((atual) => ({ ...atual, [campo]: valor }));
  const horas = (min: number) => `${Math.floor(Math.abs(min) / 60)}h${String(Math.abs(min) % 60).padStart(2, "0")}`;
  if (carregando) return <div className={box}><Loader2 className="animate-spin" size={16} /></div>;
  if (erro && !jornada) return <section className={`${box} space-y-4`}><div className="rounded-xl border border-red-400/30 bg-red-400/5 p-4"><p className="text-xs font-bold text-red-200">Não foi possível carregar o histórico da jornada.</p><p className="mt-2 break-words text-[10px] text-red-200/80">{erro}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => { setCarregando(true); setErro(""); void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar jornada.")).finally(() => setCarregando(false)); }} className="text-xs">Tentar novamente</Button><Button type="button" variant="outline" onClick={aoFechar} className="text-xs">Fechar</Button></div></div></section>;

  const nivelCabecalho = jornada?.tripulantes?.reduce<NivelAlertaJornada>((pior, tripulante) => ({ normal: 0, atencao: 1, critico: 2, excedido: 3 }[tripulante.limites.nivel_alerta] > { normal: 0, atencao: 1, critico: 2, excedido: 3 }[pior] ? tripulante.limites.nivel_alerta : pior), limites?.nivel_alerta || "normal") || "normal";
  const tripulantesComLimites = jornada?.tripulantes ?? (jornada && limites ? [{ ...jornada, funcao_tripulante: jornada.funcao_tripulante, limites }] : []);
  return <section className={`${box} space-y-5`}>
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/25 p-4"><div className="flex items-start gap-3"><div className={`rounded-xl border p-2.5 ${tomAlerta[nivelCabecalho]}`}><Route size={18} /></div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-primary">Operação · UTC/Zulu</p><h2 className="mt-1 text-base font-bold">Jornada de voo</h2><p className="mt-1 text-[10px] text-muted-foreground">Controle de apresentação, acionamento, voo, pouso e corte.</p></div>{jornada?.status === "encerrada" && <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-300">Encerrada</span>}<button type="button" onClick={aoFechar} aria-label="Fechar jornada de voo" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><X size={16} /></button></div>{jornada && <div className="grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2">{tripulantesComLimites.map((t) => <div key={t.id} className={`rounded-lg border px-3 py-2 ${tomAlerta[t.limites.nivel_alerta]}`}><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-wide"> · {nomesTripulantes.get(t.tripulante_id ?? "") || "Tempo Jornada"}</span></div><p className="mt-1 text-[9px] text-muted-foreground">Semana {horas(t.limites.semana.minutos)}/{horas(t.limites.semana.limite)} · Mês {horas(t.limites.mes.minutos)}/{horas(t.limites.mes.limite)}</p></div>)}</div>}{jornada?.status === "encerrada" && <Button type="button" onClick={() => { setJornada(null); setMensagem("Nova jornada: preencha os horários e o novo dia."); setData(item.data_agendada || hoje()); setAcionamento(""); setApresentacao(""); setPerna({ ...pernaVazia(), origem: item.origem || "", destino: item.destino || "" }); }} className="w-full gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto sm:self-end"><Plus size={14} /> Iniciar nova jornada</Button>}</div>
    {!jornada ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo label="Data da jornada *"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={input} /></Campo>
      <AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("origem", valor)} />
      <AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("destino", valor)} />
      <Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={(e) => alterarPerna("numero_passageiros", e.target.value)} className={input} /></Campo>
      <Campo label="Tripulação check-in automático"><input type="time" value={apresentacao} readOnly disabled={!acionamento} aria-describedby="checkin-automatico-ajuda" className={input} /><span id="checkin-automatico-ajuda" className="block text-[9px] text-muted-foreground">Preenchido 30 min antes do acionamento.</span></Campo>
      <Campo label="Horário de acionamento (AC) *"><input type="time" value={acionamento} onChange={(e) => { setAcionamento(e.target.value); setApresentacao(""); }} className={input} /></Campo>
      <Campo label="Decolagem / saída (DEP) *"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo>
      <div className="sm:col-span-2 lg:col-span-4"><p className="mb-2 text-[10px] text-muted-foreground">Horários: check-in da tripulação → AC → DEP → POU → COR. Na primeira gravação informe check-in, AC e DEP; POU e COR serão registrados depois.</p><Button onClick={() => void salvarInicio()} disabled={salvando || !data || !perna.origem || !perna.destino || !apresentacao || !acionamento || !perna.horario_dep} className="gap-2 text-xs"><Save size={14} /> Salvar AC e DEP</Button></div>
    </div> : <>
      {jornada.status !== "encerrada" && <div className="grid gap-2 sm:grid-cols-4"><div className="rounded-xl border border-border/70 bg-secondary/20 p-3"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><CalendarDays size={12} />Data</span><strong className="mt-1 block text-xs">{dataBr(jornada.data)}</strong></div><div className="rounded-xl border border-border/70 bg-secondary/20 p-3"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Clock3 size={12} />Check-in</span><strong className="mt-1 block text-xs">{hora(jornada.horario_apresentacao) || "—"}</strong></div><div className="rounded-xl border border-border/70 bg-secondary/20 p-3"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Gauge size={12} />Acionamento</span><strong className="mt-1 block text-xs text-sky-300">{hora(jornada.horario_acionamento) || "—"}</strong></div><div className="rounded-xl border border-border/70 bg-secondary/20 p-3"><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Route size={12} />Sequência</span><strong className="mt-1 block text-[10px]">CHECK-IN → AC → DEP → POU → COR</strong></div></div>}
      <HistoricoJornadas jornadas={jornada.historico?.length ? jornada.historico : [jornada]} />
      {jornada.status !== "encerrada" && jornada.pernas?.map((p) => <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-[10px] ${p.id === ultimaPerna?.id && pernaEmVoo ? "border-sky-400/40 bg-sky-400/5" : "border-border/70 bg-background/30"}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plane size={14} /></span><div className="min-w-[92px]"><strong className="block">Perna {p.numero}</strong><span className="text-muted-foreground">{p.numero_passageiros} pax</span></div><div className="flex min-w-[150px] flex-1 items-center gap-2 font-semibold"><span>{p.origem}</span><span className="text-primary">→</span><span>{p.destino}</span></div><div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground"><span>AC {hora(p.horario_ac) || "—"}</span><span>DEP {hora(p.horario_dep) || "—"}</span><span>POU {hora(p.horario_pouso) || "—"}</span><span>COR {hora(p.horario_corte) || "—"}</span></div><span className={`rounded-full border px-2 py-1 font-bold ${p.status === "em_voo" ? "border-sky-400/25 bg-sky-400/10 text-sky-300" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"}`}>{p.status === "em_voo" ? "Em voo" : "Pousado"}</span></div>)}
      {jornada.status !== "encerrada" && pernaEmVoo && ultimaPerna && <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-sky-200"><Clock3 size={15} /> Perna {ultimaPerna.numero} aguardando POU</div><div className="mb-4 grid gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-[10px] sm:grid-cols-4"><div><span className="text-muted-foreground">Trecho</span><strong className="block">{ultimaPerna.origem} → {ultimaPerna.destino}</strong></div><div><span className="text-muted-foreground">AC</span><strong className="block">{hora(ultimaPerna.horario_ac) || hora(jornada.horario_acionamento)}</strong></div><div><span className="text-muted-foreground">DEP</span><strong className="block">{hora(ultimaPerna.horario_dep) || "—"}</strong></div><div><span className="text-muted-foreground">Data</span><strong className="block">{dataBr(jornada.data)}</strong></div></div><div className="grid gap-3 sm:grid-cols-3"><Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={(e) => alterarPerna("numero_passageiros", e.target.value)} className={input} /></Campo><Campo label="Pouso (POU) *"><input type="time" value={perna.horario_pouso} onChange={(e) => alterarPerna("horario_pouso", e.target.value)} className={input} /></Campo><Campo label="Corte (CORT) *"><input type="time" value={perna.horario_corte} onChange={(e) => alterarPerna("horario_corte", e.target.value)} className={input} /></Campo></div><Button onClick={() => void salvarCorte()} disabled={salvando || !perna.horario_pouso || !perna.horario_corte} className="mt-4 gap-2 text-xs"><CheckCircle2 size={14} /> Salvar POU e corte</Button></div>}
      {jornada.status !== "encerrada" && pernaCortada && !criandoPerna && <div className="flex flex-wrap gap-2 rounded-xl border border-[rgba(52,211,153,0.72)] bg-emerald-400/5 p-4"><p className="w-full text-[10px] text-emerald-200">POU e corte salvos. Escolha o próximo passo da jornada.</p><Button onClick={prepararNovaPerna} className="gap-2 text-xs"><Plus size={14} /> Nova perna</Button><Button variant="outline" onClick={() => void encerrar()} disabled={salvando} className="gap-2 text-xs"><Flag size={14} /> Encerrar jornada</Button></div>}
      {jornada.status !== "encerrada" && pernaCortada && criandoPerna && <div className="rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="mb-1 text-xs font-bold">Nova perna</p><p className="mb-3 text-[10px] text-muted-foreground">A saída foi definida automaticamente como o destino da perna anterior.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Campo label="Data da perna"><input type="date" value={dataNovaPerna || jornada.data} readOnly disabled className={input} /></Campo><AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("origem", valor)} /><AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("destino", valor)} /><Campo label="Passageiros"><input type="number" min="0" step="1" value={perna.numero_passageiros} onChange={(e) => alterarPerna("numero_passageiros", e.target.value)} className={input} /></Campo><Campo label="Acionamento / AC *"><input type="time" value={perna.horario_ac} onChange={(e) => alterarPerna("horario_ac", e.target.value)} className={input} /></Campo><Campo label="Decolagem / DEP *"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo></div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => void salvarNovaPerna()} disabled={salvando || !perna.origem || !perna.destino || !perna.horario_ac || !perna.horario_dep} className="gap-2 text-xs"><Save size={14} /> Salvar nova perna</Button><Button variant="outline" onClick={() => { setCriandoPerna(false); setDataNovaPerna(""); setPerna(pernaVazia()); }} className="text-xs">Cancelar</Button></div></div>}
    </>}
    {(erro || mensagem) && <p className={`text-[10px] ${erro ? "text-red-300" : "text-emerald-300"}`}>{erro || mensagem}</p>}
  </section>;
}
