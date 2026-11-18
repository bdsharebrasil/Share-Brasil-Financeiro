import { target, type Rect } from "@/engine/geometry";
import { timeline as script } from "@/engine/timeline";
import { DURATION } from "@/engine/tokens";
import { Avatar, Bar, Block, DASHBOARD, pct, type SceneProps } from "@/wireframe";

/**
 * The dashboard's middle KPI tile grows into a detail panel over the content column (the page dims
 * behind it), the extra detail fades in once the panel has its size, and the close button shrinks
 * it back into the tile. The tile's own header never scales: it rides along at the top-left.
 */
const SOURCE: Rect = DASHBOARD.targets.kpi1;
const DETAIL: Rect = { x: 152, y: 60, w: 380, h: 268 };
const CLOSE: Rect = { x: DETAIL.x + DETAIL.w - 16 - 24, y: DETAIL.y + 14, w: 24, h: 24 };
const PAGE = { w: 560, h: 344 };

/** Cursor rest point (stage px): lower right, over the chart. */
const REST = { x: 448, y: 318 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/*
 * Choreography: a slow, deliberate approach from the lower right that bends up into the middle
 * tile; a press grows the tile into the panel (220 ms ease-out) while the page dims, and the
 * detail fades in over the last part of the growth (120 ms). The panel stays open for about a
 * second and a half; the cursor drifts to the close button, presses it, and the panel shrinks back
 * into the tile (160 ms ease-in) with the detail gone first.
 */
const b = script({ cursor: REST, tracks: { open: 0, scrim: 0, detail: 0, hoverCard: 0, pressCard: 0, hoverClose: 0, pressClose: 0 } })
  .wait(600)
  .moveTo(target(SOURCE, { fx: 0.42, fy: 0.58 }), 720, { curve: 0.3 })
  .tween("hoverCard", 1, DURATION.fast)
  .wait(180)
  .press({ key: "pressCard", anchor: "card-kpi1" });

const opened = b.lastClick;
b.tween("open", 1, DURATION.enter, { at: opened, ease: "out" })
  .tween("scrim", 1, DURATION.enter, { at: opened, ease: "out" })
  .tween("detail", 1, DURATION.fast, { at: opened + DURATION.enter - DURATION.fast + 20, ease: "out" })
  .tween("hoverCard", 0, DURATION.fast, { at: opened })
  .wait(420)
  .mark("open")
  .moveTo(target(CLOSE, { fx: 0.5, fy: 0.55 }), 540, { curve: -0.18 })
  .tween("hoverClose", 1, DURATION.fast)
  .wait(260)
  .press({ key: "pressClose", anchor: "card-close" });

const closed = b.lastClick;
b.tween("detail", 0, DURATION.fast, { at: closed - 40, ease: "in" })
  .tween("open", 0, DURATION.exit, { at: closed, ease: "in" })
  .tween("scrim", 0, DURATION.exit, { at: closed, ease: "in" })
  .tween("hoverClose", 0, DURATION.fast, { at: closed })
  .wait(320)
  .moveTo(REST, 640, { curve: 0.16 });

export const timeline = b.build();

/** The detail panel fully open: shown under reduced motion. */
export const poster = timeline.marks.open ?? 0;

const BARS = [30, 44, 38, 56, 50, 68, 62, 80] as const;

function Detail() {
  return (
    <>
      <Bar x={16} y={86} w={120} h={6} tone="base" />
      {BARS.map((h, i) => (
        <Bar key={i} x={16 + i * 26} y={196 - h} w={16} h={h} r={3} tone={i === BARS.length - 1 ? "strong" : "title"} />
      ))}
      {[0, 1, 2].map((i) => (
        <Block key={i} x={236} y={86 + i * 38} w={128} h={30} r={8} tone="panel">
          <Avatar x={8} y={8} size={14} tone="title" />
          <Bar x={30} y={12} w={52 - i * 8} h={6} tone="title" />
          <Bar x={96} y={12} w={22} h={6} tone="strong" />
        </Block>
      ))}
      <Bar x={16} y={214} w={348} h={1} tone="title" />
      <Block x={16} y={226} w={110} h={28} r={8} tone="accent" />
      <Bar x={140} y={237} w={64} h={6} tone="base" />
    </>
  );
}

export default function CardExpandScene({ frame }: SceneProps) {
  const { open, scrim, detail, hoverCard, pressCard, hoverClose, pressClose } = frame.v as Record<
    "open" | "scrim" | "detail" | "hoverCard" | "pressCard" | "hoverClose" | "pressClose",
    number
  >;
  const r = between(SOURCE, DETAIL, open);
  const shown = open > 0.001;
  return (
    <>
      <DASHBOARD.Page />
      {scrim > 0 ? <Block x={0} y={0} w={PAGE.w} h={PAGE.h} r={0} style={{ background: "var(--mk-scrim)", opacity: scrim }} /> : null}
      <div data-anchor="card-kpi1" style={{ position: "absolute", left: SOURCE.x, top: SOURCE.y, width: SOURCE.w, height: SOURCE.h }} />
      <Block
        {...r}
        r={lerp(10, 14, open)}
        tone={shown ? "surface" : "panel"}
        style={{
          overflow: "hidden",
          boxShadow: shown
            ? `0 ${pct(open) / 6}px ${pct(open) / 2.5}px rgb(0 0 0 / ${0.16 * open})`
            : `0 0 0 ${1.5 * hoverCard}px var(--mk-wire-strong)`,
          transform: pressCard > 0 && !shown ? `scale(${1 - 0.03 * pressCard})` : undefined,
        }}
      >
        <Bar x={14} y={14} w={44} h={6} tone="base" />
        <Bar x={14} y={30} w={68} h={14} tone="title" />
        <Bar x={14} y={50} w={36} h={6} tone="strong" />
        <Avatar x={94} y={12} size={12} tone="title" style={{ opacity: 1 - open }} />
        <div style={{ position: "absolute", inset: 0, opacity: detail }}>
          <Detail />
          <Block
            x={CLOSE.x - DETAIL.x}
            y={CLOSE.y - DETAIL.y}
            w={CLOSE.w}
            h={CLOSE.h}
            r={12}
            tone="surface"
            style={{
              background: `color-mix(in srgb, var(--mk-secondary-hover) ${pct(hoverClose)}%, var(--mk-surface))`,
              transform: pressClose > 0 ? `scale(${1 - 0.08 * pressClose})` : undefined,
            }}
          >
            <svg width={24} height={24} viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }}>
              <path d="M8 8l8 8M16 8l-8 8" stroke="var(--mk-wire-strong)" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </Block>
        </div>
      </Block>
      <div data-anchor="card-close" style={{ position: "absolute", left: CLOSE.x, top: CLOSE.y, width: CLOSE.w, height: CLOSE.h }} />
    </>
  );
}
