import {
  getAccessToken,
  getSession,
  handleUnauthorizedResponse,
} from "@/lib/auth/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type JoinMode = "open" | "code" | "approval" | "invite";
export type ConversationMode = "chat" | "broadcast";
export type GroupMemberPermission = "members" | "admins";

export type GroupSettings = {
  mode: ConversationMode;
  join_mode: JoinMode;
  add_member_permission: GroupMemberPermission;
  edit_group_permission: GroupMemberPermission;
  sms_delivery_enabled: boolean;
  sms_replies_enabled: boolean;
  voice_messages_enabled: boolean;
};

export type CreateConversationInvite = {
  phone_number: string;
  display_name?: string;
};

export type CreateConversationPayload = {
  name: string;
  description?: string;
  members?: string[];
  invite?: CreateConversationInvite[];
  settings: GroupSettings;
};

export type Conversation = {
  id: string | number;
  name: string;
  description: string;
  mode: ConversationMode;
  joinMode: JoinMode | null;
  logoImage: string | null;
  settings: GroupSettings | null;
  preview: string;
  unread: number;
  isAdmin: boolean;
  active?: boolean;
  participants: ConversationParticipant[];
};

export type ConversationParticipant = {
  id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  role: "admin" | "moderator" | "member";
  joinedAt: string;
  isBlocked?: boolean;
  lastActive?: string;
};

export type ConversationAttachment = {
  id?: string | number;
  url: string;
  originalName: string;
  contentType?: string;
};

export type ConversationMessage = {
  id: string | number;
  conversationId: string | number;
  sender: string;
  senderUsername?: string;
  text: string;
  createdAt: string;
  attachments: ConversationAttachment[];
  mine: boolean;
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

export function normalizeParticipant(
  item: unknown,
): ConversationParticipant | null {
  if (!isApiObject(item)) return null;
  const user = isApiObject(item.user) ? item.user : item;
  // The membership row's own id, not the account's - every action endpoint
  // (remove/role/requests) looks a participant up by Participant.pk, and
  // that differs from the user's id as soon as an account has more than one
  // membership. When item IS the user object (no nested `user` key), this is
  // the same value user.id would have given, so the fallback path is unaffected.
  const id = item.id;
  if (typeof id !== "string" && typeof id !== "number") return null;
  const profile = isApiObject(user.profile) ? user.profile : user;
  const username = asText(user.username) || undefined;
  const name = asText(
    user.display_label,
    asText(profile.display_label, username ?? "Member"),
  );
  const role =
    item.role === "admin" || item.role === "moderator" ? item.role : "member";

  return {
    id: String(id),
    name,
    username,
    email: asText(user.email) || undefined,
    phone: asText(user.phone_number, asText(user.phone)) || undefined,
    role,
    joinedAt: asText(item.joined_at, "Recently"),
    isBlocked: item.is_blocked === true,
    lastActive: asText(profile.last_seen_at) || undefined,
  };
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

function normalizeConversation(item: ApiObject): Conversation | null {
  const id = item.id;
  if ((typeof id !== "string" && typeof id !== "number") || !item.name) {
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
  const preview = asText(
    lastMessage?.text,
    asText(item.description, "New Loop"),
  );

  return {
    id,
    name: asText(item.title, asText(item.name)),
    description: asText(item.description),
    mode,
    joinMode,
    logoImage: asText(item.image_url, asText(item.logo_image)) || null,
    settings: isApiObject(item.settings)
      ? normalizeGroupSettings(item.settings)
      : null,
    preview,
    unread:
      typeof item.unread_count === "number"
        ? item.unread_count
        : typeof item.unread === "number"
          ? item.unread
          : 0,
    isAdmin: isCurrentUserAdmin(item),
    participants: Array.isArray(item.participants)
      ? item.participants
          .map(normalizeParticipant)
          .filter(
            (participant): participant is ConversationParticipant =>
              participant !== null,
          )
      : [],
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
  };
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
  const senderProfile =
    senderObject && isApiObject(senderObject.profile)
      ? senderObject.profile
      : senderObject;
  const senderName = senderObject
    ? asText(
        senderObject.display_label,
        asText(
          senderProfile?.display_label,
          asText(senderObject.username, "Unknown"),
        ),
      )
    : asText(sender, "Unknown");
  const senderUsername = senderObject
    ? asText(senderObject.username) || undefined
    : typeof sender === "string"
      ? sender
      : undefined;

  return {
    id,
    conversationId,
    sender: senderName,
    senderUsername,
    text: asText(item.text),
    createdAt: asText(item.created_at),
    mine: item.mine === true,
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
  };
}

async function authorizedRequest(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error("You must be signed in to manage loops.");

  const response = await fetch(`${API_BASE_URL}${input}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  await handleUnauthorizedResponse(response);
  return response;
}

export async function createConversation(
  payload: CreateConversationPayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body: ApiObject = {
    name: payload.name,
    settings: payload.settings,
  };
  if (payload.description) body.description = payload.description;
  if (payload.members?.length) body.members = payload.members;
  if (payload.invite?.length) body.invite = payload.invite;

  try {
    const response = await authorizedRequest("/chat/conversations/group/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to create this Loop.",
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

export async function fetchConversations(): Promise<
  { ok: true; conversations: Conversation[] } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest("/chat/conversations/");
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

export async function updateGroupSettings(
  conversationId: string | number,
  payload: {
    name?: string;
    description?: string;
    settings?: Partial<GroupSettings>;
  },
): Promise<
  { ok: true; conversation: Conversation } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/settings/`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
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

export async function addConversationMembers(
  conversationId: string | number,
  members: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/members/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
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

// Loops can have well over 100 participants, and the API paginates this
// endpoint, so a single page is not enough to build either the full member
// list or an accurate isAdmin check for the requesting user. Walk pages
// until the API returns a short (or empty) page, with a hard cap so a
// misbehaving backend (e.g. one that never returns a short page) can't spin
// this into an unbounded loop.
const MAX_PARTICIPANT_PAGES = 50;

export async function fetchConversationParticipants(
  conversationId: string | number,
  options: { size?: number } = {},
): Promise<
  | { ok: true; participants: ConversationParticipant[]; isAdmin: boolean }
  | { ok: false; message: string }
> {
  try {
    const size = options.size ?? 100;
    const currentUsername = getSession();

    const participants: ConversationParticipant[] = [];
    let isAdmin = false;
    let page = 1;

    for (; page <= MAX_PARTICIPANT_PAGES; page++) {
      const response = await authorizedRequest(
        `/chat/conversations/${conversationId}/participants/?page=${page}&size=${size}`,
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

      if (!isAdmin && currentUsername != null) {
        isAdmin = items.some((item) => {
          if (!isApiObject(item) || item.role !== "admin") return false;
          const user = isApiObject(item.user) ? item.user : item;
          return asText(user.username) === currentUsername;
        });
      }

      if (items.length < size) break;
    }

    return { ok: true, participants, isAdmin };
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

export async function fetchMessageHistory(
  conversationId: string | number,
): Promise<
  { ok: true; messages: ConversationMessage[] } | { ok: false; message: string }
> {
  try {
    const response = await authorizedRequest(
      `/chat/conversations/${conversationId}/messages/`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(data) ?? "Unable to load message history.",
      };
    }

    const items = getConversationItems(data);
    return {
      ok: true,
      messages: items
        .map(normalizeMessage)
        .filter((message): message is ConversationMessage => message !== null)
        .reverse(),
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

export async function sendConversationMessage(
  conversationId: string | number,
  text: string,
  attachments: File[] = [],
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
            return formData;
          })()
        : JSON.stringify({ text: text.trim() }),
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
