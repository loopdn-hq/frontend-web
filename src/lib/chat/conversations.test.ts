import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client", () => ({
  getAccessToken: vi.fn(),
  getSession: vi.fn(),
  handleUnauthorizedResponse: vi.fn(),
  refreshTokens: vi.fn(),
}));

import {
  getAccessToken,
  getSession,
  handleUnauthorizedResponse,
  refreshTokens,
} from "@/lib/auth/client";
import {
  addConversationMembers,
  authorizedRequest,
  clearConversationHistory,
  conversationMode,
  createConversation,
  deleteConversation,
  deleteConversationMessage,
  directCounterpart,
  editConversationMessage,
  fetchBlockedMembers,
  fetchConversation,
  fetchConversationParticipants,
  fetchConversations,
  fetchJoinCode,
  fetchJoinRequests,
  fetchMessageHistory,
  forwardConversationMessage,
  hasReacted,
  inviteConversationMemberByPhone,
  joinConversation,
  joinConversationWithCode,
  leaveConversation,
  markConversationRead,
  mergeConversations,
  normalizeConversationPayload,
  normalizeMessagePayload,
  normalizeParticipant,
  normalizeReplyTo,
  nudgeConversationMember,
  provisionGroupNumber,
  removeConversationMember,
  respondToJoinRequest,
  searchConversations,
  searchGroups,
  searchMemberCandidates,
  sendConversationMessage,
  setConversationArchived,
  setConversationMuted,
  setMessageReaction,
  setPinnedMessage,
  startDirectConversation,
  unblockConversationMember,
  updateGroupSettings,
  updateMemberRole,
  type Conversation,
  type GroupSettings,
} from "@/lib/chat/conversations";
import { setHttp } from "@/lib/config/http";
import { brokenResponse, jsonResponse } from "@/test/helpers";

const http = vi.fn();

function respond(status: number, body: unknown) {
  http.mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [url, init] = http.mock.calls.at(-1)!;
  const request = (init ?? {}) as RequestInit;
  return {
    url: url as string,
    method: request.method,
    headers: request.headers as Record<string, string>,
    raw: request.body,
    body:
      typeof request.body === "string" ? JSON.parse(request.body) : undefined,
  };
}

/**
 * Every call here fails the same four ways: the server's sentence, the
 * call's own fallback, a thrown error's message, and a generic network line.
 */
async function expectFailures(
  call: () => Promise<{ ok: boolean; message?: unknown }>,
  fallback: string,
) {
  respond(400, { message: "The server said no." });
  expect(await call()).toEqual({ ok: false, message: "The server said no." });

  http.mockResolvedValue(brokenResponse(500));
  expect(await call()).toEqual({ ok: false, message: fallback });

  http.mockRejectedValue(new Error("Connection reset."));
  expect(await call()).toEqual({ ok: false, message: "Connection reset." });

  http.mockRejectedValue("not an error");
  expect(await call()).toEqual({
    ok: false,
    message: "Network error. Please try again.",
  });
}

const SAM = {
  id: 7,
  username: "sam",
  email: "sam@example.com",
  phone_number: "+14155552671",
  blocked_by_me: true,
  profile: {
    display_label: "Sam Wren",
    avatar_url: "https://cdn/sam.png",
    is_online: true,
    last_seen_at: "2026-10-05T11:00:00Z",
  },
};

const MESSAGE = {
  id: 501,
  conversation: 12,
  sender: SAM,
  text: "See you at 6",
  created_at: "2026-10-05T12:00:00Z",
  mine: true,
  forwarded: true,
  source: "sms",
  edited_at: "2026-10-05T12:01:00Z",
  deleted_at: null,
  mentions_everyone: true,
  reply_to: { id: 500, sender: "Alex", text: "When?" },
  reactions: [
    { emoji: "👍", count: 2, usernames: ["sam", "alex", 4] },
    { emoji: "❤️", usernames: ["sam"] },
    { usernames: ["nobody"] },
    "junk",
  ],
  link_preview: {
    url: "https://example.com/a",
    title: "A page",
    description: "",
    image_url: "http://insecure/img.png",
    site_name: "Example",
  },
  mentions: [
    { participant_id: 3, user_id: 8, username: "alex", display_label: "Alex" },
    { participant_id: 4 },
    { participant_id: "x" },
    null,
  ],
  attachments: [
    {
      id: 9,
      url: "https://cdn/a.png",
      original_name: "a.png",
      content_type: "image/png",
      kind: "image",
    },
    { url: "https://cdn/b.bin" },
    { original_name: "no url" },
    "junk",
  ],
};

const SETTINGS = {
  mode: "broadcast",
  join_mode: "code",
  add_member_permission: "members",
  edit_group_permission: "members",
  sms_delivery_enabled: false,
  sms_replies_enabled: false,
  voice_messages_enabled: true,
  media_enabled: false,
  reactions_enabled: false,
  category: "sports",
  region: "US-CA",
};

const CONVERSATION = {
  id: 12,
  kind: "group",
  title: "Book club",
  name: "book-club",
  description: "Monthly reads",
  mode: "broadcast",
  join_mode: "approval",
  image_url: "https://cdn/club.png",
  settings: SETTINGS,
  last_message: MESSAGE,
  pinned_message: { ...MESSAGE, id: 400 },
  unread_count: 3,
  muted: true,
  archived: true,
  cleared: true,
  is_admin: true,
  features: ["group.message.send", 5],
  sms_number: { number: "+15550009999", country: "US", status: "active", provider: "x" },
  created_by: { username: "sam" },
  participants: [
    { id: 1, role: "admin", joined_at: "2026-01-01", user: SAM, last_read_message: 501 },
    "junk",
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  http.mockReset();
  setHttp(http as never);
  vi.mocked(getAccessToken).mockReturnValue("access-1");
  vi.mocked(getSession).mockReturnValue("sam");
  vi.mocked(refreshTokens).mockResolvedValue(false);
});

