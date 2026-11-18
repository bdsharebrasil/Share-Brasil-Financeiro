import { easingCss } from "@/engine/tokens";
import { defineMeta } from "@/kit/types";
import { SWIPE_MS } from "./timing";

export default defineMeta({
  slug: "swipe-delete",
  name: "Swipe delete",
  family: "content",
  summary: "A row gesture reveals a delete action, with an explicit non-gesture route and undo.",
  whenToUse: [
    "Offer compact mobile list cleanup with a reversible delete.",
    "Reveal an action before removing the row; use dropdown-menu for several row actions.",
  ],
  avoidWhen: [
    "Irreversible high-impact deletion without confirmation: use alert-dialog.",
    "Reordering rather than removal: use drag-reorder.",
  ],
  promptTerm: "swipe-to-reveal delete row",
  promptExample:
    "Use the “swipe-to-reveal delete row” pattern to build a mobile row that swipes left to reveal a Delete action, uses a configurable threshold, collapses on deletion, and provides a visible keyboard Delete button plus an Undo toast hook.",
  aliases: ["Swipe delete", "Swipe-to-reveal action", "Swipeable row"],
  timing: [
    { phase: "enter (incomplete swipe settles, undone row opens back)", ms: SWIPE_MS.enter, easing: easingCss("out") },
    { phase: "exit (deleted row collapses and fades)", ms: SWIPE_MS.exit, easing: easingCss("in") },
    { phase: "reduced motion", ms: 0, easing: "linear" },
  ],
  loopMs: 5000,
  a11y: [
    "Expose an always-discoverable named Delete button; dragging is optional and must not hijack normal vertical scroll.",
    "Keep row content in a semantic list; do not invent a swipe ARIA role.",
    "After deletion, focus a surviving row/action and announce the removed item politely.",
    "Make Undo keyboard reachable, preserve restoration data, and keep essential recovery available beyond a fleeting animation.",
    "Reduced motion: Set reveal/collapse states in 0 ms; direct user drag may track the pointer, but no animated settling.",
  ],
  primitives: [
    "motion 14.8.0 (MIT): pan gesture (onPan) into a motion value, clamped to the row and released against a threshold; Motion runs the settle, collapse and restore. drag=\"x\" was tried and dropped: its own release inertia animated the same value as the settle. No CSS animation in this piece (only the shared Button's own hover transition)",
    "@base-ui/react 1.9.0 Toast (MIT), behind src/primitives/toast.tsx, for the optional undo hook",
  ],
  status: "ready",
});
