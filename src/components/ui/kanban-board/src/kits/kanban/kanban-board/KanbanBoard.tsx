/**
 * Kanban board: columns with counts and work-in-progress limits, cards you drag with a pointer or
 * move with the keyboard (Space picks up, arrows move, Space drops, Esc cancels), live announcements
 * for every step, and an inline "Add task" per column. Controlled: you own the task array.
 */
import { AlertTriangle } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/ui/cn";
import { DRAG_SPRING, useMotionTransitions } from "@/ui/motion";
import { moveTask, moveToIndex, positionOf, tasksIn } from "../shared/board";
import { addDays, today } from "../shared/dates";
import { StatusIcon } from "../shared/marks";
import type { Column, Label, Person, Status, Task } from "../shared/types";
import { useAnnouncer } from "../shared/useAnnouncer";
import { AddTask } from "./AddTask";
import { CARD_SURFACE, TaskCardBody } from "./TaskCard";
import { usePointerDrag } from "./usePointerDrag";

export interface KanbanBoardProps {
  columns: Column[];
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  people: Person[];
  labels: Label[];
  /** Hide tasks without removing them (filters). Hidden tasks keep their place. */
  visible?: (task: Task) => boolean;
  /** Click or Enter on a card. */
  onOpenTask?: (id: string) => void;
  /** Builds a task for "Add task"; the default makes an unassigned one due in a week. */
  createTask?: (title: string, status: Status, tasks: Task[]) => Task;
  className?: string;
}

const ALL = () => true;

function defaultTask(title: string, status: Status, tasks: Task[]): Task {
  const top = tasks.reduce((max, t) => Math.max(max, Number(t.key.split("-")[1]) || 0), 0);
  const prefix = tasks[0]?.key.split("-")[0] ?? "TASK";
  return {
    id: `t-${Date.now().toString(36)}-${top + 1}`,
    key: `${prefix}-${top + 1}`,
    title,
    description: "",
    status,
    priority: "none",
    assigneeIds: [],
    labelIds: [],
    start: today(),
    due: addDays(today(), 7),
    checklist: [],
    comments: [],
  };
}