afterEach(() => {
  setHttp((...args) => globalThis.fetch(...args));
});

describe("authorizedRequest", () => {
  it("sends the bearer token, letting the caller add headers", async () => {
    respond(200, {});
    const response = await authorizedRequest("/chat/conversations/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(200);
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/",
      method: "POST",
      headers: {
        Authorization: "Bearer access-1",
        "Content-Type": "application/json",
      },
    });
    expect(handleUnauthorizedResponse).toHaveBeenCalledWith(response, {
      alreadyRetried: false,
    });
  });

  it("refuses to send anything signed out", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    await expect(authorizedRequest("/x/")).rejects.toThrow(
      "You must be signed in to manage loops.",
    );
    expect(http).not.toHaveBeenCalled();
  });

  it("refreshes on a 401 and retries once with the new token", async () => {
    http
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { data: 1 }));
    vi.mocked(refreshTokens).mockResolvedValue(true);
    vi.mocked(getAccessToken)
      .mockReturnValueOnce("access-1")
      .mockReturnValue("access-2");

    const response = await authorizedRequest("/x/");
    expect(response.status).toBe(200);
    expect(http).toHaveBeenCalledTimes(2);
    expect(lastRequest().headers.Authorization).toBe("Bearer access-2");
    expect(handleUnauthorizedResponse).toHaveBeenCalledWith(response, {
      alreadyRetried: true,
    });
  });

  it("hands the 401 on when the refresh fails", async () => {
    respond(401, {});
    const response = await authorizedRequest("/x/");
    expect(response.status).toBe(401);
    expect(http).toHaveBeenCalledTimes(1);
    expect(handleUnauthorizedResponse).toHaveBeenCalledWith(response, {
      alreadyRetried: false,
    });
  });
});

describe("normalizeConversationPayload", () => {
  it("reads a full conversation", () => {
    const conversation = normalizeConversationPayload(CONVERSATION)!;
    expect(conversation).toMatchObject({
      id: 12,
      kind: "group",
      name: "Book club",
      description: "Monthly reads",
      mode: "broadcast",
      joinMode: "approval",
      logoImage: "https://cdn/club.png",
      preview: "Sam Wren: 2 attachments · See you at 6",
      lastMessageAt: "2026-10-05T12:00:00Z",
      unread: 3,
      muted: true,
      archived: true,
      cleared: true,
      isAdmin: true,
      features: ["group.message.send"],
      smsNumber: {
        number: "+15550009999",
        country: "US",
        status: "active",
        provider: "x",
      },
      createdByUsername: "sam",
    });
    expect(conversation.settings).toEqual(SETTINGS);
    expect(conversation.pinnedMessage?.id).toBe(400);
    expect(conversation.participants).toHaveLength(1);
    expect(conversationMode(conversation)).toBe("broadcast");
  });

  it("falls back for everything a sparse conversation leaves out", () => {
    const conversation = normalizeConversationPayload({
      id: "c1",
      name: "Quiet",
      kind: "direct",
      join_mode: "secret",
      logo_image: "https://cdn/old.png",
      unread: 2,
      settings: {},
      sms_number: { country: "US" },
      created_by: {},
    })!;
    expect(conversation).toMatchObject({
      id: "c1",
      kind: "direct",
      name: "Quiet",
      mode: "chat",
      joinMode: null,
      logoImage: "https://cdn/old.png",
      preview: "No messages yet",
      lastMessageAt: null,
      unread: 2,
      muted: false,
      isAdmin: false,
      features: [],
      smsNumber: null,
      createdByUsername: undefined,
      participants: [],
      pinnedMessage: null,
    });
    expect(conversation.settings).toEqual({
      mode: "chat",
      join_mode: "approval",
      add_member_permission: "admins",
      edit_group_permission: "admins",
      sms_delivery_enabled: true,
      sms_replies_enabled: true,
      voice_messages_enabled: false,
      media_enabled: true,
      reactions_enabled: true,
      category: null,
      region: "",
    });
    expect(conversationMode(conversation)).toBe("chat");
    expect(conversationMode({ mode: "broadcast", settings: null })).toBe(
      "broadcast",
    );
  });

  it("accepts every join mode it knows", () => {
    for (const mode of ["open", "code", "approval", "invite"]) {
      expect(
        normalizeConversationPayload({ id: 1, name: "x", join_mode: mode })
          ?.joinMode,
      ).toBe(mode);
      expect(
        normalizeConversationPayload({
          id: 1,
          name: "x",
          settings: { join_mode: mode },
        })?.settings?.join_mode,
      ).toBe(mode);
    }
  });

  it("previews the description, a deleted message, and unread zero", () => {
    expect(
      normalizeConversationPayload({ id: 1, name: "x", description: "About" })
        ?.preview,
    ).toBe("About");
    expect(
      normalizeConversationPayload({
        id: 1,
        name: "x",
        last_message: {
          id: 2,
          conversation: 1,
          sender: "alex",
          deleted_at: "2026-10-05T12:00:00Z",
        },
      })?.preview,
    ).toBe("alex: This message was deleted");
    expect(normalizeConversationPayload({ id: 1, name: "x" })?.unread).toBe(0);
  });

  it("works out admin from the member list when the flag is missing", () => {
    const withRole = (role: string, username: string, nested = true) =>
      normalizeConversationPayload({
        id: 1,
        name: "x",
        participants: [
          nested
            ? { id: 1, role, user: { username } }
            : { id: 1, role, username },
          "junk",
        ],
      })!.isAdmin;

    expect(withRole("admin", "sam")).toBe(true);
    expect(withRole("admin", "sam", false)).toBe(true);
    expect(withRole("member", "sam")).toBe(false);
    expect(withRole("admin", "alex")).toBe(false);

    vi.mocked(getSession).mockReturnValue(null);
    expect(withRole("admin", "sam")).toBe(false);
    expect(
      normalizeConversationPayload({ id: 1, name: "x", is_admin: false })!
        .isAdmin,
    ).toBe(false);
  });

  it("refuses what is not a conversation", () => {
    expect(normalizeConversationPayload({ id: 1 })).toBeNull();
    expect(normalizeConversationPayload({ name: "x" })).toBeNull();
    expect(normalizeConversationPayload("x")).toBeNull();
    expect(normalizeConversationPayload(null)).toBeNull();
  });
});

