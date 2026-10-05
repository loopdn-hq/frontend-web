import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
const send = vi.fn();
let accessToken: string | null = "access-1";
let socket: {
  status: string;
  options: {
    url: string;
    enabled: boolean;
    onMessage: (message: Record<string, unknown>) => void;
  } | null;
};

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth/client", () => ({
  displayNameForSession: (session: string | null) => session ?? "New Member",
  fetchUserProfile: vi.fn(),
  getSession: vi.fn(() => "sam"),
  logout: vi.fn(async () => {}),
  useAccessToken: () => accessToken,
}));
vi.mock("@/lib/app/push", () => ({ syncPush: vi.fn(async () => {}) }));
vi.mock("@/lib/websocket/useWebSocket", () => ({
  useWebSocket: (options: NonNullable<typeof socket.options>) => {
    socket.options = options;
    return { status: socket.status, send };
  },
}));
vi.mock("@/lib/chat/conversations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/conversations")>(
    "@/lib/chat/conversations",
  );
  return { ...actual, fetchConversations: vi.fn() };
});
vi.mock("@/lib/chat/notifications", () => ({ fetchNotifications: vi.fn() }));

import { AppShellProvider, useAppShell } from "@/lib/app/AppShellProvider";
import { syncPush } from "@/lib/app/push";
import { fetchUserProfile, logout } from "@/lib/auth/client";
import { fetchConversations, type Conversation } from "@/lib/chat/conversations";
import { fetchNotifications } from "@/lib/chat/notifications";
import { deferred, stubLocation } from "@/test/helpers";

type Page = Awaited<ReturnType<typeof fetchConversations>>;

function conversation(id: number, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    kind: "group",
    name: `Loop ${id}`,
    description: "",
    mode: "chat",
    joinMode: null,
    logoImage: null,
    settings: null,
    preview: "",
    lastMessageAt: null,
    unread: 0,
    muted: false,
    archived: false,
    cleared: false,
    isAdmin: false,
    features: [],
    smsNumber: null,
    participants: [],
    pinnedMessage: null,
    ...overrides,
  };
}

