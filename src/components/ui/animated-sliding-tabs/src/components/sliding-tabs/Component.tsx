import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { DURATION, EASING_POINTS } from "@/engine/tokens";
import { Tabs } from "@/primitives/tabs";

export type TabsValue = Tabs.Tab.Value;

/**
 * Sliding tabs: a tab list whose active pill slides to the selected tab while the panel below
 * crossfades.
 *
 * Behavior comes from the tabs primitive (src/primitives/tabs.tsx, Base UI): role="tablist" / "tab" /
 * "tabpanel" with aria-selected, aria-controls and aria-labelledby wiring, roving tabindex, Left
 * and Right arrows (Up and Down when vertical) move focus and wrap, Home and End reach the first
 * and last tab. `activation="automatic"` (default) selects a tab as it receives focus;
 * `activation="manual"` only moves focus and selects on Enter or Space.
 * Motion: the pill is one Motion element shared across tabs through `layoutId`, so it travels to
 * the new tab in 220 ms ease-out. The leaving panel fades out in 160 ms ease-in and the entering
 * panel fades in over 220 ms ease-out (CSS transitions on Base UI's starting and ending style
 * attributes; both panels share one grid cell so they overlap). Reduced motion: the pill jumps and
 * the panels swap with no transition.
 */

/** Mirrors --mk-r-control (8 px). Motion corrects a numeric border radius during the layout move. */
const PILL_RADIUS = 8;

function bezier(points: readonly [number, number, number, number]): [number, number, number, number] {
  return [points[0], points[1], points[2], points[3]];
}

interface SlidingTabsState {
  value: TabsValue;
  /** Shared layoutId of the pill, unique per tabs instance. */
  pillId: string;
  activation: "automatic" | "manual";
}

const SlidingTabsContext = createContext<SlidingTabsState>({ value: null, pillId: "", activation: "automatic" });

export interface SlidingTabsProps {
  children: ReactNode;
  value?: TabsValue;
  defaultValue?: TabsValue;
  onValueChange?(value: TabsValue): void;
  /** "automatic" selects on focus (arrow keys); "manual" moves focus and selects on Enter or Space. */
  activation?: "automatic" | "manual";
  className?: string;
}

export function SlidingTabs({
  children,
  value: controlled,
  defaultValue,
  onValueChange,
  activation = "automatic",
  className = "",
}: SlidingTabsProps) {
  // Uncontrolled: Base UI owns the value (and picks the first tab when there is no default); this
  // mirror only tells the tabs which one carries the pill. onValueChange also reports that initial pick.
  const [uncontrolled, setUncontrolled] = useState<TabsValue>(defaultValue ?? null);
  const value = controlled !== undefined ? controlled : uncontrolled;
  const pillId = `sliding-tabs-pill-${useId()}`;
  return (
    <SlidingTabsContext.Provider value={{ value, pillId, activation }}>
      <LayoutGroup id={pillId}>
        <Tabs.Root
          {...(controlled !== undefined ? { value: controlled } : { defaultValue })}
          onValueChange={(next) => {
            if (controlled === undefined) setUncontrolled(next);
            onValueChange?.(next);
          }}
          className={`flex min-w-0 flex-col ${className}`}
        >
          {children}
        </Tabs.Root>
      </LayoutGroup>
    </SlidingTabsContext.Provider>
  );
}

