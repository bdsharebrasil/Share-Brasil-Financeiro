import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ContextMenu as Menu } from "../../primitives/context-menu";
import { Button } from "../../../../button";
import { MENU_MS } from "./timing";

/**
 * Context menu: object actions opened at the pointer (right-click, or a long press on touch) or, from
 * the keyboard, at the focused target with Shift+F10 or the Menu key.
 *
 * Behavior comes from the context-menu primitive (src/primitives/context-menu.tsx, Base UI):
 * role="menu" with role="menuitem" rows, arrow-key navigation, typeahead, Enter and Space activate,
 * Esc and an outside press close it and focus returns to where it was, and the popup flips or
 * shifts to stay inside the viewport. This file adds the keyboard route: Shift+F10 and the Menu key
 * open the menu at the focused target's center instead of a stale pointer position. Every action is
 * also reachable from a visible "More actions" button, so right-click is never the only way in.
 * Motion: fade + scale 0.98 to 1 around the pointer anchor, 180 ms ease-out;
 * exit 120 ms ease-in. Reduced motion: it appears and disappears at once, at the same anchor.
 */

const TIMING = { "--menu-enter": `${MENU_MS.enter}ms`, "--menu-exit": `${MENU_MS.exit}ms` } as CSSProperties;

/**
 * Base UI places a context menu 2 px right of and 5 px above its anchor point (the context-menu
 * defaults of Menu.Positioner: alignOffset 2, sideOffset -5), so a right-click lands just inside it.
 */
const ANCHOR_OFFSET = { x: 2, y: -5 } as const;

/**
 * Opens the menu of `target` as if it were right-clicked at (x, y): one code path for every route.
 * Chromium stores a constructed MouseEvent's coordinates as whole pixels by truncating (10.6 becomes
 * 10), so they are rounded here: the anchor is the nearest pixel, not up to 1 px above and left.
 */
function openAt(target: HTMLElement, x: number, y: number) {
  target.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: Math.round(x), clientY: Math.round(y), button: 2 }),
  );
}

export interface ContextMenuItem {
  id: string;
  label: string;
  /** Draw a separator above this item. */
  separated?: boolean;
  onSelect(): void;
}

export interface ContextMenuProps {
  /** The target. It must be focusable so the keyboard route works. */
  children: ReactNode;
  items: ContextMenuItem[];
  /** Accessible name of the target, used to name the menu ("Actions for …"). */
  label: string;
  className?: string;
  onOpenChange?(open: boolean): void;
}

