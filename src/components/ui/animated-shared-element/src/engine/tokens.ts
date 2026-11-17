import { cubicBezier } from "motion/react";

/**
 * JS mirror of src/styles/tokens.css for values the engine and Motion need as numbers.
 * Keep both files in sync.
 */

/** Demo stage geometry in stage px. A 4 px grid. */
export const STAGE = {
  /** Window (mini browser) width. */
  w: 560,
  /** Window height. */
  windowH: 380,
  /** Chrome bar height including its 1px divider. */
  chromeH: 36,
  /** Gap between the window and the label pill. */
  labelGap: 24,
  /** Label pill height. */
  labelH: 44,
  /** Page area (below the chrome) size. */
  pageW: 560,
  pageH: 380 - 36,
  /** Standard page padding. */
  pad: 28,
} as const;

/** Full stage height: window + gap + label. */
export const STAGE_H = STAGE.windowH + STAGE.labelGap + STAGE.labelH;

/** Durations in ms (enter 180-260 ms, exit 120-180 ms). */
export const DURATION = {
  fast: 120,
  exit: 160,
  enter: 220,
  slow: 320,
  /** Default seamless loop length. */
  loop: 5000,
} as const;

/** Easing curves as cubic-bezier control points (the single source for CSS strings and JS functions). */
export const EASING_POINTS = {
  out: [0.2, 0.8, 0.2, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
  /** Cursor travel: quick start, soft landing, like a hand on a trackpad. */
  cursor: [0.45, 0.05, 0.2, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EasingName = keyof typeof EASING_POINTS | "linear";

export const EASING: Record<EasingName, (p: number) => number> = {
  linear: (p) => p,
  out: cubicBezier(...EASING_POINTS.out),
  in: cubicBezier(...EASING_POINTS.in),
  inOut: cubicBezier(...EASING_POINTS.inOut),
  cursor: cubicBezier(...EASING_POINTS.cursor),
};

/** CSS string for an easing name, e.g. for meta sheets. */
export function easingCss(name: EasingName): string {
  if (name === "linear") return "linear";
  return `cubic-bezier(${EASING_POINTS[name].join(", ")})`;
}
