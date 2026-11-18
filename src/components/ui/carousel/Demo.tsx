import { target, type Rect } from "@/engine/geometry";
import { PRESS, timeline as script } from "@/engine/timeline";
import { DURATION } from "@/engine/tokens";
import { Avatar, Bar, Block, LANDING, pct, type SceneProps } from "@/wireframe";

/**
 * A three-slide carousel drawn over the landing page's hero media panel: a white viewport with
 * the slides side by side (a bar chart, a quote, a picture), round previous/next arrows on its
 * edges and a dot row underneath where the current dot stretches into a dark pill.
 */
const PANEL: Rect = LANDING.targets.media;
const VIEW: Rect = { x: 10, y: 10, w: 212, h: 108 };
const SLIDE_W = VIEW.w;
const ARROW = 24;
const PREV: Rect = { x: 16, y: VIEW.y + (VIEW.h - ARROW) / 2, w: ARROW, h: ARROW };
const NEXT: Rect = { x: VIEW.x + VIEW.w - 6 - ARROW, y: PREV.y, w: ARROW, h: ARROW };
const DOT_Y = 132;
const DOT = 6;
const DOT_ON = 18;
const DOT_GAP = 6;
/** Hit box around each dot (panel px), so presses have something to land on. */
const DOT_HIT = 16;
const inPage = (r: Rect): Rect => ({ ...r, x: PANEL.x + r.x, y: PANEL.y + r.y });

/** How far the drag pulls the strip before letting go (px). */
const PULL = 64;

/** Dot boxes for a fractional slide position: the current dot widens, the rest stay round. */
function dots(pos: number): Rect[] {
  const widths = [0, 1, 2].map((i) => DOT + (DOT_ON - DOT) * Math.max(0, 1 - Math.abs(pos - i)));
  const total = widths.reduce((a, w) => a + w, 0) + DOT_GAP * 2;
  let x = (PANEL.w - total) / 2;
  return widths.map((w) => {
    const r = { x, y: DOT_Y, w, h: DOT };
    x += w + DOT_GAP;
    return r;
  });
}
/** Resting dot boxes on slide 3 (where dot 1 is pressed from). */
const dotHit = (i: number, pos: number): Rect => {
  const d = dots(pos)[i]!;
  return { x: d.x + d.w / 2 - DOT_HIT / 2, y: DOT_Y + DOT / 2 - DOT_HIT / 2, w: DOT_HIT, h: DOT_HIT };
};

/** Cursor rest point (stage px): under the hero copy, left of the stat tiles. */
const REST = { x: 176, y: 262 };

/*
 * Choreography: a wide arc from the lower left up to the next arrow; one press moves the strip a
 * slide (220 ms ease-out). The cursor drops into the slide and drags it left; on release the strip
 * keeps going to slide 3 and settles over 320 ms (momentum, no bounce). The cursor then dips to
 * dot 1, presses it, and the strip travels back two slides (220 ms) while it returns to rest.
 */
const b = script({ cursor: REST, tracks: { pos: 0, hoverNext: 0, pressNext: 0, pressDot: 0, hoverDot: 0 } })
  .wait(500)
  .moveTo(target(inPage(NEXT), { fx: 0.55, fy: 0.6 }), 620, { curve: -0.24 })
  .tween("hoverNext", 1, DURATION.fast)
  .wait(140)
  .press({ key: "pressNext", anchor: "carousel-next" });

const toTwo = b.lastClick;
b.tween("pos", 1, DURATION.enter, { at: toTwo, ease: "out" })
  .tween("hoverNext", 0, DURATION.fast, { at: toTwo + 80 })
  .wait(240)
  .moveTo(target(inPage(VIEW), { fx: 0.62, fy: 0.46 }), 380, { curve: 0.12 });

const grab = b.now;
b.drag(target(inPage(VIEW), { fx: 0.62 - PULL / VIEW.w, fy: 0.5 }), 300, { curve: 0.02, ease: "in" });
b.tween("pos", 1 + PULL / SLIDE_W, 300, { at: grab + PRESS.down, ease: "in" });
const release = b.now - PRESS.up;
b.tween("pos", 2, DURATION.slow, { at: release, ease: "out" })
  .wait(260)
  .mark("onThree")
  .moveTo(target(inPage(dotHit(0, 2))), 500, { curve: 0.2 })
  .tween("hoverDot", 1, DURATION.fast)
  .wait(100)
  .press({ key: "pressDot", anchor: "carousel-dot1" });

const toOne = b.lastClick;
b.tween("pos", 0, DURATION.enter, { at: toOne, ease: "out" })
  .tween("hoverDot", 0, DURATION.fast, { at: toOne })
  .wait(320)
  .moveTo(REST, 560, { curve: -0.14 });

