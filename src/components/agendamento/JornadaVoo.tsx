import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Clock3, Flag, Loader2, Plane, Plus, Route, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { buscarAerodromos, type AerodromoOption } from "@/lib/flightplan-api";
import { atualizarPernaJornada, adicionarPernaJornada, buscarJornadaVoo, buscarLimitesJornada, encerrarJornadaVoo, iniciarJornadaVoo, type JornadaVoo as Jornada, type LimitesJornada, type NivelAlertaJornada } from "@/lib/colaborador-api";
import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";

const input = "h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary";
const box = "rounded-2xl border border-[rgba(34,44,57,0.96)] bg-card/80 p-4 shadow-sm";
const hoje = () => new Date().toISOString().slice(0, 10);
const iso = (data: string, hora: string) => `${data}T${hora}:00`;
const tomAlerta: Record<NivelAlertaJornada, string> = { normal: "border-emerald-400/30 bg-emerald-400/5 text-emerald-200", atencao: "border-amber-400/30 bg-amber-400/5 text-amber-200", critico: "border-orange-400/40 bg-orange-400/10 text-orange-200", excedido: "border-red-400/40 bg-red-400/10 text-red-200" };
function hora(valor?: string | null) { if (!valor) return ""; const match = valor.match(/T(\d{2}:\d{2})/); return match?.[1] || valor.slice(0, 5); }
function dataBr(valor?: string | null) { if (!valor) return "—"; const [ano, mes, dia] = valor.slice(0, 10).split("-"); return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor; }
function Campo({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1"><span className="text-[9px] font-bold text-muted-foreground">{label}</span>{children}</label>; }
type PernaForm = { origem: string; destino: string; horario_ac: string; horario_dep: string; horario_pouso: string; horario_corte: string };
const pernaVazia = (): PernaForm => ({ origem: "", destino: "", horario_ac: "", horario_dep: "", horario_pouso: "", horario_corte: "" });

function AeroportoCampo({ label, value, aerodromos, carregando, onChange }: { label: string; value: string; aerodromos: AerodromoOption[]; carregando: boolean; onChange: (value: string) => void }) {
  return <Campo label={label}><SearchableCombobox items={aerodromos.map((aero) => ({ id: aero.id, label: aero.label || `${aero.id} · ${aero.name}` }))} value={value} onChange={onChange} placeholder={carregando ? "Carregando aeródromos..." : "Selecione o aeródromo"} searchPlaceholder="Buscar por nome ou ICAO" emptyMessage="Nenhum aeródromo encontrado no D1." disabled={carregando} /></Campo>;
}

export default function JornadaVoo({ item, aoFechar }: { item: SolicitacaoVooInterna; aoFechar?: () => void }) {
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [criandoPerna, setCriandoPerna] = useState(false);
  const [aerodromos, setAerodromos] = useState<AerodromoOption[]>([]);
  const [aerodromosCarregando, setAerodromosCarregando] = useState(true);
  const [data, setData] = useState(item.data_agendada || hoje());
  const [acionamento, setAcionamento] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [perna, setPerna] = useState<PernaForm>({ ...pernaVazia(), origem: item.origem || "", destino: item.destino || "" });
  const [limites, setLimites] = useState<LimitesJornada | null>(null);
  const nomesTripulantes = useMemo(() => new Map([[item.piloto_id || "", item.piloto_nome || ""], [item.copiloto_id || "", item.copiloto_nome || ""]]), [item.copiloto_id, item.copiloto_nome, item.piloto_id, item.piloto_nome]);

  const opcoesAerodromos = useMemo(() => aerodromos, [aerodromos]);
  const carregar = async () => {
    const atual = await buscarJornadaVoo(item.id);
    setJornada(atual);
    if (atual) {
      setData(atual.data || item.data_agendada || hoje());
      setAcionamento(hora(atual.horario_acionamento));
      setApresentacao(hora(atual.horario_apresentacao));
      const ultima = atual.pernas?.[atual.pernas.length - 1];
      if (ultima) setPerna({ origem: ultima.origem || "", destino: ultima.destino || "", horario_ac: hora(ultima.horario_ac), horario_dep: hora(ultima.horario_dep), horario_pouso: hora(ultima.horario_pouso), horario_corte: hora(ultima.horario_corte) });
    }
  };
  useEffect(() => { void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar jornada.")).finally(() => setCarregando(false)); }, [item.id]);
  useEffect(() => {
    let ativo = true;
    setAerodromosCarregando(true);
    void buscarAerodromos().then((resposta) => { if (ativo) setAerodromos(resposta.aerodromos || []); }).catch(() => { if (ativo) setAerodromos([]); }).finally(() => { if (ativo) setAerodromosCarregando(false); });
    return () => { ativo = false; };
  }, []);
  useEffect(() => { if (!acionamento || apresentacao) return; const d = new Date(iso(data, acionamento)); if (!Number.isNaN(d.getTime())) setApresentacao(new Date(d.getTime() - 30 * 60000).toTimeString().slice(0, 5)); }, [data, acionamento, apresentacao]);
  const atualizarLimites = useCallback(async (jornadaId: string) => { try { setLimites(await buscarLimitesJornada(jornadaId)); } catch { setLimites(null); } }, []);
  useEffect(() => { if (jornada?.id) void atualizarLimites(jornada.id); }, [jornada?.id, atualizarLimites]);
  useEffect(() => { if (!jornada?.id || jornada.status === "encerrada") return; const timer = window.setInterval(() => void atualizarLimites(jornada.id), 60_000); return () => window.clearInterval(timer); }, [jornada?.id, jornada?.status, atualizarLimites]);

  const ultimaPerna = jornada?.pernas?.[jornada.pernas.length - 1];
  const pernaCortada = Boolean(ultimaPerna?.horario_pouso && ultimaPerna?.horario_corte);
  const pernaEmVoo = Boolean(ultimaPerna) && !pernaCortada;
  const salvarInicio = async () => {
    if (!data || !perna.origem || !perna.destino || !apresentacao || !acionamento || !perna.horario_dep) { setErro("Confirme a data, os aeródromos, a apresentação, o acionamento e a decolagem."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    try { await iniciarJornadaVoo(item.id, { data, data_jornada: data, horario_apresentacao: apresentacao, tripulacao_checkin_hora: apresentacao, horario_acionamento: acionamento, tempo_ac: acionamento, horario_ac: acionamento, horario_dep: perna.horario_dep, tempo_dep: perna.horario_dep, origem: perna.origem, aerodromo_partida: perna.origem, destino: perna.destino, aerodromo_chegada: perna.destino, tripulante_id: item.piloto_id, tripulantes: [item.piloto_id && { tripulante_id: item.piloto_id, funcao: "PIC" as const }, item.copiloto_id && { tripulante_id: item.copiloto_id, funcao: "SIC" as const }].filter((tripulante): tripulante is { tripulante_id: string; funcao: "PIC" | "SIC" } => Boolean(tripulante)) }); await carregar(); setMensagem("Check-in, AC e DEP salvos. Volte depois para registrar POU e COR."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível iniciar a jornada."); } finally { setSalvando(false); }
  };
  const salvarCorte = async () => {
    if (!jornada || !ultimaPerna || !perna.horario_pouso || !perna.horario_corte) return;
    setSalvando(true); setErro(""); setMensagem("");
    try { await atualizarPernaJornada(jornada.id, ultimaPerna.id, { horario_pouso: perna.horario_pouso, tempo_pou: perna.horario_pouso, horario_corte: perna.horario_corte, tempo_cor: perna.horario_corte }); await carregar(); setMensagem("POU e corte salvos. Agora você pode iniciar uma nova perna ou encerrar a jornada."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar pouso e corte."); } finally { setSalvando(false); }
  };
  const salvarNovaPerna = async () => {
    if (!jornada) return;
    setSalvando(true); setErro(""); setMensagem("");
    try { await adicionarPernaJornada(jornada.id, perna); await carregar(); setCriandoPerna(false); setMensagem("Nova perna iniciada. Informe o pouso e o corte desta perna."); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível iniciar a nova perna."); } finally { setSalvando(false); }
  };
  const encerrar = async () => {
    if (!jornada || pernaEmVoo || !pernaCortada) return;
    const corte = ultimaPerna?.horario_corte; if (!corte) { setErro("Salve o corte da última perna antes de encerrar a jornada."); return; }
    const corteDate = new Date(iso(jornada.data || data, hora(corte))); if (Number.isNaN(corteDate.getTime())) { setErro("O horário de corte salvo é inválido."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    const corteFinal = new Date(corteDate.getTime() + 30 * 60000).toISOString();
    try { const atualizada = await encerrarJornadaVoo(jornada.id, { horario_corte_final: corteFinal }); setJornada({ ...jornada, ...atualizada, pernas: jornada.pernas }); setMensagem("Jornada encerrada."); }
    catch (e) { const mensagemErro = e instanceof Error ? e.message : ""; const tripulanteId = mensagemErro.match(/tripulante_id=([^\s|]+)/)?.[1]; const nome = tripulanteId ? nomesTripulantes.get(tripulanteId) : undefined; if (mensagemErro.startsWith("limite_jornada")) { const aviso = nome ? `${nome} (${tripulanteId}) ultrapassa o limite legal. Registrar mesmo assim?` : "Um tripulante ultrapassa o limite legal. Registrar mesmo assim?"; if (window.confirm(aviso)) { try { const atualizada = await encerrarJornadaVoo(jornada.id, { horario_corte_final: corteFinal, confirmar_excedente: true }); setJornada({ ...jornada, ...atualizada, pernas: jornada.pernas }); setMensagem("Jornada encerrada com excedente confirmado."); } catch (confirmacao) { setErro(confirmacao instanceof Error ? confirmacao.message : "Não foi possível encerrar a jornada."); } } else setErro(mensagemErro); } else setErro(mensagemErro || "Não foi possível encerrar a jornada."); } finally { setSalvando(false); }
  };
  const alterarPerna = (campo: keyof PernaForm, valor: string) => setPerna((atual) => ({ ...atual, [campo]: valor }));
  const horas = (min: number) => `${Math.floor(Math.abs(min) / 60)}h${String(Math.abs(min) % 60).padStart(2, "0")}`;
  if (carregando) return <div className={box}><Loader2 className="animate-spin" size={16} /></div>;

  const nivelCabecalho = jornada?.tripulantes?.reduce<NivelAlertaJornada>((pior, tripulante) => ({ normal: 0, atencao: 1, critico: 2, excedido: 3 }[tripulante.limites.nivel_alerta] > { normal: 0, atencao: 1, critico: 2, excedido: 3 }[pior] ? tripulante.limites.nivel_alerta : pior), limites?.nivel_alerta || "normal") || "normal";
  return <section className={`${box} space-y-4`}>
    <div className={`flex items-start gap-3 rounded-xl border p-2 ${tomAlerta[nivelCabecalho]}`}><div className="rounded-xl bg-primary/15 p-2 text-primary"><Route size={18} /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Jornada de voo</h2><p className="text-[10px] text-muted-foreground">Salve os cinco horários operacionais: check-in, AC, DEP, POU e COR.</p></div>{jornada?.status === "encerrada" && <span className="ml-auto rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground">Encerrada</span>}<button type="button" onClick={aoFechar} aria-label="Fechar jornada de voo" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={16} /></button></div>
    {!jornada ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo label="Data da jornada *"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={input} /></Campo>
      <AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("origem", valor)} />
      <AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("destino", valor)} />
      <Campo label="Tripulação check-in *"><input type="time" value={apresentacao} onChange={(e) => setApresentacao(e.target.value)} className={input} /></Campo>
      <Campo label="Horário de acionamento (AC) *"><input type="time" value={acionamento} onChange={(e) => { setAcionamento(e.target.value); setApresentacao(""); }} className={input} /></Campo>
      <Campo label="Decolagem / saída (DEP) *"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo>
      <div className="sm:col-span-2 lg:col-span-4"><p className="mb-2 text-[10px] text-muted-foreground">Horários: check-in da tripulação → AC → DEP → POU → COR. Na primeira gravação informe check-in, AC e DEP; POU e COR serão registrados depois.</p><Button onClick={() => void salvarInicio()} disabled={salvando || !data || !perna.origem || !perna.destino || !apresentacao || !acionamento || !perna.horario_dep} className="gap-2 text-xs"><Save size={14} /> Salvar AC e DEP</Button></div>
    </div> : <>
      <div className="grid gap-3 text-[10px] sm:grid-cols-4"><div><span className="text-muted-foreground">Data</span><strong className="block">{dataBr(jornada.data)}</strong></div><div><span className="text-muted-foreground">Tripulação check-in</span><strong className="block">{hora(jornada.horario_apresentacao) || "—"}</strong></div><div><span className="text-muted-foreground">AC</span><strong className="block text-sky-300">{hora(jornada.horario_acionamento) || "—"}</strong></div><div><span className="text-muted-foreground">Ordem dos tempos</span><strong className="block">CHECK-IN → AC → DEP → POU → COR</strong></div></div>
      {(jornada.tripulantes ?? (limites ? [{ ...jornada, funcao_tripulante: jornada.funcao_tripulante, limites }] : [])).map((t) => <div key={t.id} className={`rounded-xl border p-3 text-[10px] ${tomAlerta[t.limites.nivel_alerta]}`}><p className="font-bold">{t.funcao_tripulante} · {nomesTripulantes.get(t.tripulante_id ?? "") || "Tripulante"}</p><p className="mt-1">Jornada {horas(t.limites.minutos_jornada)}/{horas(t.limites.limite_jornada_minutos)} · restam {horas(t.limites.restante_minutos)}</p><p>Semana {horas(t.limites.semana.minutos)}/{horas(t.limites.semana.limite)} · Mês {horas(t.limites.mes.minutos)}/{horas(t.limites.mes.limite)}</p></div>)}
      {jornada.pernas?.map((p) => <div key={p.id} className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 text-[10px] ${p.id === ultimaPerna?.id && pernaEmVoo ? "border-sky-400/40 bg-sky-400/5" : "border-[rgba(34,44,57,1)]"}`}><Plane size={13} className="text-primary" /><strong>Perna {p.numero}</strong><span>{p.origem} → {p.destino}</span><span className="text-muted-foreground">AC {hora(p.horario_ac) || "—"} · DEP {hora(p.horario_dep) || "—"} · POU {hora(p.horario_pouso) || "—"} · COR {hora(p.horario_corte) || "—"}</span><span className={`ml-auto ${p.status === "em_voo" ? "text-sky-300" : "text-emerald-300"}`}>{p.status === "em_voo" ? "Em voo" : "Pousado"}</span></div>)}
      {jornada.status !== "encerrada" && pernaEmVoo && ultimaPerna && <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-sky-200"><Clock3 size={15} /> Perna {ultimaPerna.numero} aguardando POU</div><div className="mb-4 grid gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-[10px] sm:grid-cols-4"><div><span className="text-muted-foreground">Trecho</span><strong className="block">{ultimaPerna.origem} → {ultimaPerna.destino}</strong></div><div><span className="text-muted-foreground">AC</span><strong className="block">{hora(ultimaPerna.horario_ac) || hora(jornada.horario_acionamento)}</strong></div><div><span className="text-muted-foreground">DEP</span><strong className="block">{hora(ultimaPerna.horario_dep) || "—"}</strong></div><div><span className="text-muted-foreground">Data</span><strong className="block">{dataBr(jornada.data)}</strong></div></div><div className="grid gap-3 sm:grid-cols-2"><Campo label="Pouso (POU) *"><input type="time" value={perna.horario_pouso} onChange={(e) => alterarPerna("horario_pouso", e.target.value)} className={input} /></Campo><Campo label="Corte (CORT) *"><input type="time" value={perna.horario_corte} onChange={(e) => alterarPerna("horario_corte", e.target.value)} className={input} /></Campo></div><Button onClick={() => void salvarCorte()} disabled={salvando || !perna.horario_pouso || !perna.horario_corte} className="mt-4 gap-2 text-xs"><CheckCircle2 size={14} /> Salvar POU e corte</Button></div>}
      {jornada.status !== "encerrada" && pernaCortada && !criandoPerna && <div className="flex flex-wrap gap-2 rounded-xl border border-[rgba(52,211,153,0.72)] bg-emerald-400/5 p-4"><p className="w-full text-[10px] text-emerald-200">POU e corte salvos. Escolha o próximo passo da jornada.</p><Button onClick={() => { setCriandoPerna(true); setPerna(pernaVazia()); }} className="gap-2 text-xs"><Plus size={14} /> Nova perna</Button><Button variant="outline" onClick={() => void encerrar()} disabled={salvando} className="gap-2 text-xs"><Flag size={14} /> Encerrar jornada</Button></div>}
      {jornada.status !== "encerrada" && pernaCortada && criandoPerna && <div className="rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="mb-3 text-xs font-bold">Nova perna</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><AeroportoCampo label="Aeródromo de saída *" value={perna.origem} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("origem", valor)} /><AeroportoCampo label="Aeródromo de destino *" value={perna.destino} aerodromos={opcoesAerodromos} carregando={aerodromosCarregando} onChange={(valor) => alterarPerna("destino", valor)} /><Campo label="Acionamento / AC *"><input type="time" value={perna.horario_ac} onChange={(e) => alterarPerna("horario_ac", e.target.value)} className={input} /></Campo><Campo label="Decolagem / DEP *"><input type="time" value={perna.horario_dep} onChange={(e) => alterarPerna("horario_dep", e.target.value)} className={input} /></Campo></div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => void salvarNovaPerna()} disabled={salvando || !perna.origem || !perna.destino || !perna.horario_ac || !perna.horario_dep} className="gap-2 text-xs"><Save size={14} /> Salvar nova perna</Button><Button variant="outline" onClick={() => { setCriandoPerna(false); setPerna(pernaVazia()); }} className="text-xs">Cancelar</Button></div></div>}
    </>}
    {(erro || mensagem) && <p className={`text-[10px] ${erro ? "text-red-300" : "text-emerald-300"}`}>{erro || mensagem}</p>}
  </section>;
}
