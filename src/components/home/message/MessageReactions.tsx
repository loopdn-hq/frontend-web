"use client";

import { hasReacted, type MessageReaction } from "@/lib/chat/conversations";
import { reactionLabel } from "@/lib/chat/reactions";

/**
 * The pills under a bubble showing what people made of it.
 *
 * Its own row INSIDE the article rather than hanging off the bottom edge:
 * `absolute right-0 -bottom-4` is already taken by the "N read" caption on the
 * last message you sent, and two things in that space overlap.
 *
 * Each pill is a button - clicking one is how you join or leave that reaction,
 * which is the shortest path and the one people reach for first.
 */

type MessageReactionsProps = {
  reactions: MessageReaction[];
  currentUsername: string | null;
  onToggle: (emoji: string, reacted: boolean) => void;
  /** Disabled while a change is in flight, so a double click cannot race. */
  busy?: boolean;
};

export function MessageReactions({
  reactions,
  currentUsername,
  onToggle,
  busy = false,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {reactions.map((reaction) => {
        const mine = hasReacted(reaction, currentUsername);
        return (
          <button
            key={reaction.emoji}
            type="button"
            disabled={busy}
            onClick={() => onToggle(reaction.emoji, mine)}
            aria-pressed={mine}
            // Who reacted, for the pointer and for a screen reader - the same
            // fact, not a decoration, so it is the accessible name too.
            title={reaction.usernames.join(", ")}
            aria-label={`${reactionLabel(reaction.emoji)}, ${reaction.count}${
              mine ? ", including you" : ""
            }`}
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition disabled:opacity-50 ${
              mine
                ? "border-sky-400 bg-sky-100 text-sky-800 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            <span aria-hidden>{reaction.emoji}</span>
            <span className="tabular-nums">{reaction.count}</span>
          </button>
        );
      })}
    </div>
  );
}