export function KanbanBoard({ columns, tasks, onTasksChange, people, labels, visible = ALL, onOpenTask, createTask = defaultTask, className }: KanbanBoardProps) {
  const uid = useId();
  const instructionsId = `${uid}-how`;
  const { reduced, enter } = useMotionTransitions();
  const { announce, region } = useAnnouncer();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  useLayoutEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  /** Keyboard pick-up: the task being moved and the order to restore on Esc. */
  const [picked, setPicked] = useState<{ id: string; snapshot: Task[] } | null>(null);
  const pointerSnapshot = useRef<Task[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const focusTarget = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  // A keyboard pick-up ends with a drop when the pointer is used anywhere else.
  useEffect(() => {
    if (!picked) return;
    const drop = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(`[data-task-card="${picked.id}"]`)) return;
      setPicked(null);
      const task = tasksRef.current.find((t) => t.id === picked.id);
      announce(`Dropped ${task?.key} in ${whereRef.current(tasksRef.current, picked.id)}`);
    };
    window.addEventListener("pointerdown", drop, true);
    return () => window.removeEventListener("pointerdown", drop, true);
  }, [picked, announce]);

  const columnName = useCallback((status: Status) => columns.find((c) => c.id === status)?.name ?? status, [columns]);
  const shown = useMemo(() => tasks.filter(visible), [tasks, visible]);
  const rovingId = activeId && shown.some((t) => t.id === activeId) ? activeId : (columns.map((c) => shown.find((t) => t.status === c.id)).find(Boolean)?.id ?? null);

  const focusCard = (id: string) => {
    setActiveId(id);
    focusTarget.current = id;
    setFocusTick((n) => n + 1);
  };
  // Moving a card between columns re-mounts it, so focus is restored after every render that asked for it.
  useLayoutEffect(() => {
    const id = focusTarget.current;
    if (!id) return;
    focusTarget.current = null;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-task-card="${id}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusTick]);

  const where = (list: Task[], id: string) => {
    const task = list.find((t) => t.id === id);
    if (!task) return "";
    const { index, size } = positionOf(list, id, visible);
    const column = columns.find((c) => c.id === task.status);
    const total = list.filter((t) => t.status === task.status).length;
    const over = column?.wip && total > column.wip ? ` ${column.name} is over its limit of ${column.wip}.` : "";
    return `${column?.name ?? task.status}, position ${index + 1} of ${size}.${over}`;
  };

  const whereRef = useRef(where);
  useLayoutEffect(() => {
    whereRef.current = where;
  });

  const drag = usePointerDrag({
    root: rootRef,
    scroller: scrollerRef,
    reduced,
    onStart: (id) => {
      pointerSnapshot.current = tasksRef.current;
      const task = tasksRef.current.find((t) => t.id === id);
      setActiveId(id);
      announce(`Picked up ${task?.key}. ${where(tasksRef.current, id)}`);
    },
    onOver: (id, status, beforeId) => {
      const current = tasksRef.current;
      const next = moveTask(current, id, status, beforeId);
      if (next === current || next.every((t, i) => t.id === current[i]?.id && t.status === current[i]?.status)) return;
      const columnChanged = current.find((t) => t.id === id)?.status !== status;
      tasksRef.current = next;
      onTasksChange(next);
      if (columnChanged) announce(where(next, id));
    },
    onEnd: (id, how) => {
      const key = tasksRef.current.find((t) => t.id === id)?.key;
      if (how === "cancel" && pointerSnapshot.current) {
        const snapshot = pointerSnapshot.current;
        tasksRef.current = snapshot;
        onTasksChange(snapshot);
        announce(`Move cancelled. ${key} is back in ${where(snapshot, id)}`);
      } else {
        announce(`Dropped ${key} in ${where(tasksRef.current, id)}`);
      }
      pointerSnapshot.current = null;
    },
  });

  const keyboardMove = (task: Task, key: string) => {
    const { index } = positionOf(tasks, task.id, visible);
    const columnIndex = columns.findIndex((c) => c.id === task.status);
    let status = task.status;
    let target = index;
    if (key === "ArrowUp") target = index - 1;
    else if (key === "ArrowDown") target = index + 1;
    else if (key === "Home") target = 0;
    else if (key === "End") target = Infinity;
    else {
      const next = columns[columnIndex + (key === "ArrowLeft" ? -1 : 1)];
      if (!next) return announce(`${task.key} is already in the ${key === "ArrowLeft" ? "first" : "last"} column, ${columnName(task.status)}.`);
      status = next.id;
    }
    const others = tasksIn(tasks, status, visible).filter((t) => t.id !== task.id).length;
    if (target === Infinity) target = others;
    if (key === "ArrowUp" && target < 0) return announce(`${task.key} is already at the top of ${columnName(status)}.`);
    if (key === "ArrowDown" && target > others) return announce(`${task.key} is already at the bottom of ${columnName(status)}.`);
    target = Math.max(0, Math.min(target, others));
    const next = moveToIndex(tasks, task.id, status, target, visible);
    onTasksChange(next);
    focusCard(task.id);
    announce(where(next, task.id));
  };

  const navigate = (task: Task, key: string) => {
    const column = shown.filter((t) => t.status === task.status);
    const index = column.findIndex((t) => t.id === task.id);
    let to: Task | undefined;
    if (key === "ArrowUp") to = column[index - 1];
    else if (key === "ArrowDown") to = column[index + 1];
    else if (key === "Home") to = column[0];
    else if (key === "End") to = column.at(-1);
    else {
      const step = key === "ArrowLeft" ? -1 : 1;
      for (let c = columns.findIndex((col) => col.id === task.status) + step; c >= 0 && c < columns.length; c += step) {
        const list = shown.filter((t) => t.status === columns[c]?.id);
        if (list.length) {
          to = list[Math.min(index, list.length - 1)];
          break;
        }
      }
    }
    if (to) focusCard(to.id);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, task: Task) => {
    const { key } = event;
    const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (picked?.id === task.id) {
      if (arrows.includes(key)) {
        event.preventDefault();
        keyboardMove(task, key);
      } else if (key === " " || key === "Enter") {
        event.preventDefault();
        setPicked(null);
        announce(`Dropped ${task.key} in ${where(tasks, task.id)}`);
      } else if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onTasksChange(picked.snapshot);
        setPicked(null);
        focusCard(task.id);
        announce(`Move cancelled. ${task.key} is back in ${where(picked.snapshot, task.id)}`);
      } else if (key === "Tab") {
        setPicked(null);
        announce(`Dropped ${task.key} in ${where(tasks, task.id)}`);
      }
      return;
    }
    if (key === " ") {
      event.preventDefault();
      if (drag.session) return;
      setPicked({ id: task.id, snapshot: tasks });
      announce(`Picked up ${task.key}, ${task.title}. ${where(tasks, task.id)} Use the arrow keys to move it, Space to drop, Escape to cancel.`);
    } else if (key === "Enter") {
      event.preventDefault();
      onOpenTask?.(task.id);
    } else if (arrows.includes(key)) {
      event.preventDefault();
      navigate(task, key);
    }
  };

  const add = (status: Status, title: string) => {
    const task = createTask(title, status, tasks);
    onTasksChange([...tasks, task]);
    announce(`Added ${task.key} to ${columnName(status)}.`);
  };


  const moving = !!picked || !!drag.session;
  const layoutTransition = moving ? DRAG_SPRING : enter;
  const dragged = drag.session ? tasks.find((t) => t.id === drag.session?.id) : undefined;

  return (
    <div ref={rootRef} data-testid="kanban-board" className={cn("flex min-h-0 flex-col", className)}>
      <p id={instructionsId} hidden>
        Press Space to pick up a task, the arrow keys to move it, Space to drop it and Escape to cancel. Press Enter to open it.
      </p>
      <motion.div
        ref={scrollerRef}
        layoutScroll
        className={cn(
          "relative flex min-h-0 flex-1 gap-3 overflow-x-auto overscroll-x-contain pb-1",
          !drag.session && "snap-x snap-mandatory sm:snap-none",
        )}
      >
        <LayoutGroup id={uid}>
          {columns.map((column) => {
            const cards = tasksIn(tasks, column.id, visible);
            const total = tasks.filter((t) => t.status === column.id).length;
            const over = !!column.wip && total > column.wip;
            const headingId = `${uid}-${column.id}`;
            return (
              <section
                key={column.id}
                aria-labelledby={headingId}
                data-column={column.id}
                data-over-limit={over || undefined}
                className={cn(
                  "flex w-[min(84vw,320px)] shrink-0 snap-start flex-col rounded-card border bg-subtle sm:w-auto sm:min-w-[248px] sm:flex-1 sm:basis-0",
                  over ? "border-[color-mix(in_oklab,var(--ui-warning)_45%,var(--ui-border))]" : "border-transparent",
                )}
              >
                <header className="flex h-11 shrink-0 items-center gap-2 px-3">
                  <StatusIcon status={column.id} />
                  <h3 id={headingId} className="m-0 text-[13px] font-semibold text-ink">
                    {column.name}
                  </h3>
                  <span
                    data-testid="column-count"
                    className={cn(
                      "inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-xs font-medium tabular",
                      over ? "bg-surface text-warning ring-1 ring-[color-mix(in_oklab,var(--ui-warning)_40%,transparent)]" : "text-muted",
                    )}
                  >
                    {over && <AlertTriangle aria-hidden className="size-3" />}
                    {column.wip ? `${total} / ${column.wip}` : cards.length}
                    <span className="sr-only-ui">
                      {column.wip ? ` tasks, limit ${column.wip}${over ? ", over the limit" : ""}` : cards.length === 1 ? " task" : " tasks"}
                    </span>
                  </span>
                </header>
                <motion.ul layoutScroll data-column-list className="relative m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto px-2 pt-0.5 pb-2">
                  {cards.map((task) => {
                    const isPicked = picked?.id === task.id;
                    const isGhost = drag.session?.id === task.id;
                    return (
                      <motion.li
                        key={task.id}
                        layout={!reduced}
                        layoutId={reduced ? undefined : task.id}
                        transition={{ layout: layoutTransition }}
                        data-card-slot={task.id}
                        className="relative"
                      >
                        <div
                          role="button"
                          tabIndex={task.id === rovingId ? 0 : -1}
                          data-task-card={task.id}
                          data-picked={isPicked || undefined}
                          aria-roledescription="draggable task"
                          aria-describedby={instructionsId}
                          aria-pressed={isPicked}
                          onFocus={() => setActiveId(task.id)}
                          onKeyDown={(e) => onCardKeyDown(e, task)}
                          onPointerDown={(e) => {
                            if (picked) return;
                            drag.onPointerDown(e, task.id);
                          }}
                          onClick={() => {
                            if (drag.swallowClick() || picked) return;
                            onOpenTask?.(task.id);
                          }}
                          className={cn(
                            CARD_SURFACE,
                            "block cursor-grab select-none [-webkit-touch-callout:none] transition-[border-color,box-shadow,background-color] duration-120 hover:border-input",
                            isPicked && "relative z-10 border-accent shadow-float ring-2 ring-[color-mix(in_oklab,var(--ui-accent)_30%,transparent)]",
                            isGhost && "border-dashed border-input bg-transparent shadow-none [&>*]:invisible",
                          )}
                        >
                          <TaskCardBody task={task} people={people} labels={labels} />
                        </div>
                      </motion.li>
                    );
                  })}
                  {cards.length === 0 && (
                    <li className="grid min-h-24 place-items-center rounded-[12px] border border-dashed border-line px-3 text-center text-[13px] text-muted">
                      {total > 0 ? "No tasks match the filters" : "Drop tasks here"}
                    </li>
                  )}
                  <li className="pt-0.5">
                    <AddTask columnName={column.name} onAdd={(title) => add(column.id, title)} />
                  </li>
                </motion.ul>
              </section>
            );
          })}
        </LayoutGroup>
      </motion.div>
      {region}
      {drag.session &&
        dragged &&
        createPortal(
          <motion.div
            aria-hidden
            data-testid="drag-overlay"
            className="pointer-events-none fixed top-0 left-0 z-[70]"
            style={{ x: drag.x, y: drag.y, width: drag.session.width }}
            initial={{ rotate: 0, scale: 1 }}
            animate={reduced || drag.session.settling ? { rotate: 0, scale: 1 } : { rotate: 2, scale: 1.03 }}
            transition={DRAG_SPRING}
          >
            <div className={cn(CARD_SURFACE, "shadow-float", !drag.session.settling && "border-input")}>
              <TaskCardBody task={dragged} people={people} labels={labels} />
            </div>
          </motion.div>,
          document.body,
        )}
    </div>
  );
}
