import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth/client", () => ({ getSession: () => "sam" }));
vi.mock("@/lib/app/AppShellProvider", async () => ({
  useAppShell: (await import("@/test/homeShell")).useFakeAppShell,
}));
// The network half of the module is faked; reading and merging stay real.
vi.mock("@/lib/chat/conversations", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/chat/conversations",
  );
  const real = new Set([
    "mergeConversations",
    "conversationMode",
    "directCounterpart",
    "hasReacted",
    "normalizeConversationPayload",
    "normalizeMessagePayload",
    "normalizeParticipant",
    "normalizeReplyTo",
  ]);
  return Object.fromEntries(
    Object.entries(actual).map(([name, value]) => [
      name,
      typeof value === "function" && !real.has(name) ? vi.fn() : value,
    ]),
  );
});
vi.mock("@/lib/billing", () => ({
  createPlanCheckoutSession: vi.fn(),
  fetchBillingPlans: vi.fn(),
  fetchBillingSummary: vi.fn(),
}));
vi.mock("@/lib/user/blocks", () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));
vi.mock("@/lib/hooks/useCopyToClipboard", async () => {
  const { clipboard } = await import("@/test/homeShell");
  return { useCopyToClipboard: () => ({ ...clipboard }) };
});
vi.mock("@/lib/user/messagingPreferences", async () => {
  const { shell } = await import("@/test/homeShell");
  return {
    useLocalMessagingPreferences: () => ({ enterToSend: shell.enterToSend }),
  };
});
vi.mock("@/lib/config/origin", () => ({
  publicOrigin: () => "https://loopdn.com",
}));
vi.mock("@/components/app/NavDrawerButton", () => ({
  NavDrawerButton: () => null,
}));
vi.mock("@/components/app/LoopdnLogo", () => ({ LoopdnLogo: () => null }));
vi.mock("@/components/calls/ConversationCallButtons", async () => ({
  ConversationCallButtons: (await import("@/test/homeShell")).CallButtonsStub,
}));
vi.mock("@/components/home/SponsoredSlot", async () => {
  const stubs = await import("@/test/homeShell");
  return {
    SponsoredSlot: stubs.SponsoredStub,
    useSponsoredSlot: stubs.useFakeSponsoredSlot,
  };
});
vi.mock("@/components/home/CreateLoopModal", async () => ({
  CreateLoopModal: (await import("@/test/homeShell")).CreateLoopStub,
}));
vi.mock("@/components/home/JoinLoopModal", async () => ({
  JoinLoopModal: (await import("@/test/homeShell")).JoinLoopStub,
}));
vi.mock("@/components/home/AddMembersModal", async () => ({
  AddMembersModal: (await import("@/test/homeShell")).AddMembersStub,
}));
vi.mock("@/components/home/LoopAdminPanel", async () => ({
  LoopAdminPanel: (await import("@/test/homeShell")).AdminPanelStub,
}));
vi.mock("@/components/home/NewConversationModal", async () => ({
  NewConversationModal: (await import("@/test/homeShell")).NewConversationStub,
}));

import {
  fetchConversation,
  fetchConversationParticipants,
  fetchMessageHistory,
  markConversationRead,
  sendConversationMessage,
} from "@/lib/chat/conversations";
import { GROUP } from "@/lib/rbac/conversation";
import { deferred } from "@/test/helpers";
import { emitFrame, shell } from "@/test/homeShell";
import {
  ADA,
  LIN,
  SAM,
  SETTINGS,
  composer,
  conversation,
  direct,
  flush,
  historyIs,
  list,
  listed,
  message,
  mine,
  minutesAgo,
  panel,
  person,
  planIs,
  renderShell,
  resetHomeShell,
  row,
  rowButton,
  subtitle,
  wireMessage,
} from "@/test/homeShellApi";

type History = Awaited<ReturnType<typeof fetchMessageHistory>>;

async function emit(frame: Record<string, unknown>) {
  await act(async () => emitFrame(frame));
  await flush();
}

function sendAnswers(result: unknown) {
  vi.mocked(sendConversationMessage).mockResolvedValue(result as never);
}

