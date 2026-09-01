import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Award, Briefcase, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileText, Mail, PencilLine, Phone, Plane, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { atualizarHabilitacaoTripulante, atualizarTripulante, buscarGestaoTripulacao, buscarHorasTripulacao, buscarPainelAgendamento, criarHabilitacaoTripulante, type EscalaAgendamento, type HabilitacaoTripulante, type HoraTripulacao, type TripulanteGestao } from "@/lib/colaborador-api";

const DEFAULT_AVATAR = "/icon.pilot.png";

const field = "h-10 rounded-lg border-border/70 bg-background/70 text-sm";

function formatHours(value: number) { return `${Number(value || 0).toFixed(1).replace(".", ",")} h`; }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function isActive(status: string | null) { return (status || "ativo").toLowerCase() === "ativo"; }
function diasParaVencer(value: string | null | undefined) { if (!value) return null; const days = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86_400_000); return Number.isFinite(days) ? days : null; }
function dueLabel(value: string | null | undefined) { const days = diasParaVencer(value); if (days == null) return "Sem validade"; if (days < 0) return "Vencido"; if (days <= 30) return `Vence em ${days} dias`; return `Válido até ${new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")}`; }
function dueTone(value: string | null | undefined) { const days = diasParaVencer(value); if (days == null) return "border-border bg-background/40"; return days! < 0 ? "border-red-400/40 bg-red-400/10" : days! <= 30 ? "border-amber-300/40 bg-amber-300/10" : "border-emerald-400/35 bg-emerald-400/[.07]"; }
export type HabSituacao = "vencida" | "atencao" | "regular" | "vazia";
export function situacaoHabilitacoes(habs: HabilitacaoTripulante[]): HabSituacao {
  if (!habs.length) return "vazia";
  let situacao: HabSituacao = "regular";
  for (const item of habs) {
    for (const date of [item.data_validade, item.validade_cma]) {
      const days = diasParaVencer(date);
      if (days == null) continue;
      if (days < 0) return "vencida";
      if (days <= 30) situacao = "atencao";
    }
  }
  return situacao;
}

type VooRegistro = { id: string; data_registro: string; matricula_registro: string | null; pic_canac: string | null; pic_nome: string | null; sic_canac: string | null; sic_nome: string | null; tempo_voo: number; horas_diurnas: number; horas_noturnas: number; tempo_ifr: number };

export function CrewCard({ crew, situacao, onClick }: { crew: TripulanteGestao; situacao: HabSituacao; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group relative flex min-h-[210px] flex-col rounded-2xl border border-border/70 bg-card/80 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <Avatar className="h-14 w-14 rounded-xl border border-border/70 bg-muted/40">
          <AvatarImage src={crew.url_avatar || DEFAULT_AVATAR} className="rounded-xl object-cover" onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }} />
          <AvatarFallback className="rounded-xl bg-muted/40 text-muted-foreground"><UserRound size={22} /></AvatarFallback>
        </Avatar>
        <ChevronRight size={18} className="text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="mt-4 min-w-0">
        <p className="truncate text-sm font-extrabold uppercase tracking-wide">{crew.nome_completo}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-muted-foreground">CANAC <span className="font-bold text-foreground">{crew.canac || "—"}</span></p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {crew.tipo_licenca && <span className="text-[10px] font-semibold text-muted-foreground">{crew.tipo_licenca}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <HabSituacaoBadge situacao={situacao} />
        <Status status={crew.status} />
      </div>
    </button>
  );
}

function HabSituacaoBadge({ situacao }: { situacao: HabSituacao }) {
  if (situacao === "vencida") return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-400"><AlertTriangle size={13} /> Habilitação vencida</span>;
  if (situacao === "atencao") return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300"><AlertTriangle size={13} /> Vence em breve</span>;
  if (situacao === "vazia") return <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"><FileText size={13} /> Sem habilitações</span>;
  return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400"><ShieldCheck size={13} /> Documentação regular</span>;
}

