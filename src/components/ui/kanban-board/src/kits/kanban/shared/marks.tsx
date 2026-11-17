/** Small visual marks shared by the kanban pieces: status rings, priority bars, label chips, avatars, due dates. */
import { CalendarDays } from "lucide-react";
import { initials } from "@/ui/Avatar";
import { cn } from "@/ui/cn";
import { diffDays, formatDay, formatDayLong, today } from "./dates";
import { toneStyle } from "./tone";
import type { Label, Person, Priority, Status } from "./types";

export const STATUS_TEXT: Record<Status, string> = {
  backlog: "text-muted",
  todo: "text-muted",
  in_progress: "text-warning",
  in_review: "text-accent-text",
  done: "text-success",
};

/** Ring that fills as work moves right: dashed, empty, half, three quarters, done. Decorative. */
export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const r = 5.25;
  const pie = (part: number) => {
    const angle = part * 2 * Math.PI;
    const x = 7 + 3.5 * Math.sin(angle);
    const y = 7 - 3.5 * Math.cos(angle);
    return `M7 7 L7 3.5 A3.5 3.5 0 ${part > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  };
  return (
    <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0", STATUS_TEXT[status], className)} fill="none">
      {status === "done" ? (
        <>
          <circle cx="7" cy="7" r="6.25" fill="currentColor" />
          <path d="M4.4 7.2 6.2 9 9.7 5.3" stroke="var(--ui-surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="7" cy="7" r={r + 1} stroke="currentColor" strokeWidth="1.5" strokeDasharray={status === "backlog" ? "2 2.1" : undefined} />
          {status === "in_progress" && <path d={pie(0.5)} fill="currentColor" />}
          {status === "in_review" && <path d={pie(0.75)} fill="currentColor" />}
        </>
      )}
    </svg>
  );
}

export const PRIORITY_NAME: Record<Priority, string> = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low", none: "No priority" };
export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];

/** Signal bars for priority; urgent is a filled badge. Decorative: pair it with PRIORITY_NAME for text. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "urgent") {
    return (
      <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0 text-danger", className)}>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" />
        <path d="M7 3.8v4M7 10.1v.1" stroke="var(--ui-surface)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (priority === "none") {
    return (
      <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0 text-muted", className)}>
        {[2, 6, 10].map((x) => (
          <rect key={x} x={x} y="6.25" width="2.2" height="1.5" rx="0.6" fill="currentColor" />
        ))}
      </svg>
    );
  }
  const level = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0 text-muted", className)}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1.5 + i * 4} y={9 - i * 3} width="3" height={3.5 + i * 3} rx="0.8" fill="currentColor" opacity={i < level ? 1 : 0.28} />
      ))}
    </svg>
  );
}

/** Label name with a colored dot. */
export function LabelChip({ label, className }: { label: Label; className?: string }) {
  return (
    <span
      style={toneStyle(label.tone)}
      className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface px-2 text-xs leading-none font-medium whitespace-nowrap text-muted", className)}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--tone)" />
      {label.name}
    </span>
  );
}

const AVATAR_SIZE = { sm: "size-6 text-xs", md: "size-7 text-xs", lg: "size-8 text-[13px]" } as const;
/** Stack overlap per size: just enough to read as a group without the ring covering the initials. */
export const AVATAR_OVERLAP = { sm: "-ml-px", md: "-ml-0.5", lg: "-ml-1" } as const;

/**
 * Initials on a tint of the person's color. Decorative by default (the name is printed next to it or
 * given by the parent); pass `label` when it stands alone.
 */
export function PersonAvatar({ person, size = "sm", label, className }: { person: Person; size?: keyof typeof AVATAR_SIZE; label?: string; className?: string }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <span
      {...a11y}
      style={toneStyle(person.tone)}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--tone)_24%,var(--ui-surface))] font-semibold text-ink select-none",
        AVATAR_SIZE[size],
        className,
      )}
    >
      <span aria-hidden className="tracking-[-0.01em]">
        {initials(person.name)}
      </span>
    </span>
  );
}

/** Overlapping avatars with a +N overflow. Reads as one image: "Assigned to Priya Raman and Tomás Ferreira". */
export function AvatarStack({ people, max = 3, size = "sm", className }: { people: Person[]; max?: number; size?: keyof typeof AVATAR_SIZE; className?: string }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const names = people.map((p) => p.name);
  const label = `Assigned to ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}`;
  return (
    <span role="img" aria-label={label} className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <PersonAvatar key={p.id} person={p} size={size} className={cn("ring-2 ring-surface", i > 0 && AVATAR_OVERLAP[size])} />
      ))}
      {extra > 0 && (
        <span aria-hidden className={cn(AVATAR_OVERLAP[size], "inline-grid place-items-center rounded-full bg-active font-semibold text-ink ring-2 ring-surface", AVATAR_SIZE[size])}>
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Due date with overdue and due-today states. Done tasks never look late. */
export function DueDate({ due, done, className }: { due: string; done?: boolean; className?: string }) {
  const left = diffDays(today(), due);
  const late = !done && left < 0;
  const soon = !done && left >= 0 && left <= 1;
  const text = left === 0 ? "Today" : left === 1 ? "Tomorrow" : left === -1 ? "Yesterday" : formatDay(due);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular", late ? "text-danger" : soon ? "text-warning" : "text-muted", className)}>
      <CalendarDays aria-hidden className="size-3.5" />
      <span className="sr-only-ui">{late ? "Overdue, was due" : "Due"} {formatDayLong(due)}.</span>
      <span aria-hidden>{text}</span>
    </span>
  );
}