beforeEach(() => {
  resetHomeShell();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomeShell - the chat list", () => {
  it("shows a skeleton while the list loads", async () => {
    shell.isLoadingConversations = true;
    await renderShell([]);
    expect(list().getByRole("status")).toBeInTheDocument();
    expect(list().queryByText("No chats yet")).not.toBeInTheDocument();
  });

  it("says why the list could not be loaded, and loads again on request", async () => {
    shell.conversationsError = "Unable to load your Loops.";
    await renderShell([]);
    expect(list().getByRole("alert")).toHaveTextContent(
      "Couldn't load your chats",
    );
    expect(list().getByRole("alert")).toHaveTextContent(
      "Unable to load your Loops.",
    );
    await userEvent.click(list().getByRole("button", { name: "Try again" }));
    expect(shell.reloadConversations).toHaveBeenCalled();
  });

  it("invites a first Loop when there are no chats", async () => {
    await renderShell([]);
    expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();
    expect(list().getByText("No chats yet")).toBeInTheDocument();
    expect(
      list().getByText("Create a loop to get started"),
    ).toBeInTheDocument();
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
    expect(panel().getByText("No Loop Selected")).toBeInTheDocument();
    expect(
      panel().getByText("Select or create a Loop to start chatting"),
    ).toBeInTheDocument();
  });

  it("lists only the conversations of its mode, leaving out cleared ones", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "News", { mode: "broadcast" }),
      conversation(3, "Gone", { cleared: true }),
      conversation(4, "Old", { archived: true }),
    ]);
    expect(listed()).toEqual(["Book Club"]);
  });

  it("shows the broadcast Loops on the broadcast screen", async () => {
    const first = await renderShell(
      [
        conversation(1, "Book Club"),
        conversation(2, "News", { mode: "broadcast" }),
      ],
      "broadcast",
    );
    expect(
      screen.getByRole("heading", { name: "Broadcast" }),
    ).toBeInTheDocument();
    expect(listed()).toEqual(["News"]);
    first.unmount();

    await renderShell([], "broadcast");
    expect(list().getByText("No broadcast Loops yet")).toBeInTheDocument();
    expect(
      list().getByText("Loops set to broadcast mode appear here"),
    ).toBeInTheDocument();
  });

  it("shows what each row needs: the preview, the badge, admin and muted", async () => {
    await renderShell([
      conversation(1, "Book Club", {
        isAdmin: true,
        muted: true,
        unread: 120,
        preview: "Ada: See you at noon",
        lastMessageAt: minutesAgo(3),
      }),
      direct(2, ADA, { isAdmin: true }),
    ]);
    expect(row("Book Club")).toHaveTextContent("Admin");
    expect(row("Book Club")).toHaveTextContent("Ada: See you at noon");
    expect(row("Book Club")).toHaveTextContent("99+");
    expect(
      row("Book Club").querySelector("[aria-label='Muted']"),
    ).not.toBeNull();
    // Admin is a thing a group has, not a one-to-one.
    expect(row("Ada")).not.toHaveTextContent("Admin");
  });

  it("filters by unread, groups and archived, and searches by name", async () => {
    await renderShell([
      conversation(1, "Book Club", { unread: 2 }),
      conversation(2, "Runners"),
      direct(3, ADA),
      conversation(4, "Old Loop", { archived: true, unread: 5 }),
    ]);
    expect(listed()).toEqual(["Book Club", "Runners", "Ada"]);
    expect(list().getByRole("button", { name: /^Unread/ })).toHaveTextContent(
      "Unread1",
    );
    expect(list().getByRole("button", { name: /^Archived/ })).toHaveTextContent(
      "Archived5",
    );

    await userEvent.click(list().getByRole("button", { name: /^Unread/ }));
    expect(listed()).toEqual(["Book Club"]);
    await userEvent.click(list().getByRole("button", { name: "Groups" }));
    expect(listed()).toEqual(["Book Club", "Runners"]);
    await userEvent.click(list().getByRole("button", { name: /^Archived/ }));
    expect(listed()).toEqual(["Old Loop"]);

    await userEvent.click(list().getByRole("button", { name: "All" }));
    await userEvent.type(list().getByRole("searchbox"), " RUN ");
    expect(listed()).toEqual(["Runners"]);
  });

  it("says when a filter leaves nothing, and has no Archived chip with nothing archived", async () => {
    await renderShell([direct(1, ADA)]);
    expect(
      list().queryByRole("button", { name: /^Archived/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(list().getByRole("button", { name: "Unread" }));
    expect(list().getByText("Nothing unread")).toBeInTheDocument();
    expect(list().getByText("Try another filter.")).toBeInTheDocument();
    await userEvent.click(list().getByRole("button", { name: "Groups" }));
    expect(list().getByText("No groups yet")).toBeInTheDocument();
  });

  it("says Nothing archived once the last archived chat is searched away", async () => {
    await renderShell([conversation(4, "Old Loop", { archived: true })]);
    await userEvent.click(list().getByRole("button", { name: /^Archived/ }));
    await userEvent.type(list().getByRole("searchbox"), "zzz");
    expect(list().getByText("Nothing archived")).toBeInTheDocument();
  });

  it("loads more of the list near its end, but not while filtering or searching", async () => {
    shell.hasMoreConversations = true;
    await renderShell([conversation(1, "Book Club")]);
    const scroller = row("Book Club").closest("[class*='overflow']")!;
    const near = () => {
      Object.defineProperties(scroller, {
        scrollHeight: { configurable: true, value: 1000 },
        scrollTop: { configurable: true, value: 500 },
        clientHeight: { configurable: true, value: 400 },
      });
      fireEvent.scroll(scroller);
    };

    near();
    expect(shell.loadMoreConversations).toHaveBeenCalledTimes(1);

    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 0,
    });
    fireEvent.scroll(scroller);
    expect(shell.loadMoreConversations).toHaveBeenCalledTimes(1);

    await userEvent.type(list().getByRole("searchbox"), "b");
    near();
    await userEvent.clear(list().getByRole("searchbox"));
    await userEvent.click(list().getByRole("button", { name: "Groups" }));
    near();
    expect(shell.loadMoreConversations).toHaveBeenCalledTimes(1);
  });

  it("does not ask for more while more is loading, or when there is none", async () => {
    shell.hasMoreConversations = true;
    shell.isLoadingMoreConversations = true;
    const first = await renderShell([conversation(1, "Book Club")]);
    expect(list().getByText("Loading more...")).toBeInTheDocument();
    fireEvent.scroll(row("Book Club").closest("[class*='overflow']")!);
    first.unmount();

    shell.hasMoreConversations = false;
    shell.isLoadingMoreConversations = false;
    await renderShell([conversation(1, "Book Club")]);
    fireEvent.scroll(row("Book Club").closest("[class*='overflow']")!);
    expect(shell.loadMoreConversations).not.toHaveBeenCalled();
  });

  it("shows the plan and how much of it is used", async () => {
    planIs({
      code: "premium",
      name: "Premium",
      maxGroups: 5,
      maxMembersPerGroup: 50,
      maxAdminsPerGroup: 3,
    });
    await renderShell([
      conversation(1, "Mine", { createdByUsername: "sam" }),
      conversation(2, "Old mine", { isAdmin: true }),
      conversation(3, "Theirs", { createdByUsername: "ada", isAdmin: true }),
      direct(4, ADA),
    ]);
    expect(
      list().getByText(
        "Plan: Premium · Groups 2/5 · Members per group up to 50",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the limits off an unlimited plan, and says when billing is down", async () => {
    const first = await renderShell([]);
    expect(list().getByText("Plan: Free · Groups 0")).toBeInTheDocument();
    first.unmount();

    planIs(null);
    await renderShell([]);
    expect(
      list().getByText("Billing info unavailable right now: Billing is down."),
    ).toBeInTheDocument();
    expect(list().queryByText(/^Plan:/)).not.toBeInTheDocument();
  });

  it("ignores billing that arrives after it has gone", async () => {
    const view = await renderShell([]);
    view.unmount();
    await flush();
    expect(screen.queryByText(/^Plan:/)).not.toBeInTheDocument();
  });
});

describe("HomeShell - the Loop menu", () => {
  const openMenu = () =>
    userEvent.click(list().getByRole("button", { name: "Loop menu" }));

  it("marks every chat in this mode as read", async () => {
    await renderShell([
      conversation(1, "Book Club", { unread: 2 }),
      conversation(2, "Runners"),
      conversation(3, "News", { mode: "broadcast", unread: 4 }),
    ]);
    await openMenu();
    await userEvent.click(
      list().getByRole("button", { name: "Mark all as read" }),
    );
    expect(markConversationRead).toHaveBeenCalledWith(1);
    expect(markConversationRead).not.toHaveBeenCalledWith(2);
    expect(shell.latest.map((item) => item.unread)).toEqual([0, 0, 4]);
    expect(
      list().queryByRole("button", { name: "Mark all as read" }),
    ).not.toBeInTheDocument();
  });

  it("selects chats instead of opening them, until it is left", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    vi.mocked(markConversationRead).mockClear();
    await openMenu();
    await userEvent.click(list().getByRole("button", { name: "Select chats" }));
    expect(list().getByText("Selected chats: 0")).toBeInTheDocument();
    expect(
      list().queryByRole("button", { name: "Chat options" }),
    ).not.toBeInTheDocument();

    await userEvent.click(rowButton("Runners"));
    await userEvent.click(rowButton("Book Club"));
    expect(list().getByText("Selected chats: 2")).toBeInTheDocument();
    await userEvent.click(rowButton("Runners"));
    expect(list().getByText("Selected chats: 1")).toBeInTheDocument();
    expect(markConversationRead).not.toHaveBeenCalled();

    await openMenu();
    await userEvent.click(
      list().getByRole("button", { name: "Exit select chats" }),
    );
    expect(list().queryByText(/Selected chats/)).not.toBeInTheDocument();
  });

  it("closes when its button is pressed again", async () => {
    await renderShell([]);
    await openMenu();
    await openMenu();
    expect(
      list().queryByRole("button", { name: "New Loop" }),
    ).not.toBeInTheDocument();
  });
});

