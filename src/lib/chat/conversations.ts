import {
  getAccessToken,
  getSession,
  handleUnauthorizedResponse,
  refreshTokens,
} from "@/lib/auth/client";
import { composePreview, describeMessageBody } from "@/lib/chat/preview";
import { DELETED_MESSAGE_TEXT } from "@/lib/chat/messageActions";
import type { MessageMention } from "@/lib/chat/mentions";

import { API_BASE_URL } from "@/lib/config/env";
import { http as fetch } from "@/lib/config/http";

export type JoinMode = "open" | "code" | "approval" | "invite";
export type ConversationMode = "chat" | "broadcast";

/**
 * Which mode a conversation is in, whichever shape the payload arrived in.
 *
 * The two endpoints disagree about where `mode` lives, so neither field alone
 * is reliable:
 *   - ConversationSerializer (list + detail) omits a top-level `mode` and
 *     reports it only inside `settings`, so `conversation.mode` falls back to
 *     its "chat" default for EVERY row, broadcast groups included.
 *   - ConversationSearchSerializer (discovery) is the reverse: a top-level
 *     `mode` and no `settings` at all.
 *
 * Prefer settings.mode and fall back to the top-level field.
 */
export function conversationMode(conversation: {
  mode: ConversationMode;
  settings: GroupSettings | null;
}): ConversationMode {
  return conversation.settings?.mode ?? conversation.mode;
}
export type GroupMemberPermission = "members" | "admins";

export type GroupSettings = {
  mode: ConversationMode;
  join_mode: JoinMode;
  add_member_permission: GroupMemberPermission;
  edit_group_permission: GroupMemberPermission;
  sms_delivery_enabled: boolean;
  sms_replies_enabled: boolean;
  voice_messages_enabled: boolean;
  /**
   * What kind of group this is (a category's slug) and where it is (a
   * country, "PH", or one of its regions, "PH-00"). Declared by an admin;
   * null and "" until then. Ads are matched on these two and nothing else.
   */
  category: string | null;
  region: string;
};

/** A new group's settings: what kind and where are optional at creation. */
export type NewGroupSettings = Omit<GroupSettings, "category" | "region"> &
  Partial<Pick<GroupSettings, "category" | "region">>;

export type CreateConversationInvite = {
  phone_number: string;
  display_name?: string;
};

export type CreateConversationPayload = {
  name: string;
  description?: string;
  /** Usernames of existing accounts. All-or-nothing: one miss fails the request. */
  members?: string[];
  /** Phone numbers. Texted an invitation whether or not they have an account. */
  invite?: CreateConversationInvite[];
  /**
   * Email addresses. A verified account is added outright; anybody else is
   * emailed an invitation and joins by confirming that address. Unlike
   * `members`, an address that matches nobody is not an error.
   */
  invite_email?: string[];
  settings: NewGroupSettings;
  /** The group's photo. Sends the whole request as a form - see `groupForm`. */
  image?: File;
};

export type ConversationKind = "group" | "direct";

/**
 * A group's phone number, as the API sends it.
 *
 * An object rather than a bare string because "the number exists" and "the
 * number works" are different questions - `status` answers the second, and
 * `provider` is what tells a support conversation where to go looking.
 */
export type GroupNumber = {
  number: string;
  country: string;
  status: string;
  provider: string;
};

export type Conversation = {
  id: string | number;
  // Leaving and deleting are both refused on a one-to-one, so the client has
  // to know which it is before offering either.
  kind: ConversationKind;
  name: string;
  description: string;
  mode: ConversationMode;
  joinMode: JoinMode | null;
  logoImage: string | null;
  settings: GroupSettings | null;
  preview: string;
  // When the newest message landed, for the timestamp on each row.
  lastMessageAt: string | null;
  unread: number;
  // Both are this member's own state, never an admin's. `muted` stops
  // delivery on every channel, SMS included; `archived` stops nothing and
  // only decides which list the conversation appears in.
  muted: boolean;
  archived: boolean;
  // The member cleared their view and nothing has arrived since, so there is
  // nothing to show. Goes false again on the next message, which is what
  // brings the conversation back holding only what came after.
  cleared: boolean;
  isAdmin: boolean;
  /**
   * What the viewer may do in THIS conversation, straight from the server.
   *
   * Decides what to SHOW. Every write is re-checked server-side, and the
   * queryset there is what decides whether the conversation is reachable at
   * all - see backend rbac/resolver.py.
   *
   * `isAdmin` stays beside it until the last screen has moved across; the two
   * agree, but this one can say "may pin" without a client having to know that
   * pinning is an admin thing in a group and not in a DM.
   */
  features: string[];
  /**
   * The group's own phone number, or null while it has not got one.
   *
   * The API has always sent this; nothing read it. Without it the product's
   * central promise - text this number to reach your group - is unreachable,
   * because a member has no way to learn the number.
   *
   * Null is a real state, not a missing field: a group whose provisioning
   * failed has no number at all, and nothing ever invents a stand-in.
   */
  smsNumber: GroupNumber | null;
  createdByUsername?: string;
  active?: boolean;
  participants: ConversationParticipant[];
  /**
   * The one message held above the thread, or null.
   *
   * On the conversation rather than on a message because there is exactly one,
   * which is also what lets a pin ride the `conversation.updated` broadcast
   * instead of needing a socket event of its own.
   */
  pinnedMessage: ConversationMessage | null;
};

/** One member's answer about one delivery channel. */
export type ChannelConsentState = {
  /** null when they have never been asked about this channel. */
  status: "pending" | "opted_in" | "declined" | "opted_out" | null;
  /** What the fan-out actually decides, so the UI never re-derives it. */
  allowsDelivery: boolean;
  askedAt: string | null;
  consentedAt: string | null;
  optedOutAt: string | null;
  /**
   * Whether a nudge can go out on this channel at all, as the server decides
   * it. The once-a-day floor is not part of it: that refusal comes back when
   * the nudge is pressed, saying how long to wait.
   */
  canNudge: boolean;
};

export type ConversationParticipant = {
  id: string;
  avatarUrl?: string;
  // How far this member has read. Null when they have read nothing, and
  // permanently null for a phone-only member - SMS reports that a handset
  // took a text, never that a person read it, so they cannot be counted in a
  // receipt without inventing the fact.
  lastReadMessageId?: number;
  // The ACCOUNT's id, where there is an account. Distinct from `id`, which is
  // the membership row. Realtime events identify people by account id - the
  // `typing` frame carries a bare `user_id` - so without this there is no way
  // to turn one into a name. Undefined for phone-only members, who have no
  // account and cannot open a socket to type on.
  userId?: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  /**
   * Admin or member - the only two the server has (`Participant.Role`).
   *
   * Narrow on purpose. A third value here is how "Make moderator" came to be
   * offered in the member menu: the role endpoint is a ChoiceField over these
   * two, so sending anything else is a 400, and the type now says so at build
   * time instead of at the request.
   */
  role: "admin" | "member";
  joinedAt: string;
  /**
   * Where this member stands on each delivery channel.
   *
   * Keyed by channel name rather than typed per channel, so a channel added
   * on the server appears here without a frontend change. `status` is null
   * when they were never asked, which is a different thing from having said
   * no - the two look identical as a boolean and are not.
   */
  channels: Record<string, ChannelConsentState>;
  isBlocked?: boolean;
  /**
   * Whether the VIEWER has blocked this person.
   *
   * One direction, and only ever the viewer's own decision: it is never true
   * because this person blocked the viewer. That asymmetry is the whole point -
   * a block has to stay invisible to the person it was made against.
   *
   * Distinct from `isBlocked`, which is an ADMIN's ban from one group. This one
   * is personal, spans the product, and no admin can see it.
   *
   * The only participant field whose answer depends on who is asking, which is
   * what makes it unsafe to read off a broadcast - see `applyConversationUpdate`.
   */
  blockedByMe: boolean;
  isOnline?: boolean;
  lastActive?: string;
};

