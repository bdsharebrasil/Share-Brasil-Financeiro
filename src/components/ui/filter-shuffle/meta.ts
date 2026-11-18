import { defineMeta } from "@/kit/types";
export default defineMeta({
  "slug": "filter-shuffle",
  "name": "Filter shuffle",
  "family": "content",
  "summary": "A filterable grid whose surviving cards animate into their new positions.",
  "whenToUse": [
    "Narrow a card collection by category while retaining spatial context.",
    "Provide toggle chips and a result count; use sortable-table for structured column sorting."
  ],
  "avoidWhen": [
    "A mutually exclusive page panel selector: use sliding-tabs.",
    "Loading another remote page instead of filtering: use infinite-scroll."
  ],
  "promptTerm": "animated filterable grid",
  "promptExample": "Use the “animated filterable grid” pattern to build a card grid with labeled toggle filter chips, fading removed/added cards, animated layout reflow, and a politely announced results count.",
  "aliases": [
    "Filter shuffle",
    "Filterable grid",
    "Animated grid reflow"
  ],
  "timing": [
    {
      "phase": "enter",
      "ms": 220,
      "easing": "cubic-bezier(0.2,0.8,0.2,1)"
    },
    {
      "phase": "exit",
      "ms": 160,
      "easing": "cubic-bezier(0.4,0,1,1)"
    },
    {
      "phase": "reduced-motion",
      "ms": 0,
      "easing": "linear"
    }
  ],
  "loopMs": 5000,
  "a11y": [
    "Group named filter buttons and expose aria-pressed on each; specify whether multiple filters can be active.",
    "Keep standard Enter/Space button operation and visible focus; do not turn the collection into an ARIA grid solely for visual layout.",
    "Announce the resulting count and no-results state via a polite live region.",
    "Retain focus on the active chip; if a focused card is removed programmatically, move focus to a sensible surviving control.",
    "Reduced motion: Apply filters and final positions in 0 ms; no fade, shuffle, or stagger."
  ],
  "primitives": [
    "Motion 14.8.0 (MIT)"
  ],
  "status": "ready"
});