describe("HomeShell - opening a conversation", () => {
  it("opens the first conversation by itself", async () => {
    historyIs([message(10, "Hello there")]);
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    expect(
      panel().getByRole("heading", { name: "Book Club" }),
    ).toBeInTheDocument();
    expect(subtitle()).toHaveTextContent("2 members");
    expect(fetchMessageHistory).toHaveBeenCalledWith(1);
    expect(fetchConversation).toHaveBeenCalledWith(1);
    expect(fetchConversationParticipants).toHaveBeenCalledWith(1);
    expect(panel().getByText("Hello there")).toBeInTheDocument();
    expect(panel().getByTestId("call-buttons")).toHaveTextContent("true");
  });

  it("marks a chosen conversation read, and shows its messages", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners", { unread: 3, participants: [SAM] }),
    ]);
    historyIs([message(20, "Run at six", { conversationId: 2 })]);
    await userEvent.click(rowButton("Runners"));
    await flush();

    expect(markConversationRead).toHaveBeenCalledWith(2);
    expect(shell.clearConversationToOpen).toHaveBeenCalled();
    expect(shell.latest.find((item) => item.id === 2)).toMatchObject({
      unread: 0,
      active: true,
    });
    expect(
      panel().getByRole("heading", { name: "Runners" }),
    ).toBeInTheDocument();
    expect(subtitle()).toHaveTextContent(/^1 member(?!s)/);
    expect(panel().getByText("Run at six")).toBeInTheDocument();
  });

  it("opens the conversation another screen asked for", async () => {
    shell.conversationToOpen = "2";
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    expect(fetchMessageHistory).toHaveBeenLastCalledWith("2");
  });

  it("waits for a requested conversation that is not in the list yet", async () => {
    shell.conversationToOpen = 9;
    await renderShell([conversation(1, "Book Club")]);
    expect(
      panel().getByRole("heading", { name: "Book Club" }),
    ).toBeInTheDocument();
  });

  it("takes the members the server sends for the open conversation", async () => {
    vi.mocked(fetchConversationParticipants).mockResolvedValue({
      ok: true,
      participants: [SAM, ADA, LIN],
    } as never);
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    expect(subtitle()).toHaveTextContent("3 members");
    expect(shell.latest[1].participants).toHaveLength(2);
  });

  it("goes back to the list", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.click(
      panel().getByRole("button", { name: "Back to chat list" }),
    );
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
    expect(panel().queryByTestId("call-buttons")).not.toBeInTheDocument();
  });

  it("says whether the other person is online, or when they were last seen", async () => {
    const online = await renderShell([
      direct(1, person("2", "Ada", { isOnline: true })),
    ]);
    expect(panel().getByText("Online")).toBeInTheDocument();
    online.unmount();

    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const seen = await renderShell([
      direct(1, person("2", "Ada", { lastActive: yesterday })),
    ]);
    expect(panel().getByText("Last seen yesterday")).toBeInTheDocument();
    seen.unmount();

    await renderShell([direct(1, ADA)]);
    expect(panel().getByText("Direct Message")).toBeInTheDocument();
    expect(
      panel().queryByRole("button", { name: "Loop Settings" }),
    ).not.toBeInTheDocument();
  });

  it("warns only when the connection is not live", async () => {
    const live = await renderShell([conversation(1, "Book Club")]);
    expect(panel().queryByText("Connecting")).not.toBeInTheDocument();
    live.unmount();

    shell.socketStatus = "connecting";
    const connecting = await renderShell([conversation(1, "Book Club")]);
    expect(panel().getByText("Connecting")).toHaveAttribute(
      "title",
      "WebSocket: connecting",
    );
    connecting.unmount();

    shell.socketStatus = "disconnected";
    await renderShell([conversation(1, "Book Club")]);
    expect(panel().getByText("Offline")).toBeInTheDocument();
  });
});

