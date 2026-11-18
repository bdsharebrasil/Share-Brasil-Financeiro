import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { Button as AriaButton, DropIndicator, GridList, GridListItem, useDragAndDrop, useListData } from "@/primitives/react-aria";
import { DURATION, EASING_POINTS } from "@/engine/tokens";

/**
 * Drag reorder: a list whose order people change by dragging a row's handle, with three equivalent
 * keyboard routes.
 *
 * - Behavior comes from React Aria (src/primitives/react-aria.ts): GridList rows with grid/row
 *   semantics, a named drag handle (`slot="drag"`), pointer drag with drop indicators between rows,
 *   React Aria's own keyboard drag (Enter on a row or its handle starts it, Tab picks the target,
 *   Enter drops, Escape cancels) and its screen-reader announcements for that flow.
 * - Added on top, explicitly (not part of React Aria): a lift mode on the focused row. Space lifts
 *   it, Arrow Up/Down move it one place, Space or Enter drops it, Escape puts it back. It lives in a
 *   capture-phase key handler so the grid's own arrow navigation never sees those keys while a row
 *   is lifted. Focus stays on the moved row (by its stable id), and every meaningful step is
 *   announced once in a polite live region.
 * - Visible Move up / Move down buttons on every row do the same without dragging.
 * - Focus inside a row's handle or Move buttons makes that row the grid's remembered tab stop, however
 *   it got there, so cancelling React Aria's keyboard drag returns focus to the handle that started it.
 * - Motion: displaced rows slide to their new place (220 ms ease-out, Motion `layout`); the row
 *   being moved settles with a spring (stiffness 320, damping 36, mass 1, no bounce).
 * - Reduced motion: no layout animation at all, rows jump to their new order in 0 ms; pointer
 *   dragging, the drag preview and every control stay available.
 */

const SLIDE: Transition = { type: "tween", duration: DURATION.enter / 1000, ease: [...EASING_POINTS.out] as [number, number, number, number] };
const SETTLE: Transition = { type: "spring", stiffness: 320, damping: 36, mass: 1 };

export interface ReorderItem {
  id: string;
  /** Row name, also the accessible name used in announcements. */
  name: string;
  /** Short secondary line. */
  detail?: string;
}

export interface DragReorderProps {
  items: ReorderItem[];
  /** Accessible name of the list. */
  label: string;
  className?: string;
  onReorder?(items: ReorderItem[]): void;
}

type Lift = { id: string; snapshot: string[] };
type Refocus = { id: string; target: "row" | "up" | "down"; order: string };
type DragHooks = ReturnType<typeof useDragAndDrop>["dragAndDropHooks"];
type SelectionManager = ReturnType<NonNullable<DragHooks["useDraggableCollectionState"]>>["selectionManager"];

