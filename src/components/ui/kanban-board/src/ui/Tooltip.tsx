/**
 * Tooltip: Base UI Tooltip (MIT). Shows on hover and keyboard focus. A tooltip repeats a label; it
 * never replaces it: icon buttons still need their own aria-label.
 */
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

/** Wrap the app once so neighbouring tooltips open instantly after the first one. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={450} closeDelay={60}>
      {children}
    </BaseTooltip.Provider>
  );
}

export function Tooltip({ label, side = "top", children }: { label: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactElement }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} collisionPadding={8} className="z-[60]">
          <BaseTooltip.Popup className="fade-motion rounded-[7px] bg-ink px-2 py-1 text-xs font-medium text-page shadow-float">{label}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
