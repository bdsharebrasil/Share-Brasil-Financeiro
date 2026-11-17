/**
 * Context menu timings: enter 180 ms ease-out (fade + scale
 * 0.98 to 1 around the pointer), exit 120 ms ease-in. Neither matches a shared token (enter 220,
 * exit 160, fast 120 is a hover token), so they live here as named constants.
 */
export const MENU_MS = { enter: 180, exit: 120 } as const;
