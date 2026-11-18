import { DURATION, easingCss } from "@/engine/tokens";
import { defineMeta } from "@/kit/types";

export default defineMeta({
  slug: "carousel",
  name: "Carousel",
  family: "content",
  summary: "A horizontally browsable set of slides with direct navigation controls.",
  whenToUse: [
    "Browse peer images or cards one slide at a time.",
    "Allow swiping while retaining visible arrows/dots; use image-lightbox for enlarged image inspection.",
  ],
  avoidWhen: [
    "Essential content people must compare simultaneously: use sortable-table or a static grid.",
    "An endless feed of new content: use infinite-scroll.",
  ],
  promptTerm: "accessible draggable carousel",
  promptExample:
    "Use the “accessible draggable carousel” pattern to build a swipeable carousel with momentum, named previous/next buttons, slide dots, an accessible slide count, and explicit pause/resume controls if autoplay is enabled. Settle on the next slide in 220 ms ease-out; a drag follows the pointer and a fling carries on at most one slide over 320 ms with no bounce; under reduced motion slides change instantly with no inertia and autoplay starts off.",
  aliases: ["Carousel", "Slide show", "Image rotator"],
  timing: [
    { phase: "enter (button or dot press settles on the new slide)", ms: DURATION.enter, easing: easingCss("out") },
    { phase: "release after a fling (carries at most one slide, no bounce)", ms: DURATION.slow, easing: easingCss("out") },
    { phase: "exit (dot pill shrinks back)", ms: DURATION.exit, easing: easingCss("in") },
    { phase: "reduced motion", ms: 0, easing: "linear" },
  ],
  loopMs: 5000,
  a11y: [
    "Use a named region/group with aria-roledescription=carousel and meaningful slide labels/counts.",
    "Provide named Previous/Next and dot buttons; normal Tab navigation must work without dragging.",
    "Keep hidden slides and their controls out of interaction; do not forcibly move focus on each slide change.",
    "Autoplay defaults off; if enabled, provide a rotation control, pause on hover/focus, and require explicit restart after focus stops it.",
    "Reduced motion: Jump to the selected slide in 0 ms; disable smooth scrolling, inertia, and autoplay.",
  ],
  primitives: ["motion 14.8.0 drag, animate, useMotionValue (MIT)", "custom strip and controls (no carousel library)"],
  status: "ready",
});