type ProfileTab = "perfil" | "horas" | "habilitacoes" | "escala";

export function CrewProfile({ crew, habilitations, onBack, onChanged }: { crew: TripulanteGestao; habilitations: HabilitacaoTripulante[]; onBack: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<ProfileTab>("perfil");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [edit, setEdit] = useState({ nome_completo: crew.nome_completo, canac: crew.canac, tipo_licenca: crew.tipo_licenca || "", status: crew.status || "ativo" });

  const saveProfile = async () => {
    setSaving(true); setError(null); setOk(null);
    try { await atualizarTripulante(crew.id, edit); setOk("Perfil atualizado."); setEditing(false); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o perfil."); }
    finally { setSaving(false); }
  };

  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: "perfil", label: "Perfil" },
    { id: "horas", label: "Horas de voo" },
    { id: "habilitacoes", label: "Habilitações" },
    { id: "escala", label: "Escala" },
  ];

  return (
    <div className="route-enter space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"><ArrowLeft size={15} /> Voltar para tripulação</button>
      {error && <Notice error>{error}</Notice>}
      {ok && <Notice>{ok}</Notice>}

      <section className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 border-b border-border/60 p-5">
          <Avatar className="h-16 w-16 rounded-2xl border border-border/70 bg-muted/40">
            <AvatarImage src={crew.url_avatar || DEFAULT_AVATAR} className="rounded-2xl object-cover" onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }} />
            <AvatarFallback className="rounded-2xl bg-muted/40 text-lg font-extrabold text-muted-foreground">{initials(crew.nome_completo)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold uppercase tracking-tight">{crew.nome_completo}</h1>
              <Status status={crew.status} />
            </div>
            <p className="mt-1.5 text-[11px] uppercase tracking-[.12em] text-muted-foreground">CANAC <span className="font-bold text-foreground">{crew.canac || "—"}</span>{crew.tipo_licenca ? <span className="ml-3 normal-case tracking-normal">{crew.tipo_licenca}</span> : null}</p>
          </div>
          <Button type="button" variant={editing ? "default" : "outline"} onClick={() => { setEditing((open) => !open); setTab("perfil"); }} className="h-9 gap-2 text-xs"><PencilLine size={14} /> {editing ? "Fechar edição" : "Editar perfil"}</Button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-4">
          {tabs.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${tab === item.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>{item.label}</button>
          ))}
        </div>
      </section>

      {tab === "perfil" && (
        <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
          <h2 className="text-base font-extrabold">Dados pessoais</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField icon={<FileText size={14} />} label="Código ANAC" value={crew.canac} mono />
            <InfoField icon={<Award size={14} />} label="Tipo de licença" value={crew.tipo_licenca} />
            <InfoField icon={<Users size={14} />} label="Departamento" value={crew.departamento} />
            <InfoField icon={<Mail size={14} />} label="E-mail" value={crew.email} />
            <InfoField icon={<Phone size={14} />} label="Telefone" value={crew.telefone} />
            <InfoField icon={<CheckCircle2 size={14} />} label="Status" value={isActive(crew.status) ? "Ativo" : crew.status || "Inativo"} />
          </div>

          {editing && (
            <div className="mt-5 rounded-xl border border-primary/25 bg-primary/[.06] p-4">
              <p className="text-xs font-extrabold">Editar dados do perfil</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input value={edit.nome_completo} onChange={(e) => setEdit({ ...edit, nome_completo: e.target.value })} placeholder="Nome completo" className={field} />
                <Input value={edit.canac} onChange={(e) => setEdit({ ...edit, canac: e.target.value })} placeholder="Código ANAC" className={field} />
                <Input value={edit.tipo_licenca} onChange={(e) => setEdit({ ...edit, tipo_licenca: e.target.value })} placeholder="Tipo de licença" className={field} />
                <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={`${field} px-3`}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select>
              </div>
              <Button type="button" onClick={() => void saveProfile()} disabled={saving} className="mt-4 h-9 text-xs">{saving ? "Salvando..." : "Salvar perfil"}</Button>
            </div>
          )}
        </section>
      )}

      {tab === "horas" && <FlightHoursTab crew={crew} />}

      {tab === "habilitacoes" && <HabilitacoesTab crew={crew} habilitations={habilitations} onChanged={onChanged} onError={setError} onOk={setOk} />}

      {tab === "escala" && <EscalaTripulanteTab crew={crew} />}
    </div>
  );
}

