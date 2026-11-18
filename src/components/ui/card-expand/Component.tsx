import { useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { DialogBackdrop, DialogClose, DialogDescription, DialogPopup, DialogPortal, DialogRoot, DialogTitle } from "@/primitives/dialog";
import { DURATION, EASING_POINTS } from "@/engine/tokens";
import { Button } from "@/ui/Button";

/**
 * Card expand: a grid of cards where pressing one grows its surface into a modal detail view, and
 * closing shrinks it back into the same card.
 *
 * - Behavior comes from the dialog primitive (src/primitives/dialog.tsx, Base UI): role="dialog"
 *   with aria-modal and aria-labelledby, focus moved inside on open, Tab trapped, the rest of the
 *   page inert, background scroll locked, Esc / outside press / the close button dismiss, and
 *   focus returns to the card that opened it.
 * - Motion: the card's surface and the dialog's surface share one Motion `layoutId`, so the dialog
 *   grows out of the card's bounds (220 ms ease-out) and shrinks back into them (160 ms ease-in).
 *   No spring. The detail content fades in over the last 120 ms of the growth and is gone before
 *   the shrink starts, so text is never shown stretched.
 * - The shared surface is a decorative, aria-hidden layer with nothing focusable in it: the card
 *   button and the dialog never expose the same content twice.
 * - Reduced motion: the dialog appears and disappears in its final layout in 0 ms, with no
 *   geometry interpolation and no crossfade.
 */

const EASE_OUT: [number, number, number, number] = [...EASING_POINTS.out];
const EASE_IN: [number, number, number, number] = [...EASING_POINTS.in];
const RADIUS = { card: 12, dialog: 16 };

export interface ExpandableCardItem {
  id: string;
  /** Card heading, reused as the dialog title. */
  title: string;
  /** Card body (summary); keep it short. */
  summary: ReactNode;
  /** One sentence under the dialog title. */
  description: string;
  /** Dialog body. */
  detail: ReactNode;
}

export interface CardExpandProps {
  items: ExpandableCardItem[];
  /** Accessible name of the card list. */
  label: string;
  className?: string;
  /** Extra controls in the dialog footer, given the open item. */
  footer?(item: ExpandableCardItem): ReactNode;
}

export function CardExpand({ items, label, className = "", footer }: CardExpandProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const source = useRef<string | null>(null);
  const group = useId();
  const open = items.find((i) => i.id === openId) ?? null;

  const grow = { duration: reduced ? 0 : DURATION.enter / 1000, ease: EASE_OUT };
  const shrink = { duration: reduced ? 0 : DURATION.exit / 1000, ease: EASE_IN };
  const contentIn = reduced ? { duration: 0 } : { duration: DURATION.fast / 1000, delay: (DURATION.enter - DURATION.fast) / 1000, ease: EASE_OUT };
  const contentOut = { duration: 0 };
  // Reduced motion drops the shared layout altogether: even at 0 ms, a layoutId projects one frame
  // at the card's bounds before snapping. Without it the dialog simply appears in its final layout.
  const sharedId = (id: string) => (reduced ? undefined : `${id}-surface`);

  return (
    <LayoutGroup id={group}>
      <ul aria-label={label} className={`m-0 grid list-none grid-cols-1 gap-3 p-0 min-[480px]:grid-cols-3 ${className}`} data-card-expand-list>
        {items.map((item) => {
          const isOpen = item.id === openId;
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                ref={(el) => {
                  if (el) cards.current.set(item.id, el);
                  else cards.current.delete(item.id);
                }}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                onClick={() => {
                  source.current = item.id;
                  setOpenId(item.id);
                }}
                className="group relative block w-full rounded-panel p-4 text-left text-ink"
                data-card-expand-card={item.id}
              >
                {isOpen ? (
                  <span aria-hidden="true" className="absolute inset-0 rounded-panel border border-dashed border-line" />
                ) : (
                  <motion.span
                    aria-hidden="true"
                    layoutId={sharedId(item.id)}
                    transition={{ layout: shrink }}
                    style={{ borderRadius: RADIUS.card }}
                    className="absolute inset-0 border border-line bg-surface transition-shadow duration-120 group-hover:shadow-[0_0_0_1.5px_var(--mk-control-border)]"
                    data-card-expand-surface
                  />
                )}
                <span
                  className={`relative block ${isOpen ? "opacity-0" : "opacity-100 transition-opacity duration-[var(--mk-dur-fast)] delay-[var(--mk-dur-exit)] motion-reduce:transition-none motion-reduce:delay-0"}`}
                >
                  <span className="block text-[14px] font-medium text-muted">{item.title}</span>
                  {item.summary}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <DialogRoot open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        <AnimatePresence>
          {open ? (
            <DialogPortal keepMounted>
              <DialogBackdrop
                render={
                  <motion.div
                    data-card-expand-overlay
                    className="fixed inset-0 z-50 bg-[var(--mk-scrim)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: grow }}
                    exit={{ opacity: 0, transition: shrink }}
                  />
                }
              />
              <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
                <DialogPopup
                  aria-modal="true"
                  finalFocus={() => (source.current ? (cards.current.get(source.current) ?? true) : true)}
                  render={
                    <motion.div
                      layoutId={sharedId(open.id)}
                      transition={{ layout: grow }}
                      exit={{ opacity: reduced ? 0 : 1, transition: shrink }}
                      style={{ borderRadius: RADIUS.dialog }}
                      className="pointer-events-auto max-h-[calc(100dvh-32px)] w-full max-w-[min(480px,calc(100vw-32px))] overflow-hidden bg-surface text-ink shadow-[var(--mk-shadow-overlay)] outline-none"
                      data-card-expand-dialog
                    />
                  }
                >
                  <motion.div
                    layout={!reduced}
                    initial={{ opacity: reduced ? 1 : 0 }}
                    animate={{ opacity: 1, transition: contentIn }}
                    exit={{ opacity: 0, transition: contentOut }}
                    className="max-h-[calc(100dvh-32px)] overflow-y-auto p-5 sm:p-6"
                    data-card-expand-content
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 pt-0.5">
                        <DialogTitle className="m-0 text-lg leading-snug font-semibold tracking-[-0.01em]">{open.title}</DialogTitle>
                        <DialogDescription className="mt-1 mb-0 text-[15px] leading-relaxed text-muted">{open.description}</DialogDescription>
                      </div>
                      <DialogClose
                        render={
                          <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1.5 -mr-2 shrink-0 text-muted" data-card-expand-close>
                            <CloseIcon />
                          </Button>
                        }
                      />
                    </div>
                    <div className="mt-5">{open.detail}</div>
                    {footer ? <div className="mt-5 flex flex-wrap items-center gap-2">{footer(open)}</div> : null}
                  </motion.div>
                </DialogPopup>
              </div>
            </DialogPortal>
          ) : null}
        </AnimatePresence>
      </DialogRoot>
    </LayoutGroup>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

function PinIcon({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="-ml-1 size-5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M10 2.8l2.2 4.5 4.9.7-3.6 3.5.9 4.9-4.4-2.3-4.4 2.3.9-4.9L2.9 8l4.9-.7z" />
    </svg>
  );
}

const METRICS = [
  {
    id: "revenue",
    title: "Revenue",
    value: "$84.2k",
    delta: "Up 12% on Q2",
    description: "Monthly recurring revenue for the quarter, by month.",
    rows: [
      ["July", "$26.1k"],
      ["August", "$27.9k"],
      ["September", "$30.2k"],
    ],
  },
  {
    id: "users",
    title: "Active users",
    value: "3,918",
    delta: "Up 8% on Q2",
    description: "People who signed in at least once in the month.",
    rows: [
      ["July", "3,604"],
      ["August", "3,771"],
      ["September", "3,918"],
    ],
  },
  {
    id: "churn",
    title: "Churn",
    value: "2.1%",
    delta: "Down 0.4 points",
    description: "Share of paying accounts that cancelled in the month.",
    rows: [
      ["July", "2.5%"],
      ["August", "2.3%"],
      ["September", "2.1%"],
    ],
  },
] as const;

/** Live example for /kit/card-expand: three quarter metrics that open into a monthly breakdown. */
export function Playground() {
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const items: ExpandableCardItem[] = METRICS.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    summary: (
      <>
        <span className="mt-1 block text-[22px] leading-tight font-semibold tracking-[-0.01em] tabular-nums">{m.value}</span>
        <span className="mt-1 block text-[13px] text-muted">{m.delta}</span>
      </>
    ),
    detail: (
      <dl className="m-0 divide-y divide-[var(--mk-border)] rounded-control bg-sunken px-4">
        {m.rows.map(([month, v]) => (
          <div key={month} className="flex items-center justify-between py-2.5 text-[15px]">
            <dt className="text-muted">{month}</dt>
            <dd className="m-0 font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    ),
  }));
  return (
    <div className="flex w-full max-w-[560px] min-w-0 flex-col gap-3" data-card-expand-playground>
      <h3 className="m-0 text-base font-semibold text-ink">Q3 metrics</h3>
      <CardExpand
        label="Q3 metrics"
        items={items}
        footer={(item) => (
          <Button
            variant="secondary"
            aria-pressed={Boolean(pinned[item.id])}
            onClick={() => setPinned((p) => ({ ...p, [item.id]: !p[item.id] }))}
            data-card-expand-pin
          >
            <PinIcon on={Boolean(pinned[item.id])} />
            Pin to overview
          </Button>
        )}
      />
      <p className="m-0 text-[14px] text-muted">Open a metric for its monthly breakdown.</p>
    </div>
  );
}
