# Kanban board

Columns of task cards with counts and work-in-progress limits; drag cards between columns or move them by keyboard, and add a card inline. Part of the Kanban kit.

Version 1.0.0. React 19 and TypeScript, styled with Tailwind CSS 4, animated with Motion, accessible behavior from Base UI, icons from Lucide, built with Vite.

## Run it

You need Node.js 22 or newer.

1. Install the libraries: `npm install` (or `pnpm install`).
2. Start the demo page: `npm run dev`, then open the address Vite prints (usually `http://localhost:5173`).
3. Add `?theme=dark` or `?theme=light` to the address to force a theme; otherwise it follows your system and the button in the corner.

`npm run build` writes a static copy of the demo to `dist/`; `npm run typecheck` checks the types.

## What is inside

- `src/kits/kanban/kanban-board/`: kanban board, with its live example.
- `src/kits/kanban/shared/`: data shapes and small utilities the components share.
- `src/ui/`: the building blocks (buttons, menus, popovers, dialogs) the components use.
- `src/styles/tokens.css`: colors, corners and fonts as CSS variables for the light and dark themes. `src/styles/index.css` maps them to Tailwind classes such as `bg-surface` and `text-muted`.
- `src/main.tsx` and `index.html`: the demo page.
- `CREDITS.md`: libraries and their licenses. `AGENTS.md` and `CLAUDE.md`: instructions for AI coding agents.

## Make it yours

- **Use it in your app:** copy `src/kits/kanban/`, `src/ui/` and `src/styles/` into your project, keep the `@/` path alias pointing at your source folder, import `src/styles/index.css` once, and install the libraries listed under `dependencies` in `package.json`.
- **Colors and corners:** edit `src/styles/tokens.css`. There is a light block and a dark block, and one accent color (`--ui-accent`) drives every highlight.
- **Content:** the sample conversations, names and figures live in the `data.ts` files. Replace them with your own data or pass your own props.
- **Motion:** entrances take 180-260 ms and exits 120-180 ms. With reduced motion turned on in the operating system, everything changes state without movement and stays fully usable.

## Components

### Kanban board

Columns of task cards with counts and work-in-progress limits; drag cards between columns or move them by keyboard, and add a card inline.

Component: `src/kits/kanban/kanban-board/KanbanBoard.tsx`. Live example: `src/kits/kanban/kanban-board/Preview.tsx`. Sample content: `src/kits/kanban/kanban-board/data.ts`.

| Prop | Type | What it does |
| --- | --- | --- |
| `columns` | `Column[]` | id, name and an optional wip limit. A column over its limit shows a warning count. |
| `tasks / onTasksChange` | `Task[] / (tasks: Task[]) => void` | Array order is board order. Every move or new card hands back the whole new array. |
| `people / labels` | `Person[] / Label[]` | Used for avatars and label chips on the cards. |
| `visible` | `(task: Task) => boolean` | Hides tasks without removing them, for filters. Hidden tasks keep their place. |
| `onOpenTask` | `(id: string) => void` | Called on click or Enter; open your detail panel here. |
| `createTask` | `(title, status, tasks) => Task` | Builds the task added from a column's Add task field. |

Keyboard and screen readers:

- Each card is a focusable draggable item; arrow keys move between cards and columns, Enter opens the card.
- Space picks a card up, arrows move it, Space or Enter drops it and Esc puts it back; each step is announced with column and position.
- Moving past a column's limit is announced, and the count says it is over the limit.
- Pointer drag starts after a small move with a mouse, or a long press on touch so the page still scrolls.
- With reduced motion cards jump to their new place; the spring is used only while dragging.

Ask an AI coding agent for it by name: "kanban board with drag and drop and WIP limits". Other names: task board, sprint board, drag and drop board, scrum board.

## Deploy the demo

Run `npm run build` and upload `dist/` to any static host, such as Cloudflare Pages, Netlify, Vercel or GitHub Pages.

## License

Made by HorizonX. Your HorizonX subscription lets you use this code in your own and your clients' projects. You may not resell or share it as a template, kit or component library. The libraries listed in CREDITS.md keep their own licenses.