export interface SlidingTabsListProps {
  children: ReactNode;
  /** Accessible name of the tab list when no visible heading labels it. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

export function SlidingTabsList({ children, className = "", ...aria }: SlidingTabsListProps) {
  const { activation } = useContext(SlidingTabsContext);
  return (
    <Tabs.List
      {...aria}
      activateOnFocus={activation === "automatic"}
      data-activation={activation}
      className={`flex max-w-full gap-0.5 self-start overflow-x-auto rounded-control bg-sunken p-1 ${className}`}
    >
      {children}
    </Tabs.List>
  );
}

export function SlidingTabsTab({ value, children, className = "" }: { value: TabsValue; children: ReactNode; className?: string }) {
  const { value: selected, pillId } = useContext(SlidingTabsContext);
  const reduced = useReducedMotion() ?? false;
  const active = selected === value;
  return (
    <Tabs.Tab
      value={value}
      className={`relative inline-flex h-10 shrink-0 items-center justify-center rounded-control px-1.5 text-[14px] font-medium whitespace-nowrap transition-colors duration-[var(--mk-dur-enter)] ease-kit-out select-none sm:px-2.5 pointer-coarse:h-11 motion-reduce:transition-none ${
        active ? "text-accent-fg" : "text-muted hover:bg-secondary hover:text-ink"
      } ${className}`}
    >
      {active ? (
        <motion.span
          aria-hidden="true"
          data-tabs-indicator
          layoutId={pillId}
          className="absolute inset-0 bg-accent"
          style={{ borderRadius: PILL_RADIUS }}
          transition={{ layout: { duration: reduced ? 0 : DURATION.enter / 1000, ease: bezier(EASING_POINTS.out) } }}
        />
      ) : null}
      <span className="relative">{children}</span>
    </Tabs.Tab>
  );
}

/** Wraps the panels so the leaving and entering panel overlap in one grid cell while they crossfade. */
export function SlidingTabsPanels({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid ${className}`}>{children}</div>;
}

// Reduced motion: no starting style, so the entering panel is fully shown on its first frame while
// the leaving one is already hidden. With both fades zeroed but still applied, the two panels would
// sit at opacity 0 together for a frame and the area would flash blank.
const PANEL_MOTION =
  "transition-opacity duration-[var(--mk-dur-enter)] ease-kit-out data-[starting-style]:opacity-0 data-[ending-style]:duration-[var(--mk-dur-exit)] data-[ending-style]:ease-kit-in";

export function SlidingTabsPanel({ value, children, className = "" }: { value: TabsValue; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <Tabs.Panel
      value={value}
      data-tabs-panel
      className={`[grid-area:1/1] min-w-0 rounded-control opacity-100 data-[ending-style]:opacity-0 ${reduced ? "transition-none" : PANEL_MOTION} ${className}`}
    >
      {children}
    </Tabs.Panel>
  );
}

/* Playground ------------------------------------------------------------------------------- */

const SECTIONS = [
  {
    value: "summary",
    label: "Summary",
    title: "Q3 at a glance",
    rows: [
      ["Revenue", "$48.2k", "+12% vs Q2"],
      ["Active customers", "1,284", "+86"],
      ["Churn", "1.9%", "−0.4 pts"],
    ],
  },
  {
    value: "revenue",
    label: "Revenue",
    title: "Revenue by plan",
    rows: [
      ["Max", "$21.6k", "45%"],
      ["Pro", "$17.9k", "37%"],
      ["Starter", "$8.7k", "18%"],
    ],
  },
  {
    value: "team",
    label: "Team",
    title: "Top accounts",
    rows: [
      ["Northwind Labs", "Max", "78% of seats"],
      ["Juniper & Co", "Pro", "52% of seats"],
      ["Atlas Studio", "Pro", "34% of seats"],
    ],
  },
  {
    value: "notes",
    label: "Notes",
    title: "Notes",
    rows: [
      ["Pricing test", "Ends Nov 14", "Owner: Ana"],
      ["Onboarding email", "Draft", "Owner: Leo"],
      ["Q4 targets", "Review", "Owner: Mia"],
    ],
  },
] as const;

/**
 * Live example: a report card with four tabs. A checkbox switches the tab
 * list between automatic activation (arrows select) and manual activation (arrows move focus,
 * Enter or Space selects).
 */
export function Playground() {
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState<TabsValue>("summary");
  const headingId = useId();
  const modeId = useId();
  return (
    <div className="flex w-full max-w-[520px] min-w-0 flex-col gap-4">
      <section aria-labelledby={headingId} className="min-w-0 rounded-panel border border-line bg-surface p-3 text-ink sm:p-5">
        <h3 id={headingId} className="m-0 mb-3 text-[16px] font-semibold tracking-[-0.01em]">
          Q3 report
        </h3>
        <SlidingTabs value={value} onValueChange={setValue} activation={manual ? "manual" : "automatic"}>
          {/* Narrow screens: the list spans the card and the four tabs share it evenly. */}
          <SlidingTabsList aria-labelledby={headingId} className="w-full sm:w-auto">
            {SECTIONS.map((s) => (
              <SlidingTabsTab key={s.value} value={s.value} className="grow sm:grow-0">
                {s.label}
              </SlidingTabsTab>
            ))}
          </SlidingTabsList>
          <SlidingTabsPanels className="mt-4">
            {SECTIONS.map((s) => (
              <SlidingTabsPanel key={s.value} value={s.value}>
                <h4 className="m-0 text-[15px] font-semibold">{s.title}</h4>
                <dl className="m-0 mt-2 flex flex-col">
                  {s.rows.map(([name, figure, note]) => (
                    <div key={name} className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                      <dt className="min-w-0 text-[15px]">{name}</dt>
                      <dd className="m-0 flex shrink-0 items-baseline gap-2 text-right">
                        <span className="text-[15px] font-semibold tabular-nums">{figure}</span>
                        <span className="text-[13px] text-muted">{note}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </SlidingTabsPanel>
            ))}
          </SlidingTabsPanels>
        </SlidingTabs>
      </section>
      <label htmlFor={modeId} className="flex items-center gap-2 self-start text-[14px] text-muted">
        <input
          id={modeId}
          type="checkbox"
          data-testid="tabs-manual"
          checked={manual}
          onChange={(e) => setManual(e.currentTarget.checked)}
          className="size-4 accent-[var(--mk-accent)]"
        />
        Manual activation (arrows move focus, Enter or Space selects)
      </label>
    </div>
  );
}