describe("HomeShell - the thread", () => {
  it("shows a skeleton, then an empty thread", async () => {
    const pending = deferred<History>();
    vi.mocked(fetchMessageHistory).mockReturnValue(pending.promise);
    await renderShell([conversation(1, "Book Club")]);
    expect(panel().getByRole("status")).toHaveTextContent("Loading messages");

    await act(async () =>
      pending.resolve({ ok: true, messages: [], hasMore: false } as never),
    );
    expect(panel().getByText("No messages yet")).toBeInTheDocument();
  });

  it("says why the thread could not be loaded, and loads it again on request", async () => {
    vi.mocked(fetchMessageHistory).mockResolvedValue({
      ok: false,
      message: "Unable to load messages.",
    } as never);
    await renderShell([conversation(1, "Book Club")]);
    expect(panel().getByRole("alert")).toHaveTextContent(
      "Couldn't load this conversation",
    );

    historyIs([message(10, "Hello there")]);
    await userEvent.click(panel().getByRole("button", { name: "Try again" }));
    expect(await panel().findByText("Hello there")).toBeInTheDocument();
  });

  it("files messages under their day, and groups a run from one sender", async () => {
    const lastWeek = new Date(Date.now() - 20 * 24 * 3_600_000).toISOString();
    historyIs([
      message(1, "An old one", { createdAt: lastWeek }),
      message(2, "First", { createdAt: minutesAgo(30) }),
      message(3, "Second", { createdAt: minutesAgo(29) }),
      message(4, "Much later", { createdAt: minutesAgo(10) }),
      mine(5, "Mine", { createdAt: minutesAgo(9), mine: false }),
      message(6, "No time", { createdAt: "" }),
    ]);
    await renderShell([conversation(1, "Book Club")]);
    expect(panel().getByText("Today")).toBeInTheDocument();
    const bubbles = panel().getAllByRole("article");
    // The sender is named at the start of each run only.
    expect(
      bubbles.map((bubble) => bubble.textContent?.startsWith("Ada")),
    ).toEqual([true, true, false, true, false, true]);
    // A message from the signed-in account is theirs even if the server did not say.
    expect(
      panel().getByText("Mine").closest("[data-message-id]")?.className,
    ).toContain("justify-end");
  });

  it("loads older messages above, without repeating any", async () => {
    historyIs([message(10, "Newest")], true);
    await renderShell([conversation(1, "Book Club")]);
    const older = deferred<History>();
    vi.mocked(fetchMessageHistory).mockReturnValue(older.promise);

    await userEvent.click(
      panel().getByRole("button", { name: "Load older messages" }),
    );
    expect(panel().getByRole("button", { name: "Loading..." })).toBeDisabled();
    expect(fetchMessageHistory).toHaveBeenLastCalledWith(1, { page: 2 });

    await act(async () =>
      older.resolve({
        ok: true,
        messages: [message(9, "Older"), message(10, "Newest")],
        hasMore: false,
      } as never),
    );
    await flush();
    expect(
      panel()
        .getAllByRole("article")
        .map((bubble) => bubble.textContent),
    ).toEqual([
      expect.stringContaining("Older"),
      expect.stringContaining("Newest"),
    ]);
    expect(
      panel().queryByRole("button", { name: "Load older messages" }),
    ).not.toBeInTheDocument();
  });

  it("says why older messages could not be loaded", async () => {
    historyIs([message(10, "Newest")], true);
    await renderShell([conversation(1, "Book Club")]);
    vi.mocked(fetchMessageHistory).mockResolvedValue({
      ok: false,
      message: "Unable to load older messages.",
    } as never);
    await userEvent.click(
      panel().getByRole("button", { name: "Load older messages" }),
    );
    expect(
      await panel().findByText("Unable to load older messages."),
    ).toBeInTheDocument();
    expect(
      panel().getByRole("button", { name: "Load older messages" }),
    ).toBeEnabled();
  });

  it("notes whether the reader is at the bottom of the thread", async () => {
    historyIs([message(10, "Newest")]);
    await renderShell([conversation(1, "Book Club")]);
    const scroller = panel()
      .getByText("Newest")
      .closest("[class*='overflow']")!;
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 400 },
    });
    scroller.scrollTop = 0;
    fireEvent.scroll(scroller);

    // Scrolled up, so a new message does not drag the thread down.
    await emit({ type: "message.new", message: wireMessage(11, "Another") });
    expect(scroller.scrollTop).toBe(0);
  });

  it("shows a sponsored card under the message it was pinned to", async () => {
    shell.sponsored = { afterMessageId: "10", card: {} };
    historyIs([message(10, "Newest"), message(11, "After")]);
    await renderShell([conversation(1, "Book Club")]);
    expect(panel().getAllByTestId("sponsored-card")).toHaveLength(1);
  });

  it("catches up on what was missed when the connection comes back", async () => {
    shell.socketStatus = "disconnected";
    historyIs([message(10, "Before")]);
    const view = await renderShell([conversation(1, "Book Club")]);

    vi.mocked(fetchMessageHistory)
      .mockResolvedValueOnce({
        ok: true,
        messages: [message(10, "Before"), message(11, "Missed one")],
        hasMore: true,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        messages: [message(11, "Missed one")],
        hasMore: true,
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        messages: [message(12, "Missed two")],
        hasMore: false,
      } as never);
    shell.socketStatus = "connected";
    view.rerender();
    await flush();

    expect(fetchMessageHistory).toHaveBeenCalledWith(1, { afterId: 10 });
    expect(fetchMessageHistory).toHaveBeenCalledWith(1, { afterId: 11 });
    expect(panel().getAllByRole("article")).toHaveLength(3);
    expect(panel().getByText("Missed two")).toBeInTheDocument();
  });

  it("gives up catching up after ten pages, and says so in the console", async () => {
    shell.socketStatus = "disconnected";
    historyIs([message(10, "Before")]);
    const view = await renderShell([conversation(1, "Book Club")]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    let next = 10;
    vi.mocked(fetchMessageHistory).mockImplementation(async () => {
      next += 1;
      return {
        ok: true,
        messages: [message(next, `Missed ${next}`)],
        hasMore: true,
      } as never;
    });
    shell.socketStatus = "connected";
    view.rerender();
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(panel().getAllByRole("article")).toHaveLength(11);
  });

  it("has nothing to catch up on in an empty thread, or with nothing new", async () => {
    shell.socketStatus = "disconnected";
    const empty = await renderShell([conversation(1, "Book Club")]);
    vi.mocked(fetchMessageHistory).mockClear();
    shell.socketStatus = "connected";
    empty.rerender();
    await flush();
    expect(fetchMessageHistory).not.toHaveBeenCalled();
    empty.unmount();

    shell.socketStatus = "disconnected";
    historyIs([message(10, "Before")]);
    const view = await renderShell([conversation(1, "Book Club")]);
    vi.mocked(fetchMessageHistory).mockResolvedValue({
      ok: true,
      messages: [],
      hasMore: false,
    } as never);
    shell.socketStatus = "connected";
    view.rerender();
    await flush();
    expect(panel().getAllByRole("article")).toHaveLength(1);
  });
});