describe("normalizeMessagePayload", () => {
  it("reads a full message", () => {
    expect(normalizeMessagePayload(MESSAGE)).toEqual({
      id: 501,
      conversationId: 12,
      source: "sms",
      replyTo: { id: 500, sender: "Alex", text: "When?" },
      sender: "Sam Wren",
      senderUsername: "sam",
      senderAvatarUrl: "https://cdn/sam.png",
      text: "See you at 6",
      createdAt: "2026-10-05T12:00:00Z",
      mine: true,
      reactions: [
        { emoji: "👍", count: 2, usernames: ["sam", "alex"] },
        { emoji: "❤️", count: 1, usernames: ["sam"] },
      ],
      forwarded: true,
      mentions: [
        { participantId: 3, userId: 8, username: "alex", displayLabel: "Alex" },
        { participantId: 4, userId: null, username: null, displayLabel: "" },
      ],
      mentionsEveryone: true,
      editedAt: "2026-10-05T12:01:00Z",
      deletedAt: null,
      linkPreview: {
        url: "https://example.com/a",
        title: "A page",
        description: null,
        imageUrl: null,
        siteName: "Example",
      },
      attachments: [
        {
          id: 9,
          url: "https://cdn/a.png",
          originalName: "a.png",
          contentType: "image/png",
          kind: "image",
        },
        {
          id: undefined,
          url: "https://cdn/b.bin",
          originalName: "Attachment",
          contentType: undefined,
          kind: "file",
        },
      ],
    });
  });

  it("reads a bare message, from a sender given as a string or not at all", () => {
    expect(
      normalizeMessagePayload({ id: "m1", conversation: "c1", sender: "alex" }),
    ).toEqual({
      id: "m1",
      conversationId: "c1",
      source: "app",
      sender: "alex",
      senderUsername: "alex",
      senderAvatarUrl: undefined,
      text: "",
      createdAt: "",
      mine: false,
      reactions: [],
      forwarded: false,
      mentions: [],
      mentionsEveryone: false,
      editedAt: null,
      deletedAt: null,
      attachments: [],
    });

    const anonymous = normalizeMessagePayload({ id: 1, conversation: 1 });
    expect(anonymous?.sender).toBe("Unknown");
    expect(anonymous?.senderUsername).toBeUndefined();
  });

  it("names a sender from whichever label it carries", () => {
    const sender = (value: object) =>
      normalizeMessagePayload({ id: 1, conversation: 1, sender: value })?.sender;
    expect(sender({ display_label: "Top" })).toBe("Top");
    expect(sender({ profile: { display_label: "Nested" } })).toBe("Nested");
    expect(sender({ username: "sam" })).toBe("sam");
    expect(sender({})).toBe("Unknown");
  });

  it("keeps every source it knows, and a secure preview image", () => {
    for (const source of ["sms", "email", "whatsapp", "system"]) {
      expect(
        normalizeMessagePayload({ id: 1, conversation: 1, source })?.source,
      ).toBe(source);
    }
    const preview = normalizeMessagePayload({
      id: 1,
      conversation: 1,
      link_preview: { url: "https://x.example", image_url: "https://x.example/i.png" },
    })?.linkPreview;
    expect(preview).toEqual({
      url: "https://x.example",
      title: null,
      description: null,
      imageUrl: "https://x.example/i.png",
      siteName: null,
    });
    expect(
      normalizeMessagePayload({
        id: 1,
        conversation: 1,
        link_preview: { url: "javascript:alert(1)" },
      })?.linkPreview,
    ).toBeUndefined();
  });

  it("takes the conversation from the socket frame when the message omits it", () => {
    expect(normalizeMessagePayload({ id: 1 }, 44)?.conversationId).toBe(44);
    expect(
      normalizeMessagePayload({ id: 1, conversation: { id: 3 } }, "c9")
        ?.conversationId,
    ).toBe("c9");
    expect(normalizeMessagePayload({ id: 1 })).toBeNull();
    expect(normalizeMessagePayload({ id: 1 }, null)).toBeNull();
    expect(normalizeMessagePayload({ conversation: 1 })).toBeNull();
    expect(normalizeMessagePayload("x", 1)).toBeNull();
  });
});

