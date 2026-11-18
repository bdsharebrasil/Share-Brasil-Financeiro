import { pageToStage, type Rect } from "@/engine/geometry";
import { timeline as script, type Point } from "@/engine/timeline";
import { Avatar, Bar, Block, MOBILE, PHONE, pct, type SceneProps } from "@/wireframe";
import { SWIPE_MS } from "./timing";

/**
 * Mobile template: below the segmented control the phone's cards become an inbox, four rows split by
 * inset hairlines. Row 2 is swiped left past half its width, the dark Delete action is revealed under
 * it, the row collapses and a dark undo snackbar rises above the tab bar; Undo brings the row back.
 */
const LIST_TOP = 92;
const ROW_H = 42;
const ROWS = 4;
const SWIPED = 1;
/** Rows in phone px. */
const row = (i: number): Rect => ({ x: 0, y: LIST_TOP + i * ROW_H, w: PHONE.w, h: ROW_H });
/** Cursor travel of the swipe; the row follows it 1:1. */
export const SWIPE_DX = 112;
/** Delete threshold: half the row width, as in the real component. */
export const THRESHOLD_PX = PHONE.w / 2;
/** Width of the revealed action before the threshold. */
const ACTION_PX = 88;
/** Undo snackbar and its Undo button, phone px (button relative to the snackbar). */
export const SNACK: Rect = { x: 12, y: 222, w: 148, h: 34 };
export const UNDO: Rect = { x: 100, y: 3, w: 44, h: 28 };

const TITLE_W = [70, 82, 60, 76];
const DETAIL_W = [92, 64, 84, 70];
const META_W = [16, 18, 14, 20];

const toPage = (r: Rect, inside?: Rect): Rect => ({
  x: PHONE.x + (inside?.x ?? 0) + r.x,
  y: PHONE.y + (inside?.y ?? 0) + r.y,
  w: r.w,
  h: r.h,
});
const at = (r: Rect, fx: number, fy = 0.5): Point => pageToStage({ x: r.x + r.w * fx, y: r.y + r.h * fy });

/** Page rects, exported for the tests. */
export const SWIPED_ROW = toPage(row(SWIPED));
export const UNDO_BUTTON = toPage(UNDO, SNACK);

/** Cursor rest point (stage px): on the backdrop right of the phone, above the middle. */
const REST = { x: 470, y: 168 };
const GRAB = at(SWIPED_ROW, 0.8, 0.52);
const RELEASE = { x: GRAB.x - SWIPE_DX, y: GRAB.y + 2 };

/*
 * Choreography: idle; glide left onto row 2 and press; drag it left past the threshold (the row
 * follows the cursor, the action fills in behind and its icon starts riding the row's edge once
 * armed); release: the row collapses and fades (180 ms ease-in) while the rows below close the gap,
 * then the snackbar rises (200 ms ease-out). The cursor drops to Undo, taps it: the snackbar leaves
 * (180 ms ease-in) and the row opens back in place (200 ms ease-out). Back to rest.
 */
const b = script({ cursor: REST, tracks: { swipe: 0, gone: 0, toast: 0, undoHover: 0 } })
  .wait(1000)
  .moveTo(GRAB, 560, { curve: 0.2 })
  .wait(60)
  .mark("grab");
const grabbed = b.now;
b.drag(RELEASE, 520, { key: "swipe" });
/** Button-up moment of the drag: the release. */
const release = grabbed + 90 + 520;
b.tween("gone", 1, SWIPE_MS.exit, { at: release, ease: "in" })
  .tween("toast", 1, SWIPE_MS.enter, { at: release + SWIPE_MS.exit, ease: "out" })
  .mark("released")
  .moveTo(at(UNDO_BUTTON, 0.5), 520, { curve: -0.18 });
b.tween("undoHover", 1, 120, { ease: "out" })
  .wait(320)
  .mark("undoTap")
  .press({ anchor: "swipe-undo" });
const click = b.lastClick;
b.tween("toast", 0, SWIPE_MS.exit, { at: click, ease: "in" })
  .tween("undoHover", 0, SWIPE_MS.exit, { at: click, ease: "in" })
  .tween("swipe", 0, 0, { at: click })
  .tween("gone", 0, SWIPE_MS.enter, { at: click, ease: "out" })
  .wait(200)
  .moveTo(REST, 560, { curve: 0.16 });

export const timeline = b.build();
export const marks = { grab: grabbed, release, click };

/** Just before release: the row is past the threshold and the dark action is revealed. */
export const poster = release - 40;

