import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { EASING_POINTS } from "@/engine/tokens";
import { Toast } from "@/primitives/toast";
import { Button } from "@/ui/Button";
import { ACTION_W, DELETE_THRESHOLD, FLING_VELOCITY, SWIPE_MS, UNDO_TIMEOUT } from "./timing";

/**
 * Swipe delete: a semantic list whose rows slide left to reveal a dark Delete action.
 *
 * - Each row is a Motion pan-gesture surface that writes into a motion value (direction-locked,
 *   `touch-action: pan-y`, so vertical scrolling stays with the browser). The row follows the pointer; releasing past half of the action
 *   width keeps the action open, past `threshold` of the row width (default 50%) deletes, anything
 *   less settles back in 200 ms ease-out. Nothing is deleted below the threshold.
 * - Deleting collapses the row's height and fades it in 180 ms ease-in (AnimatePresence); a restored
 *   row opens back in 200 ms ease-out. Reduced motion: every settle, collapse and restore is 0 ms;
 *   the row still tracks a direct drag.
 * - Keyboard and assistive tech never need the gesture: every row has a visible, named Delete
 *   button. After a delete, focus moves to the next surviving row (or the previous one, or the list)
 *   and a polite live region names the removed item. The revealed action is a pointer-only duplicate
 *   of that button, so it is hidden from assistive tech and the tab order.
 * - Undo is a hook on Base UI Toast (src/primitives/toast.tsx): `useUndoToast()` queues an 8 s
 *   notification with an Undo action; it pauses on hover and focus and F6 reaches it.
 */

export interface SwipeItem {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
}

export type DeleteVia = "swipe" | "action" | "button";

type Bezier = [number, number, number, number];
const EASE_OUT = [...EASING_POINTS.out] as Bezier;
const EASE_IN = [...EASING_POINTS.in] as Bezier;

function TrashIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6M9 9v4M11 9v4" />
    </svg>
  );
}

/** Moves focus to a row's Delete button, or to the list itself when the row is gone. */
export function focusSwipeRow(root: HTMLElement | null, id: string | null) {
  if (!root) return;
  const row = id ? root.querySelector<HTMLElement>(`[data-swipe-delete-row="${CSS.escape(id)}"] [data-swipe-delete-button]`) : null;
  (row ?? root.querySelector<HTMLElement>("[data-swipe-delete-list]"))?.focus();
}

interface RowProps {
  item: SwipeItem;
  threshold: number;
  reduced: boolean;
  onDelete(item: SwipeItem, via: DeleteVia): void;
}

