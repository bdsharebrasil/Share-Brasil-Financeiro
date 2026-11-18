import { defineMeta } from "@/kit/types";
export default defineMeta({
  "slug": "sortable-table",
  "name": "Sortable table",
  "family": "content",
  "summary": "A data collection whose column sort changes row order and whose rows can reveal details.",
  "whenToUse": [
    "Compare structured records across columns.",
    "Choose ascending/descending order through headers; use drag-reorder for a manually curated order."
  ],
  "avoidWhen": [
    "Unstructured card browsing: use filter-shuffle.",
    "A short selection list rather than tabular data: use combobox."
  ],
  "promptTerm": "sortable data table with expandable row details",
  "promptExample": "Use the “sortable data table with expandable row details” pattern to build a React Aria sortable table with keyboard-operable column headers, correct sort state, animated row reordering, and explicitly controlled expandable row details.",
  "aliases": [
    "Sortable table",
    "Sortable data table",
    "Table"
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
    "Name the collection and preserve React Aria's grid/row/columnheader semantics; expose aria-sort on the currently sorted header.",
    "Keep headers keyboard operable with the primitive's focus navigation and Enter/Space activation.",
    "Give each details button aria-expanded, aria-controls, and a row-specific name; associate detail content without breaking cell structure.",
    "Keep stable row IDs and focus on the same record through sorting; announce the new sort direction politely.",
    "Reduced motion: Reorder rows, change arrow, and expand/collapse details immediately (0 ms)."
  ],
  "primitives": [
    "React Aria Table, TableHeader, Column, TableBody, Row, Cell 1.22.1 (Apache-2.0)",
    "Motion 14.8.0 (MIT)"
  ],
  "status": "ready"
});
