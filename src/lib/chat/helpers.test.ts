import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  authorizedRequest,
  type ConversationAttachment,
} from "@/lib/chat/conversations";
import {
  isDuplicateMember,
  maskPhone,
  parseMember,
  splitMemberInput,
  toMemberPayload,
  type MemberEntry,
} from "@/lib/chat/members";
import {
  EVERYONE,
  filterCandidates,
  findMentionQuery,
  insertMention,
  pruneMentions,
  splitByMentions,
  toApiMentions,
  type MessageMention,
} from "@/lib/chat/mentions";
import {
  fetchNotifications,
  markNotificationsRead,
  normalizeNotification,
} from "@/lib/chat/notifications";
import {
  composePreview,
  conversationTimeLabel,
  dayLabel,
  describeMessageBody,
} from "@/lib/chat/preview";
import {
  fetchSponsoredCard,
  openLeadForm,
  reportSponsoredView,
  sendLead,
} from "@/lib/chat/sponsored";
import { jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [path, init] = vi.mocked(authorizedRequest).mock.calls.at(-1)!;
  const request = (init ?? {}) as RequestInit;
  return {
    path,
    method: request.method,
    body: JSON.parse((request.body as string) ?? "null"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("splitMemberInput", () => {
  it("splits a pasted list on commas, semicolons and new lines", () => {
    expect(
      splitMemberInput(" sam, alex@example.com;\n+15550001111 ,, "),
    ).toEqual(["sam", "alex@example.com", "+15550001111"]);
  });
});

describe("parseMember", () => {
  function entry(raw: string) {
    const result = parseMember(raw);
    return result.ok ? result.entry : result.message;
  }

  it("reads an @handle as a username, without the @", () => {
    expect(entry(" @sam.w ")).toEqual({
      raw: "@sam.w",
      value: "sam.w",
      kind: "username",
    });
    expect(entry("@not valid")).toBe('"@not valid" is not a valid username.');
  });

  it("reads an email, lower-cased", () => {
    expect(entry("Alex@Example.com")).toEqual({
      raw: "Alex@Example.com",
      value: "alex@example.com",
      kind: "email",
    });
  });

  it("reads a phone number into E.164, and refuses one that is not real", () => {
    expect(entry("+1 (415) 555-2671")).toEqual({
      raw: "+1 (415) 555-2671",
      value: "+14155552671",
      kind: "phone",
    });
    expect(entry("+1 23")).toBe(
      '"+1 23" is not a valid phone number. Include the country code.',
    );
    expect(entry("(555) 010-9999")).toMatch(/not a valid phone number/);
  });

  it("reads a bare word as a username, even one made of a few digits", () => {
    expect(entry("sam_w")).toEqual({
      raw: "sam_w",
      value: "sam_w",
      kind: "username",
    });
    // Too short to be a phone number, so it is somebody's username.
    expect(entry("12345")).toMatchObject({ kind: "username" });
  });

  it("refuses the empty and the unrecognisable", () => {
    expect(entry("   ")).toBe("Enter a username, email or phone number.");
    expect(entry("sam wren!")).toBe(
      '"sam wren!" is not a username, email or phone number.',
    );
  });
});

describe("member lists", () => {
  const sam: MemberEntry = { raw: "sam", value: "sam", kind: "username" };
  const email: MemberEntry = {
    raw: "a@b.co",
    value: "a@b.co",
    kind: "email",
  };
  const phone: MemberEntry = {
    raw: "+1 415 555 2671",
    value: "+14155552671",
    kind: "phone",
  };

  it("spots the same person typed twice, whatever the case", () => {
    expect(isDuplicateMember([sam], { ...sam, value: "SAM" })).toBe(true);
    // Same text, different kind: a username is not an email.
    expect(isDuplicateMember([sam], { ...sam, kind: "email" })).toBe(false);
    expect(isDuplicateMember([], sam)).toBe(false);
  });

  it("masks a phone number, leaving a short one alone", () => {
    expect(maskPhone("+14155552671")).toBe("+14…2671");
    expect(maskPhone("+1234")).toBe("+1234");
  });

  it("sorts entries into the three lists the API takes", () => {
    expect(toMemberPayload([sam, email, phone])).toEqual({
      members: ["sam"],
      inviteEmail: ["a@b.co"],
      invite: [{ phone_number: "+14155552671", display_name: "+14…2671" }],
    });
    expect(toMemberPayload([])).toEqual({
      members: [],
      invite: [],
      inviteEmail: [],
    });
  });
});

describe("findMentionQuery", () => {
  it("finds the @word the caret is inside", () => {
    expect(findMentionQuery("hi @sa", 6)).toEqual({ start: 3, query: "sa" });
    expect(findMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
    expect(findMentionQuery("line\n@al", 8)).toEqual({ start: 5, query: "al" });
  });

  it("ignores an @ that is not starting a mention", () => {
    expect(findMentionQuery("no mention here", 5)).toBeNull();
    // An email address being typed.
    expect(findMentionQuery("sam@ex", 6)).toBeNull();
    // The caret has moved on past a space.
    expect(findMentionQuery("@sam hi", 7)).toBeNull();
    // An @ after the caret has not been reached yet.
    expect(findMentionQuery("hello @sam", 3)).toBeNull();
  });
});

describe("filterCandidates", () => {
  const people = [
    { id: 1, label: "Sam Wren" },
    { id: 2, label: "Alex Sato" },
    { id: 3, label: "Wendy" },
    { id: EVERYONE, label: "everyone" },
  ];

  it("matches the start of any word in a name", () => {
    expect(filterCandidates(people, "sa").map((p) => p.id)).toEqual([1, 2]);
    expect(filterCandidates(people, " W ").map((p) => p.id)).toEqual([1, 3]);
    expect(filterCandidates(people, "am")).toEqual([]);
  });

  it("offers everybody for an empty query, up to the limit", () => {
    expect(filterCandidates(people, "")).toHaveLength(4);
    expect(filterCandidates(people, "", 2)).toHaveLength(2);
    expect(filterCandidates(people, "e", 0)).toEqual([]);
  });
});

describe("drafting a mention", () => {
  it("replaces the @query with the label and puts the caret after it", () => {
    const query = findMentionQuery("hi @sa there", 6)!;
    expect(insertMention("hi @sa there", query, 6, "Sam Wren")).toEqual({
      text: "hi @Sam Wren  there",
      caret: 13,
    });
  });

  it("drops a mention whose text was deleted, and a repeat", () => {
    const sam = { id: 1, label: "Sam Wren" };
    const alex = { id: 2, label: "Alex" };
    expect(pruneMentions("hi @Sam Wren", [sam, alex, sam])).toEqual([sam]);
    expect(pruneMentions("", [sam])).toEqual([]);
  });

  it("sends ids, with @everyone as a flag of its own", () => {
    expect(
      toApiMentions([
        { id: 4, label: "Sam" },
        { id: EVERYONE, label: "everyone" },
        { id: 9, label: "Alex" },
      ]),
    ).toEqual({ mentions: [4, 9], mentionEveryone: true });
    expect(toApiMentions([])).toEqual({ mentions: [], mentionEveryone: false });
  });
});

describe("splitByMentions", () => {
  const mention = (displayLabel: string, username: string): MessageMention => ({
    participantId: 1,
    userId: 1,
    username,
    displayLabel,
  });

  it("returns the text whole when nobody is mentioned", () => {
    expect(splitByMentions("hello", [], false)).toEqual([
      { text: "hello", isMention: false, isMe: false },
    ]);
    expect(splitByMentions("", [mention("Sam", "sam")], false)).toEqual([
      { text: "", isMention: false, isMe: false },
    ]);
  });

  it("marks each mention, and which of them is the reader", () => {
    expect(
      splitByMentions(
        "hey @Sam and @Alex!",
        [mention("Sam", "sam"), mention("Alex", "alex")],
        false,
        "alex",
      ),
    ).toEqual([
      { text: "hey ", isMention: false, isMe: false },
      { text: "@Sam", isMention: true, isMe: false },
      { text: " and ", isMention: false, isMe: false },
      { text: "@Alex", isMention: true, isMe: true },
      { text: "!", isMention: false, isMe: false },
    ]);
  });

  it("prefers the longer name when one starts with another", () => {
    const segments = splitByMentions(
      "@Sam Wren hi",
      [mention("Sam", "sam"), mention("Sam Wren", "samw")],
      false,
    );
    expect(segments[0]).toEqual({
      text: "@Sam Wren",
      isMention: true,
      isMe: false,
    });
  });

  it("treats @everyone as addressed to the reader", () => {
    expect(splitByMentions("@everyone lunch?", [], true)).toEqual([
      { text: "@everyone", isMention: true, isMe: true },
      { text: " lunch?", isMention: false, isMe: false },
    ]);
  });

  it("leaves the text alone when the mention is not actually in it", () => {
    expect(splitByMentions("no names", [mention("Sam", "sam")], false)).toEqual(
      [{ text: "no names", isMention: false, isMe: false }],
    );
  });
});

describe("normalizeNotification", () => {
  it("reads a full row", () => {
    expect(
      normalizeNotification({
        id: 4,
        type: "join.requested",
        category: "groups",
        from_user: { username: "sam", profile: { display_label: "Sam Wren" } },
        conversation: 12,
        conversation_name: "Book club",
        conversation_join_mode: "approval",
        viewer_status: "active",
        request_status: "pending",
        data: { note: "hi" },
        read_at: "2026-10-05T10:00:00Z",
        created_at: "2026-10-05T09:00:00Z",
      }),
    ).toEqual({
      id: 4,
      type: "join.requested",
      category: "groups",
      actorName: "Sam Wren",
      conversationId: 12,
      conversationName: "Book club",
      joinMode: "approval",
      viewerStatus: "active",
      requestStatus: "pending",
      data: { note: "hi" },
      readAt: "2026-10-05T10:00:00Z",
      createdAt: "2026-10-05T09:00:00Z",
    });
  });

  it("names the actor from the best thing it has", () => {
    const name = (row: object) =>
      normalizeNotification({ id: 1, ...row })?.actorName;
    expect(name({ from_user: { username: "sam", profile: {} } })).toBe("sam");
    expect(name({ from_user: { username: "sam" } })).toBe("sam");
    expect(name({ data: { display_name: "+14…2671" } })).toBe("+14…2671");
    expect(name({})).toBeNull();
  });

  it("falls back for everything missing or of the wrong shape", () => {
    expect(
      normalizeNotification({
        id: 1,
        conversation: { id: 3 },
        conversation_join_mode: "secret",
        viewer_status: "ghost",
        data: [],
      }),
    ).toEqual({
      id: 1,
      type: "general",
      category: "general",
      actorName: null,
      conversationId: null,
      conversationName: null,
      joinMode: null,
      viewerStatus: null,
      requestStatus: null,
      data: null,
      readAt: null,
      createdAt: "",
    });
  });

  it("accepts every join mode and status, and a string conversation id", () => {
    for (const mode of ["open", "code", "approval", "invite"]) {
      expect(
        normalizeNotification({ id: 1, conversation_join_mode: mode })
          ?.joinMode,
      ).toBe(mode);
    }
    for (const status of ["active", "pending", "left", "removed", "blocked"]) {
      expect(
        normalizeNotification({ id: 1, viewer_status: status })?.viewerStatus,
      ).toBe(status);
    }
    expect(
      normalizeNotification({ id: 1, conversation: "abc" })?.conversationId,
    ).toBe("abc");
  });

  it("drops a row with no id", () => {
    expect(normalizeNotification({ id: "4" })).toBeNull();
    expect(normalizeNotification(null)).toBeNull();
    expect(normalizeNotification([])).toBeNull();
  });
});

describe("fetchNotifications", () => {
  it("asks for everything by default", async () => {
    respond(200, {
      data: { results: [{ id: 1 }, "junk"], unread_count: 3, next: "page2" },
    });
    const result = await fetchNotifications();
    expect(lastRequest().path).toBe("/chat/notifications/");
    expect(result.ok && result.page.notifications).toHaveLength(1);
    expect(result.ok && result.page.unreadCount).toBe(3);
    expect(result.ok && result.page.hasMore).toBe(true);
  });

  it("puts the filters in the query, leaving out the defaults", async () => {
    respond(200, { data: {} });
    await fetchNotifications({
      category: "delivery",
      unreadOnly: true,
      page: 3,
    });
    expect(lastRequest().path).toBe(
      "/chat/notifications/?category=delivery&unread=1&page=3",
    );

    const result = await fetchNotifications({ category: "all", page: 1 });
    expect(lastRequest().path).toBe("/chat/notifications/");
    expect(result).toEqual({
      ok: true,
      page: { notifications: [], unreadCount: 0, hasMore: false },
    });
  });

  it("reports a failure rather than throwing", async () => {
    respond(500, {});
    expect(await fetchNotifications()).toEqual({
      ok: false,
      message: "Unable to load activity.",
    });
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("Signed out."));
    expect(await fetchNotifications()).toEqual({
      ok: false,
      message: "Signed out.",
    });
    vi.mocked(authorizedRequest).mockRejectedValue("x");
    expect(await fetchNotifications()).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });
});

describe("markNotificationsRead", () => {
  it("marks the ids given, or everything when given none", async () => {
    respond(200, { data: { unread_count: 2 } });
    expect(await markNotificationsRead([4, 5])).toEqual({
      ok: true,
      unreadCount: 2,
    });
    expect(lastRequest()).toEqual({
      path: "/chat/notifications/read/",
      method: "POST",
      body: { ids: [4, 5] },
    });

    respond(200, {});
    expect(await markNotificationsRead([])).toEqual({
      ok: true,
      unreadCount: 0,
    });
    expect(lastRequest().body).toEqual({});
    await markNotificationsRead();
    expect(lastRequest().body).toEqual({});
  });

  it("reports a failure rather than throwing", async () => {
    respond(500, {});
    expect(await markNotificationsRead()).toEqual({
      ok: false,
      message: "Unable to mark activity as read.",
    });
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("Signed out."));
    expect(await markNotificationsRead()).toEqual({
      ok: false,
      message: "Signed out.",
    });
    vi.mocked(authorizedRequest).mockRejectedValue(null);
    expect(await markNotificationsRead()).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });
});

describe("describeMessageBody", () => {
  const file = (contentType: string | null, kind = "file") =>
    ({ contentType, kind }) as unknown as ConversationAttachment;

  it("names one attachment by what it is", () => {
    expect(describeMessageBody("", [file("image/gif")])).toBe("GIF");
    expect(describeMessageBody("", [file("image/png")])).toBe("Photo");
    expect(describeMessageBody("", [file("video/mp4")])).toBe("Video");
    expect(describeMessageBody("", [file("audio/webm")])).toBe("Voice message");
    expect(describeMessageBody("", [file("application/pdf")])).toBe("PDF");
    expect(describeMessageBody("", [file(null, "image")])).toBe("Photo");
    expect(describeMessageBody("", [file("application/zip")])).toBe("File");
  });

  it("puts a caption after the attachment", () => {
    expect(describeMessageBody(" look ", [file("image/png")])).toBe(
      "Photo · look",
    );
  });

  it("counts several, by kind when they are all the same", () => {
    expect(
      describeMessageBody("", [file("image/png"), file("image/jpeg")]),
    ).toBe("2 photos");
    expect(
      describeMessageBody("", [
        file("application/pdf"),
        file("application/pdf"),
      ]),
    ).toBe("2 PDFs");
    expect(
      describeMessageBody("", [file("image/gif"), file("image/gif")]),
    ).toBe("2 GIFs");
    expect(
      describeMessageBody("both", [file("image/png"), file("video/mp4")]),
    ).toBe("2 attachments · both");
  });

  it("describes a bare link rather than printing the URL", () => {
    expect(describeMessageBody("https://youtu.be/abc123")).toBe(
      "YouTube video",
    );
    expect(describeMessageBody("https://www.youtube.com/watch?v=abc123")).toBe(
      "YouTube video",
    );
    expect(describeMessageBody("https://example.com/page")).toBe("Link");
    expect(describeMessageBody("see https://example.com")).toBe(
      "see https://example.com",
    );
  });

  it("is empty for an empty message", () => {
    expect(describeMessageBody("   ")).toBe("");
  });
});

describe("composePreview", () => {
  it("prefixes the sender when there is one, and stays empty for nothing", () => {
    expect(composePreview("Sam", "Photo")).toBe("Sam: Photo");
    expect(composePreview("", "Photo")).toBe("Photo");
    expect(composePreview("Sam", "")).toBe("");
  });
});

describe("time labels", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A Monday, at local noon.
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
  });

  const at = (year: number, month: number, day: number, hour = 9) =>
    new Date(year, month, day, hour, 30).toISOString();

  it("shows the time today, then the day, then the date", () => {
    expect(conversationTimeLabel(at(2026, 9, 5))).toMatch(/9:30/);
    expect(conversationTimeLabel(at(2026, 9, 4))).toBe("Yesterday");
    expect(conversationTimeLabel(at(2026, 9, 2))).toBe("Friday");
    expect(conversationTimeLabel(at(2026, 8, 20))).toMatch(/20/);
    // Tomorrow, by a clock that disagrees: still just a time.
    expect(conversationTimeLabel(at(2026, 9, 6))).toMatch(/9:30/);
  });

  it("labels a day in the thread the same way, in words", () => {
    expect(dayLabel(at(2026, 9, 5))).toBe("Today");
    expect(dayLabel(at(2026, 9, 4))).toBe("Yesterday");
    expect(dayLabel(at(2026, 9, 2))).toBe("Friday");
    expect(dayLabel(at(2026, 8, 20))).toMatch(/September 20, 2026/);
  });

  it("is empty for nothing and for nonsense", () => {
    expect(conversationTimeLabel(null)).toBe("");
    expect(conversationTimeLabel("soon")).toBe("");
    expect(dayLabel("")).toBe("");
    expect(dayLabel("soon")).toBe("");
  });
});