export type ConversationAttachment = {
  id?: string | number;
  url: string;
  originalName: string;
  contentType?: string;
  // The server files uploads as image or file; content_type is what actually
  // distinguishes a GIF from a photo or a voice note from a document.
  kind?: "image" | "file";
};

/** Which channel a message arrived on. Mirrors Message.Source on the server. */
export type MessageSource = "app" | "sms" | "email" | "system";

/**
 * The message a reply answers, as much of it as a quote needs.
 *
 * An EXCERPT, not a message: the server truncates it and sends no attachments,
 * because nesting the real object recurses through a chain of replies.
 *
 * Null once the parent is deleted - the FK is SET_NULL, so a reply outlives its
 * parent and simply stops quoting it.
 */
export type MessageReplyTo = {
  id: string | number;
  sender: string;
  text: string;
};

/**
 * One emoji on one message, and who put it there.
 *
 * USERNAMES rather than a `reacted` flag, because the same payload arrives over
 * the websocket, where the server has no request and so no "me" to compute one
 * against. `hasReacted` below is how a component asks the question.
 */
export type MessageReaction = {
  emoji: string;
  count: number;
  usernames: string[];
};

/**
 * The card for the first link in a message: the page's title, description
 * and picture. Built by the server after the message was sent, and only when
 * the SENDER has "Show link previews" on - it arrives as a message update.
 */
export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

export type ConversationMessage = {
  id: string | number;
  conversationId: string | number;
  sender: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
  text: string;
  createdAt: string;
  attachments: ConversationAttachment[];
  mine: boolean;
  /** One entry per emoji used, in the order they were first used. */
  reactions: MessageReaction[];
  /** Passed along from another conversation. Never says who from. */
  forwarded: boolean;
  /** When the text was last changed, or null if it never was. */
  editedAt: string | null;
  /**
   * When it was deleted, or null. The message stays in the thread as a
   * tombstone - the server withholds the text and the attachments - so replies
   * quoting it keep a parent to point at.
   */
  deletedAt: string | null;
  /**
   * The channel it came in on. Serialized by the API all along and dropped on
   * the floor here until message info needed to say "arrived via SMS".
   */
  source: MessageSource;
  /** The message this one answers, when it answers one. */
  replyTo?: MessageReplyTo;
  /** The card for its first link, when it has one. */
  linkPreview?: LinkPreview;
  /**
   * Who this message names. Stored as ids rather than parsed out of the
   * words, because most members have no handle to parse - see lib/chat/mentions.
   */
  mentions: MessageMention[];
  /** Whether it named the whole Loop, which is a flag rather than a list. */
  mentionsEveryone: boolean;
};

type ApiObject = Record<string, unknown>;

function getErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as ApiObject;
  const data = envelope.data;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const value of Object.values(data as ApiObject)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  return typeof envelope.message === "string" ? envelope.message : null;
}

function getConversationItems(payload: unknown): ApiObject[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as ApiObject).data;
  if (Array.isArray(data)) return data.filter(isApiObject);
  if (data && typeof data === "object") {
    const results = (data as ApiObject).results;
    if (Array.isArray(results)) return results.filter(isApiObject);
    if ("id" in data && ("name" in data || "title" in data)) {
      return [data as ApiObject];
    }
  }
  return [];
}

function isApiObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Normalise a conversation that arrived outside a fetch - a websocket payload.
 * Exported for the same reason `normalizeParticipant` is: the socket delivers
 * the same shapes the REST endpoints do, and the client should read them the
 * one way.
 */
export function normalizeConversationPayload(
  raw: unknown,
): Conversation | null {
  return isApiObject(raw) ? normalizeConversation(raw) : null;
}

/**
 * Fold conversations into a list: the incoming ones first and fresh, every
 * other row kept after them in the order it had.
 *
 * Everything that calls this is reporting something that just changed - a
 * first page refetched after being added to a group, one conversation a
 * message has just arrived in - and "just changed" is also "belongs at the
 * top". Replacing the list instead would throw away every later page the
 * reader had scrolled to.
 */
export function mergeConversations(
  current: Conversation[],
  incoming: Conversation[],
): Conversation[] {
  const existing = new Map(current.map((row) => [String(row.id), row]));

  const folded = incoming.map((row) => {
    const previous = existing.get(String(row.id));
    if (!previous) return row;

    return {
      ...row,
      // The list endpoint deliberately carries NO participants - the roster is
      // unbounded and lives on its own paginated endpoint - so an incoming row
      // always arrives with an empty one. Taking it at its word emptied the
      // members panel on every refresh, and it only came back on a reload,
      // when the roster is fetched again.
      participants: row.participants.length
        ? row.participants
        : previous.participants,
    };
  });

  const replaced = new Set(incoming.map((row) => String(row.id)));
  return [...folded, ...current.filter((row) => !replaced.has(String(row.id)))];
}

/**
 * One message straight off the wire, whatever brought it.
 *
 * Exported so the websocket path runs the SAME conversion as the REST path
 * instead of hand-deriving a handful of fields and casting the rest. That cast
 * is how `reply_to` arrived unconverted once already: every field the
 * serializer grows is silently absent until somebody remembers to add it in
 * two places.
 *
 * `fallbackConversationId` covers the frames whose `conversation` the caller
 * has already resolved - some carry a nested object rather than a bare id.
 */
export function normalizeMessagePayload(
  raw: unknown,
  fallbackConversationId?: string | number | null,
): ConversationMessage | null {
  if (!isApiObject(raw)) return null;

  const conversation = raw.conversation;
  const resolved =
    typeof conversation === "string" || typeof conversation === "number"
      ? conversation
      : fallbackConversationId;
  if (resolved === null || resolved === undefined) return null;

  return normalizeMessage({ ...raw, conversation: resolved });
}

