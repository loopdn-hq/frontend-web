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
 * which is the shortest path and the one people reach for first. With the
 * group's Reactions switch off they stay, as plain labels: what members already
 * said is still shown, it just cannot be added to.
 */

type MessageReactionsProps = {
  reactions: MessageReaction[];
  currentUsername: string | null;
  onToggle: (emoji: string, reacted: boolean) => void;
  /** Disabled while a change is in flight, so a double click cannot race. */
  busy?: boolean;
  /** Shown but not clickable: the group's Reactions switch is off. */
  readOnly?: boolean;
};

export function MessageReactions({
  reactions,
  currentUsername,
  onToggle,
  busy = false,
  readOnly = false,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  if (readOnly) {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {reactions.map((reaction) => {
          const mine = hasReacted(reaction, currentUsername);
          return (
            <span
              key={reaction.emoji}
              title={reaction.usernames.join(", ")}
              aria-label={`${reactionLabel(reaction.emoji)}, ${reaction.count}${
                mine ? ", including you" : ""
              }`}
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-2xs leading-none ${
                mine
                  ? "border-brand bg-tint text-ink"
                  : "border-line bg-canvas text-ink-muted"
              }`}
            >
              <span aria-hidden>{reaction.emoji}</span>
              <span className="tabular-nums">{reaction.count}</span>
            </span>
          );
        })}
      </div>
    );
  }

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
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-2xs leading-none transition disabled:opacity-50 ${
              mine
                ? "border-brand bg-tint text-ink"
                : "border-line bg-canvas text-ink-muted hover:bg-hover"
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