export function DragReorder({ items, label, className = "", onReorder }: DragReorderProps) {
  const list = useListData({ initialItems: items, getKey: (i) => i.id });
  const reduced = useReducedMotion() ?? false;
  const [lift, setLift] = useState<Lift | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const refocus = useRef<Refocus | null>(null);
  const manager = useRef<SelectionManager | null>(null);

  const order = list.items.map((i) => i.id);
  const total = order.length;
  const nameOf = (id: string) => list.getItem(id)?.name ?? id;
  const position = (id: string, ids = order) => ids.indexOf(id) + 1;

  /** The row or Move button that should hold focus for `want`, or null if its row is not rendered. */
  const focusTarget = (want: Refocus) => {
    const row = root.current?.querySelector<HTMLElement>(`[data-drag-reorder-row="${want.id}"]`);
    if (!row || want.target === "row") return row ?? null;
    const usable = (el: HTMLElement | null) => (el && !el.hasAttribute("disabled") && el.dataset.disabled === undefined ? el : null);
    const btn = row.querySelector<HTMLElement>(`[data-drag-reorder-move="${want.target}"]`);
    const other = row.querySelector<HTMLElement>(`[data-drag-reorder-move="${want.target === "up" ? "down" : "up"}"]`);
    return usable(btn) ?? usable(other) ?? row;
  };
  /** True once the DOM shows the order the move asked for (the collection renders it a commit later). */
  const rendered = (want: Refocus) =>
    [...(root.current?.querySelectorAll<HTMLElement>("[data-drag-reorder-row]") ?? [])].map((el) => el.dataset.dragReorderRow).join() === want.order;
  /**
   * Focus is ours to place only while it fell to the page, sits on a disabled control, or is still
   * inside the moved row. Anywhere else means the person moved on (for example to another row's Move
   * button), so the watch ends instead of pulling focus back.
   */
  const mayPlace = (want: Refocus) => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active.hasAttribute("disabled")) return true;
    return active.closest<HTMLElement>("[data-drag-reorder-row]")?.dataset.dragReorderRow === want.id;
  };
  const place = (want: Refocus) => {
    const el = focusTarget(want);
    if (!el || document.activeElement === el) return;
    if (mayPlace(want)) el.focus();
    else if (refocus.current === want) refocus.current = null;
  };

  // Moving a focused node in the DOM, or disabling the focused Move button at either end, can drop
  // focus to the page. Put it back on the same row (or button) once the move is rendered, and keep
  // checking for a few frames, because the button's disabled state can land in a later commit.
  useLayoutEffect(() => {
    const want = refocus.current;
    if (want && rendered(want)) place(want);
  });
  const keepFocus = (want: Refocus) => {
    refocus.current = want;
    let frames = 0;
    const check = () => {
      if (refocus.current !== want) return;
      if (rendered(want)) place(want);
      if (++frames < 20) requestAnimationFrame(check);
      else refocus.current = null;
    };
    requestAnimationFrame(check);
  };

  const commit = (ids: string[]) => onReorder?.(ids.map((id) => list.getItem(id)!));

  /** Moves `id` to zero-based `to`, keeping focus on `target`. Returns the new order. */
  const moveTo = (id: string, to: number, target: Refocus["target"]) => {
    const from = order.indexOf(id);
    if (to < 0 || to >= total || to === from) return null;
    const next = order.filter((k) => k !== id);
    next.splice(to, 0, id);
    list.move(id, to);
    setSettling(id);
    keepFocus({ id, target, order: next.join() });
    return next;
  };

  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-drag-reorder-row]");
    // Only the row itself: keys on the handle or the Move buttons keep their own meaning.
    if (!row || e.target !== row) return;
    const id = row.dataset.dragReorderRow!;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (!lift) {
      if (e.key !== " ") return;
      stop();
      setLift({ id, snapshot: order });
      setMessage(`Picked up ${nameOf(id)}, position ${position(id)} of ${total}. Arrow keys move it, Space or Enter drops it, Escape cancels.`);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      stop();
      const next = moveTo(lift.id, order.indexOf(lift.id) + (e.key === "ArrowUp" ? -1 : 1), "row");
      if (next) setMessage(`${nameOf(lift.id)}, position ${position(lift.id, next)} of ${total}.`);
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      stop();
      setLift(null);
      commit(order);
      setMessage(`Dropped ${nameOf(lift.id)} at position ${position(lift.id)} of ${total}.`);
      return;
    }
    if (e.key === "Escape") {
      stop();
      const back = lift.snapshot;
      // Only the lifted row moved, so putting it back at its old index restores the whole order.
      list.move(lift.id, back.indexOf(lift.id));
      setSettling(lift.id);
      keepFocus({ id: lift.id, target: "row", order: back.join() });
      setLift(null);
      setMessage(`Reorder cancelled. ${nameOf(lift.id)} is back at position ${position(lift.id, back)} of ${total}.`);
    }
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ "text/plain": nameOf(String(k)) })),
    onReorder(e) {
      const moved = [...e.keys].map(String);
      if (e.target.dropPosition === "before") list.moveBefore(e.target.key, moved);
      else if (e.target.dropPosition === "after") list.moveAfter(e.target.key, moved);
      setSettling(moved[0] ?? null);
      const ids = list.items.map((i) => i.id).filter((k) => !moved.includes(k));
      const at = ids.indexOf(String(e.target.key)) + (e.target.dropPosition === "after" ? 1 : 0);
      ids.splice(at, 0, ...moved);
      commit(ids);
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className={({ isDropTarget }) => `-my-px h-0.5 rounded-full ${isDropTarget ? "bg-accent" : "bg-transparent"}`}
        data-drag-reorder-indicator
      />
    ),
    renderDragPreview: (dragItems) => (
      <div className="rounded-control border border-line bg-surface px-4 py-2.5 text-[15px] font-medium text-ink shadow-[var(--mk-shadow-overlay)]">
        {dragItems[0]?.["text/plain"]}
      </div>
    ),
  });

  // The grid remembers one row as its tab stop and sends focus back to that row whenever focus
  // re-enters the grid (for example when Escape cancels React Aria's keyboard drag and it focuses the
  // handle again). React Aria moves that row along with focus only for pointer focus, so a handle or
  // Move button reached any other way (a screen reader, a script) left the old row remembered and a
  // cancelled drag landed on that other row. The hooks object hands its selection manager to the
  // drag state hook; keep it so focus inside a row's controls can make that row the remembered one.
  const useDragState = dragAndDropHooks.useDraggableCollectionState!;
  const hooks: DragHooks = {
    ...dragAndDropHooks,
    useDraggableCollectionState(props) {
      const state = useDragState(props);
      useLayoutEffect(() => {
        manager.current = state.selectionManager;
      });
      return state;
    },
  };

  return (
    <div
      ref={root}
      className={className}
      onKeyDownCapture={onKeyDownCapture}
      onFocus={(e) => {
        // Runs after the grid's own focus handling: skip focus it already redirected elsewhere.
        const target = e.target as HTMLElement;
        const row = target.closest<HTMLElement>("[data-drag-reorder-row]");
        if (!row || row === target || document.activeElement !== target) return;
        const id = row.dataset.dragReorderRow!;
        if (manager.current && manager.current.focusedKey !== id) manager.current.setFocusedKey(id);
      }}
      onBlur={(e) => {
        // Leaving the list while a row is lifted keeps the new order.
        if (lift && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
          setLift(null);
          commit(order);
          setMessage(`Dropped ${nameOf(lift.id)} at position ${position(lift.id)} of ${total}.`);
        }
      }}
    >
      {/* React Aria caches each row by item object, and a move keeps the objects: list what the
          row render reads so positions, the lifted row and the settle spring stay current. */}
      <GridList
        aria-label={label}
        items={list.items}
        dependencies={[order.join(), lift?.id, settling, reduced]}
        dragAndDropHooks={hooks}
        className="flex flex-col outline-none"
        data-drag-reorder-list
      >
        {(item) => {
          const index = order.indexOf(item.id);
          const lifted = lift?.id === item.id;
          return (
            <GridListItem
              id={item.id}
              textValue={item.name}
              data-drag-reorder-row={item.id}
              data-lifted={lifted || undefined}
              className="rounded-control py-1 outline-offset-0 data-[dragging]:opacity-50"
            >
              <motion.div
                layout={reduced ? false : "position"}
                transition={{ layout: settling === item.id ? SETTLE : SLIDE }}
                onLayoutAnimationComplete={() => settling === item.id && setSettling(null)}
                className={`flex min-h-14 items-center gap-1 rounded-control border bg-surface py-1 pr-1 pl-1 text-ink transition-[box-shadow,border-color] duration-[var(--mk-dur-enter)] ease-kit-out motion-reduce:transition-none ${
                  lifted ? "border-[var(--mk-control-border)] shadow-[var(--mk-shadow-overlay)]" : "border-line"
                }`}
                data-drag-reorder-surface
              >
                {/* React Aria turns off pointer events on the drag button so a mouse drag starts on the
                    draggable row; this wrapper takes the pointer instead, for the grab cursor and hover. */}
                <span
                  className="inline-flex size-10 shrink-0 cursor-grab items-center justify-center rounded-control hover:bg-sunken active:cursor-grabbing pointer-coarse:size-11"
                  data-drag-reorder-grip
                >
                  <AriaButton
                    slot="drag"
                    aria-label={`Drag ${item.name}`}
                    className="inline-flex size-full items-center justify-center rounded-control text-muted outline-offset-0"
                    data-drag-reorder-handle
                  >
                    <GripIcon />
                  </AriaButton>
                </span>
                <span className="min-w-0 flex-1 py-1">
                  <span className="block truncate text-[15px] font-medium">{item.name}</span>
                  {item.detail ? <span className="block truncate text-[13px] text-muted">{item.detail}</span> : null}
                </span>
                <AriaButton
                  aria-label={`Move ${item.name} up`}
                  isDisabled={index === 0}
                  onPress={() => {
                    const next = moveTo(item.id, index - 1, "up");
                    if (next) {
                      commit(next);
                      setMessage(`Moved ${item.name} to position ${position(item.id, next)} of ${total}.`);
                    }
                  }}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted outline-offset-0 hover:bg-sunken data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent pointer-coarse:size-11"
                  data-drag-reorder-move="up"
                >
                  <ArrowIcon dir="up" />
                </AriaButton>
                <AriaButton
                  aria-label={`Move ${item.name} down`}
                  isDisabled={index === total - 1}
                  onPress={() => {
                    const next = moveTo(item.id, index + 1, "down");
                    if (next) {
                      commit(next);
                      setMessage(`Moved ${item.name} to position ${position(item.id, next)} of ${total}.`);
                    }
                  }}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted outline-offset-0 hover:bg-sunken data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent pointer-coarse:size-11"
                  data-drag-reorder-move="down"
                >
                  <ArrowIcon dir="down" />
                </AriaButton>
              </motion.div>
            </GridListItem>
          );
        }}
      </GridList>
      <p aria-live="polite" aria-atomic="true" className="sr-only" data-drag-reorder-status>
        {message}
      </p>
    </div>
  );
}

