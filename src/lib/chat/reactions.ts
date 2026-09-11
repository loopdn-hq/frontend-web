/**
 * The emoji a message may be reacted with.
 *
 * MIRRORS `REACTION_EMOJI` in `backend/chat/models.py`, which is the authority:
 * the API refuses anything outside its list, so adding one here alone produces
 * a picker whose buttons are rejected. Change the backend first.
 *
 * Six, not a full picker. The set is small so the bar can sit inside the
 * message menu without becoming a second surface to navigate, and so that what
 * lands under somebody else's message is always something recognisable.
 */
export const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

/** A name for the emoji, for anyone listening rather than looking. */
export const REACTION_LABEL: Record<string, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "😂": "Laugh",
  "😮": "Surprised",
  "😢": "Sad",
  "🙏": "Thanks",
};

export function reactionLabel(emoji: string): string {
  return REACTION_LABEL[emoji] ?? emoji;
}
