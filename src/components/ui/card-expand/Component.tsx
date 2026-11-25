import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const open = items.find((item) => item.id === openId) ?? null;

  return (
    <>
      <ul aria-label={label} className={`m-0 grid list-none grid-cols-1 gap-1 p-0 ${className}`} data-card-expand-list>
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={item.id === openId}
              onClick={() => setOpenId(item.id)}
              className="group relative block w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-accent"
              data-card-expand-card={item.id}
            >
              <span className="block text-xs font-semibold">{item.title}</span>
              {item.summary}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        {open && (
          <DialogContent className="max-w-md rounded-lg">
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
              <DialogDescription>{open.description}</DialogDescription>
            </DialogHeader>
            <div className="mt-1">{open.detail}</div>
            {footer && <div className="mt-4 flex flex-wrap items-center gap-2">{footer(open)}</div>}
          </DialogContent>
        )}
      </Dialog>
    </>
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
