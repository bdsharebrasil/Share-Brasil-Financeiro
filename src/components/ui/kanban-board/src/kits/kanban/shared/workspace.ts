/**
 * Mock workspace: the Halcyon team shipping version 3.2 of their personal-finance app. Dates are
 * relative to today so the board, list and timeline always look current. Replace with your own data.
 */
import { addDays, today } from "./dates";
import type { Column, Label, Person, Task, TaskComment } from "./types";

export const WORKSPACE = "Halcyon";
export const PROJECT = "Mobile app 3.2";

export const PEOPLE: Person[] = [
  { id: "lena", name: "Lena Kowalski", role: "Product designer", tone: "indigo" },
  { id: "priya", name: "Priya Raman", role: "iOS engineer", tone: "teal" },
  { id: "tomas", name: "Tomás Ferreira", role: "Backend engineer", tone: "amber" },
  { id: "aiko", name: "Aiko Tanaka", role: "Android engineer", tone: "green" },
  { id: "jonah", name: "Jonah Whitfield", role: "Engineering manager", tone: "violet" },
  { id: "samir", name: "Samir Haddad", role: "QA engineer", tone: "orange" },
  { id: "grace", name: "Grace Mbeki", role: "Content designer", tone: "red" },
];

/** The signed-in person: "Only my tasks" and new comments use them. */
export const ME = "lena";

export const LABELS: Label[] = [
  { id: "design", name: "Design", tone: "violet" },
  { id: "feature", name: "Feature", tone: "indigo" },
  { id: "bug", name: "Bug", tone: "red" },
  { id: "backend", name: "Backend", tone: "teal" },
  { id: "ios", name: "iOS", tone: "slate" },
  { id: "android", name: "Android", tone: "green" },
  { id: "security", name: "Security", tone: "amber" },
  { id: "content", name: "Content", tone: "orange" },
];

export const COLUMNS: Column[] = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "To do" },
  { id: "in_progress", name: "In progress", wip: 4 },
  { id: "in_review", name: "In review", wip: 3 },
  { id: "done", name: "Done" },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let commentSeq = 0;
const comment = (authorId: string, body: string, ago: number): TaskComment => ({ id: `c${++commentSeq}`, authorId, body, createdAt: hoursAgo(ago) });

const steps = (prefix: string, items: Array<[string, boolean]>) => items.map(([text, done], i) => ({ id: `${prefix}-${i + 1}`, text, done }));

