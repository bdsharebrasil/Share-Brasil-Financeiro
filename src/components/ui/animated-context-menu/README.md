# Animated Context menu

A command menu opened at a pointer location or from the focused target. An accessible React component with its animation, keyboard support and reduced-motion behavior built in.

Made by HorizonX · Version 1.0.0 · October 2026

## Start here

1. Unzip this folder.
2. Start a local web server inside it:
   - Install the libraries: `npm install` (or `pnpm install`)
   - Start the demo page: `npm run dev`
3. Open the address Vite prints, usually `http://localhost:5173` in your browser.

You need Node.js 22 or newer. `npm run build` writes a static copy of the demo page to `dist/`, and `npm run typecheck` checks the TypeScript types.

## What's inside

- `src/components/context-menu/Component.tsx`: the component. It exports the reusable parts and a `Playground` example that the demo page renders.
- `src/components/context-menu/timing.ts`: values the component reads (durations and distances).
- `src/primitives/context-menu.tsx`: the accessible behavior (focus, keyboard, dismiss) the component is built on.
- `src/ui/Button.tsx`: the button used inside the component and on the demo page.
- `src/styles/tokens.css`: colors, corners, font and easing as CSS variables, for the light and dark themes. `src/styles/index.css` maps them to Tailwind classes such as `bg-surface` and `text-muted`.
- `src/main.tsx` and `index.html`: the demo page.
- `package.json`, `vite.config.ts`, `tsconfig.json`: the project setup.
- `README.md` (this guide), `CREDITS.md` (libraries and their licenses), and `AGENTS.md` plus `CLAUDE.md` (instructions for AI coding agents).

## Page sections

- One page with the live component in the middle and a light/dark theme switch. Try it with the mouse and with the keyboard.
- **Use it for:**
   - Provide object-specific actions on a file or list row.
   - Support familiar right-click workflows; use dropdown-menu as the visible discoverable equivalent.
- **Pick something else when:**
   - The only route to an essential command: include dropdown-menu access.
   - Input suggestions or choices: use combobox.
- **Keyboard and screen readers:**
   - Give the target a keyboard focus route; Shift+F10 and the Menu key open at that target, not a stale pointer coordinate.
   - Use role=menu/menuitem with arrow navigation, typeahead, and Enter/Space activation.
   - Escape closes and restores focus to the invoking target.
   - Also expose important actions through a named visible button; keep the menu within the viewport.
   - Reduced motion: Open/close immediately (0 ms); preserve the correct anchor and keyboard behavior.

## Make it yours

- **Put it in your app:** copy `src/components/context-menu/`, `src/primitives/context-menu.tsx`, `src/ui/Button.tsx` and the two files in `src/styles/` into your project, keep the `@/` path alias pointing at your source folder, and install `@base-ui/react`. Then import from `@/components/context-menu/Component`. The `Playground` function at the end of that file is a complete usage example.
- **Colors, corners and font:** edit the variables in `src/styles/tokens.css`; there is a light block and a dark block. Every color in the component reads from them.
- **Text and content:** change the labels and items inside `Playground` in `src/components/context-menu/Component.tsx`, or pass your own when you use the component.
- **Ask an AI agent for this pattern by name:** "context menu". Other names people use: Context menu, Right-click menu.

## Motion

- enter (fade + scale 0.98 to 1 around the pointer): **180 ms**, `cubic-bezier(0.2, 0.8, 0.2, 1)`
- exit (fade): **120 ms**, `cubic-bezier(0.4, 0, 1, 1)`
- reduced motion: **0 ms**, `linear`
- Durations and easing curves live in `src/components/context-menu/timing.ts`; the component reads them, so changing a value there changes the motion.
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

Write to support@horizonx.so and mention **Animated Context menu**.
