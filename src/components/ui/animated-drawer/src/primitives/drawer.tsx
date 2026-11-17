/**
 * Drawer primitive adapter.
 *
 * The kit's components import drawer behavior (swipe to dismiss with distance and velocity
 * thresholds, optional snap points, focus trap, Esc and outside-press dismiss, focus return, scroll
 * lock, aria wiring, portal) only from this file. Today it is Base UI Drawer (@base-ui/react, MIT).
 * To move to another headless library, reimplement these exports with the same props and nothing
 * else changes.
 *
 * Base UI drives the swipe through CSS: the popup gets `--drawer-swipe-movement-y` while dragging,
 * `data-swiping`, and `data-starting-style` / `data-ending-style` around open and close; the backdrop
 * reads `--drawer-swipe-progress`. Style transitions on those, and Base UI waits for them before
 * unmounting. See https://base-ui.com/react/components/drawer.
 */
import { Drawer } from "@base-ui/react/drawer";

export const DrawerRoot = Drawer.Root;
export const DrawerTrigger = Drawer.Trigger;
export const DrawerPortal = Drawer.Portal;
export const DrawerBackdrop = Drawer.Backdrop;
export const DrawerViewport = Drawer.Viewport;
export const DrawerPopup = Drawer.Popup;
export const DrawerContent = Drawer.Content;
export const DrawerTitle = Drawer.Title;
export const DrawerDescription = Drawer.Description;
export const DrawerClose = Drawer.Close;

export type DrawerRootProps = Drawer.Root.Props;
export type DrawerPopupProps = Drawer.Popup.Props;