describe("normalizeParticipant", () => {
  it("reads a member with a nested user", () => {
    expect(
      normalizeParticipant({
        id: 1,
        role: "admin",
        joined_at: "2026-01-01",
        is_blocked: true,
        last_read_message: 501,
        user: SAM,
        channels: {
          sms: {
            status: "opted_in",
            allows_delivery: true,
            asked_at: "2026-01-01T00:00:00Z",
            consented_at: "2026-01-02T00:00:00Z",
            can_nudge: true,
          },
          email: { status: "weird" },
          voice: "junk",
        },
      }),
    ).toEqual({
      id: "1",
      userId: "7",
      name: "Sam Wren",
      username: "sam",
      email: "sam@example.com",
      phone: "+14155552671",
      role: "admin",
      joinedAt: "2026-01-01",
      isBlocked: true,
      blockedByMe: true,
      avatarUrl: "https://cdn/sam.png",
      lastReadMessageId: 501,
      isOnline: true,
      lastActive: "2026-10-05T11:00:00Z",
      channels: {
        sms: {
          status: "opted_in",
          allowsDelivery: true,
          askedAt: "2026-01-01T00:00:00Z",
          consentedAt: "2026-01-02T00:00:00Z",
          optedOutAt: null,
          canNudge: true,
        },
        email: {
          status: null,
          allowsDelivery: false,
          askedAt: null,
          consentedAt: null,
          optedOutAt: null,
          canNudge: false,
        },
      },
    });
  });

  it("reads a flat row, and a phone-only member with no account", () => {
    expect(
      normalizeParticipant({
        id: "p2",
        username: "alex",
        display_label: "Alex",
        phone: "+1555",
      }),
    ).toMatchObject({
      id: "p2",
      userId: undefined,
      name: "Alex",
      username: "alex",
      phone: "+1555",
      role: "member",
      joinedAt: "Recently",
      blockedByMe: false,
      channels: {},
    });
    expect(normalizeParticipant({ id: 3 })).toMatchObject({
      name: "Member",
      username: undefined,
      email: undefined,
      avatarUrl: undefined,
    });
    expect(normalizeParticipant({ id: 3, user: { id: null, username: "x" } })).toMatchObject(
      { userId: undefined, name: "x" },
    );
  });

  it("refuses a row with no id", () => {
    expect(normalizeParticipant({ username: "sam" })).toBeNull();
    expect(normalizeParticipant(null)).toBeNull();
  });
});

describe("small helpers", () => {
  it("finds the other person in a direct conversation", () => {
    const participants = [
      { id: "1", username: "sam" },
      { id: "2" },
      { id: "3", username: "alex" },
    ] as Conversation["participants"];
    expect(directCounterpart({ kind: "direct", participants }, "sam")?.id).toBe("3");
    expect(directCounterpart({ kind: "direct", participants: [] }, "sam")).toBeNull();
    expect(directCounterpart({ kind: "group", participants }, "sam")).toBeNull();
  });

  it("knows whether somebody has reacted", () => {
    const reaction = { emoji: "👍", count: 1, usernames: ["sam"] };
    expect(hasReacted(reaction, "sam")).toBe(true);
    expect(hasReacted(reaction, "alex")).toBe(false);
    expect(hasReacted(reaction, null)).toBe(false);
  });

  it("reads a quoted message, or nothing", () => {
    expect(normalizeReplyTo({ id: "r1" })).toEqual({
      id: "r1",
      sender: "Unknown",
      text: "",
    });
    expect(normalizeReplyTo({ sender: "x" })).toBeUndefined();
    expect(normalizeReplyTo(null)).toBeUndefined();
  });

  it("merges a fresh page over the list without losing loaded members", () => {
    const base = (id: number, extra: Partial<Conversation> = {}) =>
      ({ id, name: `c${id}`, participants: [], ...extra }) as Conversation;
    const member = { id: "1" } as Conversation["participants"][number];

    const merged = mergeConversations(
      [base(1, { participants: [member], unread: 5 }), base(2), base(3)],
      [base(3, { unread: 1 }), base(1, { unread: 0 }), base(4)],
    );
    expect(merged.map((row) => row.id)).toEqual([3, 1, 4, 2]);
    expect(merged[1]).toMatchObject({ unread: 0, participants: [member] });

    const replaced = mergeConversations(
      [base(1, { participants: [member] })],
      [base(1, { participants: [member, member] })],
    );
    expect(replaced[0].participants).toHaveLength(2);
  });
});