describe("sponsored cards", () => {
  const served = {
    token: "tok_1",
    click_url: "https://acme.example/offer",
    form_token: null,
    company: { name: "Acme" },
    creative: {
      headline: "Half off",
      body: "This week only.",
      image_url: "https://cdn/acme.png",
      cta_label: "Shop now",
      cta_kind: "link",
    },
  };

  it("reads the card served for a conversation", async () => {
    respond(200, { data: served });
    expect(await fetchSponsoredCard("a b")).toEqual({
      ok: true,
      data: {
        token: "tok_1",
        companyName: "Acme",
        headline: "Half off",
        body: "This week only.",
        imageUrl: "https://cdn/acme.png",
        ctaLabel: "Shop now",
        ctaKind: "link",
        clickUrl: "https://acme.example/offer",
        formToken: null,
      },
    });
    expect(lastRequest().path).toBe(
      "/commercial/serve/?placement=chat&conversation=a%20b",
    );
  });

  it("fills in what a sparse card leaves out", async () => {
    respond(200, { data: { token: "tok_2", form_token: "form_1" } });
    expect(await fetchSponsoredCard(7)).toEqual({
      ok: true,
      data: {
        token: "tok_2",
        companyName: "",
        headline: "",
        body: "",
        imageUrl: null,
        ctaLabel: "",
        ctaKind: "link",
        clickUrl: null,
        formToken: "form_1",
      },
    });
  });

  it("shows nothing when there is no card, or one with nowhere to go", async () => {
    respond(200, { data: null });
    expect(await fetchSponsoredCard(7)).toEqual({ ok: true, data: null });
    respond(200, { data: { click_url: "https://x" } });
    expect(await fetchSponsoredCard(7)).toEqual({ ok: true, data: null });
    respond(200, { data: { token: "tok_3" } });
    expect(await fetchSponsoredCard(7)).toEqual({ ok: true, data: null });
  });

  it("passes a failed load through", async () => {
    respond(500, {});
    expect(await fetchSponsoredCard(7)).toMatchObject({
      ok: false,
      message: "Couldn't load the sponsored card.",
    });
  });

  it("reports a view with the card's token", async () => {
    respond(200, { data: null });
    await reportSponsoredView("tok_1");
    expect(lastRequest()).toEqual({
      path: "/commercial/impressions/",
      method: "POST",
      body: { token: "tok_1" },
    });
  });

  it("opens the lead form, prefilled", async () => {
    respond(200, {
      data: {
        company_name: "Acme",
        headline: "Get a quote",
        fields: { name: "Sam", phone: "+1555", email: "sam@example.com" },
        consent: "Acme may contact you.",
        already_sent: true,
      },
    });
    expect(await openLeadForm("form_1")).toEqual({
      ok: true,
      data: {
        companyName: "Acme",
        headline: "Get a quote",
        fields: { name: "Sam", phone: "+1555", email: "sam@example.com" },
        consent: "Acme may contact you.",
        alreadySent: true,
      },
    });
    expect(lastRequest().body).toEqual({ token: "form_1" });

    respond(200, { data: "odd" });
    expect(await openLeadForm("form_1")).toEqual({
      ok: true,
      data: {
        companyName: "",
        headline: "",
        fields: { name: "", phone: "", email: "" },
        consent: "",
        alreadySent: false,
      },
    });

    respond(400, { message: "This form has closed." });
    expect(await openLeadForm("form_1")).toMatchObject({
      ok: false,
      message: "This form has closed.",
    });
  });

  it("sends the lead with the form's token", async () => {
    respond(201, { data: { id: 3 } });
    const details = {
      name: "Sam",
      phone: "+1555",
      email: "sam@example.com",
      message: "Call me",
    };
    expect(await sendLead("form_1", details)).toEqual({
      ok: true,
      data: { id: 3 },
    });
    expect(lastRequest()).toEqual({
      path: "/commercial/leads/",
      method: "POST",
      body: { token: "form_1", ...details },
    });
  });
});