describe("HomeShell - sending", () => {
  it("sends what was typed, shows it, and moves the list on", async () => {
    const answer = deferred<unknown>();
    vi.mocked(sendConversationMessage).mockReturnValue(answer.promise as never);
    await renderShell([conversation(1, "Book Club")]);
    const send = panel().getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();

    await userEvent.type(composer(), "Hello all");
    await userEvent.click(send);
    expect(sendConversationMessage).toHaveBeenCalledWith(
      1,
      "Hello all",
      [],
      null,
      [],
      false,
    );
    expect(panel().getByRole("button", { name: "Sending" })).toBeDisabled();
    expect(composer()).toBeDisabled();

    await act(async () =>
      answer.resolve({ ok: true, message: mine(30, "Hello all") }),
    );
    expect(panel().getByText("Hello all")).toBeInTheDocument();
    expect(composer()).toHaveValue("");
    expect(shell.latest[0]).toMatchObject({
      preview: "Sam: Hello all",
      unread: 0,
    });
  });

  it("does not show a message twice when the socket delivered it first", async () => {
    const answer = deferred<unknown>();
    vi.mocked(sendConversationMessage).mockReturnValue(answer.promise as never);
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "Hello all{Enter}");
    await emit({
      type: "message.new",
      message: wireMessage(30, "Hello all", {
        sender: { username: "sam", display_label: "Sam" },
      }),
    });
    await act(async () =>
      answer.resolve({ ok: true, message: mine(30, "Hello all") }),
    );
    expect(panel().getAllByRole("article")).toHaveLength(1);
  });

  it("says why a message was not sent, and keeps it in the box", async () => {
    sendAnswers({ ok: false, message: "This Loop is read-only." });
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "Hello all{Enter}");
    expect(
      await panel().findByText("This Loop is read-only."),
    ).toBeInTheDocument();
    expect(composer()).toHaveValue("Hello all");
  });

  it("sends on Enter only when that is the preference, else on Ctrl or Cmd Enter", async () => {
    shell.enterToSend = false;
    sendAnswers({ ok: true, message: mine(30, "Hello") });
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "Hello{Enter}");
    expect(sendConversationMessage).not.toHaveBeenCalled();
    await userEvent.type(composer(), "{Shift>}{Enter}{/Shift}");
    expect(sendConversationMessage).not.toHaveBeenCalled();

    await userEvent.type(composer(), "{Control>}{Enter}{/Control}");
    await waitFor(() =>
      expect(sendConversationMessage).toHaveBeenCalledTimes(1),
    );
    await flush();
    await userEvent.type(composer(), "Again{Meta>}{Enter}{/Meta}");
    await waitFor(() =>
      expect(sendConversationMessage).toHaveBeenCalledTimes(2),
    );
  });

  it("sends nothing from an empty box", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "   {Enter}");
    expect(sendConversationMessage).not.toHaveBeenCalled();
  });

  it("tells the others you are typing, at most every two seconds", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(10_000);
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "He");
    expect(shell.sendSocketMessage).toHaveBeenCalledTimes(1);
    expect(shell.sendSocketMessage).toHaveBeenCalledWith({
      type: "typing",
      conversation_id: 1,
    });

    now.mockReturnValue(12_500);
    await userEvent.type(composer(), "y");
    expect(shell.sendSocketMessage).toHaveBeenCalledTimes(2);
  });

  it("does not say you are typing while offline", async () => {
    shell.socketStatus = "disconnected";
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "Hey");
    expect(shell.sendSocketMessage).not.toHaveBeenCalled();
  });

  it("adds an emoji from the picker", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.type(composer(), "Nice ");
    await userEvent.click(panel().getByRole("button", { name: "Add emoji" }));
    expect(panel().getByText("Choose an emoji")).toBeInTheDocument();
    await userEvent.click(panel().getByRole("button", { name: "Insert 🎉" }));
    expect(composer()).toHaveValue("Nice 🎉");
    expect(panel().queryByText("Choose an emoji")).not.toBeInTheDocument();

    await userEvent.click(panel().getByRole("button", { name: "Add emoji" }));
    await userEvent.click(
      panel().getByRole("button", { name: "Close emoji picker" }),
    );
    expect(panel().queryByText("Choose an emoji")).not.toBeInTheDocument();
  });

  it("attaches files, lets one be removed, and sends the rest", async () => {
    sendAnswers({ ok: true, message: mine(30, "") });
    await renderShell([conversation(1, "Book Club")]);
    const first = new File(["a"], "a.pdf", { type: "application/pdf" });
    const second = new File(["b"], "b.png", { type: "image/png" });
    await userEvent.upload(panel().getByLabelText("Attach files"), [
      first,
      second,
    ]);
    await userEvent.click(panel().getByRole("button", { name: "a.pdf ×" }));
    expect(
      panel().queryByRole("button", { name: "a.pdf ×" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      panel().getByRole("button", { name: "Send message" }),
    );
    expect(sendConversationMessage).toHaveBeenCalledWith(
      1,
      "",
      [second],
      null,
      [],
      false,
    );
    await flush();
    expect(
      panel().queryByRole("button", { name: "b.png ×" }),
    ).not.toBeInTheDocument();
  });

  it("copes with a file picker that returns nothing", async () => {
    await renderShell([conversation(1, "Book Club")]);
    fireEvent.change(panel().getByLabelText("Attach files"), {
      target: { files: null },
    });
    expect(
      panel().getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
  });

  it("hides attaching and recording where the Loop has them switched off", async () => {
    await renderShell([
      conversation(1, "Book Club", {
        settings: {
          ...SETTINGS,
          media_enabled: false,
          voice_messages_enabled: false,
        },
      }),
    ]);
    expect(panel().queryByLabelText("Attach files")).not.toBeInTheDocument();
    expect(
      panel().queryByRole("button", { name: "Record a voice message" }),
    ).not.toBeInTheDocument();
  });

  it("tells a member they cannot post where only admins may", async () => {
    await renderShell([conversation(1, "News", { features: [] })]);
    expect(
      panel().getByText("Only Admins Can Post Messages"),
    ).toBeInTheDocument();
    expect(
      panel().queryByPlaceholderText("Type a message..."),
    ).not.toBeInTheDocument();
    expect(panel().getByTestId("call-buttons")).toHaveTextContent("false");
  });
});

describe("HomeShell - mentions", () => {
  // Picking a name puts the caret after it on the next animation frame. A
  // test types faster than a frame, so it waits for that before going on -
  // otherwise the caret lands mid-way through whatever was typed next.
  const caretSettles = () =>
    act(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );

  const rows = () => [
    conversation(1, "Book Club", {
      participants: [SAM, ADA, LIN, person("4", "Mom", { userId: undefined })],
    }),
  ];

  it("offers who can be named, leaving yourself out", async () => {
    await renderShell(rows());
    await userEvent.type(composer(), "Hi @");
    const options = panel().getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "everyoneEveryone in this Loop",
      "Ada",
      "Lin",
      "MomBy text",
    ]);
    expect(composer()).toHaveAttribute("aria-expanded", "true");
    expect(composer()).toHaveAttribute(
      "aria-activedescendant",
      "composer-mentions-option-0",
    );
  });

  it("picks with the arrows and Enter, and sends who was named", async () => {
    sendAnswers({ ok: true, message: mine(30, "Hi @Lin ") });
    await renderShell(rows());
    await userEvent.type(composer(), "Hi @");
    await userEvent.keyboard("{ArrowUp}");
    expect(composer()).toHaveAttribute(
      "aria-activedescendant",
      "composer-mentions-option-3",
    );
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    expect(composer()).toHaveValue("Hi @Lin ");
    await caretSettles();
    expect(panel().queryByRole("option")).not.toBeInTheDocument();
    // Enter chose the name; it did not send the message.
    expect(sendConversationMessage).not.toHaveBeenCalled();

    await userEvent.type(composer(), "and @every{Tab}");
    expect(composer()).toHaveValue("Hi @Lin and @everyone ");
    await caretSettles();
    await userEvent.keyboard("{Enter}");
    expect(sendConversationMessage).toHaveBeenCalledWith(
      1,
      "Hi @Lin and @everyone ",
      [],
      null,
      [3],
      true,
    );
  });

  it("drops a name that was typed over before sending", async () => {
    sendAnswers({ ok: true, message: mine(30, "Hi") });
    await renderShell(rows());
    await userEvent.type(composer(), "@a{Enter}");
    expect(composer()).toHaveValue("@Ada ");
    await caretSettles();
    await userEvent.clear(composer());
    await userEvent.type(composer(), "Hi{Enter}");
    expect(sendConversationMessage).toHaveBeenCalledWith(
      1,
      "Hi",
      [],
      null,
      [],
      false,
    );
  });

  it("picks a name with the pointer, and closes on Escape", async () => {
    await renderShell(rows());
    await userEvent.type(composer(), "@");
    await userEvent.hover(
      panel().getAllByRole("option")[2].querySelector("button")!,
    );
    expect(composer()).toHaveAttribute(
      "aria-activedescendant",
      "composer-mentions-option-2",
    );
    await userEvent.click(
      panel().getAllByRole("option")[1].querySelector("button")!,
    );
    expect(composer()).toHaveValue("@Ada ");
    await caretSettles();

    await userEvent.type(composer(), "@");
    await userEvent.keyboard("{Escape}");
    expect(panel().queryByRole("option")).not.toBeInTheDocument();
    expect(composer()).toHaveValue("@Ada @");
  });

  it("shows nothing when nobody matches", async () => {
    await renderShell(rows());
    await userEvent.type(composer(), "@zzz");
    expect(panel().queryByRole("option")).not.toBeInTheDocument();
    expect(composer()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("HomeShell - voice messages", () => {
  class FakeRecorder {
    static last: FakeRecorder;
    mimeType = "audio/ogg";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn(() => this.onstop?.());
    constructor() {
      FakeRecorder.last = this;
    }
  }
  const stopTrack = vi.fn();

  function allowMicrophone() {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: stopTrack }],
        })),
      },
    });
    URL.createObjectURL = vi.fn(() => "blob:voice");
    URL.revokeObjectURL = vi.fn();
  }
  const record = () =>
    fireEvent.click(
      panel().getByRole("button", { name: "Record a voice message" }),
    );

  beforeEach(() => {
    stopTrack.mockClear();
  });

  it("says so where the browser cannot record", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    await renderShell([conversation(1, "Book Club")]);
    record();
    expect(
      await panel().findByText(
        "Voice messages aren't supported in this browser.",
      ),
    ).toBeInTheDocument();
  });

  it("says when the microphone was refused", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("no")),
      },
    });
    await renderShell([conversation(1, "Book Club")]);
    record();
    expect(
      await panel().findByText("Microphone access was denied."),
    ).toBeInTheDocument();
  });

  it("records, then attaches what was recorded as a voice message", async () => {
    allowMicrophone();
    await renderShell([conversation(1, "Book Club")]);
    record();
    expect(await panel().findByText("Recording")).toBeInTheDocument();
    expect(FakeRecorder.last.start).toHaveBeenCalled();

    act(() => {
      FakeRecorder.last.ondataavailable?.({ data: new Blob([]) });
      FakeRecorder.last.ondataavailable?.({ data: new Blob(["sound"]) });
    });
    fireEvent.click(panel().getByRole("button", { name: "Stop recording" }));
    expect(stopTrack).toHaveBeenCalled();
    expect(panel().queryByText("Recording")).not.toBeInTheDocument();
    expect(
      panel().getByLabelText("Your voice message, before sending"),
    ).toBeInTheDocument();

    fireEvent.click(
      panel().getByRole("button", { name: "Delete voice message" }),
    );
    expect(
      panel().queryByLabelText("Your voice message, before sending"),
    ).not.toBeInTheDocument();
  });

  it("attaches nothing when the recording is discarded, or was silent", async () => {
    allowMicrophone();
    await renderShell([conversation(1, "Book Club")]);
    record();
    await panel().findByText("Recording");
    act(() =>
      FakeRecorder.last.ondataavailable?.({ data: new Blob(["sound"]) }),
    );
    fireEvent.click(panel().getByRole("button", { name: "Discard" }));
    expect(
      panel().queryByLabelText("Your voice message, before sending"),
    ).not.toBeInTheDocument();

    record();
    await panel().findByText("Recording");
    FakeRecorder.last.mimeType = "";
    fireEvent.click(panel().getByRole("button", { name: "Stop recording" }));
    expect(
      panel().queryByLabelText("Your voice message, before sending"),
    ).not.toBeInTheDocument();
  });

  it("stops and drops a recording still running when the screen is left", async () => {
    allowMicrophone();
    const view = await renderShell([conversation(1, "Book Club")]);
    record();
    await panel().findByText("Recording");
    act(() =>
      FakeRecorder.last.ondataavailable?.({ data: new Blob(["sound"]) }),
    );
    view.unmount();
    expect(FakeRecorder.last.stop).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("names a webm recording as one", async () => {
    allowMicrophone();
    sendAnswers({ ok: true, message: mine(30, "") });
    await renderShell([conversation(1, "Book Club")]);
    record();
    await panel().findByText("Recording");
    FakeRecorder.last.mimeType = "audio/webm";
    act(() =>
      FakeRecorder.last.ondataavailable?.({ data: new Blob(["sound"]) }),
    );
    fireEvent.click(panel().getByRole("button", { name: "Stop recording" }));
    fireEvent.click(panel().getByRole("button", { name: "Send message" }));
    const sent = vi.mocked(sendConversationMessage).mock.calls[0][2] as File[];
    expect(sent[0].name).toMatch(/^voice-message-\d+\.webm$/);
  });
});