describe("createConversation", () => {
  const settings = SETTINGS as unknown as GroupSettings;

  it("creates a group as JSON, sending only what was given", async () => {
    respond(201, { data: { id: 44 } });
    expect(await createConversation({ name: "Book club", settings })).toEqual({
      ok: true,
      conversationId: 44,
    });
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/group/",
      method: "POST",
      body: { name: "Book club", settings: SETTINGS },
    });

    await createConversation({
      name: "Book club",
      description: "Monthly",
      members: ["sam"],
      invite: [{ phone_number: "+1555", display_name: "+15…5555" }],
      invite_email: ["a@b.co"],
      settings,
    });
    expect(lastRequest().body).toEqual({
      name: "Book club",
      description: "Monthly",
      members: ["sam"],
      invite: [{ phone_number: "+1555", display_name: "+15…5555" }],
      invite_email: ["a@b.co"],
      settings: SETTINGS,
    });
  });

  it("flattens everything into a form when there is a picture", async () => {
    respond(201, { data: {} });
    const image = new File(["png"], "club.png", { type: "image/png" });
    const result = await createConversation({
      name: "Book club",
      members: ["sam", "alex"],
      invite: [{ phone_number: "+1555", display_name: undefined }],
      settings: { ...settings, category: null },
      image,
    });
    expect(result).toEqual({ ok: true, conversationId: null });

    const request = lastRequest();
    expect(request.headers).toEqual({ Authorization: "Bearer access-1" });
    const form = request.raw as FormData;
    expect(form.get("name")).toBe("Book club");
    expect(form.getAll("members")).toEqual(["sam", "alex"]);
    expect(form.get("invite[0]phone_number")).toBe("+1555");
    expect(form.has("invite[0]display_name")).toBe(false);
    expect(form.get("settings.join_mode")).toBe("code");
    expect(form.get("settings.sms_delivery_enabled")).toBe("false");
    expect(form.get("settings.category")).toBe("");
    expect(form.get("image")).toBeInstanceOf(File);
  });

  it("reports a refusal", async () => {
    await expectFailures(
      () => createConversation({ name: "x", settings }),
      "Unable to create this Loop.",
    );
    respond(400, { data: { name: ["A Loop with that name exists."] } });
    expect(await createConversation({ name: "x", settings })).toEqual({
      ok: false,
      message: "A Loop with that name exists.",
    });
    respond(400, { data: { detail: "Plan limit reached." } });
    expect(await createConversation({ name: "x", settings })).toEqual({
      ok: false,
      message: "Plan limit reached.",
    });
  });
});

describe("listing and searching conversations", () => {
  it("lists a page of conversations", async () => {
    respond(200, { data: { next: "page2", results: [CONVERSATION, { id: 1 }, "x"] } });
    const result = await fetchConversations();
    expect(lastRequest().url).toBe("/chat/conversations/");
    expect(result).toMatchObject({ ok: true, hasMore: true });
    expect(result.ok && result.conversations).toHaveLength(1);

    respond(200, { data: [CONVERSATION] });
    const bare = await fetchConversations({ page: 3 });
    expect(lastRequest().url).toBe("/chat/conversations/?page=3");
    expect(bare).toMatchObject({ ok: true, hasMore: false });

    respond(200, { data: CONVERSATION });
    const single = await fetchConversations({ page: 1 });
    expect(single.ok && single.conversations).toHaveLength(1);

    for (const data of [null, "text", { results: "no" }]) {
      respond(200, { data });
      expect(await fetchConversations()).toEqual({
        ok: true,
        conversations: [],
        hasMore: false,
      });
    }
    await expectFailures(fetchConversations, "Unable to load your Loops.");
  });

  it("searches the conversations somebody is in", async () => {
    respond(200, { data: [CONVERSATION] });
    const result = await searchConversations("book & tea");
    expect(lastRequest().url).toBe(
      "/chat/conversations/search/?q=book%20%26%20tea",
    );
    expect(result.ok && result.conversations[0].name).toBe("Book club");
    await expectFailures(
      () => searchConversations("x"),
      "Unable to search Loops.",
    );
  });

  it("searches groups that can be joined", async () => {
    respond(200, {
      data: [
        {
          id: 5,
          name: "Runners",
          description: "5k club",
          image_url: "https://cdn/r.png",
          member_count: 42,
          join_mode: "open",
          mode: "broadcast",
        },
        { id: 6, name: "Quiet", join_mode: "invite" },
        { id: 7 },
      ],
    });
    expect(await searchGroups("run")).toEqual({
      ok: true,
      groups: [
        {
          id: 5,
          name: "Runners",
          description: "5k club",
          logoImage: "https://cdn/r.png",
          memberCount: 42,
          joinMode: "open",
          mode: "broadcast",
        },
        {
          id: 6,
          name: "Quiet",
          description: "",
          logoImage: null,
          memberCount: 0,
          joinMode: "approval",
          mode: "chat",
        },
      ],
    });
    await expectFailures(() => searchGroups("x"), "Unable to search groups.");
  });

  it("starts a direct conversation", async () => {
    respond(200, { data: { id: 77 } });
    expect(await startDirectConversation("  @sam ")).toEqual({
      ok: true,
      conversationId: 77,
    });
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/direct/",
      method: "POST",
      body: { identifier: "@sam" },
    });

    respond(400, { data: { identifier: ["Nobody by that name."] }, message: "Bad." });
    expect(await startDirectConversation("x")).toEqual({
      ok: false,
      message: "Nobody by that name.",
    });
    respond(400, { message: "They do not accept messages." });
    expect(await startDirectConversation("x")).toEqual({
      ok: false,
      message: "They do not accept messages.",
    });
    for (const response of [brokenResponse(500), jsonResponse(200, { data: {} })]) {
      http.mockResolvedValue(response);
      expect(await startDirectConversation("x")).toEqual({
        ok: false,
        message: "Could not start that conversation.",
      });
    }
    http.mockRejectedValue(new Error(""));
    expect(await startDirectConversation("x")).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
    http.mockRejectedValue(new Error("Signed out."));
    expect(await startDirectConversation("x")).toEqual({
      ok: false,
      message: "Signed out.",
    });
  });
});

