# AGENTS.md — Animated Sheet

Instructions for AI coding agents (Codex, Claude Code, Cursor and others) working in this folder. The person you are working with always has the final say: when their request and these notes disagree, follow them.

## Project

A modal side panel that keeps the originating page visible behind a backdrop. An accessible React component with its animation, keyboard support and reduced-motion behavior built in.

- Stack: React 19 and TypeScript, styled with Tailwind CSS 4, animated with Motion 14 (`motion/react`), behavior from Base UI, built with Vite 8
- `README.md` is the buyer guide. `CREDITS.md` lists every library and image with its license. `LICENSE.md` (when present) is the HorizonX license.

## Run it

   - Install the libraries: `npm install` (or `pnpm install`)
   - Start the demo page: `npm run dev`

Then open the address Vite prints, usually `http://localhost:5173`.

## Where things are

- `src/components/sheet/Component.tsx`: the component. It exports the reusable parts and a `Playground` example that the demo page renders.
- `src/components/sheet/timing.ts`: values the component reads (durations and distances).
- `src/primitives/dialog.tsx`: the accessible behavior (focus, keyboard, dismiss) the component is built on.
- `src/engine/tokens.ts`: shared motion values: durations, easing curves and distances.
- `src/ui/Button.tsx`: the button used inside the component and on the demo page.
- `src/styles/tokens.css`: colors, corners, font and easing as CSS variables, for the light and dark themes. `src/styles/index.css` maps them to Tailwind classes such as `bg-surface` and `text-muted`.
- `src/main.tsx` and `index.html`: the demo page.
- `package.json`, `vite.config.ts`, `tsconfig.json`: the project setup.
- `README.md` (this guide), `CREDITS.md` (libraries and their licenses), and `AGENTS.md` plus `CLAUDE.md` (instructions for AI coding agents).

## How to change things

- **Put it in your app:** copy `src/components/sheet/`, `src/primitives/dialog.tsx`, `src/engine/tokens.ts`, `src/ui/Button.tsx` and the two files in `src/styles/` into your project, keep the `@/` path alias pointing at your source folder, and install `@base-ui/react`, `motion`. Then import from `@/components/sheet/Component`. The `Playground` function at the end of that file is a complete usage example.
- **Colors, corners and font:** edit the variables in `src/styles/tokens.css`; there is a light block and a dark block. Every color in the component reads from them.
- **Text and content:** change the labels and items inside `Playground` in `src/components/sheet/Component.tsx`, or pass your own when you use the component.
- **Ask an AI agent for this pattern by name:** "side sheet". Other names people use: Side sheet, Side panel, Sheet.

## Motion

- enter (slide from the edge, backdrop fade): **240 ms**, `cubic-bezier(0.2, 0.8, 0.2, 1)`
- exit (slide back to the edge): **180 ms**, `cubic-bezier(0.4, 0, 1, 1)`
- reduced motion: **0 ms**, `linear`
- Durations and easing curves live in `src/engine/tokens.ts` and `src/components/sheet/timing.ts`; the component reads them, so changing a value there changes the motion.
- With reduced motion turned on in the operating system, the component changes state without movement and stays fully usable.

## Rules for this project

- The component lives in `src/components/sheet/Component.tsx`. Keep its exported names and props working; `Playground` shows how they fit together.
- Focus handling, keyboard support and dismissal come from `src/primitives/dialog.tsx`. Build on them instead of rewriting that behavior.
- Colors come from the CSS variables in `src/styles/tokens.css` through Tailwind classes. Use those classes or variables instead of hard-coded colors, and check both the light and the dark theme.
- Durations and easing come from `src/engine/tokens.ts` and `src/components/sheet/timing.ts`. Reuse them so the motion stays consistent.
- Before you finish, run `npm run typecheck` and `npm run build`; both must pass.
- Keep the current look and motion unless the user asks to change them. Before a large change, say what you plan to do.
- Every animation you add or change must keep working with `prefers-reduced-motion` and when its script fails to load.
- Fonts are not covered by the HorizonX license. If the user changes the fonts, use ones they own or have a license for, and never download font files they did not provide.
- When you add a library, font or image, add it to `CREDITS.md` with its version and license.
- Do not add analytics, tracking or other third-party scripts unless the user asks for them.

## Check your work

1. Serve the folder and open every section of the page.
2. Make sure the browser console shows no errors and no file returns 404.
3. Check the layout at 390 px and 1440 px wide.
4. Turn on reduced motion in the operating system and check that the content still appears.

## License

The template is licensed to its owner through their HorizonX membership. Building and shipping sites from it is allowed; publishing or reselling the source files as a template is not. Terms: https://horizonx.so/terms
