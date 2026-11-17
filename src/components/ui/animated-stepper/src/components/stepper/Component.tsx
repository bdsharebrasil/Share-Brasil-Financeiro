import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/ui/Button";
import { EASING_POINTS } from "@/engine/tokens";

/**
 * Stepper: an ordered list of steps for a multi-step task, with Back and Next.
 *
 * Custom (no primitive library): an <ol> with aria-current="step" on the current item and a
 * visible "Completed" / "Current" / "Not started" state in text (not color alone). Next validates
 * the current stage first and keeps people on it with a described error; after a stage change
 * focus moves to the new stage heading and a polite status announces "Step n of N: name".
 * Orientation: "horizontal", "vertical", or "auto" (vertical in narrow containers, horizontal from
 * 30rem). The current step's title is semibold; completed titles stay ink, upcoming ones muted.
 * Motion: a completed connector fills and its check draws in 240 ms ease-out, undoing runs
 * 150 ms ease-in; the leaving stage fades out (150 ms) and the new one enters 12 px from the
 * navigation direction (240 ms). Reduced motion: every change is immediate.
 */

export const ENTER_MS = 240;
export const EXIT_MS = 150;

export interface StepDef {
  id: string;
  title: string;
  /** Returns an error message to block advancing, or null. */
  validate?(): string | null;
  render(props: { error: string | null; errorId: string; inputRef: React.RefObject<HTMLInputElement | null> }): ReactNode;
}

type Orientation = "horizontal" | "vertical" | "auto";

const LIST: Record<Orientation, string> = {
  horizontal: "flex-row items-center",
  vertical: "flex-col",
  auto: "flex-col @[30rem]:flex-row @[30rem]:items-center",
};
const CONNECTOR: Record<Orientation, string> = {
  horizontal: "mx-2 h-0.5 min-w-4 flex-1",
  vertical: "my-1 ml-[13px] h-5 w-0.5",
  auto: "my-1 ml-[13px] h-5 w-0.5 @[30rem]:mx-2 @[30rem]:my-0 @[30rem]:h-0.5 @[30rem]:w-auto @[30rem]:min-w-4 @[30rem]:flex-1",
};
const FILL: Record<Orientation, [string, string]> = {
  horizontal: ["origin-left scale-x-0", "scale-x-100"],
  vertical: ["origin-top scale-y-0", "scale-y-100"],
  auto: ["origin-top scale-y-0 @[30rem]:origin-left @[30rem]:scale-x-0 @[30rem]:scale-y-100", "scale-100"],
};

function Check({ done }: { done: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
      <path
        d="M3.5 8.5l3 3 6-6.5"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        className={`${done ? "[stroke-dashoffset:0] duration-240 ease-kit-out" : "[stroke-dashoffset:1] duration-150 ease-kit-in"} transition-[stroke-dashoffset] motion-reduce:transition-none`}
      />
    </svg>
  );
}