export const timeline = b.build();

/** Slide 3 settled after the drag: shown under reduced motion. */
export const poster = timeline.marks.onThree ?? 0;

const BARS = [34, 52, 40, 66, 58, 74] as const;

function ChartSlide() {
  return (
    <>
      <Avatar x={14} y={14} size={22} tone="title" />
      <Bar x={44} y={18} w={64} h={7} tone="title" />
      <Bar x={44} y={30} w={40} h={5} tone="base" />
      {BARS.map((h, i) => (
        <Bar key={i} x={64 + i * 22} y={96 - h * 0.7} w={12} h={h * 0.7} r={3} tone={i === 5 ? "strong" : "title"} />
      ))}
    </>
  );
}

function QuoteSlide() {
  return (
    <>
      <Bar x={44} y={20} w={14} h={10} r={3} tone="strong" />
      <Bar x={44} y={38} w={124} h={8} tone="title" />
      <Bar x={44} y={52} w={108} h={8} tone="title" />
      <Avatar x={44} y={72} size={20} tone="title" />
      <Bar x={70} y={75} w={52} h={6} tone="strong" />
      <Bar x={70} y={86} w={36} h={5} tone="base" />
    </>
  );
}

function PictureSlide() {
  return (
    <>
      <Block x={36} y={12} w={140} h={84} r={8} tone="panel">
        <Avatar x={96} y={14} size={16} tone="title" />
        <svg width={140} height={84} viewBox="0 0 140 84" style={{ position: "absolute", left: 0, top: 0 }}>
          <polygon points="0,84 38,40 64,62 92,30 140,72 140,84" fill="var(--mk-wire-title)" />
          <polygon points="0,84 30,62 58,74 90,56 140,84" fill="var(--mk-wire-strong)" opacity={0.55} />
        </svg>
      </Block>
    </>
  );
}

const SLIDES = [ChartSlide, QuoteSlide, PictureSlide] as const;

function Chevron({ dir }: { dir: "left" | "right" }) {
  const d = dir === "right" ? "M10 7l5 5-5 5" : "M14 7l-5 5 5 5";
  return (
    <svg width={ARROW} height={ARROW} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={d} fill="none" stroke="var(--mk-wire-strong)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CarouselScene({ frame }: SceneProps) {
  const { pos, hoverNext, pressNext, pressDot, hoverDot } = frame.v as Record<
    "pos" | "hoverNext" | "pressNext" | "pressDot" | "hoverDot",
    number
  >;
  const strip = -pos * SLIDE_W;
  const dotBoxes = dots(pos);
  return (
    <>
      <LANDING.Page />
      <Block {...PANEL} r={12}>
        <Block {...VIEW} r={8} tone="surface" style={{ overflow: "hidden" }}>
          {SLIDES.map((Slide, i) => (
            <div key={i} style={{ position: "absolute", left: strip + i * SLIDE_W, top: 0, width: SLIDE_W, height: VIEW.h }}>
              <Slide />
            </div>
          ))}
        </Block>
        <Block
          {...PREV}
          r={ARROW / 2}
          tone="surface"
          style={{ boxShadow: "0 0 0 1px var(--mk-wire)", opacity: pos < 0.5 ? 0.55 : 1 }}
        >
          <Chevron dir="left" />
        </Block>
        <Block
          {...NEXT}
          r={ARROW / 2}
          tone="surface"
          style={{
            boxShadow: "0 0 0 1px var(--mk-wire)",
            background: `color-mix(in srgb, var(--mk-secondary-hover) ${pct(hoverNext)}%, var(--mk-surface))`,
            transform: pressNext > 0 ? `scale(${1 - 0.06 * pressNext})` : undefined,
          }}
        >
          <div data-anchor="carousel-next" style={{ position: "absolute", inset: 0 }} />
          <Chevron dir="right" />
        </Block>
        {dotBoxes.map((d, i) => {
          const on = Math.max(0, 1 - Math.abs(pos - i));
          const hovered = i === 0 ? hoverDot : 0;
          return (
            <Block
              key={i}
              {...d}
              r={DOT / 2}
              style={{
                background: `color-mix(in srgb, var(--mk-accent) ${pct(on)}%, color-mix(in srgb, var(--mk-wire-strong) ${pct(hovered)}%, var(--mk-wire-title)))`,
                transform: i === 0 && pressDot > 0 ? `scale(${1 - 0.1 * pressDot})` : undefined,
              }}
            />
          );
        })}
        <div
          data-anchor="carousel-dot1"
          style={{ position: "absolute", left: dotHit(0, 2).x, top: dotHit(0, 2).y, width: DOT_HIT, height: DOT_HIT }}
        />
      </Block>
    </>
  );
}