describe("joining", () => {
  it("joins outright, or waits for approval", async () => {
    respond(200, { data: CONVERSATION });
    expect(await joinConversation(12)).toMatchObject({
      ok: true,
      status: "joined",
      conversation: { id: 12 },
    });
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/join/",
      method: "POST",
    });

    respond(202, { data: null });
    expect(await joinConversation(12)).toEqual({ ok: true, status: "pending" });
    await expectFailures(() => joinConversation(12), "Unable to join this Loop.");
  });

  it("joins with a code", async () => {
    respond(200, { data: CONVERSATION });
    expect(await joinConversationWithCode("ABC123")).toMatchObject({
      status: "joined",
    });
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/join/",
      body: { code: "ABC123" },
    });
    await expectFailures(
      () => joinConversationWithCode("x"),
      "Unable to join this Loop.",
    );
  });

  it("reads the join code", async () => {
    respond(200, { data: { join_code: "ABC123" } });
    expect(await fetchJoinCode(12)).toEqual({ ok: true, code: "ABC123" });
    expect(lastRequest().url).toBe("/chat/conversations/12/join-code/");

    respond(200, { data: {} });
    expect(await fetchJoinCode(12)).toEqual({
      ok: false,
      message: "Unable to load the join code.",
    });
    await expectFailures(() => fetchJoinCode(12), "Unable to load the join code.");
  });
});

describe("one conversation", () => {
  it.each([
    [
      "fetches it",
      () => fetchConversation(12),
      "/chat/conversations/12/",
      undefined,
      "Unable to load this conversation.",
    ],
    [
      "gets it a number",
      () => provisionGroupNumber(12),
      "/chat/conversations/12/number/",
      "POST",
      "Unable to get this Loop a number.",
    ],
    [
      "updates its settings",
      () => updateGroupSettings(12, { name: "New name" }),
      "/chat/conversations/12/settings/",
      "PATCH",
      "Unable to update Loop settings.",
    ],
    [
      "pins a message",
      () => setPinnedMessage(12, 501, true),
      "/chat/conversations/12/messages/501/pin/",
      "POST",
      "Unable to pin this message.",
    ],
    [
      "unpins a message",
      () => setPinnedMessage(12, 501, false),
      "/chat/conversations/12/messages/501/pin/",
      "DELETE",
      "Unable to unpin this.",
    ],
  ])("%s, returning the conversation as it now is", async (_n, call, url, method, fallback) => {
    respond(200, { data: CONVERSATION });
    expect(await call()).toMatchObject({ ok: true, conversation: { id: 12 } });
    expect(lastRequest().url).toBe(url);
    expect(lastRequest().method).toBe(method);

    respond(200, { data: { id: 12 } });
    expect(await call()).toEqual({ ok: false, message: fallback });
    await expectFailures(call, fallback);
  });

  it("sends changed settings as JSON, and a picture change as a form", async () => {
    respond(200, { data: CONVERSATION });
    await updateGroupSettings(12, {
      description: "New",
      settings: { join_mode: "open" },
    });
    expect(lastRequest().body).toEqual({
      description: "New",
      settings: { join_mode: "open" },
    });

    // null removes the picture; it still has to travel as a form field.
    await updateGroupSettings(12, { name: "x", image: null });
    const form = lastRequest().raw as FormData;
    expect(form.get("name")).toBe("x");
    expect(form.get("image")).toBe("");
  });
});

