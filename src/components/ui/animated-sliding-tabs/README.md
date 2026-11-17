# Animated Sliding tabs

A tabbed view whose active indicator moves while the associated panel changes. An accessible React component with its animation, keyboard support and reduced-motion behavior built in.

Made by HorizonX · Version 1.0.0 · October 2026

## Start here

1. Unzip this folder.
2. Start a local web server inside it:
   - Install the libraries: `npm install` (or `pnpm install`)
   - Start the demo page: `npm run dev`
3. Open the address Vite prints, usually `http://localhost:5173` in your browser.

You need Node.js 22 or newer. `npm run build` writes a static copy of the demo page to `dist/`, and `npm run typecheck` checks the TypeScript types.

## What's inside

- `src/components/sliding-tabs/Component.tsx`: the component. It exports the reusable parts and a `Playground` example that the demo page renders.
- `src/primitives/tabs.tsx`: the accessible behavior (focus, keyboard, dismiss) the component is built on.
- `src/engine/tokens.ts`: shared motion values: durations, easing curves and distances.
- `src/ui/Button.tsx`: the button used inside the component and on the demo page.
- `src/styles/tokens.css`: colors, corners, font and easing as CSS variables, for the light and dark themes. `src/styles/index.css` maps them to Tailwind classes such as `bg-surface` and `text-muted`.
- `src/main.tsx` and `index.html`: the demo page.
- `package.json`, `vite.config.ts`, `tsconfig.json`: the project setup.
- `README.md` (this guide), `CREDITS.md` (libraries and their licenses), and `AGENTS.md` plus `CLAUDE.md` (instructions for AI coding agents).

## Page sections

- One page with the live component in the middle and a light/dark theme switch. Try it with the mouse and with the keyboard.
- **Use it for:**
   - Switch related panels within the same page context.
   - Give each panel a meaningful tab label; use segmented-control for a single setting rather than panels.
- **Pick something else when:**
   - Separate page destinations needing URL navigation: use pagination or collapsible-sidebar.
   - Sections that should remain independently open: use accordion.
- **Keyboard and screen readers:**
   - Use tablist, tab, and tabpanel roles with selected state and linked IDs.
   - Roving tabindex: arrows move focus; Home/End reach first/last tab.
   - Manual mode uses Enter/Space to activate; automatic mode is suitable only when panels appear without noticeable delay.
   - Hide inactive panels from interaction and keep a visible focus indicator separate from selection.
   - Reduced motion: Place indicator and switch panels immediately (0 ms); no travel or crossfade.

## Make it yours

- **Put it in your app:** copy `src/components/sliding-tabs/`, `src/primitives/tabs.tsx`, `src/engine/tokens.ts`, `src/ui/Button.tsx` and the two files in `src/styles/` into your project, keep the `@/` path alias pointing at your source folder, and install `@base-ui/react`, `motion`. Then import from `@/components/sliding-tabs/Component`. The `Playground` function at the end of that file is a complete usage example.
- **Colors, corners and font:** edit the variables in `src/styles/tokens.css`; there is a light block and a dark block. Every color in the component reads from them.
- **Text and content:** change the labels and items inside `Playground` in `src/components/sliding-tabs/Component.tsx`, or pass your own when you use the component.
- **Ask an AI agent for this pattern by name:** "tabs with sliding active indicator". Other names people use: Sliding tabs, Animated tabs, Tabs.

## Motion

- enter (pill slides to the new tab, entering panel fades in): **220 ms**, `cubic-bezier(0.2, 0.8, 0.2, 1)`
- exit (leaving panel fades out): **160 ms**, `cubic-bezier(0.4, 0, 1, 1)`
- reduced motion: **0 ms**, `linear`
- Durations and easing curves live in `src/engine/tokens.ts`; the component reads them, so changing a value there changes the motion.
- With reduced motion turned on in the operating system, the component changes state without movement and stays fully usable.

## Deploy

- This folder is a component with a demo page. To ship it, add the component to your own app (see "Make it yours").
- To put the demo page itself online, run `npm run build` and upload the `dist/` folder to any static host, such as Cloudflare Pages, Netlify, Vercel or GitHub Pages.

## Keep building with AI

Open this folder in an AI coding agent such as Claude Code or Codex and ask in plain words. The folder includes `AGENTS.md` (and a `CLAUDE.md` that points to it), so Codex, Claude Code, Cursor and other agents learn how the project is built and how to check their work before they change anything. Some examples:

- "Read README.md and index.html, then change the brand colors to my palette: …"
- "Replace the copy with content for my studio. Keep the layout and the animations."
- "Port this page to Vue 3 or Svelte 5 without changing how it looks or moves."

To add more HorizonX components to the page from your agent, connect the HorizonX MCP server (included in your membership): https://horizonx.so/mcp

## License

Your HorizonX membership gives you a commercial license for this template: use it and adapt it in personal, client and commercial projects. You may not resell, redistribute, sublicense or publicly share the original source files. Full terms: https://horizonx.so/terms.
Libraries and images are listed with their own licenses in `CREDITS.md`. Fonts are not covered by the HorizonX license: if you change them, use fonts you own or have a license for.

## Need help?

Write to support@horizonx.so and mention **Animated Sliding tabs**.