describe("HomeShell - what the socket says", () => {
  it("adds a new message to the open thread, and marks it read while watching", async () => {
    await renderShell([conversation(1, "Book Club")]);
    vi.mocked(markConversationRead).mockClear();
    await emit({ type: "message.new", message: wireMessage(40, "Fresh") });
    expect(panel().getByText("Fresh")).toBeInTheDocument();
    expect(markConversationRead).toHaveBeenCalledWith(1, 40);
    expect(shell.latest[0]).toMatchObject({ preview: "Ada: Fresh", unread: 0 });

    // The same frame again changes nothing.
    await emit({ type: "message.new", message: wireMessage(40, "Fresh") });
    expect(panel().getAllByText("Fresh")).toHaveLength(1);
  });

  it("does not mark it read while the window is elsewhere", async () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    await renderShell([conversation(1, "Book Club")]);
    vi.mocked(markConversationRead).mockClear();
    await emit({ type: "message.new", message: wireMessage(40, "Fresh") });
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it("counts a message for another chat as unread, and brings a cleared chat back", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners", { unread: 1, cleared: true }),
    ]);
    await emit({
      type: "message.new",
      message: wireMessage(41, "Run?", {
        conversation: { id: 2 },
        attachments: [{ url: "/a.png", content_type: "image/png" }],
      }),
    });
    expect(panel().queryByText("Run?")).not.toBeInTheDocument();
    expect(shell.latest[1]).toMatchObject({
      unread: 2,
      cleared: false,
      preview: "Ada: Photo · Run?",
    });
    expect(listed()).toEqual(["Book Club", "Runners"]);
  });

  it("fetches a conversation it has not listed yet, once", async () => {
    await renderShell([conversation(1, "Book Club")]);
    const pending = deferred<unknown>();
    vi.mocked(fetchConversation).mockClear();
    vi.mocked(fetchConversation).mockReturnValue(pending.promise as never);
    await emit({
      type: "message.new",
      message: wireMessage(42, "Hi", { conversation: 9 }),
    });
    await emit({
      type: "message.new",
      message: wireMessage(43, "Again", { conversation: 9 }),
    });
    expect(fetchConversation).toHaveBeenCalledTimes(1);

    await act(async () =>
      pending.resolve({ ok: true, conversation: conversation(9, "Newcomers") }),
    );
    expect(listed()).toContain("Newcomers");
  });

  it("leaves the list alone when that conversation cannot be fetched", async () => {
    await renderShell([conversation(1, "Book Club")]);
    vi.mocked(fetchConversation).mockResolvedValue({
      ok: false,
      message: "x",
    } as never);
    await emit({
      type: "message.new",
      message: wireMessage(42, "Hi", { conversation: 9 }),
    });
    expect(listed()).toEqual(["Book Club"]);
  });

  it("takes a message with no conversation as being for the open one", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await emit({
      type: "message.new",
      message: wireMessage(44, "Here", {
        conversation: undefined,
        created_at: undefined,
      }),
    });
    expect(panel().getByText("Here")).toBeInTheDocument();
  });

  it("ignores frames it cannot read", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await emit({ type: "message.new" });
    await emit({ type: "message.new", message: "nope" });
    await emit({ type: "message.new", message: { conversation: 1 } });
    await emit({ type: "message.updated", message: null });
    await emit({ type: "conversation.updated", conversation: null });
    await emit({ type: "conversation.read", conversation_id: null });
    await emit({ type: "conversation.read.by", conversation_id: 1 });
    await emit({ type: "presence" });
    await emit({ type: "typing", conversation_id: 1 });
    await emit({ type: "conversation.request", conversation_id: 1 });
    await emit({ type: "conversation.request", participant: { id: 5 } });
    await emit({ type: "something.else" });
    expect(panel().queryByRole("article")).not.toBeInTheDocument();
    expect(shell.latest).toEqual([expect.objectContaining({ unread: 0 })]);
  });

  it("has nowhere to put a message with no conversation and none open", async () => {
    await renderShell([]);
    await emit({
      type: "message.new",
      message: wireMessage(44, "Lost", { conversation: undefined }),
    });
    expect(shell.latest).toEqual([]);
  });

  it("rewrites a message that was edited, and the preview if it was the newest", async () => {
    const at = minutesAgo(2);
    historyIs([message(10, "Frist", { createdAt: at })]);
    await renderShell([
      conversation(1, "Book Club", {
        lastMessageAt: at,
        preview: "Ada: Frist",
      }),
      conversation(2, "Runners", { preview: "untouched" }),
    ]);
    await emit({
      type: "message.updated",
      message: wireMessage(10, "First", {
        created_at: at,
        edited_at: minutesAgo(0),
      }),
    });
    expect(panel().getByText("First")).toBeInTheDocument();
    expect(panel().getByText("edited")).toBeInTheDocument();
    expect(shell.latest[0].preview).toBe("Ada: First");
    expect(shell.latest[1].preview).toBe("untouched");
  });

  it("leaves a tombstone for a deleted message, and unpins it", async () => {
    const at = minutesAgo(2);
    const pinned = message(10, "Rules", { createdAt: at });
    historyIs([pinned]);
    await renderShell([
      conversation(1, "Book Club", {
        lastMessageAt: at,
        pinnedMessage: pinned,
      }),
    ]);
    expect(panel().getByText(/Pinned · Ada/)).toBeInTheDocument();

    await emit({
      type: "message.updated",
      message: wireMessage(10, "", {
        created_at: at,
        deleted_at: minutesAgo(0),
      }),
    });
    expect(panel().queryByText(/Pinned · Ada/)).not.toBeInTheDocument();
    expect(shell.latest[0].preview).toBe("Ada: This message was deleted");
  });

  it("keeps the pin's words in step with an edit, and other previews as they were", async () => {
    const pinned = message(10, "Ruels", { createdAt: minutesAgo(9) });
    historyIs([pinned, message(11, "Later")]);
    await renderShell([
      conversation(1, "Book Club", {
        lastMessageAt: minutesAgo(1),
        preview: "Ada: Later",
        pinnedMessage: pinned,
      }),
    ]);
    await emit({
      type: "message.updated",
      message: wireMessage(10, "Rules", { created_at: pinned.createdAt }),
    });
    expect(shell.latest[0].pinnedMessage?.text).toBe("Rules");
    expect(shell.latest[0].preview).toBe("Ada: Later");

    // An update for a message that is not loaded changes no bubble.
    await emit({ type: "message.updated", message: wireMessage(99, "Unseen") });
    expect(panel().queryByText("Unseen")).not.toBeInTheDocument();
  });

  it("ticks your message once somebody has read it", async () => {
    historyIs([mine(10, "Anyone?")]);
    await renderShell([
      conversation(1, "Book Club", { participants: [SAM, ADA, LIN] }),
    ]);
    expect(panel().getByLabelText("Sent")).toBeInTheDocument();

    await emit({
      type: "conversation.read.by",
      conversation_id: 1,
      user_id: 102,
      last_read_message_id: 10,
    });
    expect(panel().getByLabelText("Read by 1")).toBeInTheDocument();
    expect(panel().getByText(/^1 read /)).toBeInTheDocument();
  });

  it("clears the unread count when you read it somewhere else", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners", { unread: 4 }),
    ]);
    await emit({ type: "conversation.read", conversation_id: "2" });
    expect(shell.latest.map((item) => item.unread)).toEqual([0, 0]);
  });

  it("follows somebody coming online and going away", async () => {
    await renderShell([direct(1, ADA), conversation(2, "Book Club")]);
    await emit({ type: "presence", user_id: 102, online: true });
    expect(panel().getByText("Online")).toBeInTheDocument();

    await emit({
      type: "presence",
      user_id: "102",
      online: false,
      last_seen_at: minutesAgo(0),
    });
    expect(panel().getByText(/^Last seen /)).toBeInTheDocument();

    await emit({ type: "presence", user_id: 102, online: false });
    expect(panel().getByText("Direct Message")).toBeInTheDocument();
  });

  it("says who is typing in the open conversation", async () => {
    await renderShell([
      conversation(1, "Book Club", { participants: [SAM, ADA, LIN] }),
    ]);
    await emit({ type: "typing", conversation_id: 2, user_id: 102 });
    expect(panel().queryByText(/typing/)).not.toBeInTheDocument();

    await emit({ type: "typing", conversation_id: "1", user_id: 102 });
    expect(panel().getByText("Ada is typing...")).toBeInTheDocument();
    await emit({ type: "typing", conversation_id: 1, user_id: "103" });
    expect(panel().getByText("Ada and Lin are typing...")).toBeInTheDocument();
    await emit({ type: "typing", conversation_id: 1, user_id: 999 });
    expect(
      panel().getByText("Several people are typing..."),
    ).toBeInTheDocument();
  });

  it("says somebody is typing when it cannot tell who", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await emit({ type: "typing", conversation_id: 1, user_id: 998 });
    expect(panel().getByText("Someone is typing...")).toBeInTheDocument();
    await emit({ type: "typing", conversation_id: 1, user_id: 999 });
    expect(
      panel().getByText("Several people are typing..."),
    ).toBeInTheDocument();
  });

  it("stops saying so five seconds after the last keystroke", async () => {
    await renderShell([conversation(1, "Book Club")]);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    act(() => emitFrame({ type: "typing", conversation_id: 1, user_id: 102 }));
    expect(panel().getByText("Ada is typing...")).toBeInTheDocument();

    now.mockReturnValue(3_000);
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(panel().getByText("Ada is typing...")).toBeInTheDocument();

    now.mockReturnValue(7_000);
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(panel().queryByText(/typing/)).not.toBeInTheDocument();
  });

  it("forgets who was typing in the conversation you left", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners", { participants: [SAM, LIN] }),
    ]);
    await emit({ type: "typing", conversation_id: 1, user_id: 102 });
    await userEvent.click(rowButton("Runners"));
    await flush();
    expect(panel().queryByText(/typing/)).not.toBeInTheDocument();
    await emit({ type: "typing", conversation_id: 2, user_id: 103 });
    expect(panel().getByText("Lin is typing...")).toBeInTheDocument();
  });

  it("takes a group's new name and settings from a broadcast, keeping your own blocks", async () => {
    await renderShell([
      conversation(1, "Book Club", {
        participants: [SAM, person("2", "Ada", { blockedByMe: true })],
      }),
      conversation(2, "Runners"),
    ]);
    await emit({
      type: "conversation.updated",
      conversation: {
        id: 1,
        name: "Readers",
        description: "We read.",
        mode: "chat",
        participants: [
          { id: 1, role: "admin", user: { id: 101, username: "sam" } },
          { id: 2, user: { id: 102, username: "ada", display_label: "Ada" } },
          { id: 3, user: { id: 103, username: "lin", display_label: "Lin" } },
        ],
      },
    });
    expect(
      panel().getByRole("heading", { name: "Readers" }),
    ).toBeInTheDocument();
    expect(subtitle()).toHaveTextContent("3 members");
    const members = shell.latest[0].participants;
    // The broadcast went to everybody, so it cannot know who YOU blocked.
    expect(members.find((member) => member.id === "2")?.blockedByMe).toBe(true);
    expect(members.find((member) => member.id === "3")?.blockedByMe).toBe(
      false,
    );
    expect(shell.latest[1].name).toBe("Runners");
  });

  it("keeps a one-to-one's name, and the members when a broadcast lists none", async () => {
    await renderShell([direct(1, ADA)]);
    await emit({
      type: "conversation.updated",
      conversation: { id: 1, kind: "direct", name: "Sam" },
    });
    expect(shell.latest[0].name).toBe("Ada");
    expect(shell.latest[0].participants).toHaveLength(2);
  });

  it("queues a request to join for the admin panel", async () => {
    await renderShell([
      conversation(1, "Book Club", { features: [GROUP.send] }),
    ]);
    const request = {
      type: "conversation.request",
      conversation_id: 1,
      participant: { id: 5, user: { id: 105, username: "kim" } },
    };
    await emit(request);
    await emit(request);
    await userEvent.click(
      panel().getByRole("button", { name: "Loop Settings" }),
    );
    const { captured } = await import("@/test/homeShell");
    expect(captured.admin.pendingRequests).toEqual([
      { id: "5", name: "kim", username: "kim", phone: undefined },
    ]);
  });
});