describe("members", () => {
  it.each([
    [
      "adds members",
      () => addConversationMembers(12, ["sam"], ["a@b.co"], "new"),
      "/chat/conversations/12/members/",
      { members: ["sam"], invite_email: ["a@b.co"], history: "new" },
      "Unable to add members to this Loop.",
    ],
    [
      "adds members with the defaults",
      () => addConversationMembers(12, ["sam"]),
      "/chat/conversations/12/members/",
      { members: ["sam"], invite_email: [], history: "all" },
      "Unable to add members to this Loop.",
    ],
    [
      "invites by phone",
      () => inviteConversationMemberByPhone(12, { phone_number: "+1555" }),
      "/chat/conversations/12/invite/",
      { phone_number: "+1555" },
      "Unable to send this invite.",
    ],
    [
      "approves a join request",
      () => respondToJoinRequest(12, 3, "approve"),
      "/chat/conversations/12/requests/",
      { participant: 3, decision: "approve" },
      "Unable to update this request.",
    ],
    [
      "changes a role",
      () => updateMemberRole(12, 3, "admin"),
      "/chat/conversations/12/role/",
      { participant: 3, role: "admin" },
      "Unable to update this member's role.",
    ],
    [
      "removes and blocks a member",
      () => removeConversationMember(12, 3, true),
      "/chat/conversations/12/remove/",
      { participant: 3, block: true },
      "Unable to remove this member.",
    ],
    [
      "unblocks a member",
      () => unblockConversationMember(12, 3),
      "/chat/conversations/12/unblock/",
      { participant: 3 },
      "Unable to unblock this member.",
    ],
    [
      "marks read up to a message",
      () => markConversationRead(12, "501"),
      "/chat/conversations/12/read/",
      { message_id: 501 },
      "Unable to mark as read.",
    ],
    [
      "marks everything read",
      () => markConversationRead(12),
      "/chat/conversations/12/read/",
      {},
      "Unable to mark as read.",
    ],
    [
      "archives",
      () => setConversationArchived(12, true),
      "/chat/conversations/12/archive/",
      { archived: true },
      "Unable to update this Loop.",
    ],
    [
      "mutes",
      () => setConversationMuted(12, true),
      "/chat/conversations/12/delivery/",
      { muted: true },
      "Unable to update this Loop.",
    ],
    [
      "clears the history",
      () => clearConversationHistory(12),
      "/chat/conversations/12/clear/",
      undefined,
      "Unable to clear this chat.",
    ],
    [
      "leaves",
      () => leaveConversation(12),
      "/chat/conversations/12/leave/",
      undefined,
      "Unable to leave this Loop.",
    ],
  ])("%s", async (_name, call, url, body, fallback) => {
    respond(200, {});
    expect(await call()).toEqual({ ok: true });
    expect(lastRequest()).toMatchObject({ url, method: "POST" });
    expect(lastRequest().body).toEqual(body);
    await expectFailures(call, fallback);
  });

  it("deletes a conversation", async () => {
    respond(204, null);
    expect(await deleteConversation(12)).toEqual({ ok: true });
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/",
      method: "DELETE",
    });
    await expectFailures(() => deleteConversation(12), "Unable to delete this Loop.");
  });

  it("loads every member, a page at a time until a short page", async () => {
    const page = (count: number, from: number) =>
      jsonResponse(200, {
        data: {
          results: Array.from({ length: count }, (_, i) => ({ id: from + i })),
        },
      });
    http
      .mockResolvedValueOnce(page(2, 1))
      .mockResolvedValueOnce(page(2, 3))
      .mockResolvedValueOnce(page(1, 5));

    const result = await fetchConversationParticipants(12, { size: 2 });
    expect(result.ok && result.participants.map((p) => p.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(http.mock.calls.map((call) => call[0])).toEqual([
      "/chat/conversations/12/participants/?page=1&page_size=2",
      "/chat/conversations/12/participants/?page=2&page_size=2",
      "/chat/conversations/12/participants/?page=3&page_size=2",
    ]);
  });

  it("asks for a hundred at a time by default, and stops after fifty pages", async () => {
    respond(200, { data: [{ id: 1 }] });
    await fetchConversationParticipants(12);
    expect(lastRequest().url).toMatch(/page=1&page_size=100$/);

    http.mockClear();
    respond(200, { data: [{ id: 1 }] });
    const capped = await fetchConversationParticipants(12, { size: 1 });
    expect(http).toHaveBeenCalledTimes(50);
    expect(capped.ok && capped.participants).toHaveLength(50);

    await expectFailures(
      () => fetchConversationParticipants(12),
      "Unable to load members.",
    );
  });

  it("lists join requests and blocked members", async () => {
    respond(200, { data: [{ id: 1, user: SAM }, { username: "no id" }] });
    const requests = await fetchJoinRequests(12);
    expect(lastRequest().url).toBe("/chat/conversations/12/requests/");
    expect(requests.ok && requests.requests).toHaveLength(1);

    const blocked = await fetchBlockedMembers(12);
    expect(lastRequest().url).toBe("/chat/conversations/12/blocked/");
    expect(blocked.ok && blocked.members[0].name).toBe("Sam Wren");

    await expectFailures(
      () => fetchJoinRequests(12),
      "Unable to load pending requests.",
    );
    await expectFailures(
      () => fetchBlockedMembers(12),
      "Unable to load blocked members.",
    );
  });

  it("searches people who could be added, and offers an email invite", async () => {
    respond(200, {
      data: {
        has_more: true,
        invite: { email: "new@example.com", status: "ready", detail: "" },
        results: [
          { user: SAM, status: "already_member", detail: "Already here." },
          { user: { id: 9, username: "alex" }, status: "odd" },
          { user: { id: 10 } },
          { status: "ready" },
          "junk",
        ],
      },
    });
    expect(await searchMemberCandidates(12, " sa ")).toEqual({
      ok: true,
      hasMore: true,
      invite: { email: "new@example.com", status: "ready", detail: "" },
      candidates: [
        {
          id: "7",
          username: "sam",
          name: "Sam Wren",
          avatarUrl: "https://cdn/sam.png",
          status: "already_member",
          detail: "Already here.",
        },
        {
          id: "9",
          username: "alex",
          name: "alex",
          avatarUrl: undefined,
          status: "refused",
          detail: "",
        },
      ],
    });
    expect(lastRequest().url).toBe("/chat/conversations/12/members/search/?q=sa");

    respond(200, { data: { results: [], invite: { email: "x@y.co", status: "?" } } });
    expect(await searchMemberCandidates(12, "x")).toMatchObject({
      hasMore: false,
      invite: { email: "x@y.co", status: "refused" },
    });
    respond(200, { data: { results: [], invite: { status: "ready" } } });
    expect(await searchMemberCandidates(12, "x")).toMatchObject({ invite: null });

    respond(200, { data: { results: 0 } });
    expect(await searchMemberCandidates(12, "x")).toEqual({
      ok: false,
      message: "Search failed.",
    });
    await expectFailures(() => searchMemberCandidates(12, "x"), "Search failed.");
  });

  it("nudges a member who has not answered, by text unless told otherwise", async () => {
    respond(200, { data: { id: 3, user: SAM } });
    const result = await nudgeConversationMember(12, 3);
    expect(result.ok && result.participant.name).toBe("Sam Wren");
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/nudge/",
      body: { participant: 3, channel: "sms" },
    });

    await nudgeConversationMember(12, 3, "email");
    expect(lastRequest().body.channel).toBe("email");

    respond(200, { data: {} });
    expect(await nudgeConversationMember(12, 3)).toEqual({
      ok: false,
      message: "Unable to send that reminder.",
    });
    await expectFailures(
      () => nudgeConversationMember(12, 3),
      "Unable to send that reminder.",
    );
  });
});

