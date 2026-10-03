import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import {
  attachGroupWhatsApp,
  fetchConnections,
  fetchGroupWhatsApp,
  inviteByWhatsApp,
  setGroupWhatsAppConsent,
} from "@/lib/whatsapp/api";

/** The envelope every endpoint answers with (loopd/renderers.py). */
function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response);
}

function lastRequest() {
  const call = vi.mocked(authorizedRequest).mock.calls.at(-1);
  return {
    path: call?.[0] as string,
    init: (call?.[1] ?? {}) as RequestInit,
    body: JSON.parse(((call?.[1] as RequestInit)?.body as string) ?? "null"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("failure handling", () => {
  it("lifts `reason` out of a 400 so callers branch on it, not on wording", async () => {
    respond(400, {
      code: -1,
      message: "Connect WhatsApp Business first.",
      data: {
        detail: "Connect WhatsApp Business first.",
        reason: "whatsapp_not_connected",
      },
    });

    const result = await inviteByWhatsApp(12, {
      phoneNumber: "+15550001111",
      displayName: "Sam",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("whatsapp_not_connected");
    expect(result.message).toBe("Connect WhatsApp Business first.");
    expect(result.status).toBe(400);
  });

  it("keeps every documented reason, and drops one it does not know", async () => {
    for (const reason of [
      "choose_connection",
      "no_verified_number",
      "not_admin",
      "keyword_taken",
      "not_attached",
      "number_in_use",
      "suspended",
    ]) {
      respond(400, { message: "no", data: { reason } });
      const result = await fetchGroupWhatsApp(1);
      expect(result.ok ? null : result.reason).toBe(reason);
    }

    respond(400, { message: "no", data: { reason: "something_new" } });
    const unknown = await fetchGroupWhatsApp(1);
    // Unknown reasons become null rather than being passed through: a caller
    // switching on them must fall to its default branch, not match by luck.
    expect(unknown.ok ? null : unknown.reason).toBeNull();
  });

  it("marks 503 retryable and 429 rate limited", async () => {
    respond(503, { message: "WhatsApp is unavailable right now." });
    const unavailable = await fetchConnections();
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) {
      expect(unavailable.retryable).toBe(true);
      expect(unavailable.rateLimited).toBe(false);
    }

    respond(429, { message: "Too many invitations. Try again shortly." });
    const throttled = await inviteByWhatsApp(1, { participant: 5 });
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) {
      expect(throttled.rateLimited).toBe(true);
      expect(throttled.message).toMatch(/too many/i);
    }
  });

  it("survives a network failure without throwing", async () => {
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    const result = await fetchConnections();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });
});

describe("payloads", () => {
  it("reads a connection, including the groups using it", async () => {
    respond(200, {
      data: {
        results: [
          {
            id: 3,
            status: "active",
            waba_id: "w1",
            phone_number_id: "p1",
            display_phone_number: "+1 555 000 1111",
            verified_name: "Acme",
            quality_rating: "GREEN",
            messaging_limit_tier: "TIER_1K",
            notification_template_name: "group_message",
            notification_template_language: "en_US",
            invitation_template_name: "group_invitation",
            last_error: "",
            connected_at: "2026-09-01T10:00:00Z",
            groups: [{ id: 9, name: "Team", keyword: "team" }],
          },
        ],
      },
    });

    const result = await fetchConnections();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].verifiedName).toBe("Acme");
    expect(result.data[0].groups[0]).toEqual({
      id: 9,
      name: "Team",
      keyword: "team",
    });
  });

  it("reads a member's own standing in a group", async () => {
    respond(200, {
      data: {
        connected: true,
        is_admin: false,
        my_consent: "opted_in",
        my_number_verified: true,
        channel: {
          id: 4,
          keyword: "team",
          display_phone_number: "+1 555 000 1111",
          verified_name: "Acme",
          connection_status: "active",
          delivery_enabled: true,
          replies_enabled: false,
          join_link: "https://wa.me/15550001111?text=START",
        },
      },
    });

    const result = await fetchGroupWhatsApp(9);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.myConsent).toBe("opted_in");
    expect(result.data.isAdmin).toBe(false);
    expect(result.data.channel?.repliesEnabled).toBe(false);
    expect(result.data.channel?.joinLink).toContain("wa.me");
  });

  it("treats an unknown consent value as never asked", async () => {
    respond(200, {
      data: { connected: false, channel: null, my_consent: "weird" },
    });
    const result = await fetchGroupWhatsApp(9);
    expect(result.ok && result.data.myConsent).toBeNull();
  });

  it("sends a member invite and a phone invite as different bodies", async () => {
    respond(201, {
      data: {
        outcome: "invited",
        participant: 5,
        channel: null,
        delivery_status: "sent",
        reason: "",
      },
    });

    await inviteByWhatsApp(9, { participant: 5, connection: 2 });
    expect(lastRequest().body).toEqual({ participant: 5, connection: 2 });

    await inviteByWhatsApp(9, {
      phoneNumber: "+15550001111",
      displayName: "Sam",
    });
    expect(lastRequest().body).toEqual({
      phone_number: "+15550001111",
      display_name: "Sam",
    });
    // Never both: the serializer refuses a body carrying the two.
    expect(lastRequest().body).not.toHaveProperty("participant");
  });

  it("only sends the attach fields it was given", async () => {
    respond(200, { data: { connected: true, channel: null } });

    await attachGroupWhatsApp(9, { connection: 2 });
    expect(lastRequest().body).toEqual({ connection: 2 });

    await attachGroupWhatsApp(9, { connection: 2, deliveryEnabled: false });
    expect(lastRequest().body).toEqual({
      connection: 2,
      delivery_enabled: false,
    });
    expect(lastRequest().init.method).toBe("PUT");
  });

  it("puts the member's own consent on the consent route", async () => {
    respond(200, { data: { connected: true, channel: null } });
    await setGroupWhatsAppConsent(9, true);
    expect(lastRequest().path).toBe("/whatsapp/groups/9/consent/");
    expect(lastRequest().body).toEqual({ enabled: true });
  });
});
