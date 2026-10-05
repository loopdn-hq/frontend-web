import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import {
  fetchAccountSettings,
  saveAccountSettings,
} from "@/lib/user/accountSettings";
import { blockUser, fetchBlockedUsers, unblockUser } from "@/lib/user/blocks";
import { inviteToApp } from "@/lib/user/invites";
import {
  defaultMessagingPreferences,
  MESSAGING_GROUPS,
  saveLocalMessagingPreferences,
  useLocalMessagingPreferences,
} from "@/lib/user/messagingPreferences";
import {
  defaultLocalNotificationPreferences,
  NOTIFICATION_GROUPS,
  saveLocalNotificationPreferences,
  useLocalNotificationPreferences,
} from "@/lib/user/notificationPreferences";
import {
  defaultLocalPrivacyPreferences,
  PRIVACY_GROUPS,
  saveLocalPrivacyPreferences,
  useLocalPrivacyPreferences,
} from "@/lib/user/privacyPreferences";
import { MIN_USER_SEARCH_LENGTH, searchUsers } from "@/lib/user/search";
import { brokenResponse, jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [path, init] = vi.mocked(authorizedRequest).mock.calls.at(-1)!;
  return {
    path,
    method: (init as RequestInit | undefined)?.method,
    body: JSON.parse(((init as RequestInit | undefined)?.body as string) ?? "null"),
  };
}

