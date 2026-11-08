import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import "./anexos.css";

/** Compatibilidade de layout com os componentes de upload já existentes. */
export function AreaAnexo({ children }: { children: ReactNode }) {
  return <div className="area-anexo">{children}</div>;
}

/** Nome e categoria podem quebrar linha sem empurrar a borda direita. */
export function LinhaDocumento({
  nome,
  categoria,
  socio = false,
}: {
  nome: string;
  categoria?: string | null;
  socio?: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border dark:border-white/[.07] bg-white/[.025] p-3">
      <span className="flex min-w-0 max-w-full flex-[1_1_12rem] items-start gap-2 text-xs">
        <FileText
          size={14}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${socio ? "text-violet-300" : "text-primary"}`}
        />
        <span className="min-w-0 [overflow-wrap:anywhere]">{nome}</span>
      </span>
      <span className="min-w-0 max-w-full rounded-md bg-white/5 px-2 py-1 text-[10px] text-muted-foreground dark:text-slate-400 [overflow-wrap:anywhere]">
        {categoria || "geral"}
      </span>
    </div>
  );
}
