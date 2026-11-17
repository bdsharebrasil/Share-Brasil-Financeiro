import type { ReactNode } from "react";
import { cn } from "./cn";

const SIZE = { sm: "size-6 text-xs", md: "size-8 text-xs", lg: "size-10 text-sm" } as const;

/** Initials from a full name: "Maya Okafor" -> "MO". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/**
 * Round avatar. Pass `src` for a photo, `icon` for a product mark, or nothing for initials.
 * Decorative by default (the name is printed next to it); set `label` when it stands alone.
 */
export function Avatar({
  name,
  src,
  icon,
  size = "md",
  label,
  className,
}: {
  name: string;
  src?: string;
  icon?: ReactNode;
  size?: keyof typeof SIZE;
  label?: string;
  className?: string;
}) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <span
      {...a11y}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none",
        icon ? "bg-accent text-accent-fg" : "bg-active text-ink",
        SIZE[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : (icon ?? initials(name))}
    </span>
  );
}