/** The three ways a call can fail that are not the server saying no. */
async function expectNetworkFailures(
  call: () => Promise<{ ok: boolean; message?: string }>,
) {
  vi.mocked(authorizedRequest).mockRejectedValue(new Error("Signed out."));
  expect(await call()).toEqual({ ok: false, message: "Signed out." });

  vi.mocked(authorizedRequest).mockRejectedValue("not an error");
  expect(await call()).toEqual({
    ok: false,
    message: "Network error. Please try again.",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("fetchAccountSettings", () => {
  it("translates each screen from the API's names to the app's", async () => {
    respond(200, {
      data: {
        messaging: { enter_to_send: false, sms_enabled: true, unknown: 1 },
        notifications: { mentions_replies: false, sound: "none" },
        privacy: { direct_messages_from: "loops", read_receipts_enabled: false },
      },
    });

    expect(await fetchAccountSettings()).toEqual({
      ok: true,
      settings: {
        messaging: { enterToSend: false, smsDelivery: true },
        notifications: { mentionsAndReplies: false, sound: "none" },
        privacy: { directMessages: "loops", readReceipts: false },
      },
    });
    expect(lastRequest().path).toBe("/users/me/settings/");
  });

  it("returns empty screens rather than failing on an empty answer", async () => {
    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(200));
    expect(await fetchAccountSettings()).toEqual({
      ok: true,
      settings: { messaging: {}, notifications: {}, privacy: {} },
    });
  });

  it("reports a refusal with the server's words, or its own", async () => {
    respond(500, { message: "Settings are down." });
    expect(await fetchAccountSettings()).toEqual({
      ok: false,
      message: "Settings are down.",
    });
    respond(500, {});
    expect(await fetchAccountSettings()).toEqual({
      ok: false,
      message: "Could not load your settings.",
    });
    await expectNetworkFailures(fetchAccountSettings);
  });
});

describe("saveAccountSettings", () => {
  it("patches only the changed keys, under the API's names", async () => {
    respond(200, { data: { discoverable_by_phone: false } });
    const result = await saveAccountSettings("privacy", {
      findByPhone: false,
      // A key this screen does not own, and one with no value, are dropped.
      ...({ nonsense: true, findByEmail: undefined } as object),
    });

    expect(lastRequest()).toEqual({
      path: "/users/me/settings/privacy/",
      method: "PATCH",
      body: { discoverable_by_phone: false },
    });
    expect(result).toEqual({ ok: true, values: { findByPhone: false } });
  });

  it("returns nothing changed when the server sends no data back", async () => {
    respond(200, {});
    expect(await saveAccountSettings("messaging", { enterToSend: true })).toEqual(
      { ok: true, values: {} },
    );
  });

  it("reports a refusal", async () => {
    respond(400, { message: "Pick a valid audience." });
    expect(
      await saveAccountSettings("privacy", { directMessages: "nobody" }),
    ).toEqual({ ok: false, message: "Pick a valid audience." });

    respond(400, {});
    expect(
      await saveAccountSettings("notifications", { messages: false }),
    ).toEqual({ ok: false, message: "Couldn't save that. Try again." });

    await expectNetworkFailures(() =>
      saveAccountSettings("notifications", { messages: false }),
    );
  });
});

describe("blocked users", () => {
  it("labels each entry with the best name it has", async () => {
    const row = {
      id: 1,
      username: "sam",
      display_label: "Sam Wren",
      phone_number: "+15550001111",
      created_at: "2026-10-01T00:00:00Z",
    };
    respond(200, {
      data: [
        row,
        { ...row, id: 2, display_label: null },
        { ...row, id: 3, display_label: "", username: null },
        { ...row, id: 4, display_label: null, username: null, phone_number: null },
      ],
    });

    const result = await fetchBlockedUsers();
    expect(result.ok && result.blocked.map((entry) => entry.label)).toEqual([
      "Sam Wren",
      "sam",
      "+15550001111",
      "Unknown",
    ]);
    expect(result.ok && result.blocked[0]).toEqual({
      id: 1,
      label: "Sam Wren",
      username: "sam",
      phoneNumber: "+15550001111",
      blockedAt: "2026-10-01T00:00:00Z",
    });
  });

  it("treats a missing list as empty, and reports a failed load", async () => {
    respond(200, {});
    expect(await fetchBlockedUsers()).toEqual({ ok: true, blocked: [] });

    respond(500, { message: "Nope." });
    expect(await fetchBlockedUsers()).toEqual({ ok: false, message: "Nope." });
    respond(500, null);
    expect(await fetchBlockedUsers()).toEqual({
      ok: false,
      message: "Could not load your blocked list.",
    });
    await expectNetworkFailures(fetchBlockedUsers);
  });

  it("blocks by username when there is one, by phone otherwise", async () => {
    respond(200, {});
    expect(await blockUser({ username: "sam", phoneNumber: "+1555" })).toEqual({
      ok: true,
    });
    expect(lastRequest()).toEqual({
      path: "/users/me/blocks/add/",
      method: "POST",
      body: { username: "sam" },
    });

    await unblockUser({ username: null, phoneNumber: "+15550001111" });
    expect(lastRequest()).toEqual({
      path: "/users/me/blocks/remove/",
      method: "POST",
      body: { phone_number: "+15550001111" },
    });
  });

  it("reports a refused block or unblock", async () => {
    const target = { username: "sam", phoneNumber: null };
    respond(400, { message: "You cannot block yourself." });
    expect(await blockUser(target)).toEqual({
      ok: false,
      message: "You cannot block yourself.",
    });

    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(500));
    expect(await blockUser(target)).toEqual({
      ok: false,
      message: "Could not block them.",
    });
    expect(await unblockUser(target)).toEqual({
      ok: false,
      message: "Could not unblock them.",
    });
    await expectNetworkFailures(() => blockUser(target));
  });
});

describe("inviteToApp", () => {
  it("says whether the person was already here", async () => {
    respond(200, { data: { outcome: "invited" } });
    expect(await inviteToApp("sam@example.com")).toEqual({
      ok: true,
      alreadyHere: false,
    });
    expect(lastRequest()).toEqual({
      path: "/users/invite/",
      method: "POST",
      body: { email: "sam@example.com" },
    });

    respond(200, { data: { outcome: "already_here" } });
    expect(await inviteToApp("sam@example.com")).toEqual({
      ok: true,
      alreadyHere: true,
    });
  });

  it("reports a refusal", async () => {
    respond(429, { message: "Too many invitations today." });
    expect(await inviteToApp("sam@example.com")).toEqual({
      ok: false,
      message: "Too many invitations today.",
    });
    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(500));
    expect(await inviteToApp("sam@example.com")).toEqual({
      ok: false,
      message: "Couldn't send that invitation. Try again.",
    });
    await expectNetworkFailures(() => inviteToApp("sam@example.com"));
  });
});

