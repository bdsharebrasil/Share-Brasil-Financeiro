/** Calendar-day helpers. Days are YYYY-MM-DD strings in local time, so no time zone can shift them. */

export function toDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function today(): string {
  return toDay(new Date());
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + amount);
  return toDay(date);
}

/** Whole days from a to b (b - a). Uses noon to stay clear of daylight-saving jumps. */
export function diffDays(a: string, b: string): number {
  const one = parseDay(a);
  const two = parseDay(b);
  one.setHours(12);
  two.setHours(12);
  return Math.round((two.getTime() - one.getTime()) / 86_400_000);
}

/** Monday on or before the day. */
export function startOfWeek(day: string): string {
  const weekday = (parseDay(day).getDay() + 6) % 7;
  return addDays(day, -weekday);
}

export function isWeekend(day: string): boolean {
  const weekday = parseDay(day).getDay();
  return weekday === 0 || weekday === 6;
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

/** "Nov 4" */
export function formatDay(day: string): string {
  return SHORT.format(parseDay(day));
}

/** "Tuesday, November 4", for screen readers and tooltips. */
export function formatDayLong(day: string): string {
  return LONG.format(parseDay(day));
}

/** "Nov 3 – 7" or "Oct 30 – Nov 4". */
export function formatRange(start: string, end: string): string {
  const a = parseDay(start);
  const b = parseDay(end);
  if (start === end) return SHORT.format(a);
  if (a.getMonth() === b.getMonth()) return `${SHORT.format(a)} – ${b.getDate()}`;
  return `${SHORT.format(a)} – ${SHORT.format(b)}`;
}

/** Inclusive length in days: a task from Nov 3 to Nov 3 lasts 1 day. */
export function spanDays(start: string, end: string): number {
  return diffDays(start, end) + 1;
}

/** "2h ago", "Yesterday", "Oct 28". */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return SHORT.format(new Date(iso));
}