function SwipeRow({ item, threshold, reduced, onDelete }: RowProps) {
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const dragged = useRef(false);
  // The dark action only exists once the row has moved, so no sliver shows at rest.
  const actionOpacity = useTransform(x, (v) => (v < -0.5 ? 1 : 0));

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const settle = (to: number) => {
    if (reduced) {
      x.stop();
      x.set(to);
    } else animate(x, to, { duration: SWIPE_MS.enter / 1000, ease: EASE_OUT });
  };

  // Motion's pan gesture writes straight into `x`. Motion's own `drag` starts an inertia and
  // constraint animation on the same value at release, a frame before this settle, and the two
  // fought over the row; with pan, the settle is the only animation on `x`.
  const origin = useRef(0);
  const horizontal = useRef(false);
  const onPanStart = (_: PointerEvent, info: PanInfo) => {
    // Direction lock: a mostly vertical gesture stays a scroll and never moves the row.
    horizontal.current = Math.abs(info.offset.x) > Math.abs(info.offset.y);
    if (!horizontal.current) return;
    dragged.current = true;
    x.stop();
    origin.current = x.get();
  };
  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (!horizontal.current) return;
    const next = origin.current + info.offset.x;
    // Left stops at the row's width; right rubber-bands a little past rest.
    x.set(next > 0 ? next * 0.08 : Math.max(next, -width));
  };
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    if (!horizontal.current) return;
    horizontal.current = false;
    const travelled = -x.get();
    const fling = info.velocity.x < -FLING_VELOCITY;
    if (width && (travelled >= width * threshold || (fling && travelled >= ACTION_W))) {
      onDelete(item, "swipe");
      return;
    }
    settle(travelled >= ACTION_W / 2 || (fling && travelled > 0) ? -ACTION_W : 0);
  };

  return (
    <div ref={rowRef} className="relative overflow-hidden" data-swipe-delete-track>
      <motion.div aria-hidden="true" className="absolute inset-0 flex justify-end bg-accent text-accent-fg" style={{ opacity: actionOpacity }} data-swipe-delete-action>
        <button
          type="button"
          tabIndex={-1}
          className="flex h-full flex-col items-center justify-center gap-1 text-[13px] font-semibold"
          style={{ width: ACTION_W }}
          onClick={() => onDelete(item, "action")}
        >
          <TrashIcon />
          Delete
        </button>
      </motion.div>
      <motion.div
        className="relative flex min-h-16 cursor-grab items-center gap-3 bg-surface py-2 pr-2 pl-4 select-none active:cursor-grabbing"
        style={{ x, touchAction: "pan-y" }}
        onPointerDown={() => (dragged.current = false)}
        onPanStart={onPanStart}
        onPan={onPan}
        onPanEnd={onPanEnd}
        onClick={() => {
          // A tap on an opened row closes it again.
          if (!dragged.current && x.get() < 0) settle(0);
        }}
        data-swipe-delete-surface
      >
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-[13px] font-semibold text-ink">
          {item.title.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] leading-snug font-medium text-ink" data-swipe-delete-title>{item.title}</span>
            {item.meta ? <span className="shrink-0 text-[13px] text-muted">{item.meta}</span> : null}
          </span>
          {item.detail ? <span className="block truncate text-[13px] leading-snug text-muted">{item.detail}</span> : null}
        </span>
        {/* 44 px on every pointer: this button is the gesture-free route for the whole row. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${item.title}`}
          className="shrink-0 text-muted hover:text-ink"
          style={{ width: 44, height: 44 }}
          onClick={() => {
            if (!dragged.current) onDelete(item, "button");
          }}
          data-swipe-delete-button
        >
          <TrashIcon />
        </Button>
      </motion.div>
    </div>
  );
}

export interface SwipeDeleteListProps {
  items: SwipeItem[];
  /** Called once per delete; remove the item from `items` and keep it for undo. */
  onDelete(item: SwipeItem, index: number, via: DeleteVia): void;
  /** Accessible name of the list. */
  label: string;
  /** Share of the row width a release must pass to delete (0..1). */
  threshold?: number;
  empty?: ReactNode;
}

export function SwipeDeleteList({ items, onDelete, label, threshold = DELETE_THRESHOLD, empty = "Nothing here." }: SwipeDeleteListProps) {
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const pendingFocus = useRef<string | null | undefined>(undefined);

  const handleDelete = (item: SwipeItem, via: DeleteVia) => {
    const index = items.findIndex((i) => i.id === item.id);
    if (index < 0) return;
    pendingFocus.current = (items[index + 1] ?? items[index - 1])?.id ?? null;
    setAnnouncement(`Deleted ${item.title}.`);
    onDelete(item, index, via);
  };

  // Once the list has re-rendered without the row, put focus on a survivor.
  useEffect(() => {
    if (pendingFocus.current === undefined) return;
    focusSwipeRow(root.current, pendingFocus.current);
    pendingFocus.current = undefined;
  }, [items]);

  const enter = { duration: reduced ? 0 : SWIPE_MS.enter / 1000, ease: EASE_OUT };
  const exit = { duration: reduced ? 0 : SWIPE_MS.exit / 1000, ease: EASE_IN };

  return (
    <div ref={root} className="min-w-0" data-swipe-delete>
      <ul aria-label={label} tabIndex={-1} className="m-0 list-none overflow-hidden rounded-panel border border-line bg-surface p-0" data-swipe-delete-list>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              className="overflow-hidden border-b border-line last:border-b-0"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1, transition: enter }}
              exit={{ height: 0, opacity: 0, transition: exit }}
              data-swipe-delete-row={item.id}
            >
              <SwipeRow item={item} threshold={threshold} reduced={reduced} onDelete={handleDelete} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length === 0 ? <p className="m-0 mt-3 text-sm text-muted" data-swipe-delete-empty>{empty}</p> : null}
      <p aria-live="polite" aria-atomic="true" className="sr-only-kit" data-swipe-delete-status>
        {announcement}
      </p>
    </div>
  );
}

/** Undo hook: queues a toast with an Undo action. Needs an `UndoToastProvider` above it. */
export function useUndoToast() {
  const manager = Toast.useToastManager();
  return useCallback(
    ({ title, description, onUndo }: { title: string; description?: string; onUndo(): void }) => {
      const id = manager.add({
        title,
        description,
        timeout: UNDO_TIMEOUT,
        actionProps: {
          children: "Undo",
          onClick: () => {
            manager.close(id);
            onUndo();
          },
        },
      });
      return id;
    },
    [manager],
  );
}

