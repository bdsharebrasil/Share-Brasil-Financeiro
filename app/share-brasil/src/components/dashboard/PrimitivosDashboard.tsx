import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomesAmbiente, type Ambiente } from "@/types/navegacao";

export function IndicadorPagina({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </div>
  );
}

export function CabecalhoSecao({ icon, title, detail, action }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-primary">{icon}</span>
        <div className="min-w-0">
          <h2 className="truncate text-xs font-bold">{title}</h2>
          {detail && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function HeroDashboard({ ambiente, title, subtitle, children }: { ambiente: Ambiente; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <section className="hero-panel relative mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card">
      <div className="command-grid absolute inset-0 opacity-40" />
      <div className={cn("absolute -right-24 -top-32 h-80 w-80 rounded-full blur-3xl", ambiente === "financeiro" ? "bg-[#f1c348]/10" : ambiente === "gestor" ? "bg-primary/12" : "bg-[#2bbf8a]/10")} />
      <div className="relative flex min-h-[175px] flex-col justify-between gap-8 p-6 md:min-h-[205px] md:p-8">
        <div className="flex items-center justify-between gap-4">
          <IndicadorPagina>Dashboard {nomesAmbiente[ambiente]}</IndicadorPagina>
          <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground sm:flex"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#5bbd75]" /> Sistema operacional</span>
        </div>
        <div className="flex items-end justify-between gap-6">
          <div><p className="mb-2 text-xs font-semibold text-muted-foreground">{subtitle}</p><h1 className="text-[28px] font-extrabold tracking-[-.05em] text-foreground md:text-[38px]">{title}</h1></div>
          {children}
        </div>
      </div>
    </section>
  );
}

export type TomKpi = "blue" | "green" | "amber" | "red" | "violet";

export function CartaoKpi({ label, value, detail, tone = "blue", icon, trend }: { label: string; value: string; detail: string; tone?: TomKpi; icon: ReactNode; trend?: string }) {
  const styles: Record<TomKpi, string> = { blue: "text-primary bg-primary/10", green: "text-[#6bd188] bg-[#5bbd75]/10", amber: "text-[#f4cc64] bg-[#f1c348]/10", red: "text-[#ed8c90] bg-[#e77b80]/10", violet: "text-[#b397ff] bg-[#8d6be8]/10" };
  return <div className="group rounded-xl border border-border bg-card/80 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/35"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span><span className={cn("rounded-lg p-2", styles[tone])}>{icon}</span></div><div className="mt-4 flex items-end justify-between gap-3"><strong className="font-mono text-[23px] font-medium tracking-[-.05em]">{value}</strong>{trend && <span className={cn("mb-1 flex items-center gap-0.5 text-[9px] font-bold", trend.startsWith("+") ? "text-[#6bd188]" : "text-[#ed8c90]")}>{trend.startsWith("+") ? <ArrowDownRight size={11} className="rotate-180" /> : <ArrowDownRight size={11} />}{trend}</span>}</div><p className="mt-1 text-[10px] leading-snug text-muted-foreground">{detail}</p></div>;
}

export function AcaoRapida({ icon, label, detail, color = "blue", onClick }: { icon: ReactNode; label: string; detail: string; color?: "blue" | "green" | "amber" | "violet"; onClick: () => void }) {
  const colors = { blue: "text-primary bg-primary/10", green: "text-[#6bd188] bg-[#5bbd75]/10", amber: "text-[#f4cc64] bg-[#f1c348]/10", violet: "text-[#b397ff] bg-[#8d6be8]/10" };
  return <button type="button" onClick={onClick} className="group flex min-h-[100px] flex-col justify-between rounded-xl border border-border bg-card/65 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[.04]"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", colors[color])}>{icon}</span><span><span className="flex items-center justify-between gap-2 text-[11px] font-bold"><span>{label}</span><ArrowRight size={12} className="text-muted-foreground transition-transform group-hover:translate-x-1" /></span><span className="mt-1 block text-[9px] text-muted-foreground">{detail}</span></span></button>;
}

export function BarraProgresso({ value, color = "blue" }: { value: number; color?: "blue" | "green" | "amber" | "red" }) {
  const colors = { blue: "bg-primary", green: "bg-[#5bbd75]", amber: "bg-[#f1c348]", red: "bg-[#e77b80]" };
  return <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full transition-all", colors[color])} style={{ width: `${value}%` }} /></div>;
}

export function EtiquetaStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  const styles = { green: "bg-[#5bbd75]/12 text-[#6bd188]", amber: "bg-[#f1c348]/14 text-[#f4cc64]", red: "bg-[#e77b80]/12 text-[#ed8c90]", blue: "bg-primary/12 text-primary", neutral: "bg-secondary text-muted-foreground" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.07em]", styles[tone])}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

export function EstadoVazio({ label = "Nenhum registro encontrado" }: { label?: string }) {
  return <div className="flex flex-col items-center justify-center py-12 text-center"><div className="mb-3 rounded-xl bg-secondary p-3 text-muted-foreground"><FileText size={21} /></div><p className="text-xs font-bold">{label}</p><p className="mt-1 max-w-xs text-[11px] text-muted-foreground">Os dados aparecerão aqui assim que forem registrados no sistema.</p></div>;
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
}
