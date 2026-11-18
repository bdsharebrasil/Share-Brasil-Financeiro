import { target, type Rect } from "@/engine/geometry";
import { PRESS, timeline as script } from "@/engine/timeline";
import { DURATION, EASING } from "@/engine/tokens";
import { Avatar, Bar, Block, FEED, pct, type SceneProps } from "@/wireframe";

/**
 * The feed's list becomes a reorderable queue: each row gets a grip on the left and small up/down
 * arrows on the right. The cursor grabs the third row's grip and pulls it straight up to the top
 * while the rows above slide down out of its way; then it presses the top row's down arrow twice,
 * walking the row back to where it started.
 */
const LIST = { x: 28, y: 98, w: 504, h: 230 };
const SLOT = 46;
const ROW_H = 42;
const DRAGGED = 2;
const NAME_W = [96, 120, 84, 108, 72] as const;
const PREVIEW_W = [232, 196, 252, 214, 184] as const;

/** Rects in page px for a row sitting in `slot`. */
const grip = (slot: number): Rect => ({ x: LIST.x + 6, y: LIST.y + slot * SLOT + 6, w: 24, h: 30 });
const down = (slot: number): Rect => ({ x: LIST.x + LIST.w - 34, y: LIST.y + slot * SLOT + 9, w: 24, h: 24 });
const up = (slot: number): Rect => ({ x: LIST.x + LIST.w - 62, y: LIST.y + slot * SLOT + 9, w: 24, h: 24 });

/** Cursor rest point (stage px): under the list, a little left of centre. */
const REST = { x: 214, y: 334 };

