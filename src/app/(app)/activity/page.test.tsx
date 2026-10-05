import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
let shell: {
  activityUnread: number;
  setActivityUnread: ReturnType<typeof vi.fn>;
  activityVersion: number;
  requestOpenConversation: ReturnType<typeof vi.fn>;
};

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/app/AppShellProvider", () => ({ useAppShell: () => shell }));
vi.mock("@/components/app/NavDrawerButton", () => ({
  NavDrawerButton: () => null,
}));
vi.mock("@/lib/chat/notifications", () => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));
vi.mock("@/lib/chat/conversations", () => ({
  joinConversation: vi.fn(),
  joinConversationWithCode: vi.fn(),
  respondToJoinRequest: vi.fn(),
}));

import ActivityPage from "@/app/(app)/activity/page";
import {
  joinConversation,
  joinConversationWithCode,
  respondToJoinRequest,
} from "@/lib/chat/conversations";
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/chat/notifications";
import { deferred } from "@/test/helpers";

type Feed = Awaited<ReturnType<typeof fetchNotifications>>;

const NOW = new Date().toISOString();
const LONG_AGO = "2020-01-02T10:00:00.000Z";

function notification(
  id: number,
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id,
    type: "role.granted",
    category: "groups",
    actorName: "Ada",
    conversationId: 7,
    conversationName: "Book Club",
    joinMode: "open",
    viewerStatus: "active",
    requestStatus: null,
    data: null,
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function feedIs(rows: AppNotification[], unreadCount = rows.length) {
  vi.mocked(fetchNotifications).mockResolvedValue({
    ok: true,
    page: { notifications: rows, unreadCount, hasMore: false },
  });
}

/** The row is the button in the feed; the detail repeats its title as a heading. */
async function openRow(name: RegExp) {
  await userEvent.click(await screen.findByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  shell = {
    activityUnread: 2,
    setActivityUnread: vi.fn(),
    activityVersion: 0,
    requestOpenConversation: vi.fn(),
  };
  feedIs([]);
  vi.mocked(markNotificationsRead).mockResolvedValue({
    ok: true,
    unreadCount: 0,
  } as never);
});

describe("ActivityPage - the feed", () => {
  it("shows a skeleton, then says when there is nothing", async () => {
    const pending = deferred<Feed>();
    vi.mocked(fetchNotifications).mockReturnValue(pending.promise);
    render(<ActivityPage />);
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();

    pending.resolve({
      ok: true,
      page: { notifications: [], unreadCount: 0, hasMore: false },
    });
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(shell.setActivityUnread).toHaveBeenCalledWith(0);
    expect(
      screen.getByText("Select something on the left to see the detail."),
    ).toBeInTheDocument();
  });

  it("says why the feed could not be loaded", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({
      ok: false,
      message: "Unable to load activity.",
    });
    render(<ActivityPage />);
    expect(
      await screen.findByText("Unable to load activity."),
    ).toBeInTheDocument();
  });

  it("groups what happened by day, newest group first", async () => {
    feedIs([
      notification(1),
      notification(2, { type: "role.revoked" }),
      notification(3, {
        type: "join.declined",
        createdAt: LONG_AGO,
        conversationName: null,
      }),
    ]);
    render(<ActivityPage />);
    expect(
      await screen.findByRole("button", { name: /You were promoted to admin/ }),
    ).toHaveTextContent("Book Club");
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Your request was declined/ }),
    ).toBeInTheDocument();
  });

  it("ignores a feed that arrives after the page has gone", async () => {
    const pending = deferred<Feed>();
    vi.mocked(fetchNotifications).mockReturnValue(pending.promise);
    const { unmount } = render(<ActivityPage />);
    unmount();
    pending.resolve({
      ok: true,
      page: { notifications: [], unreadCount: 4, hasMore: false },
    });
    await pending.promise;
    expect(shell.setActivityUnread).not.toHaveBeenCalled();
  });
});

