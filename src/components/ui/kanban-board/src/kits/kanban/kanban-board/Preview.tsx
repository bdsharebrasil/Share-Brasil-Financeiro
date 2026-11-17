import { useState } from "react";
import { Card } from "@/ui/Card";
import { Kbd } from "@/ui/Kbd";
import { COLUMNS, LABELS, PEOPLE, makeTasks } from "./data";
import { KanbanBoard } from "./KanbanBoard";

export default function Preview() {
  const [tasks, setTasks] = useState(makeTasks);
  const [opened, setOpened] = useState<string | null>(null);
  const task = tasks.find((t) => t.id === opened);
  return (
    <Card className="bg-page p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
        <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          Drag a card, or focus one and press <Kbd>Space</Kbd>, then <Kbd>←</Kbd>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>→</Kbd> and <Kbd>Space</Kbd> to drop.
        </p>
        <p role="status" className="m-0 text-[13px] text-muted">
          {task ? (
            <>
              Opened <span className="font-medium text-ink">{task.key}</span>
            </>
          ) : (
            "Click a card or press Enter to open it"
          )}
        </p>
      </div>
      <KanbanBoard
        className="h-[640px] sm:h-[600px]"
        columns={COLUMNS}
        tasks={tasks}
        onTasksChange={setTasks}
        people={PEOPLE}
        labels={LABELS}
        onOpenTask={setOpened}
      />
    </Card>
  );
}
