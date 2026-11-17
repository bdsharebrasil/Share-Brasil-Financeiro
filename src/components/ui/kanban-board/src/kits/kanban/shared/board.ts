/** Pure board logic: ordering, moving and filtering. No React, so it is easy to test and reuse on a server. */
import type { BoardFilterState, Label, Person, Status, Task } from "./types";

/** Tasks of one column, in board order (the array order is the board order). */
export function tasksIn(tasks: Task[], status: Status, visible: (task: Task) => boolean = () => true): Task[] {
  return tasks.filter((t) => t.status === status && visible(t));
}

/**
 * Moves a task to `status`, placed just before `beforeId`, or at the end of that column when
 * `beforeId` is null. Returns a new array; the input is not changed.
 */
export function moveTask(tasks: Task[], id: string, status: Status, beforeId: string | null): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || beforeId === id) return tasks;
  const rest = tasks.filter((t) => t.id !== id);
  let index = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
  if (index < 0) {
    const last = rest.findLastIndex((t) => t.status === status);
    index = last < 0 ? rest.length : last + 1;
  }
  rest.splice(index, 0, task.status === status ? task : { ...task, status });
  return rest;
}

/**
 * Moves a task to position `index` among the visible tasks of `status` (the task itself not counted).
 * Hidden tasks keep their place relative to their neighbors.
 */
export function moveToIndex(tasks: Task[], id: string, status: Status, index: number, visible: (task: Task) => boolean = () => true): Task[] {
  const siblings = tasksIn(tasks, status, visible).filter((t) => t.id !== id);
  const before = siblings[Math.max(0, index)] ?? null;
  return moveTask(tasks, id, status, before ? before.id : null);
}

/** Position of a task among the visible tasks of its column, 0-based, and that column's visible size. */
export function positionOf(tasks: Task[], id: string, visible: (task: Task) => boolean = () => true) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return { index: -1, size: 0 };
  const column = tasksIn(tasks, task.status, (t) => t.id === id || visible(t));
  return { index: column.findIndex((t) => t.id === id), size: column.length };
}

export const EMPTY_FILTERS: BoardFilterState = { query: "", assigneeIds: [], labelIds: [], mine: false };

export function filtersActive(f: BoardFilterState) {
  return f.query.trim() !== "" || f.assigneeIds.length > 0 || f.labelIds.length > 0 || f.mine;
}

/**
 * True when a task passes the filters. People and labels each match any of the picked values;
 * the search looks at the key, title, description, label names and assignee names.
 */
export function matchesFilters(task: Task, f: BoardFilterState, ctx: { me: string; people: Person[]; labels: Label[] }): boolean {
  if (f.mine && !task.assigneeIds.includes(ctx.me)) return false;
  if (f.assigneeIds.length && !task.assigneeIds.some((id) => f.assigneeIds.includes(id))) return false;
  if (f.labelIds.length && !task.labelIds.some((id) => f.labelIds.includes(id))) return false;
  const query = f.query.trim().toLowerCase();
  if (!query) return true;
  const words = [
    task.key,
    task.title,
    task.description,
    ...task.labelIds.map((id) => ctx.labels.find((l) => l.id === id)?.name ?? ""),
    ...task.assigneeIds.map((id) => ctx.people.find((p) => p.id === id)?.name ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).every((part) => words.includes(part));
}

/** Next free key: HAL-241 after HAL-240. */
export function nextKey(tasks: Task[], prefix = "HAL"): string {
  const top = tasks.reduce((max, t) => Math.max(max, Number(t.key.split("-")[1]) || 0), 0);
  return `${prefix}-${top + 1}`;
}
