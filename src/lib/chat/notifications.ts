/**
 * The activity feed: the things that happened to you.
 *
 * Deliberately no message notifications - Chats and Broadcast already carry
 * unread badges from `unread_count`, and a second count of the same thing is a
 * second thing to keep in agreement.
 */
import { authorizedRequest, type JoinMode } from "@/lib/chat/conversations";

export type NotificationType =
  | "member.added"
  | "member.removed"
  | "role.granted"
  | "role.revoked"
  | "join.requested"
  | "join.approved"
  | "join.declined"
  | "group.mode_changed"
  | "sms.opted_out"
  | "sms.opted_in"
  | "sms.send_failed"
  | "sms.invite_pending"
  | "general";

export type NotificationCategory =
  "groups" | "invites" | "sms" | "account" | "general";

/** Where the recipient stands in the conversation right now, if anywhere. */
export type ViewerStatus =
  "active" | "pending" | "left" | "removed" | "blocked" | null;

export type AppNotification = {
  id: number;
  type: NotificationType;
  category: NotificationCategory;
  actorName: string | null;
  conversationId: string | number | null;
  conversationName: string | null;
  // How a stranger gets into that group, which is what decides what the
  // detail panel can offer somebody who is not in it yet.
  joinMode: JoinMode | null;
  // Computed live by the server, not recorded with the event: the row is
  // about the past, the action has to be about now.
  viewerStatus: ViewerStatus;
  // For a join request: where THAT request stands now, so the panel can stop
  // offering to answer one somebody has already answered.
  requestStatus: ViewerStatus;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStatus(value: unknown): ViewerStatus {
  return value === "active" ||
    value === "pending" ||
    value === "left" ||
    value === "removed" ||
    value === "blocked"
    ? value
    : null;
}

function normalize(item: unknown): AppNotification | null {
  const row = asRecord(item);
  if (!row || typeof row.id !== "number") return null;

  const actor = asRecord(row.from_user);
  const profile = actor ? asRecord(actor.profile) : null;
  // The display label is what the rest of the app renders; fall back to the
  // username, then to the name carried on `data` for a phone-only member who
  // has no account to have a label at all.
  const data = asRecord(row.data);
  const actorName =
    (typeof profile?.display_label === "string" && profile.display_label) ||
    (typeof actor?.username === "string" && actor.username) ||
    (typeof data?.display_name === "string" && data.display_name) ||
    null;

  return {
    id: row.id,
    type: (row.type as NotificationType) ?? "general",
    category: (row.category as NotificationCategory) ?? "general",
    actorName,
    conversationId:
      typeof row.conversation === "string" ||
      typeof row.conversation === "number"
        ? row.conversation
        : null,
    conversationName:
      typeof row.conversation_name === "string" ? row.conversation_name : null,
    joinMode:
      row.conversation_join_mode === "open" ||
      row.conversation_join_mode === "code" ||
      row.conversation_join_mode === "approval" ||
      row.conversation_join_mode === "invite"
        ? row.conversation_join_mode
        : null,
    viewerStatus: asStatus(row.viewer_status),
    requestStatus: asStatus(row.request_status),
    data,
    readAt: typeof row.read_at === "string" ? row.read_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export type NotificationPage = {
  notifications: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
};

export async function fetchNotifications(
  options: { category?: string; unreadOnly?: boolean; page?: number } = {},
): Promise<
  { ok: true; page: NotificationPage } | { ok: false; message: string }
> {
  try {
    const query = new URLSearchParams();
    if (options.category && options.category !== "all") {
      query.set("category", options.category);
    }
    if (options.unreadOnly) query.set("unread", "1");
    if (options.page && options.page > 1) {
      query.set("page", String(options.page));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";

    const response = await authorizedRequest(`/chat/notifications/${suffix}`);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, message: "Unable to load activity." };
    }

    const data = asRecord(asRecord(body)?.data);
    const results = Array.isArray(data?.results) ? data.results : [];

    return {
      ok: true,
      page: {
        notifications: results
          .map(normalize)
          .filter((row): row is AppNotification => row !== null),
        unreadCount:
          typeof data?.unread_count === "number" ? data.unread_count : 0,
        hasMore: Boolean(data?.next),
      },
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

/** Mark specific notifications read, or every unread one when `ids` is omitted. */
export async function markNotificationsRead(
  ids?: number[],
): Promise<{ ok: true; unreadCount: number } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest("/chat/notifications/read/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids && ids.length ? { ids } : {}),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, message: "Unable to mark activity as read." };
    }
    const data = asRecord(asRecord(body)?.data);
    return {
      ok: true,
      unreadCount:
        typeof data?.unread_count === "number" ? data.unread_count : 0,
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

export { normalize as normalizeNotification };
