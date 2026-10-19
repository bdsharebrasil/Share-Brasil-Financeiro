import * as React from "react";

import { cn } from "@/lib/utils";

type FolderProps = {
  name: string;
  description: string;
  count: number;
  selected?: boolean;
  className?: string;
  onClick: () => void;
  isOpen?: boolean;
};

export function FolderCard({
  name,
  description,
  count,
  selected = false,
  className,
  onClick,
  isOpen = false,
}: FolderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[158px] w-full flex-col items-center justify-center gap-2 p-4",
        "rounded-xl border border-border bg-background/40 text-center",
        "transition-all duration-200",
        "hover:border-primary/40 hover:bg-primary/[0.03]",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        selected && "border-primary/50 bg-primary/[0.05]",
        className
      )}
    >
      <div aria-hidden="true" className="relative h-[52px] w-[58px] shrink-0">
        {/* Aba superior da pasta */}
        <div
          className={cn(
            "absolute left-[2px] top-0 h-[15px] w-[27px]",
            "rounded-t-[5px]",
            "bg-[#159bd3]",
            "transition-all duration-200",
            isOpen && "w-[31px]"
          )}
        />

        {/* Corpo da pasta */}
        <div
          className={cn(
            "absolute bottom-[2px] left-0 h-[39px] w-[58px]",
            "rounded-[3px_3px_6px_6px]",
            "bg-gradient-to-b from-[#19a8df] to-[#078ac5]",
            "shadow-[0_4px_8px_rgba(0,0,0,0.20)]",
            "transition-transform duration-200",
            "group-hover:-translate-y-[1px]",
            isOpen && "-translate-y-[2px]"
          )}
        />

        {/* Frente clara da pasta */}
        <div
          className={cn(
            "absolute bottom-[7px] left-[6px]",
            "h-[29px] w-[49px]",
            "rounded-[2px_2px_4px_4px]",
            "bg-gradient-to-b from-[#25b1e8] to-[#0b96d0]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
            "transition-all duration-200",
            "group-hover:brightness-110",
            isOpen && "brightness-110"
          )}
        />

        {/* Aba/folha clara no topo */}
        <div
          className="
            absolute left-[15px] top-[7px]
            h-[8px] w-[40px]
            rounded-[2px]
            bg-[#3db7e7]
            opacity-90
          "
        />
      </div>
      <span className="block max-w-full truncate text-sm font-semibold text-foreground">
        {name}
      </span>
      <span className="block max-w-full truncate text-xs text-muted-foreground">
        {description}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {count} {count === 1 ? "documento" : "documentos"}
      </span>
    </button>
  );
}

export default FolderCard;
