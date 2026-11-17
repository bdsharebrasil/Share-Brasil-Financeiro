# AGENTS.md — Interactive Carousel

Instructions for AI coding agents (Codex, Claude Code, Cursor and others) working in this folder. The person you are working with always has the final say: when their request and these notes disagree, follow them.

## Project

A self-contained Svelte 5 gallery component. Images fan out along an arc, with drag, swipe, buttons and arrow keys.

- Stack: Svelte 5 single-file components (legacy `export let` syntax), plain CSS and JavaScript, no dependencies beyond `svelte`
- This folder is a component to add to another project, not a site that runs on its own.
- `README.md` is the buyer guide with the usage example and the props. `CREDITS.md` lists every library with its license.

## Where things are

- `ProductArcCarousel.svelte`: the component you import. It passes `images` and `alt` to the engine and fixes `variant="arc"`.
- `ProductSpatialGallery.svelte`: the shared motion engine (script, markup and scoped styles). The other HorizonX gallery styles use the same engine with a different `variant`.
- `README.md` (the buyer guide with usage and props), `CREDITS.md` (libraries), and `AGENTS.md` plus `CLAUDE.md` (instructions for AI coding agents).

## How to use it

- Copy both `.svelte` files into the same folder of a Svelte 5 project (for example `src/lib/`), because `ProductArcCarousel.svelte` imports `./ProductSpatialGallery.svelte`.
- Import `ProductArcCarousel` and pass `images` (an array of image URLs) and `alt` (the accessible label), as in the README example.
- Video URLs in `images` are filtered out; pass a handful of images so the gallery reads well.

## How to change things

- Motion and geometry defaults live in `defaultsFor('arc')` at the top of `ProductSpatialGallery.svelte` (spread, curve, tilt and duration in milliseconds).
- The built-in **Tune motion** panel lets you try Duration, Spread, Curve and Tilt live; copy the values you like into `defaultsFor('arc')`. Remove the `<details class="tune-panel">` block if you do not want visitors to see it.
- Colors, spacing and type are in the `<style>` block of `ProductSpatialGallery.svelte`; styles are scoped to the component.
- The component uses the classic reactive syntax (`export let`), which Svelte 5 runs in legacy mode; keep that syntax or convert the whole engine to runes in one change.

## Motion

- Motion is plain JavaScript (`requestAnimationFrame`) with CSS transforms; there is no animation library.
- `prefers-reduced-motion` is handled: the engine stops the animation loop and snaps to the selected image, and CSS transitions are turned off.

## Rules for this project

- Keep `ProductArcCarousel.svelte` as a thin wrapper; put behavior changes in `ProductSpatialGallery.svelte`.
- Keep the keyboard, button and drag controls and their ARIA labels working; the stage has `role="group"` and the dots are a `tablist`.
- Change defaults in `defaultsFor('arc')` instead of hard-coding numbers elsewhere.
- Keep the current look and motion unless the user asks to change them. Before a large change, say what you plan to do.
- Keep the props in `README.md` working. If you add or change a prop, update the props list in `README.md`.
- Every animation you add or change must keep working with `prefers-reduced-motion`.
- Fonts are not covered by the HorizonX license. If the user adds or changes fonts, use ones they own or have a license for, and never download font files they did not provide.
- When you add a library or image, add it to `CREDITS.md` with its version and license.
- Do not add analytics, tracking or other third-party scripts unless the user asks for them.

## Check your work

1. Add the component to a page in a Svelte 5 project (for example a new SvelteKit app) with six or more images, and run that project's dev server.
2. Make sure the browser console shows no errors and every image loads.
3. Try every interaction the README describes at 390 px and 1440 px wide.
4. Turn on reduced motion in the operating system and check that the images still appear and stay usable.

## License

The component is licensed to its owner through their HorizonX membership. Building and shipping sites and apps with it is allowed; publishing or reselling the source files as a component or template is not. Terms: https://horizonx.so/terms