function UndoToasts() {
  const { toasts } = Toast.useToastManager();
  const reduced = useReducedMotion() ?? false;
  return (
    <Toast.Viewport className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2" data-swipe-delete-toasts>
      {toasts.map((toast) => {
        const ending = toast.transitionStatus === "ending" || toast.limited;
        return (
          <Toast.Root
            key={toast.id}
            toast={toast}
            swipeDirection={["down"]}
            className="pointer-events-auto flex items-center gap-3 rounded-control bg-accent py-2 pr-2 pl-4 text-accent-fg shadow-lg data-[limited]:hidden"
            data-testid="swipe-delete-toast"
            render={
              <motion.div
                initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: ending ? 0 : 1, y: ending && !reduced ? 12 : 0 }}
                transition={{ duration: reduced ? 0 : (ending ? SWIPE_MS.exit : SWIPE_MS.enter) / 1000, ease: ending ? EASE_IN : EASE_OUT }}
              />
            }
          >
            <div className="min-w-0 flex-1">
              <Toast.Title className="m-0 text-[15px] leading-snug font-semibold" />
              <Toast.Description className="m-0 truncate text-[13px] leading-snug" />
            </div>
            <Toast.Action
              className="h-10 shrink-0 rounded-control px-3 text-[15px] font-semibold underline underline-offset-4 hover:bg-white/10 focus-visible:outline-accent-fg pointer-coarse:h-11"
              data-swipe-delete-undo
            />
          </Toast.Root>
        );
      })}
    </Toast.Viewport>
  );
}

/** Toast provider plus the compact snackbar viewport, positioned at the bottom of its container. */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={UNDO_TIMEOUT} limit={1}>
      {children}
      <UndoToasts />
    </Toast.Provider>
  );
}

const INBOX: SwipeItem[] = [
  { id: "invoice", title: "Invoice 0142 is ready", detail: "Northwind Studio", meta: "9:41" },
  { id: "review", title: "Weekly design review", detail: "Calendar, Thursday 3 PM", meta: "9:12" },
  { id: "export", title: "Your export finished", detail: "Render queue, 4 files", meta: "8:55" },
  { id: "comment", title: "New comment on Onboarding", detail: "Priya Raman", meta: "Mon" },
  { id: "storage", title: "Storage is 80% full", detail: "Workspace settings", meta: "Sun" },
];

function Inbox() {
  const [items, setItems] = useState(INBOX);
  // Restoration data outlives the toast: the Restore button below works after it is gone.
  const [trash, setTrash] = useState<{ item: SwipeItem; index: number }[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const notify = useUndoToast();

  const trashRef = useRef(trash);
  trashRef.current = trash;

  const restore = (id: string) => {
    const entry = trashRef.current.find((e) => e.item.id === id);
    if (!entry) return;
    setTrash((t) => t.filter((e) => e.item.id !== id));
    setItems((list) => {
      if (list.some((i) => i.id === id)) return list;
      const next = [...list];
      next.splice(Math.min(entry.index, next.length), 0, entry.item);
      return next;
    });
    requestAnimationFrame(() => focusSwipeRow(root.current, id));
  };

  const onDelete = (item: SwipeItem, index: number) => {
    setItems((list) => list.filter((i) => i.id !== item.id));
    setTrash((t) => [...t, { item, index }]);
    notify({ title: "Message deleted", description: item.title, onUndo: () => restore(item.id) });
  };

  const last = trash[trash.length - 1];
  return (
    <div ref={root} className="relative flex min-w-0 flex-col gap-3 pb-20">
      <h3 className="m-0 text-base font-semibold text-ink" id="swipe-delete-heading">
        Inbox
      </h3>
      <SwipeDeleteList items={items} onDelete={onDelete} label="Inbox" empty="Inbox is empty." />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={!last} onClick={() => last && restore(last.item.id)} data-swipe-delete-restore>
          {last ? `Restore “${last.item.title}”` : "Nothing to restore"}
        </Button>
      </div>
      <p className="m-0 text-sm leading-relaxed text-muted">
        Swipe a row left past halfway to delete it, or use its Delete button. Undo stays in the notification for 8 seconds (F6 reaches it) and in Restore after that.
      </p>
    </div>
  );
}

/** Live example for /kit/swipe-delete: a five-message inbox with undo. */
export function Playground() {
  return (
    <div className="relative w-full max-w-[400px] min-w-0" data-swipe-delete-playground>
      <UndoToastProvider>
        <Inbox />
      </UndoToastProvider>
    </div>
  );
}
