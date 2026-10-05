import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  canActOnContent,
  canDeleteMessage,
  canEditMessage,
  canPinMessage,
  DELETED_MESSAGE_TEXT,
} from "@/lib/chat/messageActions";
import {
  REACTION_EMOJI,
  REACTION_LABEL,
  reactionLabel,
} from "@/lib/chat/reactions";
import { GROUP } from "@/lib/rbac";
import { jsonResponse } from "@/test/helpers";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("reactions", () => {
  it("names every emoji on offer, and falls back to the emoji itself", () => {
    for (const emoji of REACTION_EMOJI) {
      expect(REACTION_LABEL[emoji]).toBeTruthy();
    }
    expect(reactionLabel("👍")).toBe("Thumbs up");
    expect(reactionLabel("🦄")).toBe("🦄");
  });
});

describe("message actions", () => {
  const mine = { mine: true, source: "app", deletedAt: null, text: "hi" };
  const theirs = { ...mine, mine: false };
  const deleted = { ...mine, deletedAt: "2026-10-05T12:00:00Z" };

  it("lets only the sender edit, and only what was sent from the app", () => {
    expect(canEditMessage(mine as never)).toBe(true);
    expect(canEditMessage(theirs as never)).toBe(false);
    expect(canEditMessage({ ...mine, source: "sms" } as never)).toBe(false);
    expect(canEditMessage(deleted as never)).toBe(false);
  });

  it("lets the sender delete their own, and a moderator anybody's", () => {
    expect(canDeleteMessage(mine as never, false)).toBe(true);
    expect(canDeleteMessage(theirs as never, false)).toBe(false);
    expect(canDeleteMessage(theirs as never, true)).toBe(true);
    expect(canDeleteMessage(deleted as never, true)).toBe(false);
  });

  it("takes pinning from the conversation's features", () => {
    expect(canPinMessage({ features: [GROUP.pin] }, mine as never)).toBe(true);
    expect(canPinMessage({ features: [] }, mine as never)).toBe(false);
    expect(canPinMessage({ features: [GROUP.pin] }, deleted as never)).toBe(
      false,
    );
  });

  it("offers nothing on a deleted message", () => {
    expect(canActOnContent(mine as never)).toBe(true);
    expect(canActOnContent(deleted as never)).toBe(false);
    expect(DELETED_MESSAGE_TEXT).toBe("This message was deleted");
  });
});

describe("fetchGroupOptions", () => {
  // Fresh module per case: the answer is cached at module scope.
  async function load() {
    const conversations = await import("@/lib/chat/conversations");
    const { fetchGroupOptions } = await import("@/lib/chat/groupOptions");
    return {
      fetchGroupOptions,
      request: vi.mocked(conversations.authorizedRequest),
    };
  }

  it("reads the kinds and places, skipping rows that are not objects", async () => {
    const { fetchGroupOptions, request } = await load();
    request.mockResolvedValue(
      jsonResponse(200, {
        data: {
          categories: [{ slug: "sports", label: "Sports" }, "junk"],
          countries: [
            {
              code: "US",
              name: "United States",
              regions: [{ code: "CA", name: "California" }, null],
            },
            { code: "PH", name: "Philippines" },
            7,
          ],
        },
      }),
    );

    const result = await fetchGroupOptions();
    expect(result).toEqual({
      ok: true,
      data: {
        categories: [{ slug: "sports", label: "Sports" }],
        countries: [
          {
            code: "US",
            name: "United States",
            regions: [{ code: "CA", name: "California" }],
          },
          { code: "PH", name: "Philippines", regions: [] },
        ],
      },
    });
  });

  it("asks once, however many callers there are", async () => {
    const { fetchGroupOptions, request } = await load();
    request.mockResolvedValue(jsonResponse(200, { data: "odd" }));
    const [first, second] = await Promise.all([
      fetchGroupOptions(),
      fetchGroupOptions(),
    ]);
    await fetchGroupOptions();
    expect(request).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first).toEqual({
      ok: true,
      data: { categories: [], countries: [] },
    });
  });

  it("tries again after a failure", async () => {
    const { fetchGroupOptions, request } = await load();
    request.mockResolvedValue(jsonResponse(500, {}));
    expect(await fetchGroupOptions()).toMatchObject({
      ok: false,
      message: "Couldn't load the group options.",
    });

    request.mockResolvedValue(jsonResponse(200, { data: {} }));
    expect((await fetchGroupOptions()).ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
