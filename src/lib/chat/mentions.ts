/**
 * Naming somebody in a message.
 *
 * The composer sends IDS, never words: most members of most Loops have no
 * handle - they are a phone number with a display name - and two of them can
 * be called "Mum". The text itself stays plain ("@Mum can you bring bread"),
 * so the copy that arrives by text or email reads as a person wrote it. See
 * backend/chat/mentions.py, which is the authority on which ids may stand.
 *
 * Everything here is pure: finding the `@` being typed, putting a name in,
 * dropping names that have been deleted out of the sentence again, and
 * splitting a stored message into the pieces the bubble highlights. None of it
 * touches React or the network, so all of it can be reasoned about on its own.
 */

/** The id used for "@everyone", which is a flag on the message, not a member. */
export const EVERYONE = "everyone" as const;

/** One person a message names, as the API returns them. */
export type MessageMention = {
  participantId: number;
  /** Null for a member with no account - they cannot read the app anyway. */
  userId: number | null;
  /** Null for the same reason. Used to recognise yourself in the list. */
  username: string | null;
  displayLabel: string;
};

/** Somebody the composer has named but not yet sent. */
export type DraftMention = {
  /** A membership id, or EVERYONE. */
  id: number | typeof EVERYONE;
  /** The exact text written into the message, minus the "@". */
  label: string;
};

/** A member the picker can offer. */
export type MentionCandidate = {
  id: number | typeof EVERYONE;
  label: string;
  /** A second line - the phone number, or "Everyone in this Loop". */
  hint?: string;
};

/** Where an unfinished "@..." sits in the text being typed. */
export type MentionQuery = {
  /** Index of the "@". */
  start: number;
  /** What has been typed after it, which may be empty. */
  query: string;
};

/**
 * The mention being typed at the caret, if there is one.
 *
 * An "@" counts only at the start of the text or after a space, so an email
 * address does not open the picker on every keystroke. The query itself stops
 * at the first space: names contain spaces, but a query that swallowed them
 * would leave the picker open for the rest of the sentence.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): MentionQuery | null {
  const upToCaret = text.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;

  const before = at === 0 ? "" : upToCaret[at - 1];
  if (before !== "" && !/\s/.test(before)) return null;

  const query = upToCaret.slice(at + 1);
  if (/\s/.test(query)) return null;

  return { start: at, query };
}

/** The members worth offering for what has been typed so far. */
export function filterCandidates(
  candidates: MentionCandidate[],
  query: string,
  limit = 8,
): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return candidates.slice(0, limit);

  return candidates
    .filter((candidate) => {
      const label = candidate.label.toLowerCase();
      // Any word, not just the first: typing "bob" should find "Uncle Bob".
      return (
        label.split(/\s+/).some((word) => word.startsWith(needle)) ||
        label.startsWith(needle)
      );
    })
    .slice(0, limit);
}

/**
 * Put a chosen name into the text, replacing the "@..." being typed.
 *
 * Returns the new text and where the caret should sit - after the trailing
 * space, so the next word can simply be typed.
 */
export function insertMention(
  text: string,
  query: MentionQuery,
  caret: number,
  label: string,
): { text: string; caret: number } {
  const inserted = `@${label} `;
  const next = text.slice(0, query.start) + inserted + text.slice(caret);
  return { text: next, caret: query.start + inserted.length };
}

/**
 * Drop the mentions whose names are no longer in the words.
 *
 * Somebody who picks "@Bob" and then deletes it from the sentence has not
 * mentioned Bob, and sending the id anyway would notify him about a message
 * that does not name him. Called just before sending, and on an edit.
 */
export function pruneMentions(
  text: string,
  mentions: DraftMention[],
): DraftMention[] {
  const kept: DraftMention[] = [];
  const seen = new Set<DraftMention["id"]>();

  for (const mention of mentions) {
    if (seen.has(mention.id)) continue;
    if (!text.includes(`@${mention.label}`)) continue;
    seen.add(mention.id);
    kept.push(mention);
  }
  return kept;
}

/** What to send: membership ids, and whether the whole Loop was named. */
export function toApiMentions(mentions: DraftMention[]): {
  mentions: number[];
  mentionEveryone: boolean;
} {
  return {
    mentions: mentions
      .map((mention) => mention.id)
      .filter((id): id is number => id !== EVERYONE),
    mentionEveryone: mentions.some((mention) => mention.id === EVERYONE),
  };
}

/** A run of message text, marked as a mention or not. */
export type TextSegment = {
  text: string;
  /** True when this run is a name the message named. */
  isMention: boolean;
  /** True when the name is the reader's own, which is highlighted harder. */
  isMe: boolean;
};

/**
 * Split a message into the runs a bubble renders.
 *
 * Matches the stored mentions against the words, rather than parsing "@" out
 * of the text: a message can say "email me @ noon" and mean nothing by it, and
 * only the rows the server stored are really mentions.
 *
 * Longest label first, so "@Bob Smith" wins over "@Bob" when both are members.
 */
export function splitByMentions(
  text: string,
  mentions: MessageMention[],
  mentionsEveryone: boolean,
  currentUsername?: string | null,
): TextSegment[] {
  const labels: { label: string; isMe: boolean }[] = mentions.map(
    (mention) => ({
      label: mention.displayLabel,
      isMe: Boolean(currentUsername && mention.username === currentUsername),
    }),
  );

  if (mentionsEveryone) {
    // Everybody but the sender is included, so it always highlights for a
    // reader - the sender's own message is not counted as naming them.
    labels.push({ label: "everyone", isMe: true });
  }

  if (labels.length === 0 || !text) {
    return [{ text, isMention: false, isMe: false }];
  }

  labels.sort((a, b) => b.label.length - a.label.length);

  const segments: TextSegment[] = [];
  let rest = text;

  while (rest.length > 0) {
    let best: { index: number; label: string; isMe: boolean } | null = null;

    for (const { label, isMe } of labels) {
      const index = rest.indexOf(`@${label}`);
      if (index === -1) continue;
      if (best === null || index < best.index) best = { index, label, isMe };
    }

    if (best === null) {
      segments.push({ text: rest, isMention: false, isMe: false });
      break;
    }

    if (best.index > 0) {
      segments.push({
        text: rest.slice(0, best.index),
        isMention: false,
        isMe: false,
      });
    }
    segments.push({
      text: `@${best.label}`,
      isMention: true,
      isMe: best.isMe,
    });
    rest = rest.slice(best.index + best.label.length + 1);
  }

  return segments;
}