export function normalizeParticipant(
  item: unknown,
): ConversationParticipant | null {
  if (!isApiObject(item)) return null;
  // Only a nested `user` key is an account. Where there is none the row is
  // phone-only and `item` stands in for rendering - but its id is the
  // MEMBERSHIP's, so it must not be read back out as a user id.
  const nestedUser = isApiObject(item.user) ? item.user : null;
  const user = nestedUser ?? item;
  // The membership row's own id, not the account's - every action endpoint
  // (remove/role/requests) looks a participant up by Participant.pk, and
  // that differs from the user's id as soon as an account has more than one
  // membership. When item IS the user object (no nested `user` key), this is
  // the same value user.id would have given, so the fallback path is unaffected.
  const id = item.id;
  if (typeof id !== "string" && typeof id !== "number") return null;
  const profile = isApiObject(user.profile) ? user.profile : user;
  const username = asText(user.username) || undefined;
  const userId =
    nestedUser &&
    (typeof nestedUser.id === "string" || typeof nestedUser.id === "number")
      ? String(nestedUser.id)
      : undefined;
  const name = asText(
    user.display_label,
    asText(profile.display_label, username ?? "Member"),
  );
  const role = item.role === "admin" ? "admin" : "member";

  return {
    id: String(id),
    userId,
    name,
    username,
    email: asText(user.email) || undefined,
    phone: asText(user.phone_number, asText(user.phone)) || undefined,
    role,
    joinedAt: asText(item.joined_at, "Recently"),
    isBlocked: item.is_blocked === true,
    // Off the ACCOUNT, not the membership row: a block follows the person
    // everywhere, and a phone-only member has no account to have blocked.
    blockedByMe: user.blocked_by_me === true,
    avatarUrl: asText(profile.avatar_url) || undefined,
    lastReadMessageId:
      typeof item.last_read_message === "number"
        ? item.last_read_message
        : undefined,
    isOnline: profile.is_online === true,
    lastActive: asText(profile.last_seen_at) || undefined,
    channels: normalizeChannelConsents(item.channels),
  };
}

const CONSENT_STATUSES = ["pending", "opted_in", "declined", "opted_out"];

function normalizeChannelConsents(
  raw: unknown,
): Record<string, ChannelConsentState> {
  if (!isApiObject(raw)) return {};

  const out: Record<string, ChannelConsentState> = {};
  for (const [channel, value] of Object.entries(raw)) {
    if (!isApiObject(value)) continue;
    const status = asText(value.status);
    out[channel] = {
      status: CONSENT_STATUSES.includes(status)
        ? (status as ChannelConsentState["status"])
        : null,
      allowsDelivery: value.allows_delivery === true,
      askedAt: asText(value.asked_at) || null,
      consentedAt: asText(value.consented_at) || null,
      optedOutAt: asText(value.opted_out_at) || null,
      canNudge: value.can_nudge === true,
    };
  }
  return out;
}

/**
 * The other person in a one-to-one conversation.
 *
 * Null for a group, which is not one person, and null for a direct row that
 * holds nobody but the viewer - which is what a conversation just started
 * looks like until its participants arrive.
 *
 * Matched on username rather than on position, because the order participants
 * come back in is the server's and not a promise. Only somebody with an
 * account can be the answer: the actions that need this one person - blocking
 * them, unblocking them - name an account, and a direct conversation cannot
 * hold a phone-only member today anyway.
 */
export function directCounterpart(
  conversation: Pick<Conversation, "kind" | "participants">,
  viewerUsername: string | null,
): ConversationParticipant | null {
  if (conversation.kind === "group") return null;
  return (
    conversation.participants.find(
      (participant) =>
        participant.username && participant.username !== viewerUsername,
    ) ?? null
  );
}

function isCurrentUserAdmin(item: ApiObject): boolean {
  if (item.is_admin === true) return true;
  if (item.is_admin === false) return false;

  const currentUsername = getSession();
  if (!currentUsername || !Array.isArray(item.participants)) return false;

  return item.participants.some((participant) => {
    if (!isApiObject(participant) || participant.role !== "admin") return false;
    const user = isApiObject(participant.user) ? participant.user : participant;
    return asText(user.username) === currentUsername;
  });
}

/**
 * Who to credit for a message, account or not.
 *
 * The API guarantees this shape: a message texted in by somebody with no
 * account still carries `sender.profile.display_label`, precisely so clients
 * have one thing to read. The fallbacks below that are for older payloads.
 */
function senderLabelFrom(sender: unknown): string {
  const senderObject = isApiObject(sender) ? sender : null;
  if (!senderObject) return asText(sender, "Unknown");

  const senderProfile = isApiObject(senderObject.profile)
    ? senderObject.profile
    : senderObject;

  return asText(
    senderObject.display_label,
    asText(
      senderProfile?.display_label,
      asText(senderObject.username, "Unknown"),
    ),
  );
}

function normalizeGroupNumber(value: unknown): GroupNumber | null {
  if (!isApiObject(value)) return null;
  const number = asText(value.number);
  // No number, no object: an empty string here would render as a blank the
  // reader cannot text.
  if (!number) return null;

  return {
    number,
    country: asText(value.country),
    status: asText(value.status),
    provider: asText(value.provider),
  };
}

function normalizeConversation(item: ApiObject): Conversation | null {
  const id = item.id;
  // `title`, not `name`, is what says a conversation can be shown. A direct
  // conversation has no name of its own - the column is always '' - and is
  // titled after the other person by the server. Requiring `name` threw away
  // every direct conversation in the list, on the live `conversation.added`
  // refresh and in fetchConversation alike, so a DM could be created and never
  // opened by either person.
  if (
    (typeof id !== "string" && typeof id !== "number") ||
    !(item.title || item.name)
  ) {
    return null;
  }

  const mode: ConversationMode =
    item.mode === "broadcast" ? "broadcast" : "chat";
  const joinModeRaw = item.join_mode;
  const joinMode: JoinMode | null =
    joinModeRaw === "open" ||
    joinModeRaw === "code" ||
    joinModeRaw === "approval" ||
    joinModeRaw === "invite"
      ? joinModeRaw
      : null;
  const lastMessage = isApiObject(item.last_message) ? item.last_message : null;
  const lastMessageNormalized = lastMessage
    ? normalizeMessage(lastMessage)
    : null;
  const pinnedMessage = isApiObject(item.pinned_message)
    ? normalizeMessage(item.pinned_message)
    : null;
  // "yul: Photo" rather than "hey" - in a group the who matters as much as
  // the what, and what was sent matters when it was not words. Composed here
  // rather than read off the server's `preview` string, so the live socket
  // path can run the same code. Two implementations is what let them drift
  // apart once already.
  //
  // Falls back to the description only when there is genuinely nothing to
  // show, so an empty group still reads as itself rather than as a blank.
  const preview =
    (lastMessageNormalized &&
      composePreview(
        lastMessageNormalized.sender,
        // A deleted message has no text and no files, so describing it yields
        // an empty line and the row silently falls back to the Loop's
        // description - which reads as "this group has gone quiet" rather than
        // "the last thing said was taken back".
        lastMessageNormalized.deletedAt !== null
          ? DELETED_MESSAGE_TEXT
          : describeMessageBody(
              lastMessageNormalized.text,
              lastMessageNormalized.attachments,
            ),
      )) ||
    // asText's fallback only fires for a non-string, so an empty description
    // came through as an empty line rather than as this.
    asText(item.description) ||
    "No messages yet";

  return {
    id,
    kind: item.kind === "direct" ? "direct" : "group",
    name: asText(item.title, asText(item.name)),
    description: asText(item.description),
    mode,
    joinMode,
    logoImage: asText(item.image_url, asText(item.logo_image)) || null,
    settings: isApiObject(item.settings)
      ? normalizeGroupSettings(item.settings)
      : null,
    preview,
    lastMessageAt: lastMessageNormalized?.createdAt || null,
    unread:
      typeof item.unread_count === "number"
        ? item.unread_count
        : typeof item.unread === "number"
          ? item.unread
          : 0,
    muted: item.muted === true,
    archived: item.archived === true,
    cleared: item.cleared === true,
    smsNumber: normalizeGroupNumber(item.sms_number),
    isAdmin: isCurrentUserAdmin(item),
    features: Array.isArray(item.features)
      ? item.features.filter((key): key is string => typeof key === "string")
      : [],
    createdByUsername: isApiObject(item.created_by)
      ? asText((item.created_by as ApiObject).username) || undefined
      : undefined,
    participants: Array.isArray(item.participants)
      ? item.participants
          .map(normalizeParticipant)
          .filter(
            (participant): participant is ConversationParticipant =>
              participant !== null,
          )
      : [],
    pinnedMessage,
  };
}