function conversationsAre(rows: Conversation[], hasMore = false) {
  vi.mocked(fetchConversations).mockResolvedValue({
    ok: true,
    conversations: rows,
    hasMore,
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppShellProvider>{children}</AppShellProvider>
);

async function mount() {
  const view = renderHook(() => useAppShell(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoadingConversations).toBe(false));
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  accessToken = "access-1";
  socket = { status: "connected", options: null };
  conversationsAre([]);
  vi.mocked(fetchNotifications).mockResolvedValue({
    ok: true,
    page: { notifications: [], unreadCount: 0, hasMore: false },
  });
  vi.mocked(fetchUserProfile).mockResolvedValue({ ok: false, message: "x" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AppShellProvider - conversations", () => {
  it("loads the conversations, marking the first as the one to show", async () => {
    conversationsAre([conversation(1), conversation(2)], true);
    const view = renderHook(() => useAppShell(), { wrapper });
    expect(view.result.current.isLoadingConversations).toBe(true);

    await waitFor(() => expect(view.result.current.conversations).toHaveLength(2));
    expect(view.result.current.conversations.map((row) => row.active)).toEqual([true, false]);
    expect(view.result.current.hasMoreConversations).toBe(true);
    expect(view.result.current.conversationsError).toBeNull();
  });

  it("reports a failed load, and loads again on request", async () => {
    vi.mocked(fetchConversations).mockResolvedValue({
      ok: false,
      message: "Unable to load your Loops.",
    });
    const { result } = await mount();
    expect(result.current.conversationsError).toBe("Unable to load your Loops.");

    conversationsAre([conversation(1)]);
    act(() => result.current.reloadConversations());
    expect(result.current.isLoadingConversations).toBe(true);
    expect(result.current.conversationsError).toBeNull();
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
  });

  it("keeps only the answer to the latest load", async () => {
    const slow = deferred<Page>();
    vi.mocked(fetchConversations).mockReturnValueOnce(slow.promise);
    const { result } = renderHook(() => useAppShell(), { wrapper });

    conversationsAre([conversation(2)]);
    act(() => result.current.reloadConversations());
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    await act(async () =>
      slow.resolve({ ok: true, conversations: [conversation(1)], hasMore: false }),
    );
    expect(result.current.conversations[0].id).toBe(2);
  });

  it("loads the next page onto the end, without repeating a row", async () => {
    conversationsAre([conversation(1), conversation(2)], true);
    const { result } = await mount();

    const more = deferred<Page>();
    vi.mocked(fetchConversations).mockReturnValue(more.promise);
    act(() => result.current.loadMoreConversations());
    expect(result.current.isLoadingMoreConversations).toBe(true);
    expect(fetchConversations).toHaveBeenLastCalledWith({ page: 2 });

    // Asking again while it is loading does nothing.
    act(() => result.current.loadMoreConversations());
    expect(fetchConversations).toHaveBeenCalledTimes(2);

    await act(async () =>
      more.resolve({
        ok: true,
        conversations: [conversation(2), conversation(3)],
        hasMore: false,
      }),
    );
    expect(result.current.conversations.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(result.current.hasMoreConversations).toBe(false);

    act(() => result.current.loadMoreConversations());
    expect(fetchConversations).toHaveBeenCalledTimes(2);
  });

  it("leaves the list as it is when the next page fails", async () => {
    conversationsAre([conversation(1)], true);
    const { result } = await mount();
    vi.mocked(fetchConversations).mockResolvedValue({ ok: false, message: "down" });
    await act(async () => result.current.loadMoreConversations());
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.hasMoreConversations).toBe(true);
    expect(result.current.isLoadingMoreConversations).toBe(false);
  });

  it("totals unread by mode, leaving archived conversations out", async () => {
    conversationsAre([
      conversation(1, { unread: 3 }),
      conversation(2, { unread: 4, mode: "broadcast" }),
      conversation(3, { unread: 5, settings: { mode: "broadcast" } as never }),
      conversation(4, { unread: 9, archived: true }),
      conversation(5, { unread: undefined as never }),
    ]);
    const { result } = await mount();
    expect(result.current.unreadByMode).toEqual({ chat: 3, broadcast: 9 });
  });

  it("lets a screen replace the list directly", async () => {
    const { result } = await mount();
    act(() => result.current.setConversations([conversation(7)]));
    expect(result.current.conversations[0].id).toBe(7);
  });
});

describe("AppShellProvider - the signed-in account", () => {
  it("starts from the session name, then fills in the profile", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchUserProfile>>>();
    vi.mocked(fetchUserProfile).mockReturnValue(pending.promise);
    const { result } = await mount();
    expect(result.current.userProfile).toEqual({ displayName: "sam" });

    await act(async () =>
      pending.resolve({
        ok: true,
        displayName: "Sam Wren",
        username: "sam",
        email: "sam@example.com",
        phone: "+14155552671",
        emailVerified: true,
        phoneVerified: false,
        emailEnabled: true,
        bio: "Hi.",
        avatarUrl: "https://cdn.example/sam.png",
      }),
    );
    expect(result.current.userProfile).toEqual({
      displayName: "Sam Wren",
      username: "sam",
      email: "sam@example.com",
      phone: "+14155552671",
      emailVerified: true,
      phoneVerified: false,
      emailEnabled: true,
      bio: "Hi.",
      avatarUrl: "https://cdn.example/sam.png",
    });
  });

  it("keeps what it had for anything the profile leaves out", async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue({ ok: true, displayName: "" });
    const { result } = await mount();
    await waitFor(() => expect(fetchUserProfile).toHaveBeenCalled());
    expect(result.current.userProfile.displayName).toBe("sam");

    act(() => result.current.setUserProfile({ displayName: "Sam W" }));
    expect(result.current.userProfile.displayName).toBe("Sam W");
  });

  it("signs out and goes to the login page", async () => {
    const { result } = await mount();
    await act(() => result.current.logOut());
    expect(logout).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login/");
  });

  it("refuses to be used outside itself", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAppShell())).toThrow(
      "useAppShell must be used within AppShellProvider",
    );
    vi.restoreAllMocks();
  });
});

describe("AppShellProvider - requests between screens", () => {
  it("counts requests to create a Loop", async () => {
    const { result } = await mount();
    expect(result.current.createLoopRequest).toBe(0);
    act(() => result.current.requestCreateLoop());
    act(() => result.current.requestCreateLoop());
    expect(result.current.createLoopRequest).toBe(2);
  });

  it("holds a conversation to open until the chat screen takes it", async () => {
    const { result } = await mount();
    act(() => result.current.requestOpenConversation(12));
    expect(result.current.conversationToOpen).toBe(12);
    act(() => result.current.clearConversationToOpen());
    expect(result.current.conversationToOpen).toBeNull();
  });

  it("opens and closes the navigation drawer", async () => {
    const { result } = await mount();
    act(() => result.current.openNavDrawer());
    expect(result.current.isNavDrawerOpen).toBe(true);
    act(() => result.current.closeNavDrawer());
    expect(result.current.isNavDrawerOpen).toBe(false);
  });

  it("opens the conversation named in the address, then tidies the address", async () => {
    vi.useFakeTimers();
    stubLocation("https://loopdn.com/chats/#conversation=42");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    const { result } = renderHook(() => useAppShell(), { wrapper });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/chats/");
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.conversationToOpen).toBe(42);
    replaceState.mockRestore();
  });

  it("ignores a fragment that is not a conversation", async () => {
    stubLocation("https://loopdn.com/chats/#settings");
    const { result } = await mount();
    expect(result.current.conversationToOpen).toBeNull();
  });

  it("opens the conversation a notification was clicked for", async () => {
    let onWorkerMessage!: (event: { data: unknown }) => void;
    const removeEventListener = vi.fn();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        addEventListener: (_: string, listener: typeof onWorkerMessage) => {
          onWorkerMessage = listener;
        },
        removeEventListener,
      },
    });
    const { result, unmount } = await mount();
    expect(syncPush).toHaveBeenCalled();

    act(() => onWorkerMessage({ data: null }));
    act(() => onWorkerMessage({ data: { type: "other" } }));
    act(() => onWorkerMessage({ data: { type: "loopdn:open-conversation" } }));
    expect(result.current.conversationToOpen).toBeNull();

    act(() =>
      onWorkerMessage({ data: { type: "loopdn:open-conversation", conversationId: 12 } }),
    );
    expect(result.current.conversationToOpen).toBe(12);
    expect(push).toHaveBeenCalledWith("/chats/");

    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });
});