export function Stepper({
  steps,
  orientation = "auto",
  onFinish,
  label = "Progress",
}: {
  steps: readonly StepDef[];
  orientation?: Orientation;
  onFinish?(): void;
  label?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const moved = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion() ?? false;
  const errorId = useId();
  const step = steps[current]!;
  const last = current === steps.length - 1;

  function go(next: number) {
    moved.current = true;
    setDir(next > current ? 1 : -1);
    setError(null);
    setCurrent(next);
    setAnnounce(`Step ${next + 1} of ${steps.length}: ${steps[next]!.title}`);
  }

  function onNext(e: FormEvent) {
    e.preventDefault();
    const problem = step.validate?.() ?? null;
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    if (last) onFinish?.();
    else go(current + 1);
  }

  const ease = { enter: [...EASING_POINTS.out] as [number, number, number, number], exit: [...EASING_POINTS.in] as [number, number, number, number] };

  return (
    <div className="@container flex w-full flex-col gap-5">
      <ol aria-label={label} className={`m-0 flex list-none p-0 ${LIST[orientation]}`}>
        {steps.map((s, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <li key={s.id} aria-current={isCurrent ? "step" : undefined} className={`flex ${orientation === "horizontal" ? "flex-1 items-center last:flex-none" : orientation === "vertical" ? "flex-col" : "flex-col @[30rem]:flex-1 @[30rem]:flex-row @[30rem]:items-center @[30rem]:last:flex-none"}`}>
              <span className="flex items-center gap-2.5">
                <span
                  data-testid={`step-node-${i}`}
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${
                    done ? "border-accent bg-accent text-accent-fg duration-240 ease-kit-out" : isCurrent ? "border-accent bg-surface text-ink duration-240 ease-kit-out" : "border-control-line bg-surface text-muted duration-150 ease-kit-in"
                  }`}
                >
                  <span className={`col-start-1 row-start-1 transition-opacity motion-reduce:transition-none ${done ? "opacity-0 duration-150 ease-kit-in" : "opacity-100 duration-240 ease-kit-out"}`}>{i + 1}</span>
                  <span className="col-start-1 row-start-1">
                    <Check done={done} />
                  </span>
                </span>
                <span className="flex flex-col">
                  {/* The current title turns semibold; an invisible semibold copy reserves its width so the row never shifts. */}
                  <span className="grid text-[14px] leading-5 whitespace-nowrap">
                    <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
                      {s.title}
                    </span>
                    <span
                      data-testid={`step-title-${i}`}
                      className={`col-start-1 row-start-1 transition-colors motion-reduce:transition-none ${
                        isCurrent ? "font-semibold text-ink duration-240 ease-kit-out" : done ? "font-medium text-ink duration-150 ease-kit-in" : "font-medium text-muted duration-150 ease-kit-in"
                      }`}
                    >
                      {s.title}
                    </span>
                  </span>
                  <span className="text-[12px] leading-4 whitespace-nowrap text-muted">{done ? "Completed" : isCurrent ? "Current" : "Not started"}</span>
                </span>
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden="true" className={`relative block overflow-hidden rounded-full bg-line ${CONNECTOR[orientation]}`}>
                  <span
                    data-testid={`connector-fill-${i}`}
                    className={`absolute inset-0 rounded-full bg-accent transition-transform motion-reduce:transition-none ${done ? `${FILL[orientation][1]} duration-240 ease-kit-out` : `${FILL[orientation][0]} duration-150 ease-kit-in`}`}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <form onSubmit={onNext} noValidate className="flex flex-col gap-5">
        <div className="relative min-h-[132px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={step.id}
              aria-labelledby={`${errorId}-h-${step.id}`}
              initial={reduced ? false : { opacity: 0, x: 12 * dir }}
              animate={{ opacity: 1, x: 0, transition: { duration: reduced ? 0 : ENTER_MS / 1000, ease: ease.enter } }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : EXIT_MS / 1000, ease: ease.exit } }}
            >
              <StageHeading id={`${errorId}-h-${step.id}`} focusOnMount={moved} headingRef={heading}>
                {step.title}
              </StageHeading>
              {step.render({ error, errorId, inputRef })}
            </motion.section>
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" disabled={current === 0} onClick={() => go(current - 1)}>
            Back
          </Button>
          <Button type="submit">{last ? "Create workspace" : "Next"}</Button>
        </div>
      </form>
      <p role="status" className="sr-only-kit">
        {announce}
      </p>
    </div>
  );
}

function StageHeading({
  id,
  children,
  focusOnMount,
  headingRef,
}: {
  id: string;
  children: ReactNode;
  focusOnMount: React.RefObject<boolean>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  useEffect(() => {
    if (focusOnMount.current) headingRef.current?.focus();
  }, [focusOnMount, headingRef]);
  return (
    <h3 id={id} ref={headingRef} tabIndex={-1} className="m-0 mb-3 w-fit rounded-[4px] text-[16px] font-semibold text-ink">
      {children}
    </h3>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  errorId,
  inputRef,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  error: string | null;
  errorId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        className="mt-1.5 h-10 w-full rounded-control border border-control-line bg-surface px-3 text-[15px] text-ink pointer-coarse:h-11 aria-invalid:border-2 aria-invalid:border-ink"
      />
      {error ? (
        <p id={errorId} className="mt-1.5 mb-0 flex items-center gap-1.5 text-sm font-medium text-ink">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 4.75v3.75M8 11.1v.15" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Playground() {
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [finished, setFinished] = useState(false);
  const steps: StepDef[] = [
    {
      id: "account",
      title: "Account",
      validate: () => (name.trim() ? null : "Enter your full name to continue."),
      render: (p) => <TextField label="Full name" value={name} onChange={setName} {...p} />,
    },
    {
      id: "workspace",
      title: "Workspace",
      validate: () => (workspace.trim() ? null : "Enter a workspace name to continue."),
      render: (p) => <TextField label="Workspace name" value={workspace} onChange={setWorkspace} {...p} />,
    },
    {
      id: "review",
      title: "Review",
      render: () => (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
          <dt className="text-muted">Name</dt>
          <dd className="m-0 min-w-0 truncate text-ink">{name}</dd>
          <dt className="text-muted">Workspace</dt>
          <dd className="m-0 min-w-0 truncate text-ink">{workspace}</dd>
        </dl>
      ),
    },
  ];
  return (
    <div data-testid="stepper-playground" className="flex w-full max-w-[520px] flex-col gap-3">
      <Stepper steps={steps} label="Workspace setup progress" onFinish={() => setFinished(true)} />
      <p data-testid="stepper-result" className="m-0 min-h-5 text-[14px] text-muted">
        {finished ? "Workspace created." : ""}
      </p>
    </div>
  );
}
