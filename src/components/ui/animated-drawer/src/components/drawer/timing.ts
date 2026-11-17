/**
 * Drawer timings: enter 260 ms ease-out, exit 180 ms ease-in, and a
 * canceled drag settles with a critically damped spring (stiffness 320, damping 36, mass 1), not a
 * fixed tween. 260 ms has no shared token (enter is 220), so these live here as named constants.
 */
export const DRAWER_MS = { enter: 260, exit: 180 } as const;
export const DRAWER_SPRING = { stiffness: 320, damping: 36, mass: 1 } as const;

/** Time for the spring to come within 1% of rest from a standing start: about 400 ms. */
export const SETTLE_MS = 400;

/**
 * Progress (0..1) of the drawer spring released from rest at 1 and settling at 0, as an ease over
 * SETTLE_MS. Damping ratio 36 / (2 * sqrt(320)) is about 1.006, so the closed form of a critically
 * damped spring, 1 - (1 + wt) e^(-wt) with w = sqrt(k / m), is accurate to well under a pixel.
 * Normalized so p = 1 lands exactly on 1.
 */
export function springEase(p: number): number {
  const w = Math.sqrt(DRAWER_SPRING.stiffness / DRAWER_SPRING.mass);
  const at = (q: number) => {
    const wt = (w * q * SETTLE_MS) / 1000;
    return 1 - (1 + wt) * Math.exp(-wt);
  };
  return at(p) / at(1);
}

/** The same curve sampled for CSS `linear()`, used by the real component's settle transition. */
export function springLinearCss(steps = 16): string {
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const p = i / steps;
    return `${Math.round(springEase(p) * 1000) / 1000} ${Math.round(p * 1000) / 10}%`;
  });
  return `linear(${points.join(", ")})`;
}
