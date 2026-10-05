import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let whatsAppEnabled = false;

// The debounce has its own tests; here every keystroke counts at once.
vi.mock("@/lib/hooks/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));
vi.mock("@/lib/chat/conversations", () => ({
  startDirectConversation: vi.fn(),
}));
vi.mock("@/lib/user/search", () => ({
  MIN_USER_SEARCH_LENGTH: 2,
  searchUsers: vi.fn(),
}));
vi.mock("@/lib/user/invites", () => ({ inviteToApp: vi.fn() }));
vi.mock("@/lib/config/origin", () => ({
  publicOrigin: () => "https://loopdn.com",
}));
vi.mock("@/lib/whatsapp/useWhatsAppConfig", () => ({
  useWhatsAppConfig: () => ({ isEnabled: whatsAppEnabled }),
}));
vi.mock("@/components/whatsapp/InviteByWhatsAppForm", () => ({
  InviteByWhatsAppForm: ({
    conversationId,
    canInviteMembers,
    onInvited,
  }: {
    conversationId: string | number;
    canInviteMembers: boolean;
    onInvited?: () => void;
  }) => (
    <div data-testid="whatsapp-form">
      {String(conversationId)}:{String(canInviteMembers)}
      <button onClick={onInvited}>whatsapp invited</button>
    </div>
  ),
}));

import { AddMembersModal } from "@/components/home/AddMembersModal";
import {
  MemberSearchPicker,
  type MemberPick,
  type MemberSearchResult,
} from "@/components/home/MemberSearchPicker";
import { NewConversationModal } from "@/components/home/NewConversationModal";
import {
  startDirectConversation,
  type ConversationParticipant,
  type MemberCandidate,
} from "@/lib/chat/conversations";
import { inviteToApp } from "@/lib/user/invites";
import { searchUsers } from "@/lib/user/search";
import { deferred } from "@/test/helpers";

function candidate(
  username: string,
  overrides: Partial<MemberCandidate> = {},
): MemberCandidate {
  return {
    id: `u-${username}`,
    username,
    name: username[0].toUpperCase() + username.slice(1),
    status: "ready",
    detail: "",
    ...overrides,
  };
}

function found(
  candidates: MemberCandidate[],
  extra: Partial<Extract<MemberSearchResult, { ok: true }>> = {},
): MemberSearchResult {
  return { ok: true, candidates, hasMore: false, invite: null, ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  whatsAppEnabled = false;
});

describe("MemberSearchPicker", () => {
  /** The picker with the selection kept by a parent, as the modal keeps it. */
  function Harness({
    onSearch,
    initial = [],
    disabled = false,
  }: {
    onSearch: (term: string) => Promise<MemberSearchResult>;
    initial?: MemberPick[];
    disabled?: boolean;
  }) {
    const [selected, setSelected] = useState<MemberPick[]>(initial);
    return (
      <MemberSearchPicker
        inputId="member-search"
        selected={selected}
        onSelect={(pick) => setSelected((current) => [...current, pick])}
        onRemove={(pick) =>
          setSelected((current) =>
            current.filter((other) => other.id !== pick.id),
          )
        }
        onSearch={onSearch}
        disabled={disabled}
      />
    );
  }

  const input = () => screen.getByRole("combobox");
  /** Each chip carries an avatar, so the names are read off the remove buttons. */
  const picked = () =>
    within(screen.getByRole("list", { name: "People to add" }))
      .getAllByRole("button")
      .map((button) =>
        button.getAttribute("aria-label")?.replace("Remove ", ""),
      );

  it("explains what can be typed before anything is", () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    expect(
      screen.getByText(/Type a username, or someone's full email/),
    ).toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it.each([
    ["a", "Keep typing..."],
    ["sam@", "Finish the email - only a full address finds someone."],
    ["+1415", "Enter the whole number, with its country code."],
  ])("waits on %s without searching", async (text, message) => {
    const onSearch = vi.fn(async () => found([]));
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), text);
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(onSearch).not.toHaveBeenCalledWith(text);
  });

  it("lists who matched, and adds the one that is clicked", async () => {
    const onSearch = vi.fn(async () =>
      found([candidate("sam"), candidate("sara")]),
    );
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), " sa ");
    expect(onSearch).toHaveBeenLastCalledWith("sa");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Sam@sam");
    expect(options[1]).toHaveTextContent("Sara@sara");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(input()).toHaveAttribute("aria-activedescendant", options[0].id);

    await userEvent.click(options[1]);
    expect(picked()).toEqual(["Sara"]);
    expect(input()).toHaveValue("");
    expect(input()).toHaveFocus();
  });

  it("moves through the results with the arrows, and adds with Enter", async () => {
    const onSearch = vi.fn(async () =>
      found([
        candidate("sam"),
        candidate("sal", { status: "already_member" }),
        candidate("sara"),
      ]),
    );
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "sa");
    const options = await screen.findAllByRole("option");

    // Somebody already in the Loop is shown but skipped.
    expect(options[1]).toHaveAttribute("aria-disabled", "true");
    expect(options[1]).toHaveTextContent("In this Loop");
    await userEvent.keyboard("{ArrowDown}");
    expect(input()).toHaveAttribute("aria-activedescendant", options[2].id);
    await userEvent.keyboard("{ArrowDown}");
    expect(input()).toHaveAttribute("aria-activedescendant", options[0].id);
    await userEvent.keyboard("{ArrowUp}");
    expect(input()).toHaveAttribute("aria-activedescendant", options[2].id);

    await userEvent.keyboard("{Enter}");
    expect(picked()).toEqual(["Sara"]);
  });

  it("follows the pointer, but not onto somebody who cannot be added", async () => {
    const onSearch = vi.fn(async () =>
      found([
        candidate("sam"),
        candidate("sal", {
          status: "refused",
          detail: "They have blocked invitations.",
        }),
        candidate("sara"),
      ]),
    );
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "sa");
    const options = await screen.findAllByRole("option");
    expect(options[1]).toHaveTextContent("They have blocked invitations.");

    await userEvent.hover(options[2]);
    expect(input()).toHaveAttribute("aria-activedescendant", options[2].id);
    await userEvent.hover(options[1]);
    expect(input()).toHaveAttribute("aria-activedescendant", options[2].id);

    await userEvent.click(options[1]);
    expect(
      screen.queryByRole("list", { name: "People to add" }),
    ).not.toBeInTheDocument();
    // Pressing a row must not take the focus out of the search box.
    expect(fireEvent.mouseDown(options[0])).toBe(false);
  });

  it("takes somebody back out when they are clicked a second time", async () => {
    const onSearch = vi.fn(async () => found([candidate("sam")]));
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "sam");
    await userEvent.click(await screen.findByRole("option"));
    expect(picked()).toEqual(["Sam"]);

    await userEvent.type(input(), "sam");
    const option = await screen.findByRole("option");
    expect(option).toHaveAttribute("aria-selected", "true");
    await userEvent.click(option);
    expect(
      screen.queryByRole("list", { name: "People to add" }),
    ).not.toBeInTheDocument();
  });

  it("removes a chosen person by their chip, or with Backspace", async () => {
    const initial: MemberPick[] = [
      { kind: "account", id: "u-sam", name: "Sam", username: "sam" },
      {
        kind: "email",
        id: "email:ada@example.com",
        name: "ada@example.com",
        email: "ada@example.com",
      },
    ];
    render(<Harness onSearch={vi.fn()} initial={initial} />);
    expect(picked()).toEqual(["Sam", "ada@example.com"]);

    await userEvent.click(input());
    await userEvent.keyboard("{Backspace}");
    expect(picked()).toEqual(["Sam"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove Sam" }));
    expect(
      screen.queryByRole("list", { name: "People to add" }),
    ).not.toBeInTheDocument();

    // With nobody left and nothing typed, the keys do nothing.
    await userEvent.keyboard("{Backspace}{ArrowDown}{Enter}");
    expect(input()).toHaveValue("");
  });

  it("offers to invite an email address nobody has an account for", async () => {
    const onSearch = vi.fn(async () =>
      found([], {
        invite: { email: "new@example.com", status: "ready", detail: "" },
      }),
    );
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "new@example.com");
    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent(
      "No account found. Invite them by email instead.",
    );
    await userEvent.keyboard("{Enter}");
    expect(picked()).toEqual(["new@example.com"]);
  });

  it("says why an email address cannot be invited again", async () => {
    const onSearch = vi.fn(async () =>
      found([], {
        invite: {
          email: "new@example.com",
          status: "already_member",
          detail: "Already invited to this Loop.",
        },
      }),
    );
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "new@example.com");
    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("Already invited to this Loop.");
    expect(option).toHaveTextContent("Invited");
    // Nothing can be picked, so the arrows have nowhere to go.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(
      screen.queryByRole("list", { name: "People to add" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["zz", 'No usernames start with "zz".'],
    ["zz@example.com", "No Loopd'n account uses that email."],
    ["+14155552671", /No Loopd'n account has that number/],
  ])("says when %s finds nobody", async (text, message) => {
    render(<Harness onSearch={vi.fn(async () => found([]))} />);
    await userEvent.type(input(), text);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(message),
    );
  });

  it("says why a search failed, and when more people match than are shown", async () => {
    const onSearch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "Search failed." })
      .mockResolvedValue(found([candidate("sam")], { hasMore: true }));
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "sa");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Search failed.",
    );

    await userEvent.type(input(), "m");
    expect(await screen.findByText(/More people match/)).toBeInTheDocument();
  });

  it("holds Enter until the search for what was typed has answered", async () => {
    const first = deferred<MemberSearchResult>();
    const onSearch = vi.fn(() => first.promise);
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(input(), "sa{Enter}");
    expect(
      screen.queryByRole("list", { name: "People to add" }),
    ).not.toBeInTheDocument();

    await act(async () => first.resolve(found([candidate("sam")])));
    await userEvent.keyboard("{Enter}");
    expect(picked()).toEqual(["Sam"]);
  });

  it("ignores an answer that arrives after it has gone", async () => {
    const pending = deferred<MemberSearchResult>();
    const { unmount } = render(<Harness onSearch={() => pending.promise} />);
    await userEvent.type(input(), "sa");
    unmount();
    pending.resolve(found([candidate("sam")]));
    await pending.promise;
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("can be held, chips and all", () => {
    render(
      <Harness
        onSearch={vi.fn()}
        disabled
        initial={[
          { kind: "account", id: "u-sam", name: "Sam", username: "sam" },
        ]}
      />,
    );
    expect(input()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Sam" })).toBeDisabled();
  });
});

describe("NewConversationModal", () => {
  const user = (username: string) => ({
    id: `u-${username}`,
    username,
    name: username[0].toUpperCase() + username.slice(1),
  });

  function show() {
    const props = {
      onClose: vi.fn(),
      onStarted: vi.fn(async () => {}),
      onCreateGroup: vi.fn(),
    };
    render(<NewConversationModal {...props} />);
    return { ...props, input: screen.getByRole("searchbox") };
  }

  function usersAre(users: ReturnType<typeof user>[], hasMore = false) {
    vi.mocked(searchUsers).mockResolvedValue({
      ok: true,
      users,
      hasMore,
    } as never);
  }

  it("asks for two letters, and offers to create a group instead", async () => {
    const { input, onCreateGroup } = show();
    expect(screen.getByText(/Type at least two letters/)).toBeInTheDocument();
    await userEvent.type(input, "s");
    expect(searchUsers).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Create group/ }));
    expect(onCreateGroup).toHaveBeenCalled();
  });

  it("finds people by username, and opens a conversation with one", async () => {
    usersAre([user("sam"), user("sara")], true);
    const answer =
      deferred<Awaited<ReturnType<typeof startDirectConversation>>>();
    vi.mocked(startDirectConversation).mockReturnValue(answer.promise);
    const { input, onStarted } = show();
    await userEvent.type(input, "sa");
    expect(searchUsers).toHaveBeenLastCalledWith("sa");

    expect(await screen.findByText("@sara")).toBeInTheDocument();
    expect(screen.getByText(/Showing the first 2\./)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Message" });
    await userEvent.click(buttons[0]);
    expect(startDirectConversation).toHaveBeenCalledWith("sam");
    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Message" })).toBeDisabled();

    await act(async () => answer.resolve({ ok: true, conversationId: 31 }));
    expect(onStarted).toHaveBeenCalledWith(31);
  });

  it("says Searching until the answer for this term is in", async () => {
    const pending = deferred<unknown>();
    vi.mocked(searchUsers).mockReturnValue(pending.promise as never);
    const { input } = show();
    await userEvent.type(input, "sa");
    expect(screen.getByText("Searching...")).toBeInTheDocument();
    await act(async () =>
      pending.resolve({ ok: true, users: [], hasMore: false }),
    );
    expect(
      screen.getByText("No usernames start with “sa”."),
    ).toBeInTheDocument();
  });

  it("says why a search or an opening failed", async () => {
    vi.mocked(searchUsers).mockResolvedValueOnce({
      ok: false,
      message: "Search is unavailable.",
    } as never);
    const { input } = show();
    await userEvent.type(input, "sa");
    expect(
      await screen.findByText("Search is unavailable."),
    ).toBeInTheDocument();

    usersAre([user("sam")]);
    vi.mocked(startDirectConversation).mockResolvedValue({
      ok: false,
      message: "They are not taking messages.",
    });
    await userEvent.type(input, "m");
    await userEvent.click(
      await screen.findByRole("button", { name: "Message" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "They are not taking messages.",
    );
    // Only a failed email offers an invitation.
    expect(
      screen.queryByRole("button", { name: "Send invite" }),
    ).not.toBeInTheDocument();
  });

  it("opens a conversation by email, and offers an invitation when nobody has it", async () => {
    vi.mocked(startDirectConversation).mockResolvedValue({
      ok: false,
      message: "No account has verified that email.",
    });
    const sending = deferred<unknown>();
    vi.mocked(inviteToApp).mockReturnValue(sending.promise as never);
    usersAre([]);
    const { input } = show();
    await userEvent.type(input, "new@example.com");
    expect(searchUsers).not.toHaveBeenCalledWith("new@example.com");
    expect(
      screen.getByText("Opens a conversation if this email is verified"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Message" }));
    expect(startDirectConversation).toHaveBeenCalledWith("new@example.com");
    await userEvent.click(
      await screen.findByRole("button", { name: "Send invite" }),
    );
    expect(inviteToApp).toHaveBeenCalledWith("new@example.com");
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    await act(async () => sending.resolve({ ok: true, alreadyHere: false }));
    expect(screen.getByText(/an invitation is on its way/)).toBeInTheDocument();
  });

  it("says when the invited address turns out to have an account, or the invite fails", async () => {
    usersAre([]);
    vi.mocked(startDirectConversation).mockResolvedValue({
      ok: false,
      message: "No.",
    });
    vi.mocked(inviteToApp)
      .mockResolvedValueOnce({
        ok: false,
        message: "Too many invitations today.",
      } as never)
      .mockResolvedValueOnce({ ok: true, alreadyHere: true } as never);
    const { input } = show();
    await userEvent.type(input, "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Message" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Send invite" }),
    );
    expect(
      await screen.findByText("Too many invitations today."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(
      await screen.findByText(/They already have an account/),
    ).toBeInTheDocument();
  });

  it("gives a link to send by hand for a number nobody has verified", async () => {
    usersAre([]);
    const { input } = show();
    await userEvent.type(input, "+14155552671");
    expect(
      await screen.findByText("No account has verified that number."),
    ).toBeInTheDocument();

    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Copy it by hand: https://loopdn.com/signup",
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
    expect(
      await screen.findByRole("button", { name: "Link copied" }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenLastCalledWith("https://loopdn.com/signup");
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("ignores results that arrive after it has closed", async () => {
    const pending = deferred<unknown>();
    vi.mocked(searchUsers).mockReturnValue(pending.promise as never);
    const props = {
      onClose: vi.fn(),
      onStarted: vi.fn(),
      onCreateGroup: vi.fn(),
    };
    const { unmount } = render(<NewConversationModal {...props} />);
    await userEvent.type(screen.getByRole("searchbox"), "sa");
    unmount();
    pending.resolve({ ok: true, users: [user("sam")], hasMore: false });
    await pending.promise;
    expect(screen.queryByText("@sam")).not.toBeInTheDocument();
  });
});

describe("AddMembersModal", () => {
  const member = (id: string) =>
    ({ id, name: `Member ${id}` }) as ConversationParticipant;

  function show(props: Partial<Parameters<typeof AddMembersModal>[0]> = {}) {
    const handlers = {
      onClose: vi.fn(),
      onAddMembers: vi.fn(async () => {}),
      onSearchMembers: vi.fn(async () =>
        found([candidate("sam"), candidate("sara")], {
          invite: { email: "new@example.com", status: "ready", detail: "" },
        }),
      ),
      onInvitePhone: vi.fn(async () => {}),
      onWhatsAppInvited: vi.fn(),
    };
    render(
      <AddMembersModal
        isOpen
        conversationId={7}
        groupName="Book Club"
        members={[member("1"), member("2")]}
        {...handlers}
        {...props}
      />,
    );
    return { ...handlers, ...props };
  }

  async function pick(...names: string[]) {
    for (const name of names) {
      await userEvent.type(screen.getByRole("combobox"), "sa");
      const options = await screen.findAllByRole("option");
      await userEvent.click(
        options.find((option) => option.textContent?.includes(name))!,
      );
    }
  }

  it("shows nothing while closed", () => {
    const { container } = render(
      <AddMembersModal
        isOpen={false}
        conversationId={7}
        groupName="Book Club"
        members={[]}
        onClose={vi.fn()}
        onAddMembers={vi.fn()}
        onSearchMembers={vi.fn()}
        onInvitePhone={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says who it is adding to, and how many are there already", () => {
    show();
    const dialog = screen.getByRole("dialog", { name: "Add members" });
    expect(dialog).toHaveTextContent("Add people to Book Club");
    expect(dialog).toHaveTextContent("2 current members");
    expect(screen.getByRole("button", { name: "Add member" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Via WhatsApp" }),
    ).not.toBeInTheDocument();
  });

  it("counts one member in the singular", () => {
    show({ members: [member("1")] });
    expect(screen.getByRole("dialog")).toHaveTextContent(
      /1 current member(?!s)/,
    );
  });

  it("asks what the newcomer may read, then adds them", async () => {
    const answer = deferred<void>();
    const onAddMembers = vi.fn(() => answer.promise);
    const { onClose } = show({ onAddMembers });
    await pick("Sam");
    await userEvent.click(screen.getByRole("button", { name: "Add member" }));

    const choice = screen.getByRole("dialog", {
      name: "Can they see old messages?",
    });
    expect(choice).toHaveTextContent(
      "Choose what this person can read in Book Club.",
    );
    await userEvent.click(
      within(choice).getByRole("button", { name: /Allow to see old messages/ }),
    );
    expect(onAddMembers).toHaveBeenCalledWith(["sam"], [], "all");
    expect(within(choice).getByText("Adding...")).toBeInTheDocument();
    expect(
      within(choice).getByRole("button", { name: /Only show new messages/ }),
    ).toBeDisabled();
    // The choice cannot be backed out of while it is being carried out.
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Can they see old messages?" }),
    ).toBeInTheDocument();

    await act(async () => answer.resolve());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds accounts and invitations together, from now on only", async () => {
    const { onAddMembers } = show();
    await pick("Sam", "Sara", "new@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: "Add 3 members" }),
    );
    expect(
      screen.getByRole("dialog", { name: /old messages/ }),
    ).toHaveTextContent("Choose what these 3 people can read in Book Club.");
    await userEvent.click(
      screen.getByRole("button", { name: /Only show new messages/ }),
    );
    expect(onAddMembers).toHaveBeenCalledWith(
      ["sam", "sara"],
      ["new@example.com"],
      "new",
    );
  });

  it("names the button for what it will do with invitations alone", async () => {
    const onSearchMembers = vi.fn().mockImplementation(async (term: string) =>
      found([], {
        invite: { email: `${term}`, status: "ready", detail: "" },
      }),
    );
    show({ onSearchMembers });
    await userEvent.type(screen.getByRole("combobox"), "a@example.com{Enter}");
    expect(
      await screen.findByRole("button", { name: "Send invitation" }),
    ).toBeEnabled();
    await userEvent.type(screen.getByRole("combobox"), "b@example.com{Enter}");
    expect(
      await screen.findByRole("button", { name: "Send 2 invitations" }),
    ).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove a@example.com" }),
    );
    expect(
      screen.getByRole("button", { name: "Send invitation" }),
    ).toBeEnabled();
  });

  it("can go back from the question without adding anybody", async () => {
    const { onAddMembers } = show();
    await pick("Sam");
    await userEvent.click(screen.getByRole("button", { name: "Add member" }));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(
      screen.queryByRole("dialog", { name: /old messages/ }),
    ).not.toBeInTheDocument();
    expect(onAddMembers).not.toHaveBeenCalled();
  });

  it("says why adding failed, keeping who was chosen", async () => {
    const onAddMembers = vi
      .fn()
      .mockRejectedValueOnce(new Error("This Loop is full."))
      .mockRejectedValueOnce("nope");
    const { onClose } = show({ onAddMembers });
    await pick("Sam");
    await userEvent.click(screen.getByRole("button", { name: "Add member" }));
    await userEvent.click(screen.getByRole("button", { name: /Allow to see/ }));
    expect(await screen.findByText("This Loop is full.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Remove Sam" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add member" }));
    await userEvent.click(screen.getByRole("button", { name: /Allow to see/ }));
    expect(
      await screen.findByText("Unable to add members."),
    ).toBeInTheDocument();
  });

  it("wants somebody chosen before it asks anything", () => {
    const { onAddMembers } = show();
    fireEvent.submit(document.getElementById("add-members-app-form")!);
    expect(
      screen.getByText("Search for at least one person to add."),
    ).toBeInTheDocument();
    expect(onAddMembers).not.toHaveBeenCalled();
  });

  it("closes from Cancel", async () => {
    const { onClose } = show();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("by phone", () => {
    async function openPhoneTab() {
      await userEvent.click(screen.getByRole("button", { name: "Via Phone" }));
      return {
        phone: screen.getByLabelText("Phone number"),
        name: screen.getByLabelText("Display name"),
        consent: screen.getByRole("checkbox"),
        submit: screen.getByRole("button", { name: "Send invite" }),
      };
    }

    it("invites a number once permission is confirmed", async () => {
      const answer = deferred<void>();
      const onInvitePhone = vi.fn(() => answer.promise);
      const { onClose } = show({ onInvitePhone });
      const { phone, name, consent, submit } = await openPhoneTab();
      expect(consent).toBeDisabled();
      expect(submit).toBeDisabled();

      await userEvent.type(phone, "+14155552671");
      await userEvent.type(name, "  Mom  ");
      await userEvent.click(consent);
      await userEvent.click(submit);
      expect(onInvitePhone).toHaveBeenCalledWith({
        phone_number: "+14155552671",
        display_name: "Mom",
      });
      expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Via Phone" })).toBeDisabled();

      await act(async () => answer.resolve());
      expect(onClose).toHaveBeenCalled();
    });

    it("withdraws the confirmation when the number changes", async () => {
      show();
      const { phone, consent } = await openPhoneTab();
      await userEvent.type(phone, "+14155552671");
      await userEvent.click(consent);
      expect(consent).toBeChecked();
      await userEvent.type(phone, "{Backspace}");
      expect(consent).not.toBeChecked();
    });

    it("refuses a number that is not one, and a missing name", async () => {
      const { onInvitePhone } = show();
      const { phone, name, consent, submit } = await openPhoneTab();
      await userEvent.type(phone, "+1415");
      await userEvent.click(consent);
      await userEvent.click(submit);
      expect(
        screen.getByText("Enter a valid phone number including country code."),
      ).toBeInTheDocument();

      await userEvent.type(phone, "5552671");
      await userEvent.click(consent);
      await userEvent.click(submit);
      expect(
        screen.getByText("Enter a name so the group knows who this is."),
      ).toBeInTheDocument();

      await userEvent.type(name, "Mom");
      await userEvent.click(consent);
      fireEvent.submit(document.getElementById("add-members-phone-form")!);
      expect(
        screen.getByText(/Confirm you have this person's permission/),
      ).toBeInTheDocument();
      expect(onInvitePhone).not.toHaveBeenCalled();
    });

    it("says why the invite could not be sent", async () => {
      const onInvitePhone = vi
        .fn()
        .mockRejectedValueOnce(new Error("That number has opted out."))
        .mockRejectedValueOnce("nope");
      show({ onInvitePhone });
      const { phone, name, consent, submit } = await openPhoneTab();
      await userEvent.type(phone, "+14155552671");
      await userEvent.type(name, "Mom");
      await userEvent.click(consent);
      await userEvent.click(submit);
      expect(
        await screen.findByText("That number has opted out."),
      ).toBeInTheDocument();

      await userEvent.click(submit);
      expect(
        await screen.findByText("Unable to send this invite."),
      ).toBeInTheDocument();
    });

    it("closes from Cancel, and returns to the account tab", async () => {
      const { onClose } = show();
      await openPhoneTab();
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalled();
      await userEvent.click(
        screen.getByRole("button", { name: "Loopd'n Account" }),
      );
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("offers WhatsApp where it is switched on", async () => {
    whatsAppEnabled = true;
    const { onWhatsAppInvited } = show({ canInviteMembers: true });
    await userEvent.click(screen.getByRole("button", { name: "Via WhatsApp" }));
    expect(screen.getByTestId("whatsapp-form")).toHaveTextContent("7:true");
    await userEvent.click(
      screen.getByRole("button", { name: "whatsapp invited" }),
    );
    expect(onWhatsAppInvited).toHaveBeenCalled();
  });
});
