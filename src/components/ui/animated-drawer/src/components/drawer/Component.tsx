import { createContext, useContext, useId, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import {
  DrawerBackdrop as BackdropPart,
  DrawerClose as ClosePart,
  DrawerContent as ContentPart,
  DrawerDescription as DescriptionPart,
  DrawerPopup as PopupPart,
  DrawerPortal as PortalPart,
  DrawerRoot as RootPart,
  DrawerTitle as TitlePart,
  DrawerTrigger as TriggerPart,
  DrawerViewport as ViewportPart,
} from "@/primitives/drawer";
import { Button } from "@/ui/Button";
import { DRAWER_MS, SETTLE_MS, springLinearCss } from "./timing";

/**
 * Drawer: a modal panel that rises from the bottom edge with a grab handle and can be dragged down
 * to dismiss.
 *
 * Behavior comes from the drawer primitive (src/primitives/drawer.tsx, Base UI): role="dialog" with
 * aria-modal, aria-labelledby (DrawerTitle) and aria-describedby (DrawerDescription), focus trap,
 * Esc and a press on the backdrop close it, focus returns to the trigger, the page behind is inert
 * and does not scroll. Dragging the handle or header down follows the pointer directly; a release
 * past half the panel height, or a fast downward flick, dismisses it. A visible Close button is
 * always there, so dragging is never the only way out. Drags that start in DrawerBody scroll it.
 * Motion: enter 260 ms rise ease-out; exit 180 ms ease-in; a drag released short
 * of the threshold settles back on the critically damped spring (stiffness 320, damping 36, mass 1)
 * sampled as CSS linear() over 400 ms. Reduced motion: open, close and settle are instant; the drag
 * still tracks the pointer.
 *
 * The transitions are CSS on purpose: Base UI writes the drag offset to `--drawer-swipe-movement-y`
 * and waits for the running transition before it unmounts the panel.
 */

/** Phase timings as custom properties, read by the data-attribute classes below. */
const TIMING = {
  "--drawer-enter": `${DRAWER_MS.enter}ms`,
  "--drawer-exit": `${DRAWER_MS.exit}ms`,
  "--drawer-settle": `${SETTLE_MS}ms`,
  "--drawer-spring": springLinearCss(),
} as CSSProperties;

/** True from the open request until the rise finishes: the resting transition is the entrance. */
const EnteringContext = createContext(false);

export interface DrawerProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?(open: boolean): void;
}

export function Drawer({ children, open: controlled, defaultOpen = false, onOpenChange }: DrawerProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const [entering, setEntering] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  return (
    <EnteringContext.Provider value={entering}>
      <RootPart
        open={open}
        onOpenChange={(next) => {
          if (next) setEntering(true);
          if (controlled === undefined) setUncontrolled(next);
          onOpenChange?.(next);
        }}
        onOpenChangeComplete={(isOpen) => {
          if (isOpen) setEntering(false);
        }}
      >
        {children}
      </RootPart>
    </EnteringContext.Provider>
  );
}

/** Renders the single element it wraps (usually a Button) as the opener. */
export function DrawerTrigger({ children }: { children: ReactElement }) {
  return <TriggerPart render={children} />;
}

/** Renders the single element it wraps as a closer. */
export function DrawerClose({ children }: { children: ReactElement }) {
  return <ClosePart render={children} />;
}

export interface DrawerContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * The backdrop and the panel. While entering, the resting transition is the 260 ms ease-out rise;
 * after that it is the spring, so a drag released short of the threshold settles on the spring.
 * Every exit (Esc, Close, backdrop press or a swipe past the threshold) is 180 ms ease-in.
 */
export function DrawerContent({ children, className = "" }: DrawerContentProps) {
  const entering = useContext(EnteringContext);
  return (
    <PortalPart>
      <BackdropPart
        data-drawer-overlay
        style={TIMING}
        className="fixed inset-0 z-50 bg-[var(--mk-scrim)] opacity-[calc(1_-_var(--drawer-swipe-progress))] transition-opacity duration-[var(--drawer-enter)] ease-kit-out data-ending-style:opacity-0 data-ending-style:duration-[var(--drawer-exit)] data-ending-style:ease-kit-in data-starting-style:opacity-0 data-swiping:duration-0 motion-reduce:transition-none"
      />
      <ViewportPart className="fixed inset-0 z-50 flex items-end justify-center">
        <PopupPart
          data-drawer-panel
          aria-modal="true"
          data-entering={entering ? "" : undefined}
          style={TIMING}
          className={`relative flex max-h-[min(640px,calc(100dvh_-_24px))] w-full max-w-[560px] flex-col rounded-t-overlay bg-surface pb-[env(safe-area-inset-bottom)] text-ink shadow-[var(--mk-shadow-overlay)] outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[var(--drawer-settle)] ease-[var(--drawer-spring)] data-entering:duration-[var(--drawer-enter)] data-entering:ease-kit-out data-starting-style:[transform:translateY(calc(100%_+_12px))] data-ending-style:[transform:translateY(calc(100%_+_12px))] data-ending-style:duration-[var(--drawer-exit)] data-ending-style:ease-kit-in data-swiping:select-none motion-reduce:transition-none ${className}`}
        >
          {children}
        </PopupPart>
      </ViewportPart>
    </PortalPart>
  );
}

