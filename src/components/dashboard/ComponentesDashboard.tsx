import type { ReactNode } from "react";
import aviationHero from "@/assets/aviation-hero.jpg";
import { ArrowDownRight, ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomesAmbiente, type Ambiente } from "@/types/navegacao";

export function IndicadorPagina({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-primary sm:mb-3 sm:gap-2.5 sm:text-[11px] sm:tracking-[.16em]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="truncate">{children}</span>
    </div>
  );
}

export function CabecalhoSecao({ icon, title, detail, action }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:px-4 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-primary">{icon}</span>
        <div className="min-w-0">
          <h2 className="truncate text-xs font-bold">{title}</h2>
          {detail && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <div className="w-full min-w-0 sm:w-auto">{action}</div>
    </div>
  );
}

export function HeroDashboard({ ambiente, title, subtitle, children }: { ambiente: Ambiente; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="hero-panel relative mb-5 overflow-hidden rounded-xl border border-white/10 bg-[#111b29] shadow-[0_18px_55px_rgba(0,0,0,.22)] sm:mb-6 sm:rounded-2xl">
      <img src={aviationHero} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,12,22,.94)_0%,rgba(5,12,22,.68)_38%,rgba(5,12,22,.22)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,12,22,.55)_0%,transparent_58%)]" />
      <div className="relative flex min-h-[150px] flex-col justify-between gap-5 p-4 sm:min-h-[175px] sm:gap-8 sm:p-6 md:min-h-[205px] md:p-8">
        <div className="flex items-center justify-between gap-4">
          <IndicadorPagina>Dashboard {nomesAmbiente[ambiente]}</IndicadorPagina>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            {subtitle && <p className="mb-1.5 truncate text-[11px] font-semibold text-white/65 sm:mb-2 sm:text-xs">{subtitle}</p>}
            <h1 className="break-words text-2xl font-extrabold leading-tight tracking-[-.03em] text-white sm:text-[28px] md:text-[38px]">{title}</h1>
          </div>
          {children && <div className="shrink-0">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export type TomKpi = "blue" | "green" | "amber" | "red" | "violet";

export function CartaoKpi({ label, value, detail, tone = "blue", icon, trend, className, onClick }: { label: string; value: string; detail: string; tone?: TomKpi; icon: ReactNode; trend?: string; className?: string; onClick?: () => void }) {
  const styles: Record<TomKpi, string> = { blue: "text-primary border-primary/25", green: "text-emerald-600 dark:text-emerald-300 border-emerald-500/30", amber: "text-amber-600 dark:text-amber-300 border-amber-500/30", red: "text-red-600 dark:text-red-300 border-red-500/30", violet: "text-violet-600 dark:text-violet-300 border-violet-500/30" };
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 break-words text-[9px] font-bold uppercase tracking-[.08em] text-muted-foreground sm:text-[10px] sm:tracking-[.1em]">{label}</span>
        <span className={cn("shrink-0 rounded-lg border bg-secondary/70 p-1.5 shadow-sm sm:p-2", styles[tone])}>
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4">{icon}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 sm:mt-4 sm:gap-3">
        <strong className="break-all font-mono text-lg font-medium tracking-[-.04em] sm:text-[23px] sm:tracking-[-.05em]">{value}</strong>
        {trend && (
          <span className={cn("mb-0.5 flex items-center gap-0.5 text-[9px] font-bold sm:mb-1", trend.startsWith("+") ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300")}>
            {trend.startsWith("+") ? <ArrowDownRight size={11} className="rotate-180" /> : <ArrowDownRight size={11} />}
            {trend}
          </span>
        )}
      </div>
      <p className="mt-1 break-words text-[10px] leading-snug text-muted-foreground">{detail}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cn("group min-w-0 rounded-xl border border-border bg-card/80 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4", className)}>
      {content}
    </button>
  ) : (
    <div className={cn("group min-w-0 rounded-xl border border-border bg-card/80 p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/35 sm:p-4", className)}>{content}</div>
  );
}

export function AcaoRapida({ icon, label, detail, color = "blue", onClick }: { icon: ReactNode; label: string; detail: string; color?: "blue" | "green" | "amber" | "violet"; onClick: () => void }) {
  const colors = { blue: "text-primary border-primary/25", green: "text-emerald-600 dark:text-emerald-300 border-emerald-500/30", amber: "text-amber-600 dark:text-amber-300 border-amber-500/30", violet: "text-violet-600 dark:text-violet-300 border-violet-500/30" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[92px] min-w-0 w-full flex-col justify-between rounded-xl border border-border bg-card/65 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[.04] sm:min-h-[100px] sm:p-3.5"
    >
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-secondary/70 shadow-sm sm:h-8 sm:w-8", colors[color])}>
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4">{icon}</span>
      </span>
      <span className="mt-2.5 min-w-0 sm:mt-3">
        <span className="flex min-w-0 items-start justify-between gap-2 text-[10px] font-bold sm:text-[11px]">
          <span className="min-w-0 break-words">{label}</span>
          <ArrowRight size={12} className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </span>
        <span className="mt-1 block break-words text-[9px] text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

export function BarraProgresso({ value, color = "blue" }: { value: number; color?: "blue" | "green" | "amber" | "red" }) {
  const colors = { blue: "bg-primary", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full transition-all", colors[color])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function EtiquetaStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "blue" | "violet" | "neutral" }) {
  const styles = { green: "text-emerald-500 dark:text-emerald-300", amber: "text-amber-500 dark:text-amber-300", red: "text-red-500 dark:text-red-300", blue: "text-sky-500 dark:text-sky-300", violet: "text-violet-500 dark:text-violet-300", neutral: "text-muted-foreground" };
  const rotulo = typeof children === "string" ? children.replace(/_/g, " ") : children;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.07em]", styles[tone])}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{rotulo}</span>
    </span>
  );
}

export function EstadoVazio({ label = "Nenhum registro encontrado" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12">
      <div className="mb-3 rounded-xl bg-secondary p-3 text-muted-foreground">
        <FileText size={20} className="sm:size-[21px]" />
      </div>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">Os dados aparecerão aqui assim que forem registrados no sistema.</p>
    </div>
  );
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(valor) ? valor : 0);
}