export function ContextMenu({ children, items, label, className = "", onOpenChange }: ContextMenuProps) {
  // Event timestamps count from page load, so 0 would swallow a real right-click in the first 600 ms.
  const keyboardAt = useRef(Number.NEGATIVE_INFINITY);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!((event.shiftKey && event.key === "F10") || event.key === "ContextMenu")) return;
    event.preventDefault();
    keyboardAt.current = event.timeStamp;
    const focused = event.target as HTMLElement;
    const box = focused.getBoundingClientRect();
    openAt(focused, box.left + box.width / 2, box.top + box.height / 2);
  };
  return (
    <Menu.Root onOpenChange={(open) => onOpenChange?.(open)}>
      <Menu.Trigger
        className={className}
        onKeyDown={onKeyDown}
        onContextMenuCapture={(event) => {
          // Some browsers follow Shift+F10 with their own contextmenu event at a stale point; the
          // synthetic one above already opened the menu at the target.
          if (event.isTrusted && event.timeStamp - keyboardAt.current < 600) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" collisionPadding={8}>
          <Menu.Popup
            aria-label={`Actions for ${label}`}
            data-testid="context-menu"
            style={TIMING}
            className="min-w-44 origin-[var(--transform-origin)] rounded-[10px] bg-surface p-1 text-ink shadow-[var(--mk-shadow-overlay)] outline-none transition-[opacity,scale] duration-[var(--menu-enter)] ease-kit-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-[var(--menu-exit)] data-ending-style:ease-kit-in data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none"
          >
            {items.map((item) => (
              <div key={item.id}>
                {item.separated ? <Menu.Separator className="mx-2 my-1 h-px bg-line" /> : null}
                <Menu.Item
                  data-testid={`context-menu-${item.id}`}
                  onClick={item.onSelect}
                  className="flex h-9 cursor-default items-center rounded-[6px] px-3 text-[15px] outline-none select-none data-highlighted:bg-sunken pointer-coarse:h-11"
                >
                  {item.label}
                </Menu.Item>
              </div>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A visible button that opens the same menu 4 px below itself, left edges aligned. */
export function MoreActionsButton({ label, open }: { label: string; open: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`More actions for ${label}`}
      aria-haspopup="menu"
      aria-expanded={open}
      data-testid="context-more"
      className="text-muted"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        openAt(event.currentTarget, box.left - ANCHOR_OFFSET.x, box.bottom + 4 - ANCHOR_OFFSET.y);
      }}
      onKeyDown={(event) => {
        // Enter and Space open it through onClick; keep them from reaching the target's handlers.
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
        <circle cx="5" cy="10" r="1.5" />
        <circle cx="10" cy="10" r="1.5" />
        <circle cx="15" cy="10" r="1.5" />
      </svg>
    </Button>
  );
}

interface FileEntry {
  id: string;
  name: string;
  kind: string;
  size: string;
}

const FILES: FileEntry[] = [
  { id: "q3", name: "Q3 report.pdf", kind: "PDF", size: "2.4 MB" },
  { id: "brand", name: "Brand kit.fig", kind: "Figma file", size: "18 MB" },
  { id: "notes", name: "Launch notes.md", kind: "Markdown", size: "6 KB" },
];

function FileGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M6 3.5h5.5l3 3v10H6zM11 3.5v3.5h3.5" />
    </svg>
  );
}

/** Inline rename field: Enter or leaving the field saves, Esc cancels. */
function RenameField({ name, onDone }: { name: string; onDone(next: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(0, name.lastIndexOf(".") > 0 ? name.lastIndexOf(".") : name.length);
  }, [name]);
  return (
    <input
      ref={ref}
      aria-label="File name"
      data-testid="context-rename"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onDone(value.trim() || null);
        if (e.key === "Escape") onDone(null);
      }}
      onBlur={() => onDone(value.trim() || null)}
      className="h-8 w-full min-w-0 rounded-[6px] border border-control-line bg-surface px-2 text-[15px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-[var(--mk-focus)]"
    />
  );
}

/**
 * Live example: three file cards. Right-click a card, or focus it and press
 * Shift+F10 or the Menu key, or use its "More actions" button: Open, Rename (inline), Duplicate,
 * Move to Archive and Delete all work and report what they did.
 */
export function Playground() {
  const [files, setFiles] = useState(FILES);
  const [openId, setOpenId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  const focusCard = (id: string | undefined) => requestAnimationFrame(() => (id ? cards.current.get(id)?.focus() : undefined));
  const itemsFor = (file: FileEntry, index: number): ContextMenuItem[] => [
    { id: "open", label: "Open", onSelect: () => setResult(`Opened ${file.name}`) },
    { id: "rename", label: "Rename", onSelect: () => setRenaming(file.id) },
    {
      id: "duplicate",
      label: "Duplicate",
      onSelect: () => {
        const copy = { ...file, id: `${file.id}-${Date.now()}`, name: `Copy of ${file.name}` };
        setFiles((list) => [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]);
        setResult(`Duplicated ${file.name}`);
      },
    },
    { id: "move", label: "Move to Archive", separated: true, onSelect: () => setResult(`Moved ${file.name} to Archive`) },
    {
      id: "delete",
      label: "Delete",
      onSelect: () => {
        const next = files[index + 1] ?? files[index - 1];
        setFiles((list) => list.filter((f) => f.id !== file.id));
        setResult(`Deleted ${file.name}`);
        focusCard(next?.id);
      },
    },
  ];

  return (
    <div className="flex w-full flex-col items-center gap-4 [contain:inline-size]">
      <ul className="m-0 grid w-full max-w-[760px] list-none grid-cols-[repeat(auto-fill,minmax(min(228px,100%),1fr))] gap-3 p-0">
        {files.map((file, index) => (
          <li key={file.id}>
            <ContextMenu
              label={file.name}
              items={itemsFor(file, index)}
              onOpenChange={(open) => setOpenId(open ? file.id : null)}
              className="block rounded-panel outline-none"
            >
              <div
                ref={(el) => {
                  if (el) cards.current.set(file.id, el);
                  else cards.current.delete(file.id);
                }}
                role="group"
                tabIndex={0}
                aria-label={`${file.name}, ${file.kind}, ${file.size}`}
                aria-keyshortcuts="Shift+F10"
                data-testid={`context-card-${index}`}
                className={`flex flex-col gap-3 rounded-panel border bg-surface p-3 text-ink transition-[border-color,box-shadow] duration-120 ease-kit-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mk-focus)] motion-reduce:transition-none ${openId === file.id ? "border-transparent shadow-[0_0_0_2px_var(--mk-accent)]" : "border-line"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-control bg-sunken">
                    <FileGlyph />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    {renaming === file.id ? (
                      <RenameField
                        name={file.name}
                        onDone={(next) => {
                          if (renaming !== file.id) return;
                          setRenaming(null);
                          if (next && next !== file.name) {
                            setFiles((list) => list.map((f) => (f.id === file.id ? { ...f, name: next } : f)));
                            setResult(`Renamed to ${next}`);
                          }
                          focusCard(file.id);
                        }}
                      />
                    ) : (
                      <span className="block truncate text-[15px] font-medium">{file.name}</span>
                    )}
                    <span className="block truncate text-sm text-muted">
                      {file.kind} · {file.size}
                    </span>
                  </span>
                  <MoreActionsButton label={file.name} open={openId === file.id} />
                </div>
              </div>
            </ContextMenu>
          </li>
        ))}
      </ul>
      <div className="flex min-h-10 items-center gap-3">
        <p role="status" className="m-0 text-sm text-muted">
          {result ?? "Right-click a file, or focus it and press Shift+F10."}
        </p>
        {files.length !== FILES.length || files.some((f, i) => f.name !== FILES[i]?.name) ? (
          <Button
            variant="secondary"
            onClick={() => {
              setFiles(FILES);
              setResult("Files reset");
            }}
          >
            Reset files
          </Button>
        ) : null}
      </div>
    </div>
  );
}