function normalizeAttachment(item: ApiObject): ConversationAttachment | null {
  const url = item.url;
  if (typeof url !== "string") return null;

  return {
    id:
      typeof item.id === "string" || typeof item.id === "number"
        ? item.id
        : undefined,
    url,
    originalName: asText(item.original_name, "Attachment"),
    contentType: asText(item.content_type) || undefined,
    kind: item.kind === "image" ? "image" : "file",
  };
}

/**
 * The reply excerpt from a raw payload, or undefined.
 *
 * Exported because the websocket branch hand-derives its fields from the raw
 * snake_case frame rather than calling normalizeMessage - without this it would
 * grow a second, drifting copy of the same conversion.
 */
export function normalizeReplyTo(raw: unknown): MessageReplyTo | undefined {
  if (!isApiObject(raw)) return undefined;
  const id = raw.id;
  if (typeof id !== "string" && typeof id !== "number") return undefined;

  return {
    id,
    sender: asText(raw.sender, "Unknown"),
    text: asText(raw.text),
  };
}

function normalizeReactions(raw: unknown): MessageReaction[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter(isApiObject).flatMap((entry) => {
    const emoji = asText(entry.emoji);
    if (!emoji) return [];
    const usernames = Array.isArray(entry.usernames)
      ? entry.usernames.filter(
          (name): name is string => typeof name === "string",
        )
      : [];
    return [
      {
        emoji,
        // The server's count, not the list length: they agree today, and
        // trusting the count keeps the pill right if it ever caps the names.
        count: typeof entry.count === "number" ? entry.count : usernames.length,
        usernames,
      },
    ];
  });
}

/** Whether this viewer is among the people who left this reaction. */
export function hasReacted(
  reaction: MessageReaction,
  username: string | null,
): boolean {
  return username !== null && reaction.usernames.includes(username);
}

/**
 * A card off the wire, or undefined. Only a web link may open from it, and
 * only an https picture is shown - an http one on an https page is blocked.
 */
function normalizeLinkPreview(raw: unknown): LinkPreview | undefined {
  if (!isApiObject(raw)) return undefined;
  const url = asText(raw.url);
  if (!/^https?:\/\//i.test(url)) return undefined;
  const imageUrl = asText(raw.image_url);
  return {
    url,
    title: asText(raw.title) || null,
    description: asText(raw.description) || null,
    imageUrl: /^https:\/\//i.test(imageUrl) ? imageUrl : null,
    siteName: asText(raw.site_name) || null,
  };
}

function normalizeMentions(value: unknown): MessageMention[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isApiObject).flatMap((row) => {
    const participantId = row.participant_id;
    if (typeof participantId !== "number") return [];

    return [
      {
        participantId,
        userId: typeof row.user_id === "number" ? row.user_id : null,
        username: asText(row.username) || null,
        displayLabel: asText(row.display_label),
      },
    ];
  });
}

function normalizeMessage(item: ApiObject): ConversationMessage | null {
  const id = item.id;
  const conversationId = item.conversation;
  if (
    (typeof id !== "string" && typeof id !== "number") ||
    (typeof conversationId !== "string" && typeof conversationId !== "number")
  ) {
    return null;
  }

  const sender = item.sender;
  const senderObject = isApiObject(sender) ? sender : null;
  const senderName = senderLabelFrom(sender);
  const senderUsername = senderObject
    ? asText(senderObject.username) || undefined
    : typeof sender === "string"
      ? sender
      : undefined;

  const senderProfile =
    senderObject && isApiObject(senderObject.profile)
      ? senderObject.profile
      : null;

  const replyTo = normalizeReplyTo(item.reply_to);
  const reactions = normalizeReactions(item.reactions);
  const linkPreview = normalizeLinkPreview(item.link_preview);

  const rawSource = item.source;
  const source: MessageSource =
    rawSource === "sms" || rawSource === "email" || rawSource === "system"
      ? rawSource
      : "app";

  return {
    id,
    conversationId,
    source,
    ...(replyTo ? { replyTo } : {}),
    sender: senderName,
    senderUsername,
    // Null for anybody who texted in without an account - the serializer keeps
    // the key and empties it rather than dropping the whole sender object.
    senderAvatarUrl: senderProfile
      ? asText(senderProfile.avatar_url) || undefined
      : undefined,
    text: asText(item.text),
    createdAt: asText(item.created_at),
    mine: item.mine === true,
    reactions,
    forwarded: item.forwarded === true,
    mentions: normalizeMentions(item.mentions),
    mentionsEveryone: item.mentions_everyone === true,
    editedAt: asText(item.edited_at) || null,
    deletedAt: asText(item.deleted_at) || null,
    ...(linkPreview ? { linkPreview } : {}),
    attachments: Array.isArray(item.attachments)
      ? item.attachments
          .filter(isApiObject)
          .map(normalizeAttachment)
          .filter(
            (attachment): attachment is ConversationAttachment =>
              attachment !== null,
          )
      : [],
  };
}

function getObjectData(payload: unknown): ApiObject | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as ApiObject).data;
  return isApiObject(data) ? data : null;
}

function normalizeGroupSettings(item: ApiObject): GroupSettings {
  return {
    mode: item.mode === "broadcast" ? "broadcast" : "chat",
    join_mode:
      item.join_mode === "open" ||
      item.join_mode === "code" ||
      item.join_mode === "invite"
        ? item.join_mode
        : "approval",
    add_member_permission:
      item.add_member_permission === "members" ? "members" : "admins",
    edit_group_permission:
      item.edit_group_permission === "members" ? "members" : "admins",
    sms_delivery_enabled: item.sms_delivery_enabled !== false,
    sms_replies_enabled: item.sms_replies_enabled !== false,
    voice_messages_enabled: item.voice_messages_enabled === true,
    category: typeof item.category === "string" ? item.category : null,
    region: typeof item.region === "string" ? item.region : "",
  };
}

