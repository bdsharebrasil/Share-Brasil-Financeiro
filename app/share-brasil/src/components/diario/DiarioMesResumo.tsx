import { CalendarDays, CheckCircle2, Gauge, LockKeyhole, Plane, Timer, UnlockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import type { DiarioLancamento, DiarioMes } from "@/lib/colaborador-api";
import { EtiquetaStatus } from "@/components/dashboard/PrimitivosDashboard";

function decimal(value: number | null | undefined, digits = 1) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function horas(value: number | null | undefined) {
  const total = Math.max(0, Number(value || 0));
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default function DiarioMesResumo({ diario, lancamentos, horasCotistas = [], horasEmprestadas = { horas_total: 0, quantidade: 0 }, onEdit, onToggleClosed }: { diario: DiarioMes; lancamentos: DiarioLancamento[]; horasCotistas?: Array<{ cotista_id: string | null; cotista_nome: string; horas_voo: number }>; horasEmprestadas?: { horas_total: number; quantidade: number }; onEdit: () => void; onToggleClosed: () => void }) {
  const tempoVoo = lancamentos.reduce((total, item) => total + Number(item.tempo_voo || 0), 0);
  const tempoTotal = lancamentos.reduce((total, item) => total + Number(item.tempo_total || 0), 0);
  const pousos = lancamentos.reduce((total, item) => total + Number(item.pousos_total || 0), 0);
  const consumo = lancamentos.reduce((total, item) => total + Number(item.litros_combustivel_abastecido || 0), 0);
  const mesLabel = new Date(diario.ano, diario.mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><CalendarDays size={13} /> Diário {mesLabel} {diario.ano}</p><p className="mt-1 text-[11px] text-muted-foreground">Base {diario.aerodromo_base || "não informada"} · {diario.tem_tarifa_diaria ? "Tarifa diária ativa" : "Sem tarifa diária"}</p></div><div className="flex items-center gap-2"><EtiquetaStatus tone={diario.fechado ? "amber" : "green"}>{diario.fechado ? "Fechado" : "Aberto"}</EtiquetaStatus><button type="button" onClick={onEdit} className="rounded-lg border border-border px-3 py-2 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">Editar parâmetros</button><button type="button" onClick={onToggleClosed} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold transition-colors ${diario.fechado ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10" : "border-amber-400/30 text-amber-300 hover:bg-amber-400/10"}`}>{diario.fechado ? <UnlockKeyhole size={12} /> : <LockKeyhole size={12} />}{diario.fechado ? "Reabrir" : "Fechar mês"}</button></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Plane size={14} />} label="Voos registrados" value={String(lancamentos.length)} detail={`${pousos} pousos · ${decimal(consumo)} L abastecidos`} /><Metric icon={<Timer size={14} />} label="Tempo de voo" value={`${decimal(tempoVoo)}h`} detail={`Total registrado ${decimal(tempoTotal)}h`} tone="green" /><Metric icon={<Gauge size={14} />} label="Célula atual" value={`${decimal(diario.celula_atual_ttotal)}h`} detail={diario.celula_prox_revisao_ttotal ? `${decimal(diario.celula_disponivel_ttotal)}h até a revisão` : "Revisão não informada"} tone="violet" /><Metric icon={<CheckCircle2 size={14} />} label="Horímetro ativo" value={horas(diario.horimetro_ativo)} detail={`Início ${decimal(diario.horimetro_inicio)}h · fim ${decimal(diario.horimetro_final)}h`} tone="amber" /></div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="rounded-xl border border-border bg-card/75 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">Horas voadas por cotista</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{horasCotistas.length ? horasCotistas.map((item) => <div key={item.cotista_id || item.cotista_nome} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2"><span className="truncate text-[10px] font-semibold">{item.cotista_nome}</span><span className="font-mono text-[11px] font-bold text-primary">{decimal(item.horas_voo, 2)}h</span></div>) : <p className="text-[10px] text-muted-foreground">Ainda não há horas vinculadas a cotistas.</p>}</div></div><Metric icon={<Plane size={14} />} label="Horas emprestadas" value={`${decimal(horasEmprestadas.horas_total, 2)}h`} detail={`${horasEmprestadas.quantidade} empréstimo(s) na competência`} tone="amber" /></div>
    </section>
  );
}

function Metric({ icon, label, value, detail, tone = "blue" }: { icon: ReactNode; label: string; value: string; detail: string; tone?: "blue" | "green" | "amber" | "violet" }) {
  const colors = { blue: "text-primary bg-primary/10 border-primary/20", green: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20", amber: "text-amber-300 bg-amber-400/10 border-amber-400/20", violet: "text-violet-300 bg-violet-400/10 border-violet-400/20" };
  return <div className="rounded-xl border border-border bg-card/75 p-4"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span><span className={`rounded-lg border p-2 ${colors[tone]}`}>{icon}</span></div><p className="mt-3 font-mono text-xl font-bold tracking-[-.04em]">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>;
}
