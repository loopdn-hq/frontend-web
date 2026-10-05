import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/whatsapp/GroupWhatsAppPanel", () => ({
  GroupWhatsAppPanel: ({
    conversationId,
  }: {
    conversationId: string | number;
  }) => <div data-testid="whatsapp-panel">{String(conversationId)}</div>,
}));
vi.mock("@/components/home/LoopPanelGeneral", () => ({
  LoopPanelGeneral: ({
    details,
    canEdit,
    canEditDetails,
  }: {
    details: { name: string; description: string; imageUrl: string | null };
    canEdit: boolean;
    canEditDetails: boolean;
  }) => (
    <div data-testid="general-panel">
      {details.name}|{details.description}|{String(details.imageUrl)}|
      {String(canEdit)}|{String(canEditDetails)}
    </div>
  ),
}));
vi.mock("@/components/home/LoopPanelMembers", () => ({
  LoopPanelMembers: ({
    canModerate,
    pendingRequestCount,
    blockedCount,
    onOpenPendingRequests,
    onOpenBlocked,
    onBlockMember,
  }: {
    canModerate: boolean;
    pendingRequestCount: number;
    blockedCount: number | null;
    onOpenPendingRequests: () => void;
    onOpenBlocked?: () => void;
    onBlockMember?: (memberId: string) => Promise<void>;
  }) => (
    <div data-testid="members-panel">
      {String(canModerate)}|{pendingRequestCount}|{String(blockedCount)}
      <button onClick={onOpenPendingRequests}>open requests</button>
      {onOpenBlocked && <button onClick={onOpenBlocked}>open blocked</button>}
      {onBlockMember && (
        <button onClick={() => void onBlockMember("9")}>block somebody</button>
      )}
    </div>
  ),
}));

import { LoopAdminPanel, type AdminTab } from "@/components/home/LoopAdminPanel";
import type {
  ConversationParticipant,
  GroupSettings,
} from "@/lib/chat/conversations";
import { deferred } from "@/test/helpers";

const SETTINGS = { mode: "chat" } as GroupSettings;
const blockedMember = (id: string, extra: Partial<ConversationParticipant> = {}) =>
  ({ id, name: `Blocked ${id}`, ...extra }) as ConversationParticipant;

