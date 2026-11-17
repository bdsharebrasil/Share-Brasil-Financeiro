# Interactive Carousel (Arc)

A production-ready, self-contained Svelte 5 gallery component. Images fan out
along an arc with drag, keyboard, and pointer navigation, honoring
`prefers-reduced-motion`.

## Files

- `ProductArcCarousel.svelte` — the component you import. Thin wrapper that
  locks the engine to the `arc` variant.
- `ProductSpatialGallery.svelte` — the motion engine (all three carousel
  styles share it; this copy is pinned to `arc` by the wrapper).

## Requirements

- Svelte 5 (runes not required — uses classic reactive `$:` syntax).
- No external dependencies beyond `svelte` itself.

## Usage

```svelte
<script>
  import ProductArcCarousel from './ProductArcCarousel.svelte';

  const images = [
    '/covers/one.jpg',
    '/covers/two.jpg',
    '/covers/three.jpg'
  ];
</script>

<ProductArcCarousel {images} alt="My gallery" />
```

## Props

| Prop     | Type       | Default | Description                                  |
| -------- | ---------- | ------- | -------------------------------------------- |
| `images` | `string[]` | `[]`    | Image URLs. Video URLs are filtered out.     |
| `alt`    | `string`   | `''`    | Accessible label / caption fallback.         |

## Notes

- Needs at least a few images to read as a carousel.
- Geometry/motion defaults (spread, curve, tilt, duration) live at the top of
  `ProductSpatialGallery.svelte` under `defaultsFor('arc')` — tweak there.

---

## From HorizonX

Made by HorizonX · Version 1.0.1 · October 2026

### Keep building with AI

Open this folder in an AI coding agent such as Claude Code or Codex and ask in plain words. The folder includes `AGENTS.md` (and a `CLAUDE.md` that points to it), so Codex, Claude Code, Cursor and other agents learn how the component works and how to check their work before they change anything. Some examples:

- "Read README.md and ProductArcCarousel.svelte, then add this component to my page with my images."
- "Make the motion slower and keep the reduced-motion behavior."
- "Port this component to React or Vue without changing how it looks or moves."

To add more HorizonX components from your agent, connect the HorizonX MCP server (included in your membership): https://horizonx.so/mcp

### License

Your HorizonX membership gives you a commercial license for this component: use it and adapt it in personal, client and commercial projects. You may not resell, redistribute, sublicense or publicly share the original source files. Full terms: https://horizonx.so/terms.
Libraries are listed with their own licenses in `CREDITS.md`. Fonts are not covered by the HorizonX license: if you add or change them, use fonts you own or have a license for.

### Need help?

Write to support@horizonx.so and mention **Interactive Carousel**.
