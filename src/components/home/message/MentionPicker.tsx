"use client";

import { useEffect, useRef } from "react";
import type { MentionCandidate } from "@/lib/chat/mentions";

/**
 * The list that opens when somebody types "@" in the composer.
 *
 * Presentational on purpose: the composer owns the text, the caret and which
 * row is highlighted, and this only draws them. The keys are handled up there
 * too, because the input must keep focus the whole time - a list that took
 * focus would put the caret somewhere else mid-sentence.
 *
 * It is a listbox rather than a menu (`components/ui/context-menu` is the
 * nearest relative): the input keeps focus and points at the active row with
 * `aria-activedescendant`, which is how a screen reader follows a combobox.
 *
 * Placed like the emoji picker above it - `absolute bottom-full` over the
 * composer - so the two never fight for the same space.
 */
export function MentionPicker({
  id,
  options,
  activeIndex,
  onPick,
  onHover,
}: {
  /** Ties the input's aria-controls to this list. */
  id: string;
  options: MentionCandidate[];
  activeIndex: number;
  onPick: (option: MentionCandidate) => void;
  onHover: (index: number) => void;
}) {
  const activeRef = useRef<HTMLLIElement | null>(null);

  // Keep the highlighted row in view when it is moved with the arrow keys.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (options.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-2xl border border-line bg-canvas shadow-xl">
      <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-muted">
        Mention someone
      </p>
      <ul id={id} role="listbox" className="max-h-56 overflow-y-auto py-1">
        {options.map((option, index) => {
          const isActive = index === activeIndex;
          return (
            <li
              key={String(option.id)}
              id={`${id}-option-${index}`}
              ref={isActive ? activeRef : null}
              role="option"
              aria-selected={isActive}
            >
              <button
                type="button"
                // The input must not lose focus, or the caret jumps and the
                // browser closes the list before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onHover(index)}
                onClick={() => onPick(option)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  isActive ? "bg-tint text-ink" : "text-ink hover:bg-hover"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {option.label}
                </span>
                {option.hint && (
                  <span className="shrink-0 text-2xs text-ink-muted">
                    {option.hint}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
