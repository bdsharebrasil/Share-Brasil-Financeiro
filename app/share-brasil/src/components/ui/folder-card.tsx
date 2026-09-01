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
        "border-[#25344a] bg-gradient-to-br from-[#121f31] via-[#101a29] to-[#0c1522]",
        "hover:-translate-y-1 hover:border-cyan-300/45 hover:shadow-[0_18px_35px_rgba(2,17,35,.38)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
        selected && "border-cyan-300/65 bg-cyan-300/[.07] shadow-[0_16px_38px_rgba(16,185,190,.12)]",
      )}
    >
      <span className="pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <span className="relative flex items-start justify-between gap-3">
        <span className="relative flex h-[74px] w-[92px] items-end justify-center">
          <span className="absolute left-1 top-2 h-[56px] w-[86px] rounded-[11px] rounded-tl-[5px] bg-gradient-to-br from-violet-300 via-violet-500 to-indigo-700 shadow-[inset_0_2px_0_rgba(255,255,255,.35),0_12px_18px_rgba(91,54,220,.25)]" />
          <span className="absolute left-1 top-0 h-[25px] w-[42px] rounded-t-[9px] rounded-br-[4px] bg-gradient-to-br from-violet-300 to-violet-600" />
          <span className="absolute left-[9px] top-[24px] h-[14px] w-[70px] rounded-[5px] bg-white/80 shadow-[0_2px_6px_rgba(255,255,255,.18)]" />
          <span className="relative z-10 mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/25 text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
            <FolderOpen size={17} strokeWidth={1.8} />
          </span>
        </span>
        <span className="rounded-lg border border-white/10 bg-white/[.04] p-2 text-slate-400 transition-colors group-hover:text-cyan-200">
          <ChevronRight size={15} />
        </span>
      </span>
      <span className="relative mt-4 block min-w-0">
        <span className="block truncate text-sm font-extrabold tracking-[-.02em] text-white">{name}</span>
        <span className="mt-1 block truncate text-[10px] leading-relaxed text-slate-400">{description}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-black/15 px-2 py-1 text-[10px] font-semibold text-slate-300">
          <FileText size={12} className="text-cyan-300" />
          {count} {count === 1 ? "arquivo" : "arquivos"}
        </span>
      </span>
    </button>
  );
}

export default FolderCard;
