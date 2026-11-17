/**
 * Motion values shared by every kit. Mirrors the --ui-dur-* and --ui-ease-* variables in
 * src/styles/tokens.css: keep both in sync.
 * Character: calm and precise. Enter 180-260 ms ease-out, exit 120-180 ms ease-in, springs only for drag.
 */
import { useReducedMotion, type Transition } from "motion/react";

export const DURATION = { fast: 120, exit: 150, enter: 220, slow: 260 } as const;
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;
export const DRAG_SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 } as const;

/** Enter and exit transitions; with reduced motion both are instant (state change without movement). */
export function useMotionTransitions() {
  const reduced = useReducedMotion() ?? false;
  const enter: Transition = { duration: reduced ? 0 : DURATION.enter / 1000, ease: [...EASE_OUT] };
  const exit: Transition = { duration: reduced ? 0 : DURATION.exit / 1000, ease: [...EASE_IN] };
  /** Distance in px for an entrance; 0 with reduced motion. */
  const shift = (px: number) => (reduced ? 0 : px);
  return { reduced, enter, exit, shift };
}