describe("messages", () => {
  it("loads history oldest first", async () => {
    respond(200, {
      data: {
        next: "page2",
        results: [{ ...MESSAGE, id: 3 }, { ...MESSAGE, id: 2 }, { id: 1 }],
      },
    });
    const result = await fetchMessageHistory(12);
    expect(lastRequest().url).toBe("/chat/conversations/12/messages/");
    expect(result.ok && result.messages.map((m) => m.id)).toEqual([2, 3]);
    expect(result.ok && result.hasMore).toBe(true);

    await fetchMessageHistory(12, { page: 4 });
    expect(lastRequest().url).toBe("/chat/conversations/12/messages/?page=4");
  });

  it("catches up after a message without reordering, ignoring the page", async () => {
    respond(200, { data: [{ ...MESSAGE, id: 4 }, { ...MESSAGE, id: 5 }] });
    const result = await fetchMessageHistory(12, { afterId: 3, page: 9 });
    expect(lastRequest().url).toBe("/chat/conversations/12/messages/?after_id=3");
    expect(result.ok && result.messages.map((m) => m.id)).toEqual([4, 5]);
    expect(result.ok && result.hasMore).toBe(false);

    await expectFailures(
      () => fetchMessageHistory(12),
      "Unable to load message history.",
    );
  });

  it("sends a text message as JSON, with only the extras it has", async () => {
    respond(201, { data: MESSAGE });
    const result = await sendConversationMessage(12, "  hello ");
    expect(result.ok && result.message.id).toBe(501);
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/messages/",
      method: "POST",
      body: { text: "hello" },
    });
    expect(lastRequest().headers["Content-Type"]).toBe("application/json");

    await sendConversationMessage(12, "hi", [], 500, [3, 4], true);
    expect(lastRequest().body).toEqual({
      text: "hi",
      reply_to: 500,
      mentions: [3, 4],
      mention_everyone: true,
    });
  });

  it("sends attachments as a form", async () => {
    respond(201, { data: MESSAGE });
    const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
    await sendConversationMessage(12, " look ", files, "r1", [3], true);

    const request = lastRequest();
    expect(request.headers).toEqual({ Authorization: "Bearer access-1" });
    const form = request.raw as FormData;
    expect(form.get("text")).toBe("look");
    expect(form.getAll("attachments")).toHaveLength(2);
    expect(form.get("reply_to")).toBe("r1");
    expect(form.getAll("mentions")).toEqual(["3"]);
    expect(form.get("mention_everyone")).toBe("true");

    await sendConversationMessage(12, "  ", files, null);
    const bare = lastRequest().raw as FormData;
    expect([...bare.keys()]).toEqual(["attachments", "attachments"]);
  });

  it("reports a message that would not send", async () => {
    respond(201, { data: { id: 1 } });
    expect(await sendConversationMessage(12, "x")).toEqual({
      ok: false,
      message: "Unable to send this message.",
    });
    await expectFailures(
      () => sendConversationMessage(12, "x"),
      "Unable to send this message.",
    );
  });

  it("adds a reaction, and removes one by query string", async () => {
    respond(200, { data: MESSAGE });
    expect((await setMessageReaction(12, 501, "👍", false)).ok).toBe(true);
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/messages/501/reactions/",
      method: "POST",
      body: { emoji: "👍" },
    });

    await setMessageReaction(12, 501, "👍", true);
    expect(lastRequest()).toMatchObject({
      url: `/chat/conversations/12/messages/501/reactions/?emoji=${encodeURIComponent("👍")}`,
      method: "DELETE",
    });

    await expectFailures(
      () => setMessageReaction(12, 501, "👍", false),
      "Unable to add that reaction.",
    );
    await expectFailures(
      () => setMessageReaction(12, 501, "👍", true),
      "Unable to remove that reaction.",
    );
  });

  it("edits a message, sending mentions only when they are given", async () => {
    respond(200, { data: MESSAGE });
    await editConversationMessage(12, 501, "  fixed ");
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/messages/501/",
      method: "PATCH",
      body: { text: "fixed" },
    });
    expect(lastRequest().body).toEqual({ text: "fixed" });

    await editConversationMessage(12, 501, "fixed", [], false);
    expect(lastRequest().body).toEqual({
      text: "fixed",
      mentions: [],
      mention_everyone: false,
    });
    await expectFailures(
      () => editConversationMessage(12, 501, "x"),
      "Unable to edit this message.",
    );
  });

  it("deletes and forwards a message", async () => {
    respond(200, { data: MESSAGE });
    expect((await deleteConversationMessage(12, 501)).ok).toBe(true);
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/12/messages/501/",
      method: "DELETE",
    });

    expect((await forwardConversationMessage(20, 501)).ok).toBe(true);
    expect(lastRequest()).toMatchObject({
      url: "/chat/conversations/20/messages/",
      method: "POST",
      body: { forward_from: 501 },
    });

    respond(200, { data: null });
    expect(await deleteConversationMessage(12, 501)).toEqual({
      ok: false,
      message: "Unable to delete this message.",
    });
    await expectFailures(
      () => forwardConversationMessage(20, 501),
      "Unable to forward this message.",
    );
  });
});