function InfoField({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{icon}{label}</p>
      <p className={`mt-1.5 text-sm font-bold ${value ? "" : "italic font-medium text-muted-foreground"} ${mono ? "font-mono tracking-wide" : ""}`}>{value || "Não informado"}</p>
    </div>
  );
}

function FlightHoursTab({ crew }: { crew: TripulanteGestao }) {
  const [consultaTipo, setConsultaTipo] = useState<"mes" | "personalizado">("mes");
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [voos, setVoos] = useState<VooRegistro[]>([]);
  const [totais, setTotais] = useState<HoraTripulacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (consultaTipo === "personalizado") {
      if (!inicio || !fim) {
        setVoos([]);
        setTotais([]);
        setLoading(false);
        setError("Selecione a data inicial e final para filtrar o período.");
        return;
      }

      if (new Date(inicio) > new Date(fim)) {
        setVoos([]);
        setTotais([]);
        setLoading(false);
        setError("A data inicial não pode ser maior que a data final.");
        return;
      }
    }

    setLoading(true); setError(null);
    const params = consultaTipo === "mes" ? { mes } : { inicio, fim };

    void buscarHorasTripulacao(params)
      .then((result) => { setVoos((result.voos || []) as VooRegistro[]); setTotais(result.totais || []); })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as horas de voo."))
      .finally(() => setLoading(false));
  }, [mes, consultaTipo, inicio, fim]);

  const meusVoos = useMemo(() => voos.filter((voo) => voo.pic_canac === crew.canac || voo.sic_canac === crew.canac), [voos, crew.canac]);
  const porAeronave = useMemo(() => {
    const map = new Map<string, { matricula: string; voos: number; horas: number; diurnas: number; noturnas: number; ifr: number }>();
    for (const voo of meusVoos) {
      const matricula = voo.matricula_registro || "Sem matrícula";
      const atual = map.get(matricula) || { matricula, voos: 0, horas: 0, diurnas: 0, noturnas: 0, ifr: 0 };
      atual.voos += 1; atual.horas += voo.tempo_voo || 0; atual.diurnas += voo.horas_diurnas || 0; atual.noturnas += voo.horas_noturnas || 0; atual.ifr += voo.tempo_ifr || 0;
      map.set(matricula, atual);
    }
    return [...map.values()].sort((a, b) => b.horas - a.horas);
  }, [meusVoos]);
  const consolidado = useMemo(() => totais.filter((item) => item.canac === crew.canac), [totais, crew.canac]);
  const totalMes = useMemo(() => meusVoos.reduce((acc, voo) => acc + (voo.tempo_voo || 0), 0), [meusVoos]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock3 size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-extrabold">Horas de voo</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Consulta por mês/ano ou período personalizado.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={consultaTipo} onChange={(e) => setConsultaTipo(e.target.value as "mes" | "personalizado")} className="h-9 rounded-lg border border-border/70 bg-background/70 px-2 text-[10px] font-medium">
            <option value="mes">Mês e ano</option>
            <option value="personalizado">Período personalizado</option>
          </select>
          {consultaTipo === "mes" ? (
            <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
              <span>Mês</span>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-[150px] rounded-lg border-border/70 bg-background/70 text-xs" />
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                <span>Início</span>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-[140px] rounded-lg border-border/70 bg-background/70 text-xs" />
              </label>
              <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                <span>Fim</span>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-[140px] rounded-lg border-border/70 bg-background/70 text-xs" />
              </label>
            </>
          )}
        </div>
      </div>

      {error && <Notice error>{error}</Notice>}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card/75 p-6 text-xs text-muted-foreground shadow-sm">Carregando horas de voo...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 shadow-sm sm:grid-cols-4">
            <Metric label="Horas no mês" value={formatHours(totalMes)} />
            <Metric label="Voos" value={String(meusVoos.length)} />
            <Metric label="PIC" value={formatHours(consolidado.find((i) => i.funcao === "PIC")?.horas_pic || 0)} />
            <Metric label="SIC" value={formatHours(consolidado.find((i) => i.funcao === "SIC")?.horas_sic || 0)} />
          </div>

          {porAeronave.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {porAeronave.map((item) => (
                <div key={item.matricula} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plane size={16} /></span>
                      <div>
                        <p className="font-mono text-sm font-extrabold tracking-wide">{item.matricula}</p>
                        <p className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">{item.voos} voo(s) no mês</p>
                      </div>
                    </div>
                    <p className="text-lg font-extrabold text-primary">{formatHours(item.horas)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                    <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">Diurnas</p><p className="mt-0.5 text-xs font-bold">{formatHours(item.diurnas)}</p></div>
                    <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">Noturnas</p><p className="mt-0.5 text-xs font-bold">{formatHours(item.noturnas)}</p></div>
                    <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-muted-foreground">IFR</p><p className="mt-0.5 text-xs font-bold">{formatHours(item.ifr)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-card/80 p-8 text-center shadow-sm">
              <Plane size={20} className="mx-auto text-primary" />
              <p className="mt-3 text-sm font-bold">Nenhum voo registrado no período</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Selecione outro mês para consultar o histórico.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function HabilitacoesTab({ crew, habilitations, onChanged, onError, onOk }: { crew: TripulanteGestao; habilitations: HabilitacaoTripulante[]; onChanged: () => void; onError: (msg: string | null) => void; onOk: (msg: string | null) => void }) {
  const [newHab, setNewHab] = useState({ tipo_habilitacao: "", data_validade: "", classe_cma: "", validade_cma: "", fs_rh: "" });
  const [formOpen, setFormOpen] = useState(false);

  const saveHabilitation = async (id: string, payload: Record<string, string | null>) => {
    try { await atualizarHabilitacaoTripulante(id, payload); onOk("Habilitação atualizada."); onChanged(); }
    catch (e) { onError(e instanceof Error ? e.message : "Não foi possível atualizar a habilitação."); }
  };
  const addHabilitation = async () => {
    if (!newHab.tipo_habilitacao.trim()) return onError("Informe o tipo da habilitação.");
    try { await criarHabilitacaoTripulante(crew.id, newHab); setNewHab({ tipo_habilitacao: "", data_validade: "", classe_cma: "", validade_cma: "", fs_rh: "" }); setFormOpen(false); onOk("Habilitação adicionada."); onChanged(); }
    catch (e) { onError(e instanceof Error ? e.message : "Não foi possível adicionar a habilitação."); }
  };

  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-primary" />
          <div>
            <h2 className="text-base font-extrabold">Habilitações</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Documentos e vencimentos do tripulante.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{habilitations.length}</span>
          <Button type="button" variant="outline" onClick={() => setFormOpen((open) => !open)} className="h-9 gap-2 text-xs"><Plus size={14} /> Nova habilitação</Button>
        </div>
      </div>

      {formOpen && (
        <div className="mt-5 rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-extrabold">Adicionar habilitação</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input value={newHab.tipo_habilitacao} onChange={(e) => setNewHab({ ...newHab, tipo_habilitacao: e.target.value })} placeholder="Tipo de habilitação" className={field} />
            <Input value={newHab.classe_cma} onChange={(e) => setNewHab({ ...newHab, classe_cma: e.target.value })} placeholder="Classe CMA" className={field} />
            <Input type="date" value={newHab.data_validade} onChange={(e) => setNewHab({ ...newHab, data_validade: e.target.value })} className={field} />
            <Input type="date" value={newHab.validade_cma} onChange={(e) => setNewHab({ ...newHab, validade_cma: e.target.value })} className={field} />
          </div>
          <Button type="button" variant="outline" onClick={() => void addHabilitation()} className="mt-3 h-9 gap-2 text-xs"><Plus size={14} /> Salvar habilitação</Button>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {habilitations.length ? habilitations.map((item) => <HabilitationCard key={item.id} item={item} onSave={(id, payload) => void saveHabilitation(id, payload)} />) : <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground md:col-span-2">Nenhuma habilitação cadastrada.</p>}
      </div>
    </section>
  );
}

function EscalaTripulanteTab({ crew }: { crew: TripulanteGestao }) {
  const [escala, setEscala] = useState<EscalaAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await buscarPainelAgendamento("2000-01-01", "2099-12-31");
        if (!active) return;
        const meusVoos = (result.escala || []).filter((item) => item.piloto_id === crew.id || item.copiloto_id === crew.id);
        setEscala(meusVoos);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Não foi possível carregar a escala do tripulante.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [crew.id]);

  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-primary" />
        <div>
          <h2 className="text-base font-extrabold">Escala de voo</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Voos agendados diretamente na escala do agendamento.</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}

      {loading ? (
        <div className="mt-4 rounded-xl border border-border bg-card/75 p-6 text-xs text-muted-foreground">Carregando escala...</div>
      ) : escala.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {escala.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{item.numero_voo || "Voo sem número"}</p>
                  <p className="mt-1 font-mono text-sm font-extrabold">{item.origem} → {item.destino}</p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-primary">{item.piloto_id === crew.id ? "PIC" : "SIC"}</span>
              </div>
              <div className="mt-3 grid gap-2 text-[10px] text-muted-foreground sm:grid-cols-2">
                <div><span className="font-bold uppercase tracking-[.12em] text-foreground">Início</span><p className="mt-1">{new Date(`${item.data_agendada}T12:00:00`).toLocaleDateString("pt-BR")}</p></div>
                <div><span className="font-bold uppercase tracking-[.12em] text-foreground">Fim</span><p className="mt-1">{new Date(`${item.data_fim || item.data_agendada}T12:00:00`).toLocaleDateString("pt-BR")}</p></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          <CalendarDays size={18} className="mx-auto text-primary" />
          <p className="mt-3 text-sm font-bold">Nenhum voo agendado</p>
          <p className="mt-1">Este tripulante ainda não está escalado em nenhum agendamento.</p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-card px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 text-base font-extrabold">{value}</p></div>; }

function HabilitationCard({ item, onSave }: { item: HabilitacaoTripulante; onSave: (id: string, payload: Record<string, string | null>) => void }) {
  const [validity, setValidity] = useState(item.data_validade || "");
  const [cmaValidity, setCmaValidity] = useState(item.validade_cma || "");
  const reference = item.data_validade || item.validade_cma;
  return (
    <div className={`rounded-xl border p-4 ${dueTone(reference)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold">{item.tipo_habilitacao}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{item.classe_cma ? `CMA ${item.classe_cma} · ` : ""}{dueLabel(reference)}</p>
        </div>
        {reference && (diasParaVencer(reference)! < 0 ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input type="date" value={validity} onChange={(e) => setValidity(e.target.value)} className="h-8 w-[142px] text-[10px]" />
        <Input type="date" value={cmaValidity} onChange={(e) => setCmaValidity(e.target.value)} className="h-8 w-[142px] text-[10px]" />
        <Button type="button" variant="outline" onClick={() => onSave(item.id, { data_validade: validity || null, validade_cma: cmaValidity || null })} className="h-8 text-[10px]">Atualizar</Button>
      </div>
    </div>
  );
}

function Status({ status }: { status: string | null }) {
  const active = isActive(status);
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold ${active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border bg-muted text-muted-foreground"}`}>{active && <CheckCircle2 size={11} />}{active ? "Ativo" : status || "Inativo"}</span>;
}

function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={`rounded-xl border p-3 text-xs ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{children}</p>;
}