/** Drag progress (0..1) at which the eased pointer has covered `fraction` of the way. */
function progressAt(fraction: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (EASING.inOut(mid) < fraction) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const DRAG_MS = 620;
const grabPoint = target(grip(DRAGGED), { fx: 0.5, fy: 0.5 });
const dropPoint = target(grip(0), { fx: 0.5, fy: 0.5 });
/** A displaced row moves once the dragged row's centre passes its centre. */
const crossing = (slot: number) => (grabPoint.y - (LIST.y + slot * SLOT + ROW_H / 2)) / (grabPoint.y - dropPoint.y);

/*
 * Choreography: a short, nearly straight approach from below up to the third row's grip; press and
 * lift (shadow and slight scale over 220 ms); a vertical pull to the top with a faint bow. Each row
 * above slides down 220 ms ease-out as the dragged row's centre crosses it. Release: the lift
 * drops over 160 ms ease-in. Then two presses on the down arrow, one row at a time, each a 220 ms
 * slide, and back to rest.
 */
const b = script({ cursor: REST, tracks: { hoverGrip: 0, lift: 0, carry: 0, placed: 0, shift0: 0, shift1: 0, down1: 0, down2: 0, pressDown: 0, hoverDown: 0 } })
  .wait(380)
  .moveTo(grabPoint, 560, { curve: 0.16 })
  .tween("hoverGrip", 1, DURATION.fast)
  .wait(110);

const grab = b.now;
const moveStart = grab + PRESS.down;
b.tween("lift", 1, DURATION.enter, { at: grab, ease: "out" })
  .set("carry", 1)
  .tween("shift1", 1, DURATION.enter, { at: moveStart + DRAG_MS * progressAt(crossing(1)), ease: "out" })
  .tween("shift0", 1, DURATION.enter, { at: moveStart + DRAG_MS * progressAt(crossing(0)) - 40, ease: "out" })
  .drag(dropPoint, DRAG_MS, { curve: 0.05 });

const release = b.now - PRESS.up;
b.tween("carry", 0, 1, { at: release })
  .tween("placed", 1, 1, { at: release })
  .tween("lift", 0, DURATION.exit, { at: release, ease: "in" })
  .tween("hoverGrip", 0, DURATION.fast, { at: release })
  .wait(260)
  .mark("moved")
  .moveTo(target(down(0)), 440, { curve: -0.22 })
  .tween("hoverDown", 1, DURATION.fast)
  .wait(90)
  .press({ key: "pressDown", anchor: "reorder-down-1" });

const first = b.lastClick;
b.tween("down1", 1, DURATION.enter, { at: first, ease: "out" })
  .wait(140)
  .moveTo(target(down(1)), 300, { curve: 0.1 })
  .press({ key: "pressDown", anchor: "reorder-down-2" });

const second = b.lastClick;
b.tween("down2", 1, DURATION.enter, { at: second, ease: "out" })
  .tween("hoverDown", 0, DURATION.fast, { at: second + 120 })
  .wait(280)
  // Back in the starting order: reset the bookkeeping tracks (no visible change).
  .set("shift0", 0)
  .set("shift1", 0)
  .set("placed", 0)
  .set("down1", 0)
  .set("down2", 0)
  .moveTo(REST, 520, { curve: -0.12 });

export const timeline = b.build();

/** Row 3 dropped at the top: shown under reduced motion. */
export const poster = timeline.marks.moved ?? 0;

/** Test hooks: where the drag starts and ends, and which rows the scene draws in which slot. */
export const geometry = { grip, down, up, grabPoint, dropPoint, LIST, SLOT };

/** Slot (fractional while sliding) of each original row, from the track values. */
export function slots(v: Record<string, number>): number[] {
  const { shift0 = 0, shift1 = 0, placed = 0, down1 = 0, down2 = 0 } = v;
  return [shift0 - down1, 1 + shift1 - down2, DRAGGED - DRAGGED * placed + down1 + down2, 3, 4];
}

function Arrow({ rect, dir, hover = 0, press = 0 }: { rect: Rect; dir: "up" | "down"; hover?: number; press?: number }) {
  const d = dir === "up" ? "M12 17V7M7.5 11.5 12 7l4.5 4.5" : "M12 7v10M7.5 12.5 12 17l4.5-4.5";
  return (
    <Block
      {...rect}
      r={8}
      tone="surface"
      style={{
        background: `color-mix(in srgb, var(--mk-secondary-hover) ${pct(hover)}%, var(--mk-surface))`,
        transform: press > 0 ? `scale(${1 - 0.1 * press})` : undefined,
      }}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke="var(--mk-wire-strong)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Block>
  );
}

export default function DragReorderScene({ frame }: SceneProps) {
  const v = frame.v as Record<string, number>;
  const { hoverGrip = 0, lift = 0, carry = 0, hoverDown = 0, pressDown = 0 } = v;
  const at = slots(v);
  // The moved row's current slot, for the arrow hover/press feedback.
  const movedSlot = Math.round(at[DRAGGED]!);
  const rows = [0, 1, 2, 3, 4].map((i) => {
    const following = i === DRAGGED && carry > 0;
    const y = following ? frame.cursor.y - (grabPoint.y - (LIST.y + DRAGGED * SLOT)) : LIST.y + at[i]! * SLOT;
    return { i, y };
  });
  // Draw the dragged row last so it passes over the others.
  rows.sort((a, b2) => (a.i === DRAGGED ? 1 : b2.i === DRAGGED ? -1 : 0));
  return (
    <>
      <FEED.Page />
      <div style={{ position: "absolute", left: LIST.x - 4, top: LIST.y - 2, width: LIST.w + 8, height: LIST.h + 4, background: "var(--mk-window)" }} />
      {rows.map(({ i, y }) => {
        const lifted = i === DRAGGED ? lift : 0;
        const isMoved = i === DRAGGED;
        return (
          <Block
            key={i}
            x={LIST.x}
            y={y}
            w={LIST.w}
            h={ROW_H}
            r={10}
            tone="surface"
            style={{
              boxShadow: `0 0 0 1px var(--mk-wire), 0 ${6 * lifted}px ${18 * lifted}px rgb(0 0 0 / ${0.14 * lifted})`,
              transform: lifted > 0 ? `scale(${1 + 0.015 * lifted})` : undefined,
            }}
          >
            <svg width={24} height={30} viewBox="0 0 24 30" style={{ position: "absolute", left: 6, top: 6 }}>
              {[9, 15, 21].flatMap((cy) =>
                [9, 15].map((cx) => (
                  <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={1.7}
                    fill={isMoved ? `color-mix(in srgb, var(--mk-accent) ${pct(Math.max(hoverGrip, lifted))}%, var(--mk-wire-strong))` : "var(--mk-wire-strong)"}
                  />
                )),
              )}
            </svg>
            <Avatar x={36} y={9} size={24} tone="title" />
            <Bar x={70} y={11} w={NAME_W[i]} h={8} tone={isMoved ? "strong" : "title"} />
            <Bar x={70} y={25} w={PREVIEW_W[i]} h={6} tone="base" />
            <Arrow rect={{ x: LIST.w - 62, y: 9, w: 24, h: 24 }} dir="up" />
            <Arrow
              rect={{ x: LIST.w - 34, y: 9, w: 24, h: 24 }}
              dir="down"
              hover={isMoved && movedSlot <= 1 ? hoverDown : 0}
              press={isMoved ? pressDown : 0}
            />
          </Block>
        );
      })}
      <div data-anchor="reorder-grip" style={{ position: "absolute", left: grip(DRAGGED).x, top: grip(DRAGGED).y, width: grip(DRAGGED).w, height: grip(DRAGGED).h }} />
      <div data-anchor="reorder-down-1" style={{ position: "absolute", left: down(0).x, top: down(0).y, width: 24, height: 24 }} />
      <div data-anchor="reorder-down-2" style={{ position: "absolute", left: down(1).x, top: down(1).y, width: 24, height: 24 }} />
    </>
  );
}
