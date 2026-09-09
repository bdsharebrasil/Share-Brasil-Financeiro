import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function GlossyFolder({ size = 88 }: { size?: number }) {
  const id = React.useId().replace(/:/g, "");
  const gradientId = (name: string) => `${id}-${name}`;

  return (
    <svg
      viewBox="0 0 100 92"
      width={size}
      height={size * 0.92}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        filter:
          "drop-shadow(0 3px 9px rgba(30,80,200,0.22)) drop-shadow(0 1px 2px rgba(20,60,160,0.14))",
      }}
    >
      <defs>
        <linearGradient id={gradientId("back")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2457c5" />
          <stop offset="100%" stopColor="#1a3fa0" />
        </linearGradient>
        <linearGradient id={gradientId("front")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b96f7" />
          <stop offset="40%" stopColor="#3a74e8" />
          <stop offset="100%" stopColor="#1e4ec8" />
        </linearGradient>
        <linearGradient id={gradientId("gloss")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
        <linearGradient id={gradientId("side")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0.18)" />
          <stop offset="15%" stopColor="rgba(0,0,0,0)" />
          <stop offset="85%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.14)" />
        </linearGradient>
        <linearGradient id={gradientId("badge")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a8c8ff" />
          <stop offset="100%" stopColor="#7aaff5" />
        </linearGradient>
        <clipPath id={gradientId("clip")}>
          <rect x="4" y="22" width="92" height="64" rx="6" style={{ backgroundColor: "rgba(9, 13, 29, 1)" }} />
        </clipPath>
      </defs>
      <rect x="4" y="18" width="92" height="68" rx="7" fill={`url(#${gradientId("back")})`} style={{ backgroundColor: "rgba(3, 4, 12, 1)" }} />
      <path d="M4 18 Q4 14 8 14 L36 14 Q40 14 42 18 L4 18 Z" fill="#2052bb" />
      <rect x="4" y="22" width="92" height="64" rx="6" fill={`url(#${gradientId("front")})`} />
      <rect x="4" y="22" width="92" height="64" rx="6" fill={`url(#${gradientId("side")})`} />
      <rect
        x="4"
        y="22"
        width="92"
        height="30"
        rx="6"
        fill={`url(#${gradientId("gloss")})`}
        clipPath={`url(#${gradientId("clip")})`}
      />
      <rect x="6" y="23" width="88" height="2" rx="1" fill="rgba(255,255,255,0.16)" />
      <rect x="68" y="66" width="20" height="14" rx="3" fill={`url(#${gradientId("badge")})`} opacity="0.9" />
      <rect x="70" y="68" width="16" height="2" rx="1" fill="rgba(255,255,255,0.7)" />
      <rect x="70" y="72" width="10" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

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
        "border-border bg-[rgba(8,9,19,0.8)]",
        "hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
        selected && "border-primary/60 bg-primary/[.07] shadow-lg",
      )}
    >
      <span className="pointer-events-none absolute -right-9 -top-9 h-24 w-24 rounded-full bg-primary/[.06] blur-xl transition-opacity group-hover:opacity-100" />

      <span className="relative flex items-start justify-between gap-3">
        <span className="transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
          <GlossyFolder size={80} />
        </span>
      </span>

      <span className="relative mt-2 block min-w-0">
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