/**
 * A request carrying the access token, refreshed once if it has expired.
 *
 * The access token lasts thirty minutes and the refresh token thirty days,
 * so without this the app signed the user out every half hour and never once
 * used the refresh token it had been storing all along.
 *
 * Retried at most once. If the refresh itself fails the session really is
 * over - an expired or blacklisted refresh token is not something a second
 * attempt fixes - and only then does the 401 become a logout.
 */
export async function authorizedRequest(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error("You must be signed in to manage loops.");

  const send = (token: string) =>
    fetch(`${API_BASE_URL}${input}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });

  let response = await send(accessToken);
  let retried = false;

  if (response.status === 401) {
    const refreshed = await refreshTokens();
    const retryToken = refreshed ? getAccessToken() : null;
    if (retryToken) {
      response = await send(retryToken);
      retried = true;
    }
  }

  await handleUnauthorizedResponse(response, { alreadyRetried: retried });
  return response;
}

/**
 * JSON, or a form when there is a photo to carry - or to take away.
 *
 * `image` undefined leaves the photo alone; null removes it, sent as an empty
 * `image` field, which DRF reads back as null (`GroupSettingsSerializer`).
 *
 * No Content-Type on the form: the browser has to write the multipart boundary
 * into it, and naming the type here produces a body the server cannot split
 * back apart.
 */
function groupRequestBody(
  fields: ApiObject,
  image: File | null | undefined,
): Pick<RequestInit, "headers" | "body"> {
  if (image === undefined) {
    return {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    };
  }
  const form = groupForm(fields);
  form.append("image", image ?? "");
  return { body: form };
}

/**
 * A group's fields as the form DRF reads back into the same shape as the JSON.
 *
 * Multipart has no nesting, so it is spelled out in the keys: a list of
 * strings is the key repeated (`members`), a list of objects is indexed
 * (`invite[0]phone_number`), and an object is dotted (`settings.mode`). See
 * rest_framework/utils/html.py. Null is sent as "" - which DRF reads back as
 * null for any field that allows it - and undefined is left out, because
 * FormData would otherwise post the string "undefined".
 */
function groupForm(fields: ApiObject, form = new FormData(), prefix = "") {
  for (const [key, value] of Object.entries(fields)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isApiObject(item)) {
          for (const [field, inner] of Object.entries(item)) {
            if (inner !== undefined) {
              form.append(`${name}[${index}]${field}`, String(inner ?? ""));
            }
          }
        } else {
          form.append(name, String(item));
        }
      });
    } else if (isApiObject(value)) {
      groupForm(value, form, name);
    } else {
      form.append(name, value === null ? "" : String(value));
    }
  }
  return form;
}

/**
 * Create a group. On success, `conversationId` is the new Loop's ID - null
 * only if the response somehow carried none, since the Loop exists either way
 * and reporting a failure would invite creating it twice.
 */
export async function createConversation(
  payload: CreateConversationPayload,
): Promise<
  | { ok: true; conversationId: string | number | null }
  | { ok: false; message: string }
> {
  const body: ApiObject = {
    name: payload.name,
    settings: payload.settings,
  };
  if (payload.description) body.description = payload.description;
  if (payload.members?.length) body.members = payload.members;
  if (payload.invite?.length) body.invite = payload.invite;
  if (payload.invite_email?.length) body.invite_email = payload.invite_email;

  try {
    const response = await authorizedRequest("/chat/conversations/group/", {
      method: "POST",
      ...groupRequestBody(body, payload.image),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to create this Loop.",
      };
    }
    const id = getObjectData(data)?.id;
    return {
      ok: true,
      conversationId:
        typeof id === "string" || typeof id === "number" ? id : null,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * A page of the caller's conversations, most recently active first.
 *
 * Twenty a page server-side. This used to read `results` and drop `next`, so
 * a member of more than twenty groups could not reach the rest of them - and
 * once the search box became a filter over what was loaded, could not search
 * for them either.
 */
export async function fetchConversations(
  options: { page?: number } = {},
): Promise<
  | { ok: true; conversations: Conversation[]; hasMore: boolean }
  | { ok: false; message: string }
> {
  try {
    const suffix =
      options.page && options.page > 1 ? `?page=${options.page}` : "";
    const response = await authorizedRequest(`/chat/conversations/${suffix}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to load your Loops.",
      };
    }
    return {
      ok: true,
      conversations: getConversationItems(data)
        .map(normalizeConversation)
        .filter(
          (conversation): conversation is Conversation => conversation !== null,
        ),
      hasMore: hasNextPage(data),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * A group as somebody OUTSIDE it sees it, before deciding to join.
 *
 * Deliberately not a `Conversation`: this is the only shape a non-member
 * reads, and it carries what is needed to choose - name, purpose, size, and
 * how to get in - rather than anything belonging to the people already inside.
 */
export type DiscoverableGroup = {
  id: string | number;
  name: string;
  description: string;
  logoImage: string | null;
  memberCount: number;
  joinMode: JoinMode;
  mode: ConversationMode;
};

function normalizeDiscoverableGroup(item: ApiObject): DiscoverableGroup | null {
  const id = item.id;
  if ((typeof id !== "string" && typeof id !== "number") || !item.name) {
    return null;
  }

  const joinModeRaw = item.join_mode;
  // Invite-only never reaches here - the server does not return it - so
  // anything unrecognised is treated as the strictest mode we can offer,
  // never as "open".
  const joinMode: JoinMode =
    joinModeRaw === "open" ||
    joinModeRaw === "code" ||
    joinModeRaw === "approval"
      ? joinModeRaw
      : "approval";

  return {
    id,
    name: asText(item.name),
    description: asText(item.description),
    logoImage: asText(item.image_url) || null,
    memberCount: typeof item.member_count === "number" ? item.member_count : 0,
    joinMode,
    mode: item.mode === "broadcast" ? "broadcast" : "chat",
  };
}

/**
 * Search public groups. Returns [] for a term the server will not act on, so
 * the caller does not have to know the two-character rule.
 */
/**
 * Open the one-to-one conversation with somebody, creating it once.
 *
 * `identifier` is a username, a VERIFIED email address, or a phone number in
 * +E.164 form - the three things `user/lookups.py:find_user` resolves. The
 * verified part is not incidental: an unverified address or number is a string
 * somebody typed into their own profile, and matching on it would open a
 * private thread with whoever typed it rather than whoever owns it.
 *
 * Safe to call for a pair that already has one; the server returns the same
 * conversation rather than a second.
 *
 * The refusal text is passed through untouched. The API deliberately says two
 * different things - "You blocked this user. Unblock to message them." to the
 * person who made the block, and a plain "no user found" to everybody else,
 * including the person who was blocked - and rewording either here would undo
 * that.
 */
export async function startDirectConversation(
  identifier: string,
): Promise<
  { ok: true; conversationId: string | number } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest("/chat/conversations/direct/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });

    const body = (await response.json().catch(() => null)) as {
      data?: { id?: string | number; identifier?: string[] };
      message?: string;
    } | null;

    if (!response.ok) {
      // The field error, not the envelope's `message`: on a 400 the envelope
      // prefixes it with the field name ("identifier: No user found ..."),
      // and the sentence underneath is the one written to be read.
      return {
        ok: false,
        message:
          body?.data?.identifier?.[0] ??
          body?.message ??
          "Could not start that conversation.",
      };
    }

    const conversationId = body?.data?.id;
    if (conversationId === undefined) {
      return { ok: false, message: "Could not start that conversation." };
    }
    return { ok: true, conversationId };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function searchGroups(
  query: string,
): Promise<
  { ok: true; groups: DiscoverableGroup[] } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/search/?q=${encodeURIComponent(query)}`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to search groups.",
      };
    }
    return {
      ok: true,
      groups: getConversationItems(data)
        .map(normalizeDiscoverableGroup)
        .filter((group): group is DiscoverableGroup => group !== null),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function searchConversations(
  query: string,
): Promise<
  { ok: true; conversations: Conversation[] } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/search/?q=${encodeURIComponent(query)}`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to search Loops.",
      };
    }
    return {
      ok: true,
      conversations: getConversationItems(data)
        .map(normalizeConversation)
        .filter(
          (conversation): conversation is Conversation => conversation !== null,
        ),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function joinConversation(
  conversationId: string | number,
): Promise<
  | { ok: true; status: "joined"; conversation: Conversation }
  | { ok: true; status: "pending" }
  | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/join/`,
      { method: "POST" },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to join this Loop.",
      };
    }
    const conversationData = getObjectData(data);
    const normalized = conversationData
      ? normalizeConversation(conversationData)
      : null;
    return normalized
      ? { ok: true, status: "joined", conversation: normalized }
      : { ok: true, status: "pending" };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function fetchConversation(
  conversationId: string | number,
): Promise<
  { ok: true; conversation: Conversation } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/`,
    );
    const data = await response.json().catch(() => null);
    const conversation = getObjectData(data);
    const normalized = conversation
      ? normalizeConversation(conversation)
      : null;
    if (!response.ok || !normalized) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to load this conversation.",
      };
    }
    return { ok: true, conversation: normalized };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Buy this Loop the phone number it was created without. Admins only.
 *
 * One Loop, one number: a Loop that already has one gets it back and nothing
 * is bought. When none can be had the server says why - no provider, no
 * country for the creator, SMS switched off, or none for sale right now - and
 * that sentence is the message here, verbatim.
 */