describe("AppShellProvider - the socket", () => {
  it("connects with the access token, to the API's own host", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.loopdn.com/api/v1");
    await mount();
    expect(socket.options).toMatchObject({
      url: "wss://api.loopdn.com/ws/chat/?token=access-1",
      enabled: true,
    });
  });

  it("uses a configured socket host, and plain ws for a plain API", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api/v1");
    vi.stubEnv("NEXT_PUBLIC_WS_HOST", "ws.loopdn.test");
    await mount();
    expect(socket.options?.url).toBe("ws://ws.loopdn.test/ws/chat/?token=access-1");
  });

  it("falls back to the local server, and stays closed without a token", async () => {
    accessToken = null;
    await mount();
    expect(socket.options).toMatchObject({
      url: "ws://127.0.0.1:8000/ws/chat/?token=",
      enabled: false,
    });
  });

  it("passes each frame to everybody subscribed, until they unsubscribe", async () => {
    const { result } = await mount();
    const listener = vi.fn();
    let stop!: () => void;
    act(() => {
      stop = result.current.subscribeToSocket(listener);
    });

    act(() => socket.options!.onMessage({ type: "message.new", id: 1 }));
    expect(listener).toHaveBeenCalledWith({ type: "message.new", id: 1 });

    stop();
    act(() => socket.options!.onMessage({ type: "message.new", id: 2 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("counts a new notification, and tells the activity screen to refresh", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({
      ok: true,
      page: { notifications: [], unreadCount: 2, hasMore: false },
    });
    const { result } = await mount();
    await waitFor(() => expect(result.current.activityUnread).toBe(2));
    expect(fetchNotifications).toHaveBeenCalledWith({ unreadOnly: true });

    act(() => socket.options!.onMessage({ type: "notification.new" }));
    expect(result.current.activityUnread).toBe(3);
    expect(result.current.activityVersion).toBe(1);

    act(() => result.current.setActivityUnread(0));
    expect(result.current.activityUnread).toBe(0);
  });

  it("starts the activity count at zero when it cannot be loaded", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ ok: false, message: "down" });
    const { result } = await mount();
    expect(result.current.activityUnread).toBe(0);
  });

  it("folds in the conversation list when one is added or removed", async () => {
    conversationsAre([conversation(1, { participants: [{ id: "1" } as never] })]);
    const { result } = await mount();

    conversationsAre([conversation(2), conversation(1)]);
    await act(async () => socket.options!.onMessage({ type: "conversation.added" }));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));
    // Members already loaded for a row survive the refresh.
    expect(
      result.current.conversations.find((row) => row.id === 1)?.participants,
    ).toHaveLength(1);

    vi.mocked(fetchConversations).mockResolvedValue({ ok: false, message: "down" });
    await act(async () => socket.options!.onMessage({ type: "conversation.removed" }));
    expect(result.current.conversations).toHaveLength(2);
  });

  it("pings once a minute while connected, to stay marked as online", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useAppShell(), { wrapper });
    expect(result.current.socketStatus).toBe("connected");
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ type: "ping" });

    unmount();
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not ping while disconnected", async () => {
    vi.useFakeTimers();
    socket.status = "disconnected";
    const { result } = renderHook(() => useAppShell(), { wrapper });
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(send).not.toHaveBeenCalled();
    result.current.sendSocketMessage({ type: "typing" });
    expect(send).toHaveBeenCalledWith({ type: "typing" });
  });
});

describe("AppShellProvider - late answers", () => {
  it("ignores everything that arrives after it has gone", async () => {
    const conversations = deferred<Page>();
    const notifications = deferred<Awaited<ReturnType<typeof fetchNotifications>>>();
    const profile = deferred<Awaited<ReturnType<typeof fetchUserProfile>>>();
    vi.mocked(fetchConversations).mockReturnValue(conversations.promise);
    vi.mocked(fetchNotifications).mockReturnValue(notifications.promise);
    vi.mocked(fetchUserProfile).mockReturnValue(profile.promise);

    const { result, unmount } = renderHook(() => useAppShell(), { wrapper });
    unmount();
    conversations.resolve({ ok: true, conversations: [conversation(1)], hasMore: false });
    notifications.resolve({
      ok: true,
      page: { notifications: [], unreadCount: 9, hasMore: false },
    });
    profile.resolve({ ok: true, displayName: "Late" });
    await profile.promise;
    expect(result.current.conversations).toEqual([]);
    expect(result.current.activityUnread).toBe(0);
    expect(result.current.userProfile.displayName).toBe("sam");
  });
});