describe("searchUsers", () => {
  it("returns people with a username, named as their profile says", async () => {
    respond(200, {
      data: {
        next: "https://api/users/search/?q=sa&page=2",
        results: [
          {
            id: 7,
            username: "sam",
            profile: { display_label: "Sam Wren", avatar_url: "https://a/1.png" },
          },
          { id: "8", username: "sasha", profile: { display_label: null } },
          { id: 9, username: "" },
          { id: 10 },
        ],
      },
    });

    expect(await searchUsers("  sa & co ")).toEqual({
      ok: true,
      hasMore: true,
      users: [
        { id: "7", username: "sam", name: "Sam Wren", avatarUrl: "https://a/1.png" },
        { id: "8", username: "sasha", name: "sasha", avatarUrl: undefined },
      ],
    });
    expect(lastRequest().path).toBe("/users/search/?q=sa%20%26%20co");
    expect(MIN_USER_SEARCH_LENGTH).toBe(2);
  });

  it("returns nobody for an empty answer, and reports a failure", async () => {
    respond(200, {});
    expect(await searchUsers("sa")).toEqual({
      ok: true,
      users: [],
      hasMore: false,
    });

    respond(400, { message: "Type at least two characters." });
    expect(await searchUsers("s")).toEqual({
      ok: false,
      message: "Type at least two characters.",
    });
    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(500));
    expect(await searchUsers("sa")).toEqual({
      ok: false,
      message: "Search failed.",
    });
    await expectNetworkFailures(() => searchUsers("sa"));
  });
});

describe("the browser's copy of each settings screen", () => {
  it("starts from the defaults and keeps what is saved", () => {
    const messaging = renderHook(() => useLocalMessagingPreferences());
    const notifications = renderHook(() => useLocalNotificationPreferences());
    const privacy = renderHook(() => useLocalPrivacyPreferences());

    expect(messaging.result.current.enterToSend).toBe(true);
    expect(notifications.result.current).toEqual(
      defaultLocalNotificationPreferences,
    );
    expect(privacy.result.current).toEqual(defaultLocalPrivacyPreferences);

    act(() => {
      saveLocalMessagingPreferences({ enterToSend: false });
      saveLocalNotificationPreferences({ sound: "none" });
      saveLocalPrivacyPreferences({ groupAdds: "nobody" });
    });

    expect(messaging.result.current.enterToSend).toBe(false);
    expect(notifications.result.current.sound).toBe("none");
    expect(privacy.result.current.groupAdds).toBe("nobody");
    expect(JSON.parse(localStorage.getItem("loopdn_privacy_prefs")!)).toMatchObject(
      { groupAdds: "nobody" },
    );
  });

  it("has a row for every setting each screen stores", () => {
    const keys = (groups: readonly { rows: readonly { key: string }[] }[]) =>
      groups.flatMap((group) => group.rows.map((row) => row.key)).sort();

    expect(keys(MESSAGING_GROUPS)).toEqual(
      Object.keys(defaultMessagingPreferences).sort(),
    );
    expect(keys(NOTIFICATION_GROUPS)).toEqual(
      Object.keys(defaultLocalNotificationPreferences).sort(),
    );
    expect(keys(PRIVACY_GROUPS)).toEqual(
      Object.keys(defaultLocalPrivacyPreferences).sort(),
    );
  });
});