export async function provisionGroupNumber(
  conversationId: string | number,
): Promise<
  { ok: true; conversation: Conversation } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/number/`,
      { method: "POST" },
    );
    const data = await response.json().catch(() => null);
    const conversationData = getObjectData(data);
    const normalized = conversationData
      ? normalizeConversation(conversationData)
      : null;
    if (!response.ok || !normalized) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to get this Loop a number.",
      };
    }
    return { ok: true, conversation: normalized };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Change a group: its name, description and photo, or its policy settings.
 *
 * The two halves are gated differently server-side. `edit_group_permission`
 * can let ordinary members change the name, description and photo; the
 * settings stay with admins regardless (`group.settings.policy`).
 */
export async function updateGroupSettings(
  conversationId: string | number,
  {
    image,
    ...payload
  }: {
    name?: string;
    description?: string;
    /**
     * A new photo, or null to remove it. Either sends the request as a form -
     * see `groupForm`.
     */
    image?: File | null;
    settings?: Partial<GroupSettings>;
  },
): Promise<
  { ok: true; conversation: Conversation } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/settings/`,
      { method: "PATCH", ...groupRequestBody(payload, image) },
    );
    const data = await response.json().catch(() => null);
    const conversationData = getObjectData(data);
    const normalized = conversationData
      ? normalizeConversation(conversationData)
      : null;
    if (!response.ok || !normalized) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to update Loop settings.",
      };
    }
    return { ok: true, conversation: normalized };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Add accounts, and invite addresses that have none, in one all-or-nothing
 * request. `inviteEmails` get an invitation to reply YES or sign up.
 */
