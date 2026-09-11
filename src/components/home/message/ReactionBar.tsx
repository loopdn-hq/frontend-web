"use client";

import { REACTION_EMOJI, reactionLabel } from "@/lib/chat/reactions";

/**
 * The row of emoji you can put on a message.
 *
 * Lives at the TOP OF THE MESSAGE MENU rather than in a popover of its own.
 * A second floating surface would need its own anchoring, its own dismissal and
 * its own focus handling - all of which the menu already has - and would leave
 * two overlapping panels for the same message. One click from the hover button
 * still gets here, which is what a quick reaction needs to be.
 *
 * The buttons are menu items so the menu's existing arrow-key walk picks them
 * up; without that they are unreachable from the keyboard.
 */

type ReactionBarProps = {
  /** What this viewer has already reacted with, so it reads as pressed. */
  mine: string[];
  onSelect: (emoji: string, reacted: boolean) => void;
};

export function ReactionBar({ mine, onSelect }: ReactionBarProps) {
  return (
    <div className="flex items-center justify-between gap-0.5 px-1.5 pb-1.5">
      {REACTION_EMOJI.map((emoji) => {
        const reacted = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            // menuitemcheckbox, not menuitem: each emoji is independently on
            // or off, and only this role can say so. The menu's arrow-key walk
            // looks for all three menu-item roles, so it is still reachable.
            role="menuitemcheckbox"
            aria-checked={reacted}
            aria-label={reactionLabel(emoji)}
            onClick={() => onSelect(emoji, reacted)}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:scale-110 focus-visible:outline-none ${
              reacted
                ? "bg-sky-100 dark:bg-sky-950"
                : "hover:bg-slate-100 focus:bg-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
            }`}
          >
            <span aria-hidden>{emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
