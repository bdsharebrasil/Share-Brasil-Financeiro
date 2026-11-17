import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-surface px-1 font-sans text-xs leading-none text-muted", className)}
      {...props}
    />
  );
}
