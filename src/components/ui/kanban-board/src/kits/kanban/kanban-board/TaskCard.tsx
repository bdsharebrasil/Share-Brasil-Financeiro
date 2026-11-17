/** What a task looks like on the board. Shared by the card in its column and the copy that follows the pointer. */
import { ListChecks, MessageSquare } from "lucide-react";
import { cn } from "@/ui/cn";
import { AvatarStack, DueDate, LabelChip, PRIORITY_NAME, PriorityIcon } from "../shared/marks";
import type { Label, Person, Task } from "../shared/types";

export function TaskCardBody({ task, people, labels }: { task: Task; people: Person[]; labels: Label[] }) {
  const assignees = task.assigneeIds.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const taskLabels = task.labelIds.map((id) => labels.find((l) => l.id === id)).filter((l): l is Label => !!l);
  const doneSteps = task.checklist.filter((c) => c.done).length;
  const done = task.status === "done";
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-faint tabular">{task.key}</span>
        <span className="ml-auto flex items-center" title={PRIORITY_NAME[task.priority]}>
          <PriorityIcon priority={task.priority} />
          <span className="sr-only-ui">Priority: {PRIORITY_NAME[task.priority]}.</span>
        </span>
      </div>
      <p className={cn("mt-1.5 mb-0 line-clamp-2 text-sm leading-5 font-medium", done ? "text-muted" : "text-ink")}>{task.title}</p>
      {taskLabels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {taskLabels.slice(0, 2).map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {taskLabels.length > 2 && (
            <span className="inline-flex h-6 items-center rounded-full border border-line px-2 text-xs font-medium text-muted">
              +{taskLabels.length - 2}
              <span className="sr-only-ui"> more labels</span>
            </span>
          )}
        </div>
      )}
      <div className="mt-3 flex min-h-6 items-center gap-3">
        <DueDate due={task.due} done={done} />
        {task.checklist.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted tabular">
            <ListChecks aria-hidden className="size-3.5" />
            <span className="sr-only-ui">Checklist</span>
            {doneSteps}/{task.checklist.length}
          </span>
        )}
        {task.comments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted tabular">
            <MessageSquare aria-hidden className="size-3.5" />
            {task.comments.length}
            <span className="sr-only-ui">{task.comments.length === 1 ? "comment" : "comments"}</span>
          </span>
        )}
        <AvatarStack people={assignees} className="ml-auto" />
      </div>
    </>
  );
}

export const CARD_SURFACE = "rounded-[12px] border border-line bg-surface p-3 text-left";
