/**
 * Swipe-delete timings: an incomplete swipe settles (and an undone row
 * returns) in 200 ms ease-out; a confirmed delete collapses and fades in 180 ms ease-in.
 * Both sit between the shared tokens (enter 220, exit 160), so they live here as named constants.
 */
export const SWIPE_MS = { enter: 200, exit: 180 } as const;

/** Release past this share of the row width deletes the row. Configurable per list. */
export const DELETE_THRESHOLD = 0.5;

/** Width of the revealed Delete action, in px; releasing past half of it keeps the action open. */
export const ACTION_W = 88;

/** A fling this fast to the left (px/s) counts as reaching the next step. */
export const FLING_VELOCITY = 500;

/** How long the undo toast stays (it pauses while hovered or focused). */
export const UNDO_TIMEOUT = 8000;