/** Horizontal offset of the swiped row (phone px, negative is left). */
export function rowOffset(swipe: number) {
  return -SWIPE_DX * swipe;
}

/** Center x (phone px) of the action icon: centered in the revealed strip, then riding the row's edge. */
export function iconCenter(revealed: number) {
  return revealed <= ACTION_PX ? PHONE.w - revealed / 2 : PHONE.w - revealed + ACTION_PX / 2;
}

function Trash({ cx, cy, opacity }: { cx: number; cy: number; opacity: number }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--mk-accent-fg)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", left: cx - 7, top: cy - 12, opacity }}
    >
      <path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" />
    </svg>
  );
}

function RowContent({ i }: { i: number }) {
  return (
    <>
      {i < 2 ? <Block x={5} y={19} w={4} h={4} r={2} tone="accent" /> : null}
      <Avatar x={14} y={11} size={20} tone="title" />
      <Bar x={42} y={13} w={TITLE_W[i]} h={6} tone="title" />
      <Bar x={42} y={24} w={DETAIL_W[i]} h={5} tone="base" />
      <Bar x={PHONE.w - 14 - META_W[i]!} y={13} w={META_W[i]} h={5} tone="base" />
    </>
  );
}

export default function SwipeDeleteScene({ frame }: SceneProps) {
  const { swipe, gone, toast, undoHover } = frame.v as Record<"swipe" | "gone" | "toast" | "undoHover", number>;
  const offset = rowOffset(swipe);
  const revealed = -offset;
  const armed = revealed >= THRESHOLD_PX;
  const collapse = ROW_H * gone;
  return (
    <>
      <MOBILE.Page />
      <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y + LIST_TOP - 4, width: PHONE.w, height: 264 - LIST_TOP + 4, overflow: "hidden", background: "var(--mk-surface)" }}>
        <div style={{ position: "absolute", left: 0, top: -LIST_TOP + 4, width: PHONE.w, height: PHONE.h }}>
          {Array.from({ length: ROWS }, (_, i) => {
            const r = row(i);
            const swiped = i === SWIPED;
            const y = i > SWIPED ? r.y - collapse : r.y;
            const h = swiped ? ROW_H - collapse : ROW_H;
            return (
              <div key={i} style={{ position: "absolute", left: 0, top: y, width: PHONE.w, height: h, overflow: "hidden", opacity: swiped ? 1 - gone : 1 }}>
                {swiped && revealed > 0 ? (
                  <Block x={0} y={0} w={PHONE.w} h={ROW_H} r={0} tone="accent">
                    <Trash cx={iconCenter(revealed)} cy={ROW_H / 2} opacity={Math.min(1, revealed / 40)} />
                    <Bar x={iconCenter(revealed) - 11} y={ROW_H / 2 + 6} w={22} h={4} tone="surface" style={{ opacity: Math.min(1, revealed / 40) }} />
                  </Block>
                ) : null}
                <div
                  data-anchor={swiped ? "swipe-row" : undefined}
                  data-armed={swiped && armed ? "" : undefined}
                  style={{ position: "absolute", left: swiped ? offset : 0, top: 0, width: PHONE.w, height: ROW_H, background: "var(--mk-surface)" }}
                >
                  <RowContent i={i} />
                  {i < ROWS - 1 ? <Block x={42} y={ROW_H - 1} w={PHONE.w - 42} h={1} r={0} tone="base" /> : null}
                </div>
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: SNACK.x,
              top: SNACK.y,
              width: SNACK.w,
              height: SNACK.h,
              borderRadius: 10,
              background: "var(--mk-accent)",
              boxShadow: "0 8px 18px -10px rgb(10 12 16 / 0.6)",
              opacity: toast,
              transform: `translateY(${Math.round((1 - toast) * 120) / 10}px)`,
            }}
          >
            <Bar x={12} y={10} w={60} h={6} tone="surface" />
            <Bar x={12} y={20} w={44} h={4} tone="surface" style={{ opacity: 0.7 }} />
            <div
              data-anchor="swipe-undo"
              style={{
                position: "absolute",
                left: UNDO.x,
                top: UNDO.y,
                width: UNDO.w,
                height: UNDO.h,
                borderRadius: 8,
                background: `color-mix(in srgb, var(--mk-accent-fg) ${pct(undoHover * 0.16)}%, transparent)`,
              }}
            >
              <Bar x={10} y={12} w={24} h={5} tone="surface" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
