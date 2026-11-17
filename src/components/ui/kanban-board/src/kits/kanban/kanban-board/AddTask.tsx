/** "Add task" at the foot of a column; turns into a title field. Enter adds and stays open, Esc closes. */
import { Plus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";

export function AddTask({ columnName, onAdd }: { columnName: string; onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const refocus = useRef<"field" | "opener" | null>(null);

  useLayoutEffect(() => {
    if (refocus.current === "field") field.current?.focus();
    if (refocus.current === "opener") opener.current?.focus();
    refocus.current = null;
  }, [open]);

  const close = () => {
    setTitle("");
    refocus.current = "opener";
    setOpen(false);
  };
  const submit = () => {
    const text = title.trim();
    if (!text) return;
    onAdd(text);
    setTitle("");
    field.current?.focus();
  };

  if (!open) {
    return (
      <Button
        ref={opener}
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-start px-2.5"
        aria-label={`Add task to ${columnName}`}
        onClick={() => {
          refocus.current = "field";
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-4" />
        Add task
      </Button>
    );
  }
  return (
    <form
      className="rounded-[12px] border border-line bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onBlur={(e) => {
        // Leaving the composer with nothing typed folds it back.
        if (!title.trim() && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setTitle("");
          setOpen(false);
        }
      }}
    >
      <Input
        ref={field}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
        placeholder="Task title"
        aria-label={`New task title in ${columnName}`}
        className="h-9"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
          Add task
        </Button>
        <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Close" onClick={close}>
          <X aria-hidden />
        </Button>
        <span className="ml-auto hidden text-xs text-faint sm:inline">Enter to add</span>
      </div>
    </form>
  );
}
