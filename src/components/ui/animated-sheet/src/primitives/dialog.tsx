/**
 * Dialog primitive adapter.
 *
 * The kit's components import dialog behavior (focus trap, Esc and outside-press dismiss, focus
 * return, scroll lock, aria wiring, portal) only from this file. Today it is Base UI Dialog
 * (@base-ui/react, MIT). To move to another headless library, reimplement these exports with the
 * same props and nothing else changes.
 *
 * Base UI composes with Motion through the `render` prop: pass `render={<motion.div ... />}` to
 * DialogBackdrop and DialogPopup. Base UI waits for Motion's opacity animation before unmounting.
 * See https://base-ui.com/react/handbook/animation.
 */
import { Dialog } from "@base-ui/react/dialog";

export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogPortal = Dialog.Portal;
export const DialogBackdrop = Dialog.Backdrop;
export const DialogPopup = Dialog.Popup;
export const DialogTitle = Dialog.Title;
export const DialogDescription = Dialog.Description;
export const DialogClose = Dialog.Close;

export type DialogRootProps = Dialog.Root.Props;
export type DialogPopupProps = Dialog.Popup.Props;
