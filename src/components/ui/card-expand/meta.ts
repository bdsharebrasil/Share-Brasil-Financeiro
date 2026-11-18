import { DURATION, easingCss } from "@/engine/tokens";
import { defineMeta } from "@/kit/types";

export default defineMeta({
  slug: "card-expand",
  name: "Card expand",
  family: "content",
  summary: "A card opens into a larger detail view while retaining visual continuity.",
  whenToUse: [
    "Inspect one item without losing its position in a grid.",
    "Use a focused modal detail view; use shared-element when the detail is a separate route.",
  ],
  avoidWhen: ["A small supplementary preview: use hover-card.", "Image-only inspection: use image-lightbox."],
  promptTerm: "shared-layout expanding card",
  promptExample:
    "Use the “shared-layout expanding card” pattern to build a grid card that expands through a shared-layout animation into a named modal detail view, focuses its content, and returns to the source card on close or Escape. Grow the card into the dialog in 220 ms ease-out and fade the detail in over the last 120 ms; shrink back in 160 ms ease-in with no spring; under reduced motion open and close the final layout instantly.",
  aliases: ["Expanding card", "Card-to-detail transition", "Shared-layout card"],
  timing: [
    { phase: "enter (card surface grows into the dialog)", ms: DURATION.enter, easing: easingCss("out") },
    { phase: "enter (detail content fades in, last part of the growth)", ms: DURATION.fast, easing: easingCss("out") },
    { phase: "exit (dialog shrinks back into the card)", ms: DURATION.exit, easing: easingCss("in") },
    { phase: "reduced motion", ms: 0, easing: "linear" },
  ],
  loopMs: 5000,
  a11y: [
    "Use a real named trigger button/link and a labeled role=dialog with aria-modal=true for this modal variant.",
    "Move focus inside, trap Tab, make background inert, and lock background scroll.",
    "Escape and a visible close button dismiss; restore focus to the source or nearest surviving card.",
    "Shared visual layers must not create duplicate readable/focusable content.",
    "Reduced motion: Open/close the final detail layout in 0 ms without geometry interpolation or crossfade.",
  ],
  primitives: [
    "@base-ui/react 1.9.0 Dialog (MIT), through src/primitives/dialog.tsx",
    "motion 14.8.0 shared layout, layoutId (MIT)",
  ],
  status: "ready",
});
