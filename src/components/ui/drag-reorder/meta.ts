import { DURATION, easingCss } from "@/engine/tokens";
import { defineMeta } from "@/kit/types";

export default defineMeta({
  slug: "drag-reorder",
  name: "Drag reorder",
  family: "content",
  summary: "A reorderable collection with pointer dragging and equivalent keyboard commands.",
  whenToUse: [
    "Change the order of a personal list or queue.",
    "Move item three to position one with clear feedback; use sortable-table for a computed column sort.",
  ],
  avoidWhen: ["Moving a panel to dismiss it: use drawer.", "Deleting a row by gesture: use swipe-delete."],
  promptTerm: "accessible reorderable list",
  promptExample:
    "Use the “accessible reorderable list” pattern to build a React Aria reorderable list with pointer dragging, announced positions, a custom Space-to-lift/arrows-to-move mode with commit/cancel, and visible Move up/down alternatives. Displaced rows slide to their new place in 220 ms ease-out, the moved row settles with a spring (stiffness 320, damping 36, mass 1), the lift highlight drops in 160 ms ease-in; under reduced motion rows jump to their new order in 0 ms while pointer dragging and every control stay available.",
  aliases: ["Reorderable list", "Sortable list", "Drag-and-drop reorder"],
  timing: [
    { phase: "enter (lift highlight; displaced rows slide to their new place)", ms: DURATION.enter, easing: easingCss("out") },
    { phase: "settle (moved row: spring stiffness 320, damping 36, mass 1; critically damped, no bounce)", ms: DURATION.slow, easing: "linear(0.000, 0.113, 0.317, 0.512, 0.667, 0.779, 0.857, 0.909, 0.943, 0.964, 1)" },
    { phase: "exit (lift highlight drops on release)", ms: DURATION.exit, easing: easingCss("in") },
    { phase: "reduced motion", ms: 0, easing: "linear" },
  ],
  loopMs: 5000,
  a11y: [
    "Use the collection's grid/row semantics and a named drag handle; retain focus on the moved item's stable ID.",
    "React Aria documents Enter to start/drop, Tab between targets, and Escape to cancel; preserve that supported route (keyboard guide (https://react-aria.adobe.com/dnd)).",
    "Add the requested Space/arrows mode explicitly, with Enter/Space to commit and Escape to cancel; also offer native Move up/down buttons.",
    "Announce pickup, destination/position, drop, and cancellation once per meaningful change, not per animation frame.",
    "Reduced motion: Reposition collection and settle immediately (0 ms); keep direct pointer tracking and all non-drag controls.",
  ],
  primitives: [
    "react-aria-components 1.22.1 GridList, GridListItem, useDragAndDrop, DropIndicator, useListData (Apache-2.0), through src/primitives/react-aria.ts",
    "motion 14.8.0 layout animation (MIT)",
    "custom Space/arrow lift adapter (not part of React Aria)",
  ],
  status: "ready",
});
