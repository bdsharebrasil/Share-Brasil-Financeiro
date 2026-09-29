import { AlertTriangle, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import type { StatusLancamento } from "@/components/financeiro-share/tipos";

const MAPA: Record<string, { label: string; classes: string; Icon: typeof Clock }> = {
  EM_ABERTO: { label: "Em Aberto", classes: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/25", Icon: Clock },
  PENDENTE: { label: "Pendente", classes: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/25", Icon: Clock },
  PAGO: { label: "Pago", classes: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/25", Icon: CheckCircle2 },
  RECEBIDO: { label: "Recebido", classes: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/25", Icon: CheckCircle2 },
  EM_ATRASO: { label: "Em Atraso", classes: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-400/25", Icon: AlertTriangle },
  ATRASADO: { label: "Atrasado", classes: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-400/25", Icon: AlertTriangle },
  CANCELADO: { label: "Cancelado", classes: "bg-neutral-200 text-neutral-600 border-neutral-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-400/20", Icon: XCircle },
  AGUARDANDO_REEMBOLSO: { label: "Aguardando Reembolso", classes: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/25", Icon: RotateCcw },
  REEMBOLSADO: { label: "Reembolsado", classes: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/25", Icon: RotateCcw },
};

export function StatusBadge({ status }: { status: string }) {
  const config = MAPA[status] ?? { label: status, classes: "bg-muted text-muted-foreground border-border", Icon: Clock };
  const { label, classes, Icon } = config;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