export async function addConversationMembers(
  conversationId: string | number,
  members: string[],
  inviteEmails: string[] = [],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/members/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members, invite_email: inviteEmails }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to add members to this Loop.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function inviteConversationMemberByPhone(
  conversationId: string | number,
  invite: CreateConversationInvite,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/invite/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to send this invite.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function fetchJoinCode(
  conversationId: string | number,
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/join-code/`,
    );
    const data = await response.json().catch(() => null);
    const codeData = getObjectData(data);
    const code = codeData ? asText(codeData.join_code) : "";
    if (!response.ok || !code) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to load the join code.",
      };
    }
    return { ok: true, code };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function joinConversationWithCode(
  code: string,
): Promise<
  { ok: true; conversation: Conversation } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest("/chat/conversations/join/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => null);
    const conversationData = getObjectData(data);
    const normalized = conversationData
      ? normalizeConversation(conversationData)
      : null;
    if (!response.ok || !normalized) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to join this Loop.",
      };
    }
    return { ok: true, conversation: normalized };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

// Loops can have well over 100 participants and the API paginates this
// endpoint, so a single page is not enough to build the full member list.
// Walk pages until the API returns a short (or empty) page, with a hard cap so
// a misbehaving backend (e.g. one that never returns a short page) can't spin
// this into an unbounded loop.
//
// This used to derive `isAdmin` on the way past, because no single response
// carried it. The server answers that now - `is_admin` and `features` both
// ride on the conversation itself - so the walk is only about members.
const MAX_PARTICIPANT_PAGES = 50;

export async function fetchConversationParticipants(
  conversationId: string | number,
  options: { size?: number } = {},
): Promise<
  | { ok: true; participants: ConversationParticipant[] }
  | { ok: false; message: string }
> {
  try {
    const size = options.size ?? 100;

    const participants: ConversationParticipant[] = [];
    let page = 1;

    for (; page <= MAX_PARTICIPANT_PAGES; page++) {
      const response = await authorizedRequest(
        // `page_size`, the name ParticipantPagination reads. It ignored
        // `size` and served its default of 10, which the short-page check
        // below then took for the last page - so no Loop showed an 11th member.
        `/chat/conversations/${conversationId}/participants/?page=${page}&page_size=${size}`,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          message: getErrorMessage(data) ?? "Unable to load members.",
        };
      }

      const items = getConversationItems(data);

      participants.push(
        ...items
          .map(normalizeParticipant)
          .filter(
            (participant): participant is ConversationParticipant =>
              participant !== null,
          ),
      );

      if (items.length < size) break;
    }

    return { ok: true, participants };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function fetchJoinRequests(
  conversationId: string | number,
): Promise<
  | { ok: true; requests: ConversationParticipant[] }
  | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/requests/`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to load pending requests.",
      };
    }
    return {
      ok: true,
      requests: getConversationItems(data)
        .map(normalizeParticipant)
        .filter(
          (participant): participant is ConversationParticipant =>
            participant !== null,
        ),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function respondToJoinRequest(
  conversationId: string | number,
  participantId: string | number,
  decision: "approve" | "decline",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/requests/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant: participantId, decision }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to update this request.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function updateMemberRole(
  conversationId: string | number,
  participantId: string | number,
  role: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/role/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant: participantId, role }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message:
          getErrorMessage(data) ?? "Unable to update this member's role.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Somebody who turned up in the add-members search, and what adding them
 * would do - so the list can say "already here" or "doesn't accept group
 * adds" before anybody is picked, rather than the add failing afterwards.
 */
export type MemberCandidate = {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
  status: "ready" | "already_member" | "refused";
  /** Why they cannot be added, in the server's words. Empty when ready. */
  detail: string;
};

/**
 * A whole address that found nobody, offered as an email invitation. Its
 * status reads like a person's: already invited, blocked here, or ready.
 */
export type EmailInvite = {
  email: string;
  status: MemberCandidate["status"];
  detail: string;
};

const CANDIDATE_STATUSES = ["ready", "already_member", "refused"];

/**
 * People an admin could add to this Loop, found by what they typed.
 *
 * The server's rules, not a gap here: a username matches by prefix, an email
 * or a number only in full - a prefix over addresses would let anybody walk
 * the directory a letter at a time. At most a handful come back; `hasMore`
 * says there were more, so the answer is to keep typing.
 */
export async function searchMemberCandidates(
  conversationId: string | number,
  term: string,
): Promise<
  | {
      ok: true;
      candidates: MemberCandidate[];
      hasMore: boolean;
      invite: EmailInvite | null;
    }
  | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/members/search/?q=${encodeURIComponent(term.trim())}`,
    );
    const data = await response.json().catch(() => null);
    const payload = getObjectData(data);
    const rows =
      payload && Array.isArray(payload.results) ? payload.results : null;
    if (!response.ok || !payload || !rows) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Search failed.",
      };
    }
    return {
      ok: true,
      candidates: rows
        .filter(isApiObject)
        .map(normalizeCandidate)
        .filter((row): row is MemberCandidate => row !== null),
      hasMore: payload.has_more === true,
      invite: normalizeInvite(payload.invite),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

function normalizeInvite(raw: unknown): EmailInvite | null {
  if (!isApiObject(raw)) return null;
  const email = asText(raw.email);
  if (!email) return null;
  const status = asText(raw.status);
  return {
    email,
    status: CANDIDATE_STATUSES.includes(status)
      ? (status as EmailInvite["status"])
      : "refused",
    detail: asText(raw.detail),
  };
}

function normalizeCandidate(raw: ApiObject): MemberCandidate | null {
  const user = isApiObject(raw.user) ? raw.user : null;
  const username = user ? asText(user.username) : "";
  if (!user || !username) return null;
  const profile = isApiObject(user.profile) ? user.profile : null;
  const status = asText(raw.status);
  return {
    id: String(user.id),
    username,
    name: (profile && asText(profile.display_label)) || username,
    avatarUrl: (profile && asText(profile.avatar_url)) || undefined,
    // An answer this client does not know is not a yes.
    status: CANDIDATE_STATUSES.includes(status)
      ? (status as MemberCandidate["status"])
      : "refused",
    detail: asText(raw.detail),
  };
}

/**
 * Ask a member again about an invitation they never answered.
 *
 * Admin-only and rate limited server-side to once a day per channel. The
 * server refuses anybody who has already answered - agreed, declined, or sent
 * STOP - so the refusal message is worth showing verbatim rather than
 * flattening to "that did not work".
 */
export async function nudgeConversationMember(
  conversationId: string | number,
  participantId: string | number,
  channel: "sms" | "email" | "voice" = "sms",
): Promise<
  | { ok: true; participant: ConversationParticipant }
  | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/nudge/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant: participantId, channel }),
      },
    );
    const data = await response.json().catch(() => null);
    const payload = getObjectData(data);
    const participant = payload ? normalizeParticipant(payload) : null;
    if (!response.ok || !participant) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to send that reminder.",
      };
    }
    return { ok: true, participant };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function removeConversationMember(
  conversationId: string | number,
  participantId: string | number,
  block: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/remove/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant: participantId, block }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to remove this member.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Mark a conversation read, optionally only up to a given message.
 *
 * Fire-and-forget by design: the badge is already cleared optimistically, and
 * a failed read is corrected by the next fetch. Blocking the UI on it, or
 * surfacing an error for it, would be noise for something nobody asked for.
 */
export async function markConversationRead(
  conversationId: string | number,
  messageId?: string | number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/read/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          messageId === undefined ? {} : { message_id: Number(messageId) },
        ),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to mark as read.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Tidy a conversation out of this member's list, or bring it back.
 *
 * Not leaving and not muting: they stay in the group and every channel keeps
 * delivering. Only which list it appears in changes.
 */
export async function setConversationArchived(
  conversationId: string | number,
  archived: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/archive/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to update this Loop.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Silence a conversation for this member, on every channel.
 *
 * The same switch texting MUTE sets, and the one the SMS fan-out checks - so
 * muting here stops the texts too, not just the in-app noise.
 */
export async function setConversationMuted(
  conversationId: string | number,
  muted: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/delivery/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted }),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to update this Loop.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Empty this member's own view of a conversation.
 *
 * Not leaving, and not deleting it for anybody else: they stay in the group,
 * and their history simply restarts after the newest message. It drops out of
 * their list while there is nothing to show, and returns on its own when
 * somebody posts - carrying only what arrived after.
 */
export async function clearConversationHistory(
  conversationId: string | number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/clear/`,
      { method: "POST" },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to clear this chat.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function leaveConversation(
  conversationId: string | number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/leave/`,
      { method: "POST" },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to leave this Loop.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Delete a group for EVERYONE, and release its phone number.
 *
 * Not the same thing as the "Delete chat" row action, which clears your own
 * view and leaves the group standing. This is the admin-only one the server
 * guards: a group is deleted for every member, and a pre_delete signal gives
 * the number back - a number that outlives its group is one nobody is watching
 * and everybody is still paying for.
 *
 * Answers 204 with no body, so there is nothing to parse on success.
 */
export async function deleteConversation(
  conversationId: string | number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to delete this Loop.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/** True when a DRF paginated envelope reports another page after this one. */
function hasNextPage(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = (payload as ApiObject).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Boolean((data as ApiObject).next);
}

export type MessageHistoryOptions = {
  // 1-based page of newest-first history. PAGE_SIZE is 20 server-side, so
  // page 1 is the newest 20, page 2 the twenty before those, and so on.
  page?: number;
  // Resume cursor: return only messages newer than this id, oldest-first.
  // Used after a dropped socket to fetch just what was missed. Mutually
  // exclusive with `page` - the server ignores paging semantics here.
  afterId?: string | number;
};

export async function fetchMessageHistory(
  conversationId: string | number,
  options: MessageHistoryOptions = {},
): Promise<
  | { ok: true; messages: ConversationMessage[]; hasMore: boolean }
  | { ok: false; message: string }
> {
  try {
    const query = new URLSearchParams();
    if (options.afterId !== undefined) {
      query.set("after_id", String(options.afterId));
    } else if (options.page && options.page > 1) {
      query.set("page", String(options.page));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";

    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/messages/${suffix}`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to load message history.",
      };
    }

    const items = getConversationItems(data)
      .map(normalizeMessage)
      .filter((message): message is ConversationMessage => message !== null);

    return {
      ok: true,
      // Default history comes back newest-first and is reversed into reading
      // order. The after_id branch is already ascending server-side (it is
      // built for appending), so reversing it would put it backwards.
      messages: options.afterId !== undefined ? items : items.reverse(),
      hasMore: hasNextPage(data),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

// -- acting on one message -------------------------------------------------
//
// Every route hangs off the conversation, never a bare /messages/<id>/: the
// conversation id is what proves membership before the message is looked up.
// See ConversationViewSet, where the same rule is enforced.

const MESSAGE_ROUTE = (
  conversationId: string | number,
  messageId: string | number,
  suffix = "",
) => `/chat/conversations/${conversationId}/messages/${messageId}/${suffix}`;

type MessageResult =
  { ok: true; message: ConversationMessage } | { ok: false; message: string };

type ConversationResult =
  { ok: true; conversation: Conversation } | { ok: false; message: string };

/**
 * Every per-message route answers with the message in its new state, so one
 * reader serves all of them and the caller always gets back something it can
 * swap straight into the thread.
 */
async function requestMessage(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<MessageResult> {
  try {
    const response = await authorizedRequest(path, init);
    const data = await response.json().catch(() => null);
    const payload = getObjectData(data);
    const message = payload ? normalizeMessage(payload) : null;
    if (!response.ok || !message) {
      return { ok: false, message: getErrorMessage(data) ?? fallback };
    }
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

/**
 * Add or remove your own reaction.
 *
 * Both directions are idempotent on the server, so a retry after a dropped
 * response cannot flip the state back - which a single toggle endpoint could
 * not have promised.
 */
export async function setMessageReaction(
  conversationId: string | number,
  messageId: string | number,
  emoji: string,
  reacted: boolean,
): Promise<MessageResult> {
  const path = MESSAGE_ROUTE(conversationId, messageId, "reactions/");

  return reacted
    ? requestMessage(
        // The emoji rides in the query string: a DELETE with a body is
        // unevenly supported by proxies, and one value fits in a parameter.
        `${path}?emoji=${encodeURIComponent(emoji)}`,
        { method: "DELETE" },
        "Unable to remove that reaction.",
      )
    : requestMessage(
        path,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
        "Unable to add that reaction.",
      );
}

/**
 * Change the words of a message you sent.
 *
 * In-app only. A copy already delivered by SMS or email cannot be recalled, so
 * the UI must not imply this reaches the phone that already has the original.
 */
export async function editConversationMessage(
  conversationId: string | number,
  messageId: string | number,
  text: string,
  /**
   * The edited words name whoever the edited words name, so an edit re-states
   * the mentions - taking "@Bob" out of the sentence has to take Bob out of
   * the mentions. Left off entirely, the message keeps the ones it has.
   */
  mentionIds?: number[],
  mentionEveryone?: boolean,
): Promise<MessageResult> {
  return requestMessage(
    MESSAGE_ROUTE(conversationId, messageId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        ...(mentionIds !== undefined ? { mentions: mentionIds } : {}),
        ...(mentionEveryone !== undefined
          ? { mention_everyone: mentionEveryone }
          : {}),
      }),
    },
    "Unable to edit this message.",
  );
}

/**
 * Delete a message for everyone.
 *
 * Answers with the message rather than nothing: it stays in the thread as a
 * tombstone, so the caller has something to render in its place.
 */
export async function deleteConversationMessage(
  conversationId: string | number,
  messageId: string | number,
): Promise<MessageResult> {
  return requestMessage(
    MESSAGE_ROUTE(conversationId, messageId),
    { method: "DELETE" },
    "Unable to delete this message.",
  );
}

/**
 * Pass a message along to another conversation.
 *
 * Posted to the DESTINATION, so the same membership and posting rules that
 * guard an ordinary send guard this too. The words come from the original on
 * the server - anything sent here would be ignored.
 */
export async function forwardConversationMessage(
  targetConversationId: string | number,
  messageId: string | number,
): Promise<MessageResult> {
  return requestMessage(
    `/chat/conversations/${targetConversationId}/messages/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forward_from: messageId }),
    },
    "Unable to forward this message.",
  );
}

/**
 * Hold one message above the thread, or let it go.
 *
 * Answers with the CONVERSATION, not the message: the pin lives on the
 * conversation, and everyone else learns about it through the
 * `conversation.updated` broadcast.
 */
export async function setPinnedMessage(
  conversationId: string | number,
  messageId: string | number,
  pinned: boolean,
): Promise<ConversationResult> {
  try {
    const response = await authorizedRequest(
      MESSAGE_ROUTE(conversationId, messageId, "pin/"),
      { method: pinned ? "POST" : "DELETE" },
    );
    const data = await response.json().catch(() => null);
    const payload = getObjectData(data);
    const conversation = payload ? normalizeConversation(payload) : null;
    if (!response.ok || !conversation) {
      return {
        ok: false,
        message:
          getErrorMessage(data) ??
          (pinned ? "Unable to pin this message." : "Unable to unpin this."),
      };
    }
    return { ok: true, conversation };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function sendConversationMessage(
  conversationId: string | number,
  text: string,
  attachments: File[] = [],
  /**
   * The message being answered. The server checks it belongs to this
   * conversation - see MessageCreateSerializer.validate_reply_to - so a wrong
   * id is refused rather than quoted.
   */
  replyToId?: string | number | null,
  /**
   * Membership ids the composer offered and the sender picked. The server
   * drops any that are not an active member of THIS conversation, so a stale
   * id costs a highlight rather than the message.
   */
  mentionIds: number[] = [],
  mentionEveryone = false,
): Promise<
  { ok: true; message: ConversationMessage } | { ok: false; message: string }
> {
  try {
    const hasAttachments = attachments.length > 0;
    const request: RequestInit = {
      method: "POST",
      body: hasAttachments
        ? (() => {
            const formData = new FormData();
            if (text.trim()) formData.append("text", text.trim());
            attachments.forEach((file) => formData.append("attachments", file));
            // FormData carries strings; DRF's IntegerField parses it back.
            if (replyToId != null) {
              formData.append("reply_to", String(replyToId));
            }
            // Repeated keys, which is how a ListField reads a multipart body.
            mentionIds.forEach((id) => {
              formData.append("mentions", String(id));
            });
            if (mentionEveryone) formData.append("mention_everyone", "true");
            return formData;
          })()
        : JSON.stringify({
            text: text.trim(),
            ...(replyToId != null ? { reply_to: replyToId } : {}),
            ...(mentionIds.length > 0 ? { mentions: mentionIds } : {}),
            ...(mentionEveryone ? { mention_everyone: true } : {}),
          }),
    };
    if (!hasAttachments) {
      request.headers = { "Content-Type": "application/json" };
    }

    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/messages/`,
      request,
    );
    const data = await response.json().catch(() => null);
    const messageData = getObjectData(data);
    const message = messageData ? normalizeMessage(messageData) : null;
    if (!response.ok || !message) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to send this message.",
      };
    }
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}
