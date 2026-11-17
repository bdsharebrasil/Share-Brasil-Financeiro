# Instructions for AI coding agents

This folder is a React 19 + TypeScript + Vite project. The demo page renders one component's live example.

## Where things are

- Kanban board: `src/kits/kanban/kanban-board/KanbanBoard.tsx`. Example usage in `Preview.tsx` next to it.
- Building blocks: `src/ui/`. Focus handling, keyboard support and dismissal come from Base UI there; build on them instead of rewriting that behavior.
- Design tokens: `src/styles/tokens.css` (light and dark), mapped to Tailwind classes in `src/styles/index.css`.

## Rules

- Keep each component's exported names and props working.
- Use the token classes (`bg-surface`, `text-muted`, `border-line`, `bg-accent` and so on) or the `--ui-*` variables. No hard-coded colors. Check the light and the dark theme.
- Keep motion short: entrances 180-260 ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`, exits 120-180 ms. Read `useMotionTransitions()` from `src/ui/motion.ts` so reduced motion keeps working.
- Every control needs a visible focus ring, an accessible name and keyboard support. Do not remove ARIA attributes.
- Layouts must work from 360 px wide without horizontal scrolling.
- Before you finish, run `npm run typecheck` and `npm run build`; both must pass.