describe("ActivityPage - filters", () => {
  it("asks for one category, or only the unread", async () => {
    render(<ActivityPage />);
    await screen.findByText("Nothing here yet");
    expect(fetchNotifications).toHaveBeenLastCalledWith({
      category: undefined,
      unreadOnly: false,
    });

    await userEvent.click(screen.getByRole("button", { name: "Invites" }));
    await waitFor(() =>
      expect(fetchNotifications).toHaveBeenLastCalledWith({
        category: "invites",
        unreadOnly: false,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: /Unread/ }));
    await waitFor(() =>
      expect(fetchNotifications).toHaveBeenLastCalledWith({
        category: undefined,
        unreadOnly: true,
      }),
    );
  });

  it("does not reload for the filter already showing", async () => {
    render(<ActivityPage />);
    await screen.findByText("Nothing here yet");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it("carries the unread count on its filter, and hides it at zero", async () => {
    const first = render(<ActivityPage />);
    expect(screen.getByRole("button", { name: /Unread/ })).toHaveTextContent(
      "Unread2",
    );
    await userEvent.click(screen.getByRole("button", { name: /Unread/ }));
    expect(screen.getByRole("button", { name: /Unread/ })).toHaveTextContent(
      "Unread2",
    );
    first.unmount();

    shell.activityUnread = 0;
    render(<ActivityPage />);
    expect(screen.getByRole("button", { name: "Unread" })).toHaveTextContent(
      /^Unread$/,
    );
    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
  });
});

describe("ActivityPage - reading", () => {
  it("marks a notification read the first time it is opened", async () => {
    feedIs([notification(1)]);
    render(<ActivityPage />);
    await openRow(/You were promoted to admin/);

    expect(markNotificationsRead).toHaveBeenCalledWith([1]);
    expect(shell.setActivityUnread).toHaveBeenLastCalledWith(1);
    expect(
      screen.getByRole("heading", { name: "You were promoted to admin" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Person")).toBeInTheDocument();
    expect(screen.getByText("Group")).toBeInTheDocument();

    await openRow(/You were promoted to admin/);
    expect(markNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it("leaves the count alone for one that was already read", async () => {
    feedIs([
      notification(1, {
        readAt: LONG_AGO,
        createdAt: LONG_AGO,
        actorName: null,
        conversationName: null,
        type: "general",
      }),
    ]);
    render(<ActivityPage />);
    await openRow(/Something happened/);
    expect(markNotificationsRead).not.toHaveBeenCalled();
    expect(screen.queryByText("Person")).not.toBeInTheDocument();
    expect(screen.queryByText("Group")).not.toBeInTheDocument();
    expect(screen.getByText("When")).toBeInTheDocument();
  });

  it("marks everything read, then takes the server's count", async () => {
    feedIs([notification(1), notification(2, { readAt: LONG_AGO })]);
    vi.mocked(markNotificationsRead).mockResolvedValue({
      ok: true,
      unreadCount: 1,
    } as never);
    render(<ActivityPage />);
    await screen.findAllByRole("button", { name: /promoted/ });
    shell.setActivityUnread.mockClear();

    await userEvent.click(
      screen.getByRole("button", { name: "Mark all as read" }),
    );
    expect(markNotificationsRead).toHaveBeenCalledWith();
    await waitFor(() =>
      expect(shell.setActivityUnread.mock.calls).toEqual([[0], [1]]),
    );
  });

  it("keeps the optimistic zero when marking all read fails", async () => {
    feedIs([notification(1)]);
    vi.mocked(markNotificationsRead).mockResolvedValue({
      ok: false,
      message: "down",
    } as never);
    render(<ActivityPage />);
    await screen.findByRole("button", { name: /promoted/ });
    shell.setActivityUnread.mockClear();
    await userEvent.click(
      screen.getByRole("button", { name: "Mark all as read" }),
    );
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalled());
    expect(shell.setActivityUnread.mock.calls).toEqual([[0]]);
  });
});

describe("ActivityPage - the detail", () => {
  it("opens the group for a member", async () => {
    feedIs([notification(1)]);
    render(<ActivityPage />);
    await openRow(/promoted/);
    await userEvent.click(screen.getByRole("button", { name: /Open group/ }));
    expect(shell.requestOpenConversation).toHaveBeenCalledWith(7);
    expect(push).toHaveBeenCalledWith("/chats/");
  });

  it("offers nothing to open about no group in particular", async () => {
    feedIs([notification(1, { conversationId: null })]);
    render(<ActivityPage />);
    await openRow(/promoted/);
    expect(
      screen.queryByRole("button", { name: /Open group/ }),
    ).not.toBeInTheDocument();
  });

  it.each(["removed", "blocked", "left"] as const)(
    "says there is nothing to open for somebody who is %s",
    async (viewerStatus) => {
      feedIs([notification(1, { type: "member.removed", viewerStatus })]);
      render(<ActivityPage />);
      await openRow(/removed from a group/);
      expect(
        screen.getByText(
          "You are no longer in this group, so there is nothing to open.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Open group/ }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("ActivityPage - answering a join request", () => {
  const request = (overrides: Partial<AppNotification> = {}) =>
    notification(1, {
      type: "join.requested",
      requestStatus: "pending",
      data: { participant_id: 55 },
      ...overrides,
    });

  it("approves the request, then reloads the feed", async () => {
    feedIs([request()]);
    const answer = deferred<Awaited<ReturnType<typeof respondToJoinRequest>>>();
    vi.mocked(respondToJoinRequest).mockReturnValue(answer.promise);
    render(<ActivityPage />);
    await openRow(/Ada requested to join/);
    expect(
      screen.getByText(/Ada has asked to join Book Club\./),
    ).toBeInTheDocument();
    // A request is answered here, not opened.
    expect(
      screen.queryByRole("button", { name: /Open group/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
    expect(respondToJoinRequest).toHaveBeenCalledWith(7, 55, "approve");

    answer.resolve({ ok: true } as never);
    expect(
      await screen.findByText("Ada is now in Book Club."),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it("declines the request", async () => {
    feedIs([request()]);
    vi.mocked(respondToJoinRequest).mockResolvedValue({ ok: true } as never);
    render(<ActivityPage />);
    await openRow(/requested to join/);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(respondToJoinRequest).toHaveBeenCalledWith(7, 55, "decline");
    expect(
      await screen.findByText("This request has already been answered."),
    ).toBeInTheDocument();
  });

  it("says why the answer could not be saved, and lets you try again", async () => {
    feedIs([request()]);
    vi.mocked(respondToJoinRequest).mockResolvedValue({
      ok: false,
      message: "Unable to update this request.",
    });
    render(<ActivityPage />);
    await openRow(/requested to join/);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(
      await screen.findByText("Unable to update this request."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("shows how a request somebody else answered turned out", async () => {
    feedIs([
      request({
        requestStatus: "active",
        actorName: null,
        conversationName: null,
      }),
    ]);
    const first = render(<ActivityPage />);
    await openRow(/Someone requested to join/);
    expect(screen.getByText("They is now in the group.")).toBeInTheDocument();
    first.unmount();

    feedIs([request({ requestStatus: "removed" })]);
    render(<ActivityPage />);
    await openRow(/requested to join/);
    expect(
      screen.getByText("This request has already been answered."),
    ).toBeInTheDocument();
  });

  it("names nobody in particular when the request carries no names", async () => {
    feedIs([request({ actorName: null, conversationName: null })]);
    render(<ActivityPage />);
    await openRow(/Someone requested to join/);
    expect(
      screen.getByText(/Someone has asked to join your group\./),
    ).toBeInTheDocument();
  });

  it("does nothing for a request with no group to answer in", async () => {
    feedIs([request({ conversationId: null })]);
    render(<ActivityPage />);
    await openRow(/requested to join/);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(respondToJoinRequest).not.toHaveBeenCalled();
  });

  it("treats a request with no participant as an ordinary notification", async () => {
    feedIs([request({ data: null })]);
    render(<ActivityPage />);
    await openRow(/requested to join/);
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open group/ }),
    ).toBeInTheDocument();
  });
});

describe("ActivityPage - joining from a notification", () => {
  const outside = (overrides: Partial<AppNotification> = {}) =>
    notification(1, {
      type: "join.declined",
      viewerStatus: null,
      ...overrides,
    });

  it("joins an open group, then reloads the feed", async () => {
    feedIs([outside()]);
    vi.mocked(joinConversation).mockResolvedValue({
      ok: true,
      status: "joined",
      conversation: {} as never,
    });
    render(<ActivityPage />);
    await openRow(/declined/);
    await userEvent.click(screen.getByRole("button", { name: "Join Group" }));
    expect(joinConversation).toHaveBeenCalledWith(7);
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it("says a request was sent when the group needs approval", async () => {
    feedIs([outside({ joinMode: "approval" })]);
    vi.mocked(joinConversation).mockResolvedValue({
      ok: true,
      status: "pending",
    });
    render(<ActivityPage />);
    await openRow(/declined/);
    await userEvent.click(
      screen.getByRole("button", { name: "Request to Join" }),
    );
    expect(await screen.findByText(/Request sent\./)).toBeInTheDocument();
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it("joins with a code, trimmed", async () => {
    feedIs([outside({ joinMode: "code", conversationName: null })]);
    vi.mocked(joinConversationWithCode).mockResolvedValue({
      ok: false,
      message: "That code is not valid.",
    });
    render(<ActivityPage />);
    await openRow(/declined/);
    expect(
      screen.getByRole("heading", { name: "This group" }),
    ).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Submit Code" });
    expect(submit).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText("Enter join code"),
      " AB12 ",
    );
    await userEvent.click(submit);
    expect(joinConversationWithCode).toHaveBeenCalledWith("AB12");
    expect(
      await screen.findByText("That code is not valid."),
    ).toBeInTheDocument();
  });

  it("shows a request already waiting as sent", async () => {
    feedIs([outside({ viewerStatus: "pending" })]);
    render(<ActivityPage />);
    await openRow(/declined/);
    expect(screen.getByText(/Request sent\./)).toBeInTheDocument();
  });

  it("explains an invite-only group", async () => {
    feedIs([outside({ joinMode: "invite" })]);
    render(<ActivityPage />);
    await openRow(/declined/);
    const detail = screen.getByRole("heading", {
      name: "Your request was declined",
    }).parentElement as HTMLElement;
    expect(
      within(detail).getByText(/This Loop is invite-only/),
    ).toBeInTheDocument();
  });
});
