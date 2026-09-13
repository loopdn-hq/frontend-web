"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui/cn";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useReturnFocus } from "@/lib/hooks/useReturnFocus";

/**
 * A menu anchored to a point rather than to an element.
 *
 * The two dropdowns already in the app hang off their trigger, which is enough
 * when the trigger is a button. A right-click menu has no trigger to hang off -
 * it opens where the pointer was - so it needs its own positioning, and that
 * position has to be corrected against the viewport after the menu is measured.
 *
 * PORTALLED, because the chat thread scrolls and clips: rendered inline, a menu
 * opened near the bottom of the list would be cut off by the scroll container
 * rather than flipping above the cursor.
 *
 * A trigger that opens this should carry `data-ignore-click-outside`, or the
 * pointerdown that reopens it is read as a click outside and the button can
 * never put its own menu away.
 */

export type ContextMenuItem =
  | { kind: "separator"; id: string }
  | {
      kind?: "item";
      id: string;
      label: string;
      /**
       * A second, quieter line under the label - "Sign out of your account".
       *
       * Optional, and absent on the message menu, where every item is a verb
       * the label already says in full. It earns its place on a menu whose
       * items are destinations rather than actions, because "Profile" and
       * "Settings" do not say on their own which one holds what.
       */
      description?: string;
      icon?: ReactNode;
      tone?: "default" | "danger";
      disabled?: boolean;
      onSelect: () => void;
    };

export type ContextMenuOrigin = { x: number; y: number };

type ContextMenuProps = {
  origin: ContextMenuOrigin | null;
  items: ContextMenuItem[];
  onClose: () => void;
  label?: string;
  /**
   * Rendered inside the panel, above the items.
   *
   * For a row of controls that belongs to the same menu but is not a list - the
   * message reaction bar. Anything focusable in here should carry
   * `role="menuitem"`, or the arrow-key walk below will step straight over it.
   *
   * Note it does NOT close the menu on click: a header control decides that for
   * itself, because picking an emoji and picking "Delete" do not deserve the
   * same ending.
   */
  header?: ReactNode;
};

// Enough that the menu never sits flush against the window edge.
const VIEWPORT_MARGIN = 8;

// All three menu-item roles, because the header slot uses `menuitemcheckbox`
// for a control that is on or off - a plain `menuitem` cannot carry that state
// - and anything the arrow keys skip is unreachable from the keyboard.
const ENABLED_ITEM = [
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
]
  .map((role) => `${role}:not([disabled])`)
  .join(",");

export function ContextMenu({
  origin,
  items,
  onClose,
  label = "Message actions",
  header,
}: ContextMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(origin);

  // Keyed by the origin it was measured for. `origin` is a fresh object on
  // every open, so reference equality is the key - and a stale placement from
  // the previous open can never be mistaken for this one's.
  const [placement, setPlacement] = useState<{
    for: ContextMenuOrigin;
    at: ContextMenuOrigin;
  } | null>(null);
  const measured = placement && placement.for === origin ? placement.at : null;

  useClickOutside(panel, isOpen, onClose);
  useEscapeKey(isOpen, onClose);
  useReturnFocus(isOpen);

  // Measured and corrected before paint, so the menu never appears at the raw
  // cursor position and then visibly jumps inside the viewport.
  useLayoutEffect(() => {
    if (!origin) return;

    const element = panel.current;
    if (!element) return;

    const { width, height } = element.getBoundingClientRect();

    // A real flip, not a clamp. Near the right edge the menu opens to the LEFT
    // of the cursor rather than sliding along it - which is what every desktop
    // menu does, and what keeps the pointer outside the panel it just opened.
    const overflowsRight =
      origin.x + width + VIEWPORT_MARGIN > window.innerWidth;
    const overflowsBottom =
      origin.y + height + VIEWPORT_MARGIN > window.innerHeight;

    setPlacement({
      for: origin,
      at: {
        x: overflowsRight
          ? Math.max(VIEWPORT_MARGIN, origin.x - width)
          : origin.x,
        y: overflowsBottom
          ? Math.max(VIEWPORT_MARGIN, origin.y - height)
          : origin.y,
      },
    });
  }, [origin]);

  // Focus lands on the first item, so the menu is reachable from the keyboard
  // at all. Without it the portalled panel is announced but unusable.
  useEffect(() => {
    if (!measured) return;
    panel.current?.querySelector<HTMLButtonElement>(ENABLED_ITEM)?.focus();
  }, [measured]);

  // The thread scrolls under the menu otherwise, leaving it pointing at
  // nothing. Closing is more honest than following.
  useEffect(() => {
    if (!isOpen) return;
    const close = () => onClose();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen, onClose]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      const options = Array.from(
        panel.current?.querySelectorAll<HTMLButtonElement>(ENABLED_ITEM) ?? [],
      );
      if (options.length === 0) return;

      const current = options.indexOf(
        document.activeElement as HTMLButtonElement,
      );

      // Wrapping, because a menu is a ring: Down on the last item returning to
      // the first is what every other menu does.
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % options.length
              : (current - 1 + options.length) % options.length;

      options[next]?.focus();
    },
    [],
  );

  if (!origin || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        "fixed z-[70] w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl",
        "dark:border-slate-700 dark:bg-slate-900",
        // Hidden until measured, so the first frame is not at the wrong spot.
        measured ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{
        left: measured?.x ?? origin.x,
        top: measured?.y ?? origin.y,
      }}
    >
      {header}
      {items.map((item) =>
        item.kind === "separator" ? (
          <div
            key={item.id}
            role="separator"
            className="my-1.5 h-px bg-slate-100 dark:bg-slate-700"
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
              "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
              item.tone === "danger"
                ? "text-rose-600 hover:bg-rose-50 focus:bg-rose-50 dark:hover:bg-rose-950/40 dark:focus:bg-rose-950/40"
                : "text-slate-700 hover:bg-sky-50 focus:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800",
            )}
          >
            {item.icon && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {item.icon}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.description && (
                <span
                  className={cn(
                    "block truncate text-xs",
                    item.tone === "danger"
                      ? "text-rose-500/80 dark:text-rose-400/70"
                      : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {item.description}
                </span>
              )}
            </span>
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
