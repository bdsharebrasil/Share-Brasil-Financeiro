/** Data shapes shared by every kanban piece. Dates are calendar days written as YYYY-MM-DD. */

export type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type Priority = "urgent" | "high" | "medium" | "low" | "none";
/** Color family for people and labels. Each maps to a mix of the theme colors, so both themes stay in tune. */
export type Tone = "indigo" | "violet" | "teal" | "green" | "amber" | "orange" | "red" | "slate";

export interface Person {
  id: string;
  name: string;
  role: string;
  tone: Tone;
}

export interface Label {
  id: string;
  name: string;
  tone: Tone;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface Task {
  id: string;
  /** Short reference shown on cards: "HAL-214". */
  key: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeIds: string[];
  labelIds: string[];
  /** First and last working day, inclusive. */
  start: string;
  due: string;
  checklist: ChecklistItem[];
  comments: TaskComment[];
  /** Tasks that must finish first; drawn as arrows on the timeline. */
  dependsOn?: string[];
}

export interface Column {
  id: Status;
  name: string;
  /** Work-in-progress limit. Going over is allowed but flagged. */
  wip?: number;
}

export interface BoardFilterState {
  query: string;
  assigneeIds: string[];
  labelIds: string[];
  /** Only tasks assigned to the signed-in person. */
  mine: boolean;
}