/** The grab handle: the visual cue for dragging. The header around it drags the panel as well. */
export function DrawerHandle() {
  return (
    <div aria-hidden="true" data-testid="drawer-handle" className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
      <span className="h-1.5 w-10 rounded-full bg-[var(--mk-wire-strong)]" />
    </div>
  );
}

export function DrawerTitle({ children }: { children: ReactNode }) {
  return <TitlePart className="m-0 text-lg leading-snug font-semibold tracking-[-0.01em]">{children}</TitlePart>;
}

export function DrawerDescription({ children }: { children: ReactNode }) {
  return <DescriptionPart className="mt-1 mb-0 text-[15px] leading-relaxed text-muted">{children}</DescriptionPart>;
}

/** Scrollable body: drags that start here scroll the content instead of moving the panel. */
export function DrawerBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ContentPart className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>{children}</ContentPart>;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const TARGETS = [
  { id: "link", label: "Copy link", done: "Copied the link", icon: <path d="M8.5 11.5l3-3M7 9.5l-1.5 1.5a2.5 2.5 0 003.5 3.5L10.5 13M13 10.5l1.5-1.5A2.5 2.5 0 0011 5.5L9.5 7" /> },
  { id: "email", label: "Email", done: "Opened an email draft", icon: <path d="M3.5 5.5h13v9h-13zM3.5 6l6.5 5 6.5-5" /> },
  { id: "message", label: "Message", done: "Sent as a message", icon: <path d="M4 5h12v8H8l-4 3z" /> },
  { id: "pdf", label: "Save PDF", done: "Saved a PDF", icon: <path d="M6 3.5h5.5l3 3v10H6zM11 3.5v3.5h3.5M8.5 11h4M8.5 13.5h3" /> },
] as const;

const ACCESS = ["Only people invited", "Anyone with the link"] as const;

/**
 * Live example: the "Share" drawer. Four share targets, a
 * link-access choice and a Close button; a target closes the drawer and reports the action. Drag
 * the handle down to dismiss it, or let go early to watch it settle back.
 */
export function Playground() {
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<(typeof ACCESS)[number]>(ACCESS[0]);
  const [result, setResult] = useState<string | null>(null);
  const accessName = useId();
  const accessLabel = useId();

  return (
    <div className="flex flex-col items-center gap-4">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger>
          <Button data-testid="drawer-trigger">
            <Icon>
              <path d="M10 3v9M6.5 6.5L10 3l3.5 3.5M4.5 11v4.5h11V11" />
            </Icon>
            Share
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHandle />
          <div data-testid="drawer-header" className="flex items-start gap-3 px-6 pb-4">
            <div className="min-w-0 flex-1">
              <DrawerTitle>Share “Q3 report”</DrawerTitle>
              <DrawerDescription>Pick where to send it. Drag down or press Esc to close.</DrawerDescription>
            </div>
            <DrawerClose>
              <Button variant="ghost" size="icon" aria-label="Close" data-testid="drawer-close" className="-mt-1 -mr-2 shrink-0 text-muted">
                <Icon>
                  <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
                </Icon>
              </Button>
            </DrawerClose>
          </div>
          <DrawerBody className="px-6 pb-6">
            <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
              {TARGETS.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    data-testid={`drawer-target-${t.id}`}
                    onClick={() => {
                      setResult(`Last action: ${t.done}`);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-center gap-2 rounded-control px-1 py-2 text-[13px] leading-tight text-ink transition-colors duration-120 ease-kit-out hover:bg-sunken motion-reduce:transition-none"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-sunken">
                      <Icon>{t.icon}</Icon>
                    </span>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
            <div role="radiogroup" aria-labelledby={accessLabel} className="mt-5 border-t border-line pt-4">
              <p id={accessLabel} className="m-0 mb-1 text-sm font-medium text-ink">
                Link access
              </p>
              {ACCESS.map((a) => (
                <label key={a} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
                  <input
                    type="radio"
                    name={accessName}
                    value={a}
                    checked={access === a}
                    onChange={() => setAccess(a)}
                    className="size-4 shrink-0 accent-[var(--mk-accent)]"
                  />
                  {a}
                </label>
              ))}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <p role="status" className="m-0 min-h-6 text-sm text-muted">
        {result ?? ""}
      </p>
    </div>
  );
}
