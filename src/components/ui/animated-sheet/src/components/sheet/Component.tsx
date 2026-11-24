import { createContext, useContext, useId, useState, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../../primitives/dialog";
import { EASING_POINTS } from "../../engine/tokens";
import { Button } from "../../ui/Button";
import { SHEET_MS } from "./timing";

/**
 * Sheet: a modal panel attached to one edge of the viewport (right by default; left, top or
 * bottom through `side`). The page stays visible behind a dimmed backdrop.
 *
 * Behavior comes from the dialog primitive (src/primitives/dialog.tsx, Base UI): role="dialog"
 * with aria-modal, aria-labelledby (SheetTitle) and aria-describedby (SheetDescription), focus
 * trap, Esc and a press on the backdrop close it, focus returns to the trigger, the page behind is
 * inert and does not scroll.
 * Motion: enter 240 ms slide from the edge + backdrop fade, ease-out; exit 180 ms
 * ease-in; no spring. Reduced motion: the panel appears at its final position with no slide and no
 * animated backdrop.
 */

export type SheetSide = "left" | "right" | "top" | "bottom";

function bezier(points: readonly [number, number, number, number]): [number, number, number, number] {
  return [points[0], points[1], points[2], points[3]];
}

/** Where the panel sits and the offset it slides in from, per edge. */
const SIDE: Record<SheetSide, { box: string; hidden: { x?: string; y?: string } }> = {
  right: { box: "inset-y-2 right-2 w-[min(400px,calc(100vw-16px))]", hidden: { x: "calc(100% + 8px)" } },
  left: { box: "inset-y-2 left-2 w-[min(400px,calc(100vw-16px))]", hidden: { x: "calc(-100% - 8px)" } },
  top: { box: "inset-x-2 top-2 max-h-[min(560px,calc(100dvh-16px))]", hidden: { y: "calc(-100% - 8px)" } },
  bottom: { box: "inset-x-2 bottom-2 max-h-[min(560px,calc(100dvh-16px))]", hidden: { y: "calc(100% + 8px)" } },
};

const SheetContext = createContext<{ open: boolean }>({ open: false });

export interface SheetProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?(open: boolean): void;
}

export function Sheet({ children, open: controlled, defaultOpen = false, onOpenChange }: SheetProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return (
    <SheetContext.Provider value={{ open }}>
      <DialogRoot open={open} onOpenChange={setOpen}>
        {children}
      </DialogRoot>
    </SheetContext.Provider>
  );
}

/** Renders the single element it wraps (usually a Button) as the opener. */
export function SheetTrigger({ children }: { children: ReactElement }) {
  return <DialogTrigger render={children} />;
}

/** Renders the single element it wraps as a closer. */
export function SheetClose({ children }: { children: ReactElement }) {
  return <DialogClose render={children} />;
}

export interface SheetContentProps {
  children: ReactNode;
  side?: SheetSide;
  className?: string;
}

export function SheetContent({ children, side = "right", className = "" }: SheetContentProps) {
  const { open } = useContext(SheetContext);
  const reduced = useReducedMotion() ?? false;
  const enter = { duration: reduced ? 0 : SHEET_MS.enter / 1000, ease: bezier(EASING_POINTS.out) };
  const exit = { duration: reduced ? 0 : SHEET_MS.exit / 1000, ease: bezier(EASING_POINTS.in) };
  const { box, hidden } = SIDE[side];
  const offset = reduced ? { x: 0, y: 0 } : { x: hidden.x ?? 0, y: hidden.y ?? 0 };
  return (
    <AnimatePresence>
      {open ? (
        <DialogPortal keepMounted>
          <DialogBackdrop
            render={
              <motion.div
                data-sheet-overlay
                className="fixed inset-0 z-50 bg-[rgb(18_21_28/0.26)]"
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: 1, transition: enter }}
                exit={{ opacity: reduced ? 1 : 0, transition: exit }}
              />
            }
          />
          <DialogPopup
            aria-modal="true"
            data-side={side}
            render={
              <motion.div
                data-sheet-content
                className={`fixed z-50 flex flex-col overflow-hidden rounded-[12px] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[0_18px_44px_-12px_rgb(20_24_33/0.32)] outline-none ${box} ${className}`}
                initial={offset}
                animate={{ x: 0, y: 0, transition: enter }}
                exit={{ ...offset, transition: exit }}
              />
            }
          >
            {children}
          </DialogPopup>
        </DialogPortal>
      ) : null}
    </AnimatePresence>
  );
}

export function SheetTitle({ children }: { children: ReactNode }) {
  return <DialogTitle className="m-0 text-lg leading-snug font-semibold tracking-[-0.01em]">{children}</DialogTitle>;
}

export function SheetDescription({ children }: { children: ReactNode }) {
  return <DialogDescription className="mt-1 mb-0 text-[15px] leading-relaxed text-[var(--app-muted)]">{children}</DialogDescription>;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3.5 6h13M6 10h8M8.5 14h3" />
    </svg>
  );
}

