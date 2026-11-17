/**
 * Pointer dragging for board cards, without pointer capture: listeners sit on window, so a child
 * losing capture can never end a gesture. Mouse and pen start after 5 px of movement; touch starts
 * after a 220 ms press so a quick swipe still scrolls the board. Near an edge the board and the
 * column under the pointer scroll on their own.
 */
import { animate, useMotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { DRAG_SPRING } from "@/ui/motion";
import type { Status } from "../shared/types";

export interface DragSession {
  id: string;
  width: number;
  /** True while the floating copy springs into its slot after a drop or a cancel. */
  settling: boolean;
}

interface Options {
  root: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  reduced: boolean;
  onStart: (id: string) => void;
  onOver: (id: string, status: Status, beforeId: string | null) => void;
  onEnd: (id: string, how: "drop" | "cancel") => void;
}

const EDGE = 56;

export function usePointerDrag(options: Options) {
  const opts = useRef(options);
  useLayoutEffect(() => {
    opts.current = options;
  });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [session, setSession] = useState<DragSession | null>(null);
  const active = useRef(false);
  const blockClickUntil = useRef(0);
  const stop = useRef<() => void>(() => {});

  useEffect(() => () => stop.current(), []);

  /** Finds the column under the pointer and the card the dragged one should sit before. */
  const hitTest = useCallback((id: string, px: number, py: number) => {
    const root = opts.current.root.current;
    if (!root) return;
    let best: HTMLElement | null = null;
    let bestDistance = Infinity;
    for (const column of root.querySelectorAll<HTMLElement>("[data-column]")) {
      const r = column.getBoundingClientRect();
      const distance = px < r.left ? r.left - px : px > r.right ? px - r.right : 0;
      if (distance < bestDistance) {
        best = column;
        bestDistance = distance;
      }
    }
    if (!best) return;
    const list = best.querySelector<HTMLElement>("[data-column-list]");
    let beforeId: string | null = null;
    if (list) {
      // offsetTop ignores the transforms of cards that are still animating, so targets do not flicker.
      const top = list.getBoundingClientRect().top - list.scrollTop;
      for (const slot of list.querySelectorAll<HTMLElement>("[data-card-slot]")) {
        if (slot.dataset.cardSlot === id) continue;
        if (py < top + slot.offsetTop + slot.offsetHeight / 2) {
          beforeId = slot.dataset.cardSlot ?? null;
          break;
        }
      }
    }
    opts.current.onOver(id, best.dataset.column as Status, beforeId);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, id: string) => {
      if (event.button !== 0 || active.current) return;
      const card = event.currentTarget;
      const pointerId = event.pointerId;
      const touch = event.pointerType === "touch";
      const startX = event.clientX;
      const startY = event.clientY;
      let lastX = startX;
      let lastY = startY;
      let started = false;
      let grabX = 0;
      let grabY = 0;
      let timer = 0;
      let frame = 0;

      const tick = () => {
        let moved = false;
        const scroller = opts.current.scroller.current;
        if (scroller) {
          const r = scroller.getBoundingClientRect();
          const dx = lastX < r.left + EDGE ? -(r.left + EDGE - lastX) / 4 : lastX > r.right - EDGE ? (lastX - (r.right - EDGE)) / 4 : 0;
          if (dx) {
            const before = scroller.scrollLeft;
            scroller.scrollLeft += Math.round(dx);
            moved ||= scroller.scrollLeft !== before;
          }
        }
        const under = document.elementFromPoint(lastX, lastY)?.closest<HTMLElement>("[data-column-list]");
        if (under) {
          const r = under.getBoundingClientRect();
          const dy = lastY < r.top + 40 ? -(r.top + 40 - lastY) / 4 : lastY > r.bottom - 40 ? (lastY - (r.bottom - 40)) / 4 : 0;
          if (dy) {
            const before = under.scrollTop;
            under.scrollTop += Math.round(dy);
            moved ||= under.scrollTop !== before;
          }
        }
        if (moved) hitTest(id, lastX, lastY);
        frame = requestAnimationFrame(tick);
      };

      const begin = () => {
        const rect = card.getBoundingClientRect();
        grabX = startX - rect.left;
        grabY = startY - rect.top;
        x.set(lastX - grabX);
        y.set(lastY - grabY);
        started = true;
        active.current = true;
        setSession({ id, width: rect.width, settling: false });
        opts.current.onStart(id);
        frame = requestAnimationFrame(tick);
      };

      const finish = (how: "drop" | "cancel" | null) => {
        stop.current();
        stop.current = () => {};
        if (!how) return;
        blockClickUntil.current = performance.now() + 400;
        opts.current.onEnd(id, how);
        setSession((s) => (s ? { ...s, settling: true } : s));
        // Wait one frame so the card has its final slot, then spring the floating copy into it.
        requestAnimationFrame(() => {
          const slot = opts.current.root.current?.querySelector(`[data-task-card="${id}"]`)?.getBoundingClientRect();
          const end = () => {
            active.current = false;
            setSession(null);
          };
          if (!slot || opts.current.reduced) return end();
          let left = 2;
          const one = () => --left === 0 && end();
          animate(x, slot.left, { ...DRAG_SPRING, onComplete: one });
          animate(y, slot.top, { ...DRAG_SPRING, onComplete: one });
        });
      };

      const move = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        lastX = e.clientX;
        lastY = e.clientY;
        if (!started) {
          const distance = Math.hypot(lastX - startX, lastY - startY);
          if (touch) {
            if (distance > 8) finish(null); // a swipe: let the page scroll
            return;
          }
          if (distance < 5) return;
          begin();
        }
        x.set(lastX - grabX);
        y.set(lastY - grabY);
        hitTest(id, lastX, lastY);
      };
      const up = (e: PointerEvent) => e.pointerId === pointerId && finish(started ? "drop" : null);
      const cancel = (e: PointerEvent) => e.pointerId === pointerId && finish(started ? "cancel" : null);
      const key = (e: KeyboardEvent) => {
        if (e.key === "Escape" && started) {
          e.preventDefault();
          e.stopPropagation();
          finish("cancel");
        }
      };
      // Once a touch drag has started, keep the page from scrolling under the finger.
      const touchMove = (e: TouchEvent) => started && e.cancelable && e.preventDefault();
      const noMenu = (e: Event) => started && e.preventDefault();

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key, true);
      window.addEventListener("touchmove", touchMove, { passive: false });
      window.addEventListener("contextmenu", noMenu);
      if (touch) timer = window.setTimeout(begin, 220);
      stop.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
        window.removeEventListener("touchmove", touchMove);
        window.removeEventListener("contextmenu", noMenu);
        window.clearTimeout(timer);
        cancelAnimationFrame(frame);
        if (!started) active.current = false;
      };
    },
    [hitTest, x, y],
  );

  /** True right after a drag, so the click that ends it does not also open the task. */
  const swallowClick = useCallback(() => performance.now() < blockClickUntil.current, []);

  return { session, x, y, onPointerDown, swallowClick };
}
