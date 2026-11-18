import { Children, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { DURATION, EASING_POINTS } from "@/engine/tokens";
import { Button } from "@/ui/Button";

/**
 * Carousel: a horizontally browsable set of slides with named previous/next buttons, a dot per
 * slide and a visible "2 of 4" count. Built from scratch on Motion (no carousel library):
 *
 * - The strip is a Motion drag="x" element: it follows the pointer (mouse, pen or touch) while
 *   vertical page scroll stays native (Motion sets touch-action: pan-y). On release a short
 *   velocity projection picks the next slide, bounded to one slide per fling; the strip then
 *   carries on to it in 320 ms ease-out with no bounce. Buttons and dots settle in 220 ms ease-out.
 * - The outer element is a named region with aria-roledescription="carousel"; each slide is a
 *   group with aria-roledescription="slide" and an "N of M" name. Slides out of view are `inert`
 *   and aria-hidden, so neither Tab nor a screen reader reaches their content.
 * - Focus never moves on its own when the slide changes; the count is a polite live region while
 *   the carousel is not rotating.
 * - Autoplay is off unless `autoplayMs` is set. Then a rotation button comes first, hovering pauses,
 *   and keyboard focus entering the carousel stops rotation until the user presses Start again.
 * - Reduced motion: slides change in 0 ms, the release has no momentum and autoplay starts off.
 */

const EASE_OUT: [number, number, number, number] = [...EASING_POINTS.out];

export interface CarouselSlideProps {
  /** Short name of the slide, read after its position ("2 of 4, Fieldnote"). */
  label: string;
  children: ReactNode;
}

/** One slide. Only meaningful as a direct child of `Carousel`. */
export function CarouselSlide({ children }: CarouselSlideProps) {
  return <>{children}</>;
}

export interface CarouselProps {
  /** Accessible name of the whole carousel, e.g. "Customer stories". */
  label: string;
  /** `CarouselSlide` elements. */
  children: ReactNode;
  /** Rotate every N ms. Leave unset for no autoplay (the default). */
  autoplayMs?: number;
  /** Controlled slide index. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?(index: number): void;
  className?: string;
}

function slideLabel(child: ReactNode): string {
  if (child && typeof child === "object" && "props" in child) {
    const props = (child as { props: Partial<CarouselSlideProps> }).props;
    if (typeof props.label === "string") return props.label;
  }
  return "";
}

export function Carousel({ label, children, autoplayMs, index: controlled, defaultIndex = 0, onIndexChange, className = "" }: CarouselProps) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const reduced = useReducedMotion() ?? false;
  const [uncontrolled, setUncontrolled] = useState(defaultIndex);
  const index = Math.min(Math.max(controlled ?? uncontrolled, 0), Math.max(count - 1, 0));
  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), count - 1);
    if (controlled === undefined) setUncontrolled(clamped);
    onIndexChange?.(clamped);
  };

  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const dragging = useRef(false);
  /** Duration of the next settle: 220 ms for buttons and dots, 320 ms for the carry after a fling. */
  const settleMs = useRef<number>(DURATION.enter);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Settle on the current slide whenever it or the width changes. A resize jumps; a slide change glides.
  const lastWidth = useRef(0);
  useEffect(() => {
    if (!width || dragging.current) return;
    const to = -index * width;
    const instant = reduced || lastWidth.current !== width;
    lastWidth.current = width;
    if (instant) {
      x.set(to);
      return;
    }
    const controls = animate(x, to, { duration: settleMs.current / 1000, ease: EASE_OUT });
    settleMs.current = DURATION.enter;
    return () => controls.stop();
  }, [index, width, reduced, x]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragging.current = false;
    if (!width) return;
    // Bounded momentum: project 0.2 s of release velocity, then allow at most one slide per fling.
    const projected = x.get() + (reduced ? 0 : info.velocity.x * 0.2);
    const target = Math.min(Math.max(Math.round(-projected / width), index - 1), index + 1);
    const next = Math.min(Math.max(target, 0), count - 1);
    if (next === index) {
      if (reduced) x.set(-index * width);
      else animate(x, -index * width, { duration: DURATION.enter / 1000, ease: EASE_OUT });
    } else {
      settleMs.current = DURATION.slow;
      go(next);
    }
  };

  // Autoplay: user intent (`playing`) plus a temporary hover pause.
  const [playing, setPlaying] = useState(Boolean(autoplayMs) && !reduced);
  const [hovered, setHovered] = useState(false);
  const rotating = Boolean(autoplayMs) && playing && !hovered;
  useEffect(() => {
    if (!rotating || !autoplayMs) return;
    const id = window.setTimeout(() => go(index + 1 >= count ? 0 : index + 1), autoplayMs);
    return () => window.clearTimeout(id);
    // `go` is stable enough for a timeout restarted on every slide change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotating, autoplayMs, index, count]);
  const rotationRef = useRef<HTMLButtonElement>(null);

  const baseId = useId();
  const stripId = `${baseId}-strip`;
  const atStart = index === 0;
  const atEnd = index === count - 1;
  const current = slideLabel(slides[index]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={`min-w-0 ${className}`}
      data-carousel
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(e) => {
        // Focus entering the carousel stops rotation for good; only the rotation button itself may restart it.
        if (autoplayMs && e.target !== rotationRef.current) setPlaying(false);
      }}
    >
      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-control"
        data-carousel-viewport
      >
        <motion.div
          id={stripId}
          className="flex cursor-grab active:cursor-grabbing"
          style={{ x }}
          drag={count > 1 ? "x" : false}
          dragConstraints={{ left: -(count - 1) * width, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragStart={() => (dragging.current = true)}
          onDragEnd={onDragEnd}
          data-carousel-strip
        >
          {slides.map((slide, i) => {
            const hidden = i !== index;
            return (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}${slideLabel(slide) ? `, ${slideLabel(slide)}` : ""}`}
                aria-hidden={hidden || undefined}
                inert={hidden}
                className="w-full shrink-0 select-none"
                data-carousel-slide={i}
              >
                {slide}
              </div>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-1">
        {autoplayMs ? (
          <Button
            ref={rotationRef}
            variant="ghost"
            size="icon"
            aria-label={playing ? "Stop slide rotation" : "Start slide rotation"}
            onClick={() => setPlaying((p) => !p)}
            data-carousel-rotation
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous slide"
          aria-controls={stripId}
          aria-disabled={atStart || undefined}
          className="aria-disabled:cursor-default aria-disabled:opacity-50"
          onClick={() => !atStart && go(index - 1)}
        >
          <ChevronIcon dir="left" />
        </Button>
        <div className="flex min-w-0 items-center">
          {slides.map((slide, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}${slideLabel(slide) ? `, ${slideLabel(slide)}` : ""}`}
              aria-controls={stripId}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
              className="group grid h-10 w-8 shrink-0 place-items-center rounded-control pointer-coarse:h-11"
              data-carousel-dot={i}
            >
              <span
                aria-hidden="true"
                className={`block h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none ${
                  i === index
                    ? "w-5 bg-accent duration-[var(--mk-dur-enter)] ease-kit-out"
                    : "w-2 bg-control-line duration-[var(--mk-dur-exit)] ease-kit-in group-hover:bg-muted"
                }`}
              />
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next slide"
          aria-controls={stripId}
          aria-disabled={atEnd || undefined}
          className="aria-disabled:cursor-default aria-disabled:opacity-50"
          onClick={() => !atEnd && go(index + 1)}
        >
          <ChevronIcon dir="right" />
        </Button>
      </div>
      <p aria-live={rotating ? "off" : "polite"} aria-atomic="true" className="mt-2 mb-0 text-center text-[13px] text-muted" data-carousel-count>
        {index + 1} of {count}
        <span className="sr-only">{current ? `, ${current}` : ""}</span>
      </p>
    </section>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "right" ? "M8 5l5 5-5 5" : "M12 5l-5 5 5 5"} />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
      <rect x="5.5" y="4.5" width="3" height="11" rx="1" />
      <rect x="11.5" y="4.5" width="3" height="11" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
      <path d="M6.5 4.8v10.4a.8.8 0 0 0 1.2.7l8-5.2a.8.8 0 0 0 0-1.4l-8-5.2a.8.8 0 0 0-1.2.7z" />
    </svg>
  );
}

const STORIES = [
  { company: "Northwind", quote: "We cut onboarding from two weeks to three days.", name: "Dana Ortiz", role: "Head of operations" },
  { company: "Fieldnote", quote: "Every handoff now has an owner and a date.", name: "Sam Patel", role: "Product lead" },
  { company: "Harbor & Co", quote: "Our weekly report finally writes itself.", name: "Lee Moreno", role: "Finance manager" },
  { company: "Loomly", quote: "Support tickets fell by a third in one quarter.", name: "Ari Chen", role: "Support manager" },
] as const;

/** Live example for /kit/carousel: customer stories, autoplay off unless the checkbox turns it on. */
export function Playground() {
  const [autoplay, setAutoplay] = useState(false);
  const headingId = useId();
  return (
    <div className="flex w-full max-w-[520px] min-w-0 flex-col gap-4">
      <div role="presentation" className="min-w-0 rounded-panel border border-line bg-surface p-3 text-ink sm:p-5" data-carousel-card>
        <h3 id={headingId} className="m-0 mb-3 text-base font-semibold">
          Customer stories
        </h3>
        <Carousel key={autoplay ? "auto" : "manual"} label="Customer stories" autoplayMs={autoplay ? 5000 : undefined}>
          {STORIES.map((s) => (
            <CarouselSlide key={s.company} label={s.company}>
              <figure className="m-0 flex min-h-[168px] flex-col justify-between rounded-control bg-sunken p-4 sm:p-5">
                <blockquote className="m-0 text-[17px] leading-snug font-medium tracking-[-0.01em]">“{s.quote}”</blockquote>
                <figcaption className="mt-4 text-[14px] text-muted">
                  <span className="font-medium text-ink">{s.name}</span>
                  <br />
                  {s.role}, {s.company}
                </figcaption>
              </figure>
            </CarouselSlide>
          ))}
        </Carousel>
      </div>
      <label className="flex items-center gap-2 self-start text-[14px] text-muted">
        <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} data-testid="carousel-autoplay" className="size-4 accent-[var(--mk-accent)]" />
        Autoplay every 5 seconds (pauses on hover and focus)
      </label>
    </div>
  );
}