const SORTS = ["Newest", "Oldest", "Unread"] as const;
const STATUSES = [
  { id: "open", label: "Open", count: 24 },
  { id: "waiting", label: "Waiting on customer", count: 9 },
  { id: "closed", label: "Closed", count: 112 },
] as const;
const TAGS = ["Billing", "Bug report", "Sales", "Feedback"] as const;
const SIDES: SheetSide[] = ["right", "left", "top", "bottom"];

interface Filters {
  sort: (typeof SORTS)[number];
  status: string[];
  tags: string[];
}
const DEFAULTS: Filters = { sort: "Newest", status: ["open"], tags: ["Bug report"] };

function describe(f: Filters) {
  return `${f.sort}, ${f.status.length} status${f.status.length === 1 ? "" : "es"}, ${f.tags.length} tag${f.tags.length === 1 ? "" : "s"}`;
}

/**
 * Live example: the "Filters" sheet (sort, status checkboxes,
 * tags, Reset and Apply), plus a picker for the edge it opens from. Apply keeps the draft;
 * closing any other way discards it.
 */
export function Playground() {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<SheetSide>("right");
  const [applied, setApplied] = useState<Filters>(DEFAULTS);
  const [draft, setDraft] = useState<Filters>(DEFAULTS);
  const [result, setResult] = useState<string | null>(null);
  const sortName = useId();
  const sideName = useId();
  const statusLabel = useId();
  const tagsLabel = useId();

  const onOpenChange = (next: boolean) => {
    if (next) setDraft(applied);
    setOpen(next);
  };
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="flex flex-col items-center gap-4">
      <fieldset className="m-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-0 p-0">
        <legend className="mb-2 w-full text-center text-sm font-medium text-ink">Opens from</legend>
        {SIDES.map((s) => (
          <label key={s} className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-[15px] text-ink capitalize">
            <input type="radio" name={sideName} value={s} checked={side === s} onChange={() => setSide(s)} className="size-4 accent-[var(--mk-accent)]" />
            {s}
          </label>
        ))}
      </fieldset>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger>
          <Button variant="secondary" data-testid="sheet-trigger">
            <FilterIcon />
            Filters
          </Button>
        </SheetTrigger>
        <SheetContent side={side}>
          <div className="flex items-start gap-3 border-b border-line px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the inbox; nothing changes until you apply.</SheetDescription>
            </div>
            <SheetClose>
              <Button variant="ghost" size="icon" aria-label="Close" data-testid="sheet-close" className="-mt-1 -mr-2 shrink-0 text-muted">
                <CloseIcon />
              </Button>
            </SheetClose>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-medium text-ink">Sort</legend>
              <div className="grid grid-cols-3 gap-1 rounded-control bg-sunken p-1">
                {SORTS.map((s) => (
                  <label
                    key={s}
                    className="relative grid min-h-9 cursor-pointer place-items-center rounded-[6px] text-sm text-ink has-checked:bg-surface has-checked:font-medium has-checked:shadow-[0_1px_2px_rgb(10_12_16/0.12)] has-focus-visible:outline-2 has-focus-visible:outline-[var(--mk-focus)]"
                  >
                    <input
                      type="radio"
                      name={sortName}
                      value={s}
                      checked={draft.sort === s}
                      onChange={() => setDraft({ ...draft, sort: s })}
                      className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-[6px] outline-none"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="m-0 border-0 p-0">
              <legend id={statusLabel} className="mb-1 text-sm font-medium text-ink">
                Status
              </legend>
              {STATUSES.map((s) => (
                <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-3 text-[15px] text-ink">
                  <input
                    type="checkbox"
                    data-testid={`sheet-status-${s.id}`}
                    checked={draft.status.includes(s.id)}
                    onChange={() => setDraft({ ...draft, status: toggle(draft.status, s.id) })}
                    className="size-4 shrink-0 accent-[var(--mk-accent)]"
                  />
                  <span className="min-w-0 flex-1">{s.label}</span>
                  <span className="text-sm text-muted tabular-nums">{s.count}</span>
                </label>
              ))}
            </fieldset>
            <div role="group" aria-labelledby={tagsLabel}>
              <p id={tagsLabel} className="m-0 mb-2 text-sm font-medium text-ink">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => {
                  const on = draft.tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft({ ...draft, tags: toggle(draft.tags, t) })}
                      className="h-9 rounded-full border border-control-line px-3.5 text-sm text-ink transition-colors duration-120 ease-kit-out aria-pressed:border-transparent aria-pressed:bg-accent aria-pressed:text-accent-fg motion-reduce:transition-none pointer-coarse:h-11"
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t border-line px-6 py-4">
            <Button variant="secondary" data-testid="sheet-reset" className="flex-1" onClick={() => setDraft(DEFAULTS)}>
              Reset
            </Button>
            <Button
              data-testid="sheet-apply"
              className="flex-1"
              onClick={() => {
                setApplied(draft);
                setResult(`Applied: ${describe(draft)}`);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <p role="status" className="m-0 min-h-6 text-sm text-muted">
        {result ?? ""}
      </p>
    </div>
  );
}
