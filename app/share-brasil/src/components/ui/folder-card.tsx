import * as React from "react";
import { ChevronRight, FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type FolderCardProps = {
  name: string;
  description: string;
  count: number;
  selected?: boolean;
  onClick: () => void;
};

export function FolderCard({ name, description, count, selected = false, onClick }: FolderCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[184px] flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200",
        "border-border bg-card/80",
        "hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
        selected && "border-primary/60 bg-primary/[.07] shadow-lg",
      )}
    >
      <span className="pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <span className="relative flex items-start justify-between gap-3">
        <span className="relative flex h-[74px] w-[92px] items-end justify-center">
          <span className="absolute left-1 top-2 h-[56px] w-[86px] rounded-[11px] rounded-tl-[5px] bg-gradient-to-br from-sky-300 via-sky-500 to-blue-700 shadow-[inset_0_2px_0_rgba(255,255,255,.35),0_12px_18px_rgba(91,54,220,.25)]" />
          <span className="absolute left-1 top-0 h-[25px] w-[42px] rounded-t-[9px] rounded-br-[4px] bg-gradient-to-br from-sky-300 to-blue-600" />
          <span className="absolute left-[9px] top-[24px] h-[14px] w-[70px] rounded-[5px] bg-white/80 shadow-[0_2px_6px_rgba(255,255,255,.18)]" />
          <span className="relative z-10 mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/25 text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
            <FolderOpen size={17} strokeWidth={1.8} />
          </span>
        </span>
        <span className="rounded-lg border border-border bg-secondary/70 p-2 text-muted-foreground transition-colors group-hover:text-primary">
          <ChevronRight size={15} />
        </span>
      </span>
      <span className="relative mt-4 block min-w-0">
        <span className="block truncate text-sm font-extrabold tracking-[-.02em] text-foreground">{name}</span>
        <span className="mt-1 block truncate text-[10px] leading-relaxed text-muted-foreground">{description}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          <FileText size={12} className="text-primary" />
          {count} {count === 1 ? "arquivo" : "arquivos"}
        </span>
      </span>
    </button>
  );
}

export default FolderCard;
