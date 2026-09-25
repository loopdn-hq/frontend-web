import { allows, GROUP } from "@/lib/rbac";
import type { Conversation, ConversationMessage } from "./conversations";

/**
 * Who may do what to a message.
 *
 * One place, because the same question is asked twice for every action - once
 * to decide whether the menu offers it, and again by the server. These are the
 * client's half; the server enforces the same rules in ConversationViewSet and
 * is the one that counts. Keeping them here means the menu and the API cannot
 * drift into offering something that is then refused.
 */

/** What a deleted message says in its place. Matches the server's wording. */
export const DELETED_MESSAGE_TEXT = "This message was deleted";

type MessageLike = Pick<
  ConversationMessage,
  "mine" | "source" | "deletedAt" | "text"
>;

/**
 * Editing is the sender's own, and only for what they sent from the app.
 *
 * Not admins: rewriting a message under somebody else's name would put words in
 * their mouth. An admin who objects can delete it, which is visible for what it
 * is.
 *
 * Not a text or an email either - those are copies of something that really was
 * sent from a handset, and editing the copy would make the thread disagree with
 * what actually arrived.
 */
export function canEditMessage(message: MessageLike): boolean {
  return message.mine && message.deletedAt === null && message.source === "app";
}

/**
 * The sender may delete their own; moderation covers anybody's.
 *
 * `canDeleteAny` comes from the conversation's `features`
 * (`group.message.delete.any`) rather than from an isAdmin boolean, so this
 * does not have to know which roles moderate - and picks up a new one for
 * free.
 */
export function canDeleteMessage(
  message: MessageLike,
  canDeleteAny: boolean,
): boolean {
  return message.deletedAt === null && (message.mine || canDeleteAny);
}

/**
 * Pinning is an admin's call in a group - it is the one thing every member sees
 * above the thread. A one-to-one has no admins, so either person may pin;
 * refusing both would make the feature unreachable in half the app.
 *
 * Both halves of that come from the server now. This used to read
 * `kind === "direct" || isAdmin`, which was the same rule written twice - and
 * the DM half is the subtle one, so it was the half most likely to drift.
 */
export function canPinMessage(
  conversation: Pick<Conversation, "features">,
  message: MessageLike,
): boolean {
  if (message.deletedAt !== null) return false;
  return allows(conversation, GROUP.pin);
}

/** A deleted message has nothing to copy, forward, quote or react to. */
export function canActOnContent(message: MessageLike): boolean {
  return message.deletedAt === null;
}
