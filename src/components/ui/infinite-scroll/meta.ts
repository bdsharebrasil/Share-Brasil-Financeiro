import { defineMeta } from "@/kit/types";
export default defineMeta({
  "slug": "infinite-scroll",
  "name": "Infinite scroll",
  "family": "content",
  "summary": "A collection appends another page as the reader reaches its end.",
  "whenToUse": [
    "Support exploratory browsing through a large stream.",
    "Use automatic loading as an enhancement to a Load more button; use pagination for stable page navigation."
  ],
  "avoidWhen": [
    "Users need to compare or revisit numbered result pages: use pagination.",
    "A finite sideways set of slides: use carousel."
  ],
  "promptTerm": "infinite-scroll list with Load more fallback",
  "promptExample": "Use the “infinite-scroll list with Load more fallback” pattern to build an IntersectionObserver-driven infinite list with guarded page loading, a keyboard Load more fallback, a bottom loader, announced loaded counts, and restrained new-item entrances.",
  "aliases": [
    "Infinite scroll",
    "Incremental loading",
    "Endless list"
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
    "Keep a named Load more button and normal document/list semantics; do not assign role=feed without its full interaction contract.",
    "Announce the count of appended items and errors via a polite status region; mark the loading region busy.",
    "Do not move focus for automatic appends; preserve a usable focus path after manually loading more.",
    "Provide retry and end-of-results states, guard duplicate requests, and keep footer/navigation reachable.",
    "Reduced motion: Append rows and show/remove loader in 0 ms; no travel or stagger."
  ],
  "primitives": [
    "Motion 14.8.0 (MIT)"
  ],
  "status": "ready"
});
