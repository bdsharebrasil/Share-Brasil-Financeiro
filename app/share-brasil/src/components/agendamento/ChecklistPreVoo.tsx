import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, FileCheck2, Fuel, Loader2, Plane, Save, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enviarComandaAbastecimento, salvarChecklistPreVoo, type SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { SECOES_CHECKLIST, type RespostasChecklist } from "./checklistStructure";

const card = "rounded-2xl border border-border/70 bg-card/80 shadow-sm";
const rascunhoKey = (id: string) => `share-prevoo-${id}`;
const respostasVazias: RespostasChecklist = {};

function dataVoo(valor?: string | null) {
  if (!valor) return "Data não informada";
  return new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ChecklistPreVoo({ item }: { item: SolicitacaoVooInterna }) {
  const [aberto, setAberto] = useState(false);
  const [respostas, setRespostas] = useState<RespostasChecklist>(respostasVazias);
  const [secaoAberta, setSecaoAberta] = useState(SECOES_CHECKLIST[0].id);
  const [litros, setLitros] = useState("");
  const [local, setLocal] = useState(item.origem || "");
  const [comanda, setComanda] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const itens = useMemo(() => SECOES_CHECKLIST.flatMap((secao) => secao.itens), []);
  const respondidos = itens.filter((itemChecklist) => respostas[itemChecklist.id]?.status).length;
  const feitos = itens.filter((itemChecklist) => respostas[itemChecklist.id]?.status === "feito").length;
  const alertas = itens.filter((itemChecklist) => respostas[itemChecklist.id]?.status === "alerta").length;
  const progresso = itens.length ? Math.round((respondidos / itens.length) * 100) : 0;
  const completo = respondidos === itens.length && alertas === 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(rascunhoKey(item.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as { respostas?: RespostasChecklist; observacoes?: string; litros?: string; local?: string; comanda?: string };
      setRespostas(draft.respostas || respostasVazias);
      setObservacoes(draft.observacoes || "");
      setLitros(draft.litros || "");
      setLocal(draft.local || item.origem || "");
      setComanda(draft.comanda || "");
    } catch { /* rascunho inválido é ignorado */ }
  }, [item.id, item.origem]);

  useEffect(() => {
    if (!aberto) return;
    const timer = window.setTimeout(() => localStorage.setItem(rascunhoKey(item.id), JSON.stringify({ respostas, observacoes, litros, local, comanda })), 350);
    return () => window.clearTimeout(timer);
  }, [aberto, item.id, respostas, observacoes, litros, local, comanda]);

  const marcar = (id: string, status: "feito" | "alerta" | "nao_feito") => {
    setRespostas((atual) => ({ ...atual, [id]: { status, observacao: atual[id]?.observacao } }));
  };

  const salvar = async (concluir: boolean) => {
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const result = await salvarChecklistPreVoo(item.id, {
        itens: respostas,
        observacoes,
        status: concluir ? "concluido" : "rascunho",
        abastecimento: Number(litros) > 0 ? { litros: Number(litros), local, numero_comanda: comanda } : undefined,
      });
      if (arquivo && result.abastecimento_id) await enviarComandaAbastecimento(result.abastecimento_id, arquivo);
      if (concluir) localStorage.removeItem(rascunhoKey(item.id));
      setMensagem(concluir ? "Checklist concluído e enviado para a operação." : "Rascunho salvo com segurança.");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível salvar o checklist.");
    } finally { setSalvando(false); }
  };

  return <section className={`${card} overflow-hidden border-primary/25`}>
    <div className="relative overflow-hidden bg-gradient-to-br from-primary/[.12] via-transparent to-emerald-500/[.06] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl border border-primary/30 bg-primary/15 p-2.5 text-primary"><ClipboardCheck size={21} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-primary">Preparação operacional</span>{completo && <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400"><ShieldCheck size={11} /> Completo</span>}</div><h2 className="mt-2 text-base font-extrabold tracking-tight sm:text-lg">Checklist pré-voo</h2><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Plane size={12} className="text-primary" /> {item.numero_voo || "Voo aprovado"}</span><span>{item.origem} → {item.destino}</span><span className="inline-flex items-center gap-1"><Clock3 size={11} /> {dataVoo(item.data_agendada)}</span></div></div></div>
        <div className="flex items-center gap-3 lg:min-w-[280px]"><div className="relative h-14 w-14 shrink-0 rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${progresso}%, hsl(var(--muted)) ${progresso}%)` }}><div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-card"><strong className="text-sm">{progresso}%</strong><span className="text-[7px] uppercase text-muted-foreground">feito</span></div></div><div className="min-w-0 flex-1"><div className="flex justify-between text-[10px] font-semibold"><span>{respondidos} de {itens.length} itens</span><span className="text-emerald-400">{feitos} OK</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progresso}%` }} /></div>{alertas > 0 && <p className="mt-1 text-[9px] text-amber-400">{alertas} item(ns) com alerta</p>}</div></div>
      </div>
      <Button type="button" variant={aberto ? "default" : "outline"} onClick={() => setAberto((valor) => !valor)} className="mt-4 h-9 w-full gap-2 text-[10px] sm:w-auto">{aberto ? "Fechar checklist" : "Abrir checklist"}<ChevronDown size={14} className={aberto ? "rotate-180" : ""} /></Button>
    </div>
    {aberto && <div className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-border/60 bg-secondary/20 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-1 text-xs font-bold">{completo ? "Pronto para voo" : "Em preparação"}</p></div><div className="rounded-xl border border-border/60 bg-secondary/20 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Conferidos</p><p className="mt-1 text-xs font-bold text-emerald-400">{feitos} itens</p></div><div className="rounded-xl border border-border/60 bg-secondary/20 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Pendentes</p><p className="mt-1 text-xs font-bold text-amber-400">{itens.length - respondidos} itens</p></div></div>
      <div className="space-y-2">{SECOES_CHECKLIST.map((secao) => { const ab = secaoAberta === secao.id; const respondidosSecao = secao.itens.filter((itemChecklist) => respostas[itemChecklist.id]?.status).length; return <div key={secao.id} className="overflow-hidden rounded-xl border border-border/70"><button type="button" onClick={() => setSecaoAberta(ab ? "" : secao.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-secondary/30"><span className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileCheck2 size={14} /></span><span className="min-w-0"><strong className="block truncate text-xs">{secao.titulo}</strong><small className="block truncate text-[9px] text-muted-foreground">{secao.subtitulo}</small></span></span><span className="flex shrink-0 items-center gap-2 text-[9px] text-muted-foreground">{respondidosSecao}/{secao.itens.length}<ChevronDown size={14} className={ab ? "rotate-180" : ""} /></span></button>{ab && <div className="grid gap-2 border-t border-border/60 bg-secondary/[.12] p-3">{secao.itens.map((itemChecklist) => { const resposta = respostas[itemChecklist.id]; return <div key={itemChecklist.id} className="rounded-xl border border-border/60 bg-background/35 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="flex min-w-0 items-start gap-2 text-[11px] leading-4"><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${resposta?.status === "feito" ? "bg-emerald-400" : resposta?.status === "alerta" ? "bg-amber-400" : resposta?.status === "nao_feito" ? "bg-red-400" : "bg-muted-foreground/30"}`} />{itemChecklist.label}</span><div className="flex shrink-0 gap-1"><button type="button" onClick={() => marcar(itemChecklist.id, "feito")} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold transition ${resposta?.status === "feito" ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-border text-muted-foreground hover:bg-emerald-400/10"}`}><Check size={12} /> OK</button><button type="button" onClick={() => marcar(itemChecklist.id, "alerta")} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold transition ${resposta?.status === "alerta" ? "border-amber-400/50 bg-amber-400/15 text-amber-300" : "border-border text-muted-foreground hover:bg-amber-400/10"}`}><AlertTriangle size={12} /> Alerta</button><button type="button" onClick={() => marcar(itemChecklist.id, "nao_feito")} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold transition ${resposta?.status === "nao_feito" ? "border-red-400/50 bg-red-400/15 text-red-300" : "border-border text-muted-foreground hover:bg-red-400/10"}`}><X size={12} /> Não</button></div></div></div>; })}</div>}</div>; })}</div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-xl border border-border/70 bg-secondary/[.12] p-4"><div className="mb-3 flex items-center gap-2"><Fuel size={15} className="text-primary" /><div><h3 className="text-xs font-bold">Abastecimento</h3><p className="text-[9px] text-muted-foreground">A comanda fica pendente para o financeiro completar.</p></div></div><div className="grid gap-2 sm:grid-cols-2"><input type="number" min="0" step="0.01" value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="Litros abastecidos" className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary" /><input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local do abastecimento" className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary" /><input value={comanda} onChange={(e) => setComanda(e.target.value)} placeholder="Número da comanda" className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary sm:col-span-2" /><input type="file" accept="image/*,.pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="text-[10px] text-muted-foreground sm:col-span-2" /></div></div><div className="rounded-xl border border-border/70 bg-secondary/[.12] p-4"><label className="text-[10px] font-bold">Observações operacionais</label><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Registre alertas, discrepâncias ou informações relevantes..." className="mt-2 min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3 text-xs outline-none focus:border-primary" /></div></div>
      {(mensagem || erro) && <div className={`rounded-xl border p-3 text-[10px] ${erro ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{erro || mensagem}</div>}
      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => void salvar(false)} disabled={salvando} className="h-9 gap-2 text-[10px]"><Save size={13} /> Salvar rascunho</Button><Button type="button" onClick={() => void salvar(true)} disabled={salvando || !completo} className="h-9 gap-2 text-[10px]">{salvando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Concluir checklist</Button></div>
    </div>}
  </section>;
}
