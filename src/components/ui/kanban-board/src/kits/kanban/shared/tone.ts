import type { CSSProperties } from "react";
import type { Tone } from "./types";

/** Each tone is a mix of theme colors, so it follows the brand color and the light or dark theme. */
const TONES: Record<Tone, string> = {
  indigo: "var(--ui-accent)",
  violet: "color-mix(in oklab, var(--ui-accent) 55%, var(--ui-danger))",
  teal: "color-mix(in oklab, var(--ui-accent) 40%, var(--ui-success))",
  green: "var(--ui-success)",
  amber: "var(--ui-warning)",
  orange: "color-mix(in oklab, var(--ui-warning) 55%, var(--ui-danger))",
  red: "var(--ui-danger)",
  slate: "var(--ui-text-muted)",
};

/** Sets --tone for a dot, bar or avatar tint. */
export function toneStyle(tone: Tone): CSSProperties {
  return { "--tone": TONES[tone] } as CSSProperties;
}