function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
      {[6, 10, 14].flatMap((y) => [7.5, 12.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />))}
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "up" ? "M10 15V5M5.5 9.5 10 5l4.5 4.5" : "M10 5v10M5.5 10.5 10 15l4.5-4.5"} />
    </svg>
  );
}

const TASKS: ReorderItem[] = [
  { id: "notes", name: "Write release notes", detail: "Docs, due Monday" },
  { id: "pricing", name: "Update the pricing page", detail: "Web, due Tuesday" },
  { id: "video", name: "Record the demo video", detail: "Marketing, due Wednesday" },
  { id: "beta", name: "Email beta testers", detail: "Support, due Thursday" },
  { id: "changelog", name: "Publish the changelog", detail: "Docs, due Friday" },
];

/** Live example for /kit/drag-reorder: a launch checklist ordered by priority. */
export function Playground() {
  return (
    <div className="flex w-full max-w-[520px] min-w-0 flex-col gap-3" data-drag-reorder-playground>
      <div>
        <h3 className="m-0 text-base font-semibold text-ink" id="drag-reorder-heading">
          Launch checklist
        </h3>
        <p className="mt-1 mb-0 text-[14px] text-muted">Drag a handle, use the arrows, or focus a row and press Space.</p>
      </div>
      <DragReorder label="Launch checklist" items={TASKS} />
    </div>
  );
}
