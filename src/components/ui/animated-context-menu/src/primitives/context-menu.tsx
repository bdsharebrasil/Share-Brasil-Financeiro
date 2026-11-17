/**
 * Context menu primitive adapter.
 *
 * The kit's components import context-menu behavior (open at the pointer on right-click or long
 * press, viewport collision handling, role="menu" / "menuitem", arrow-key navigation, typeahead,
 * Enter and Space activation, Esc and outside-press dismiss, focus return) only from this file.
 * Today it is Base UI Context Menu (@base-ui/react, MIT). To move to another headless library,
 * reimplement this namespace with the same parts and nothing else changes.
 *
 * Base UI marks the popup with `data-starting-style` / `data-ending-style` and exposes
 * `--transform-origin` on it, so components animate with CSS transitions and Base UI waits for them
 * before unmounting. See https://base-ui.com/react/components/context-menu.
 */
export { ContextMenu } from "@base-ui/react/context-menu";
