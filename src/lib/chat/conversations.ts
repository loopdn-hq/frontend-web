import { getAccessToken } from "@/lib/auth/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type JoiningMethod = "open" | "code" | "admin_approval" | "invite_only";
export type CommunicationMode = "chat" | "broadcast";
export type BroadcastReplyMode = "private" | "group_wide" | "disabled";

export type CreateConversationPayload = {
  name: string;
  description: string;
  joining_method: JoiningMethod;
  communication_mode: CommunicationMode;
  broadcast_reply_mode?: BroadcastReplyMode;
  image?: File;
};

export type Conversation = {
  id: string | number;
  name: string;
  description: string;
  preview: string;
  unread: number;
  isAdmin: boolean;
  communicationMode: CommunicationMode;
  active?: boolean;
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
  }
  return [];
}

function isApiObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeConversation(item: ApiObject): Conversation | null {
  const id = item.id;
  if ((typeof id !== "string" && typeof id !== "number") || !item.name) {
    return null;
  }

  const communicationMode =
    item.communication_mode === "broadcast" ? "broadcast" : "chat";
  const preview = asText(
    item.last_message,
    asText(item.description, "New Loop"),
  );

  return {
    id,
    name: asText(item.name),
    description: asText(item.description),
    preview,
    unread:
      typeof item.unread_count === "number"
        ? item.unread_count
        : typeof item.unread === "number"
          ? item.unread
          : 0,
    isAdmin: item.is_admin === true || item.role === "admin",
    communicationMode,
  };
}

async function authorizedRequest(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error("You must be signed in to manage loops.");

  return fetch(`${API_BASE_URL}${input}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
}

export async function createConversation(
  payload: CreateConversationPayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("name", payload.name);
  body.append("description", payload.description);
  body.append("joining_method", payload.joining_method);
  body.append("communication_mode", payload.communication_mode);
  if (
    payload.communication_mode === "broadcast" &&
    payload.broadcast_reply_mode
  ) {
    body.append("broadcast_reply_mode", payload.broadcast_reply_mode);
  }
  if (payload.image) body.append("image", payload.image);

  try {
    const response = await authorizedRequest("/chat/conversations/group/", {
      method: "POST",
      body,
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
    const response = await authorizedRequest("/chat/conversations");
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
