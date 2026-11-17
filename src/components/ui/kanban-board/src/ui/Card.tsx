import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** A bordered surface with the card radius. No shadow: shadows are for floating layers only. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface", className)} {...props} />;
}