/** Builds the task list with dates counted from `base` (today by default). */
export function makeTasks(base = today()): Task[] {
  const d = (offset: number) => addDays(base, offset);
  return [
    // In progress
    {
      id: "t214", key: "HAL-214", title: "Redesign the monthly spending chart", status: "in_progress", priority: "high",
      description: "Bars are hard to compare on small phones. Move to a stacked area per category, keep the month total on top and make the selected day readable with one thumb.",
      assigneeIds: ["lena", "priya"], labelIds: ["design", "ios"], start: d(-6), due: d(3),
      checklist: steps("t214", [["Audit current chart on 4.7\" screens", true], ["Explore three directions", true], ["Prototype touch scrubbing", true], ["Accessibility review", false], ["Hand off specs to iOS", false]]),
      comments: [comment("priya", "Scrubbing prototype feels great. Can we snap to days instead of free scrolling?", 26), comment("lena", "Yes, snapping to days. I'll update the spec this afternoon.", 5)],
    },
    {
      id: "t216", key: "HAL-216", title: "Move Android sign-in to passkeys", status: "in_progress", priority: "urgent",
      description: "Use Credential Manager for passkeys, keep the password path behind 'Other ways to sign in' for this release.",
      assigneeIds: ["aiko"], labelIds: ["android", "security"], start: d(-9), due: d(1),
      checklist: steps("t216", [["Credential Manager spike", true], ["Server challenge endpoint", true], ["Fallback flow", false]]),
      comments: [comment("tomas", "Challenge endpoint is live on staging.", 30)],
    },
    {
      id: "t221", key: "HAL-221", title: "Recurring transfers: edit or skip the next one", status: "in_progress", priority: "medium",
      description: "People can only cancel a recurring transfer today. Add 'Skip next' and 'Edit amount' without recreating the schedule.",
      assigneeIds: ["tomas", "priya"], labelIds: ["feature", "backend"], start: d(-3), due: d(8),
      checklist: steps("t221", [["Schedule API supports skips", true], ["Edit sheet", false], ["Notification copy", false]]),
      comments: [],
    },
    // In review
    {
      id: "t209", key: "HAL-209", title: "Fix currency rounding in CSV exports", status: "in_review", priority: "high",
      description: "Amounts in JPY and KRW export with two decimals. Use the currency's minor units when formatting.",
      assigneeIds: ["tomas"], labelIds: ["bug", "backend"], start: d(-8), due: d(-1),
      checklist: steps("t209", [["Failing test for zero-decimal currencies", true], ["Fix formatter", true]]),
      comments: [comment("samir", "Verified with JPY, KRW and BHD exports. Looks right.", 3)],
    },
    {
      id: "t211", key: "HAL-211", title: "Dark mode pass on Settings and Profile", status: "in_review", priority: "medium",
      description: "Several rows still use the light divider color and the avatar ring disappears on black.",
      assigneeIds: ["lena"], labelIds: ["design"], start: d(-5), due: d(2),
      checklist: steps("t211", [["Settings", true], ["Profile", true], ["Edge cases with long names", false]]),
      comments: [],
    },
    {
      id: "t217", key: "HAL-217", title: "Crash when opening statements offline", status: "in_review", priority: "urgent",
      description: "Statements view force-unwraps the cached PDF URL. Show the offline state instead.",
      assigneeIds: ["priya", "samir"], labelIds: ["bug", "ios"], start: d(-4), due: d(0),
      checklist: [], comments: [comment("samir", "Repro rate went from 100% to 0 on the fix build.", 8)],
    },
    // To do
    {
      id: "t229", key: "HAL-229", title: "Rate-limit one-time code resends", status: "todo", priority: "urgent",
      description: "Limit resends to 3 per 10 minutes per phone number and show the wait time in the app.",
      assigneeIds: ["tomas"], labelIds: ["backend", "security"], start: d(-1), due: d(4),
      checklist: [], comments: [], dependsOn: ["t216"],
    },
    {
      id: "t219", key: "HAL-219", title: "Split a payment from the transaction screen", status: "todo", priority: "high",
      description: "Pick friends, split evenly or by amount, and send requests in one go.",
      assigneeIds: ["lena", "aiko"], labelIds: ["feature", "design"], start: d(2), due: d(14),
      checklist: steps("t219", [["Flow diagram", true], ["Friend picker", false], ["Request states", false], ["Reminder rules", false]]),
      comments: [comment("jonah", "Let's ship even splits first and keep custom amounts for 3.3 if it gets tight.", 50)], dependsOn: ["t209"],
    },
    {
      id: "t224", key: "HAL-224", title: "Freeze card toggle on card details", status: "todo", priority: "medium",
      description: "One tap to freeze and unfreeze, with a confirmation only when freezing.",
      assigneeIds: ["priya"], labelIds: ["feature", "ios"], start: d(4), due: d(10),
      checklist: [], comments: [],
    },
    {
      id: "t227", key: "HAL-227", title: "Empty state for budgets with no categories", status: "todo", priority: "low",
      description: "Suggest three starter categories based on last month's spending.",
      assigneeIds: ["grace"], labelIds: ["design", "content"], start: d(6), due: d(12),
      checklist: [], comments: [],
    },
    // Backlog
    {
      id: "t240", key: "HAL-240", title: "Rewrite the push notification opt-in screen", status: "backlog", priority: "medium",
      description: "Explain the three alerts people actually want before asking for permission.",
      assigneeIds: ["grace"], labelIds: ["content"], start: d(9), due: d(16),
      checklist: [], comments: [],
    },
    {
      id: "t231", key: "HAL-231", title: "Offline mode for recent transactions", status: "backlog", priority: "low",
      description: "Cache the last 90 days so the home screen opens without a connection.",
      assigneeIds: [], labelIds: ["feature", "ios", "android"], start: d(12), due: d(26),
      checklist: [], comments: [], dependsOn: ["t217"],
    },
    {
      id: "t236", key: "HAL-236", title: "Home screen widget for the daily budget", status: "backlog", priority: "none",
      description: "Small and medium sizes; tapping opens Budgets.",
      assigneeIds: ["priya"], labelIds: ["ios", "design"], start: d(15), due: d(24),
      checklist: [], comments: [],
    },
    {
      id: "t238", key: "HAL-238", title: "Translate onboarding into Portuguese and Japanese", status: "backlog", priority: "low",
      description: "Use the new glossary. Japanese needs a review by the Tokyo support team.",
      assigneeIds: ["grace", "jonah"], labelIds: ["content"], start: d(10), due: d(20),
      checklist: [], comments: [],
    },
    // Done
    {
      id: "t201", key: "HAL-201", title: "Face ID unlock when the app opens", status: "done", priority: "high",
      description: "Ask once after sign-in; respect the system setting.",
      assigneeIds: ["priya"], labelIds: ["security", "ios"], start: d(-16), due: d(-9),
      checklist: [], comments: [],
    },
    {
      id: "t203", key: "HAL-203", title: "New transaction detail sheet", status: "done", priority: "medium",
      description: "Merchant, category, notes and receipts in one sheet.",
      assigneeIds: ["lena", "aiko"], labelIds: ["design", "android"], start: d(-14), due: d(-7),
      checklist: [], comments: [],
    },
    {
      id: "t206", key: "HAL-206", title: "Release notes for 3.1.4", status: "done", priority: "low",
      description: "Short, friendly and under 170 characters for the App Store.",
      assigneeIds: ["grace"], labelIds: ["content"], start: d(-10), due: d(-8),
      checklist: [], comments: [],
    },
  ];
}

export function personById(id: string) {
  return PEOPLE.find((p) => p.id === id);
}

export function labelById(id: string) {
  return LABELS.find((l) => l.id === id);
}

export function columnName(status: string) {
  return COLUMNS.find((c) => c.id === status)?.name ?? status;
}