function show(props: Partial<Parameters<typeof LoopAdminPanel>[0]> = {}) {
  const onTabChange = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <LoopAdminPanel
      isOpen
      conversationId={7}
      onClose={onClose}
      loopName="Book Club"
      settings={SETTINGS}
      activeTab="general"
      onTabChange={onTabChange}
      members={[]}
      {...props}
    />,
  );
  return { onTabChange, onClose, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoopAdminPanel", () => {
  it("shows nothing while closed", () => {
    show({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the general settings, passing the Loop's details down", () => {
    show({
      loopDescription: "We read.",
      loopImageUrl: "/logo.png",
      canEditSettings: false,
    });
    expect(
      screen.getByRole("dialog", { name: "Book Club Panel" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Who may edit the details follows who may edit the settings, unless said.
    expect(screen.getByTestId("general-panel")).toHaveTextContent(
      "Book Club|We read.|/logo.png|false|false",
    );
  });

  it("lets details be editable by somebody who cannot change the settings", () => {
    show({ canEditSettings: false, canEditDetails: true });
    expect(screen.getByTestId("general-panel")).toHaveTextContent(
      "Book Club||null|false|true",
    );
  });

  it("says when the settings are loading, or could not be loaded", () => {
    const first = show({ settings: null, isSettingsLoading: true });
    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
    first.unmount();
    show({ settings: null });
    expect(screen.getByText("Unable to load settings.")).toBeInTheDocument();
  });

  it("asks its parent to change the tab", async () => {
    const { onTabChange } = show();
    await userEvent.click(screen.getByRole("tab", { name: "Members" }));
    expect(onTabChange).toHaveBeenCalledWith("members");
    await userEvent.click(screen.getByRole("tab", { name: "WhatsApp" }));
    expect(onTabChange).toHaveBeenLastCalledWith("whatsapp");
  });

  it("shows the WhatsApp panel for the conversation, when there is one", () => {
    const first = show({ activeTab: "whatsapp" });
    expect(screen.getByTestId("whatsapp-panel")).toHaveTextContent("7");
    first.unmount();
    show({ activeTab: "whatsapp", conversationId: null });
    expect(screen.queryByTestId("whatsapp-panel")).not.toBeInTheDocument();
  });

  describe("members", () => {
    it("loads who is blocked when the tab is shown", async () => {
      const onFetchBlockedMembers = vi.fn(async () => [
        blockedMember("1"),
        blockedMember("2"),
      ]);
      show({
        activeTab: "members",
        canModerateMembers: true,
        pendingRequests: [{ id: "5", name: "Kim" }],
        onFetchBlockedMembers,
      });
      expect(screen.getByTestId("members-panel")).toHaveTextContent(
        "true|1|null",
      );
      await waitFor(() =>
        expect(screen.getByTestId("members-panel")).toHaveTextContent(
          "true|1|2",
        ),
      );
    });

    it("does not load the blocked on another tab, and offers no way in without a loader", () => {
      const onFetchBlockedMembers = vi.fn(async () => []);
      const first = show({ onFetchBlockedMembers });
      expect(onFetchBlockedMembers).not.toHaveBeenCalled();
      first.unmount();

      show({ activeTab: "members" });
      expect(
        screen.queryByRole("button", { name: "open blocked" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "block somebody" }),
      ).not.toBeInTheDocument();
    });

    it("reloads the blocked list after somebody is blocked", async () => {
      const onFetchBlockedMembers = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([blockedMember("9")]);
      const onBlockMember = vi.fn(async () => {});
      show({ activeTab: "members", onFetchBlockedMembers, onBlockMember });
      await waitFor(() =>
        expect(screen.getByTestId("members-panel")).toHaveTextContent("|0"),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "block somebody" }),
      );
      expect(onBlockMember).toHaveBeenCalledWith("9");
      await waitFor(() =>
        expect(screen.getByTestId("members-panel")).toHaveTextContent("|1"),
      );
    });

    it("ignores a blocked list that arrives after the panel has gone", async () => {
      const pending = deferred<ConversationParticipant[]>();
      const { unmount } = show({
        activeTab: "members",
        onFetchBlockedMembers: () => pending.promise,
      });
      unmount();
      pending.resolve([blockedMember("1")]);
      await pending.promise;
      expect(screen.queryByTestId("members-panel")).not.toBeInTheDocument();
    });

    it("ignores a failure that arrives after the panel has gone", async () => {
      const pending = deferred<ConversationParticipant[]>();
      const { unmount } = show({
        activeTab: "members",
        onFetchBlockedMembers: () => pending.promise,
      });
      unmount();
      pending.reject(new Error("late"));
      await pending.promise.catch(() => {});
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("blocked members", () => {
    async function openBlocked(
      props: Partial<Parameters<typeof LoopAdminPanel>[0]>,
    ) {
      const result = show({ activeTab: "members", ...props });
      await userEvent.click(screen.getByRole("button", { name: "open blocked" }));
      return result;
    }

    it("lists who is blocked, and goes back to the members", async () => {
      await openBlocked({
        onFetchBlockedMembers: async () => [
          blockedMember("1", { username: "kim" }),
          blockedMember("2", { phone: "+14155552671" }),
          blockedMember("3"),
        ],
      });
      expect(
        screen.getByRole("heading", { name: "Blocked members" }),
      ).toHaveFocus();
      const rows = await screen.findAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("Blocked 1@kim");
      expect(rows[1]).toHaveTextContent("Blocked 2+14155552671");
      expect(rows[2]).toHaveTextContent(/^Blocked 3Unblock$/);

      await userEvent.click(screen.getByRole("button", { name: "Members" }));
      expect(screen.getByTestId("members-panel")).toBeInTheDocument();
    });

    it("says it is loading, then that nobody is blocked", async () => {
      const pending = deferred<ConversationParticipant[]>();
      await openBlocked({ onFetchBlockedMembers: () => pending.promise });
      expect(screen.getByText("Loading blocked members...")).toBeInTheDocument();
      await act(async () => pending.resolve([]));
      expect(
        screen.getByText("Nobody is blocked from this Loop."),
      ).toBeInTheDocument();
    });

    it("says why the list could not be loaded", async () => {
      const first = await openBlocked({
        onFetchBlockedMembers: vi.fn().mockRejectedValue(new Error("Admins only.")),
      });
      expect(await screen.findByText("Admins only.")).toBeInTheDocument();
      expect(
        screen.queryByText("Loading blocked members..."),
      ).not.toBeInTheDocument();
      first.unmount();

      await openBlocked({
        onFetchBlockedMembers: vi.fn().mockRejectedValue("nope"),
      });
      expect(
        await screen.findByText("Could not load blocked members."),
      ).toBeInTheDocument();
    });

    it("unblocks somebody, then reloads the list", async () => {
      const answer = deferred<void>();
      const onUnblockMember = vi.fn(() => answer.promise);
      const onFetchBlockedMembers = vi
        .fn()
        .mockResolvedValueOnce([blockedMember("1"), blockedMember("2")])
        .mockResolvedValueOnce([blockedMember("2")]);
      await openBlocked({ onFetchBlockedMembers, onUnblockMember });
      const rows = await screen.findAllByRole("listitem");
      await userEvent.click(within(rows[0]).getByRole("button"));
      expect(onUnblockMember).toHaveBeenCalledWith("1");
      expect(
        within(rows[0]).getByRole("button", { name: "Unblocking..." }),
      ).toBeDisabled();
      expect(within(rows[1]).getByRole("button")).toBeDisabled();

      await act(async () => answer.resolve());
      await waitFor(() =>
        expect(screen.getAllByRole("listitem")).toHaveLength(1),
      );
    });

    it("says why somebody could not be unblocked, or the list not reloaded", async () => {
      const onUnblockMember = vi
        .fn()
        .mockRejectedValueOnce(new Error("They have left the Loop."))
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValueOnce(undefined);
      const onFetchBlockedMembers = vi
        .fn()
        .mockResolvedValueOnce([blockedMember("1")])
        .mockRejectedValueOnce(new Error("Could not refresh."));
      await openBlocked({ onFetchBlockedMembers, onUnblockMember });
      const unblock = await screen.findByRole("button", { name: "Unblock" });
      await userEvent.click(unblock);
      expect(
        await screen.findByText("They have left the Loop."),
      ).toBeInTheDocument();

      await userEvent.click(unblock);
      expect(
        await screen.findByText("Could not unblock them. Try again."),
      ).toBeInTheDocument();

      await userEvent.click(unblock);
      expect(await screen.findByText("Could not refresh.")).toBeInTheDocument();
    });

    it("copes with no way to unblock", async () => {
      await openBlocked({
        onFetchBlockedMembers: async () => [blockedMember("1")],
      });
      const unblock = await screen.findByRole("button", { name: "Unblock" });
      await userEvent.click(unblock);
      await waitFor(() => expect(unblock).toBeEnabled());
    });

    it("leaves the sub-view when another tab is chosen", async () => {
      const { onTabChange, rerender } = await openBlocked({
        onFetchBlockedMembers: async () => [],
      });
      await userEvent.click(screen.getByRole("tab", { name: "Members" }));
      expect(onTabChange).toHaveBeenCalledWith("members");
      rerender(
        <LoopAdminPanel
          isOpen
          onClose={vi.fn()}
          loopName="Book Club"
          settings={SETTINGS}
          activeTab={"members" as AdminTab}
          onTabChange={onTabChange}
          members={[]}
        />,
      );
      expect(screen.getByTestId("members-panel")).toBeInTheDocument();
    });
  });

  describe("join requests", () => {
    const REQUESTS = [
      { id: "5", name: "Kim", username: "kim" },
      { id: "6", name: "Lee", phone: "+14155552671" },
      { id: "7", name: "Noa" },
    ];

    async function openRequests(
      props: Partial<Parameters<typeof LoopAdminPanel>[0]> = {},
    ) {
      const result = show({ activeTab: "members", ...props });
      await userEvent.click(
        screen.getByRole("button", { name: "open requests" }),
      );
      return result;
    }

    it("lists who asked, and approves or declines each", async () => {
      const onApproveRequest = vi.fn(async () => {});
      const onDeclineRequest = vi.fn(async () => {});
      await openRequests({
        pendingRequests: REQUESTS,
        onApproveRequest,
        onDeclineRequest,
      });
      const rows = screen.getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("Kim@kim");
      expect(rows[1]).toHaveTextContent("Lee+14155552671");
      expect(rows[2]).toHaveTextContent(/^NoaDeclineApprove$/);

      await userEvent.click(
        within(rows[0]).getByRole("button", { name: "Approve" }),
      );
      expect(onApproveRequest).toHaveBeenCalledWith("5");
      await userEvent.click(
        within(rows[1]).getByRole("button", { name: "Decline" }),
      );
      expect(onDeclineRequest).toHaveBeenCalledWith("6");
    });

    it("says when there are none, or they are still loading", async () => {
      const first = await openRequests();
      expect(
        screen.getByText("No pending requests to join this Loop."),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Members" }));
      expect(screen.getByTestId("members-panel")).toBeInTheDocument();
      first.unmount();

      await openRequests({ isPendingRequestsLoading: true });
      expect(screen.getByText("Loading requests...")).toBeInTheDocument();
      expect(
        screen.queryByText("No pending requests to join this Loop."),
      ).not.toBeInTheDocument();
    });

    it("holds the answers while busy, and copes with nobody listening", async () => {
      const first = await openRequests({
        pendingRequests: REQUESTS,
        isLoading: true,
      });
      expect(screen.getAllByRole("button", { name: "Approve" })[0]).toBeDisabled();
      first.unmount();

      await openRequests({ pendingRequests: [REQUESTS[0]] });
      await userEvent.click(screen.getByRole("button", { name: "Approve" }));
      await userEvent.click(screen.getByRole("button", { name: "Decline" }));
      expect(screen.getByRole("listitem")).toBeInTheDocument();
    });
  });

  describe("leaving", () => {
    it("is not offered where it cannot be done", () => {
      show();
      expect(
        screen.queryByRole("button", { name: "Leave Loop" }),
      ).not.toBeInTheDocument();
    });

    it("asks first, and can be cancelled", async () => {
      const onLeaveLoop = vi.fn();
      show({ onLeaveLoop });
      await userEvent.click(screen.getByRole("button", { name: "Leave Loop" }));
      const confirm = screen.getByRole("dialog", { name: "Leave Book Club?" });
      await userEvent.click(
        within(confirm).getByRole("button", { name: "Cancel" }),
      );
      expect(
        screen.queryByRole("dialog", { name: "Leave Book Club?" }),
      ).not.toBeInTheDocument();
      expect(onLeaveLoop).not.toHaveBeenCalled();
    });

    it("leaves on confirmation, and cannot be backed out of meanwhile", async () => {
      const answer = deferred<{ ok: true }>();
      const onLeaveLoop = vi.fn(() => answer.promise);
      show({ onLeaveLoop });
      await userEvent.click(screen.getByRole("button", { name: "Leave Loop" }));
      const confirm = screen.getByRole("dialog", { name: "Leave Book Club?" });
      await userEvent.click(
        within(confirm).getByRole("button", { name: "Leave Loop" }),
      );
      expect(
        within(confirm).getByRole("button", { name: "Leaving..." }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(within(confirm).getByRole("button", { name: "Cancel" })).toBeDisabled();
      await userEvent.click(
        within(confirm).getByRole("button", { name: "Keep me in this Loop" }),
      );
      expect(
        screen.getByRole("dialog", { name: "Leave Book Club?" }),
      ).toBeInTheDocument();

      await act(async () => answer.resolve({ ok: true }));
      expect(
        screen.queryByRole("dialog", { name: "Leave Book Club?" }),
      ).not.toBeInTheDocument();
    });

    it("says why leaving was refused, and forgets it on asking again", async () => {
      const onLeaveLoop = vi.fn(async () => ({
        ok: false as const,
        message: "You are the last admin.",
      }));
      show({ onLeaveLoop });
      await userEvent.click(screen.getByRole("button", { name: "Leave Loop" }));
      const confirm = screen.getByRole("dialog", { name: "Leave Book Club?" });
      await userEvent.click(
        within(confirm).getByRole("button", { name: "Leave Loop" }),
      );
      expect(
        await within(confirm).findByText("You are the last admin."),
      ).toBeInTheDocument();

      await userEvent.click(
        within(confirm).getByRole("button", { name: "Keep me in this Loop" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Leave Loop" }));
      expect(
        screen.queryByText("You are the last admin."),
      ).not.toBeInTheDocument();
    });
  });
});
