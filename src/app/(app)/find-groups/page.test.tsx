import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/app/NavDrawerButton", () => ({
  NavDrawerButton: () => null,
}));
// The debounce has its own tests; here every keystroke counts at once.
vi.mock("@/lib/hooks/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));
vi.mock("@/lib/chat/conversations", () => ({
  joinConversation: vi.fn(),
  joinConversationWithCode: vi.fn(),
  searchGroups: vi.fn(),
}));

import FindGroupsPage from "@/app/(app)/find-groups/page";
import {
  joinConversation,
  joinConversationWithCode,
  searchGroups,
  type DiscoverableGroup,
} from "@/lib/chat/conversations";
import { deferred } from "@/test/helpers";

function group(
  id: number,
  overrides: Partial<DiscoverableGroup> = {},
): DiscoverableGroup {
  return {
    id,
    name: `Group ${id}`,
    description: "",
    logoImage: null,
    memberCount: 12,
    joinMode: "open",
    mode: "chat",
    ...overrides,
  };
}

function resultsAre(groups: DiscoverableGroup[]) {
  vi.mocked(searchGroups).mockResolvedValue({ ok: true, groups });
}

async function search(text = "book") {
  await userEvent.type(screen.getByRole("searchbox"), text);
}

function resultCard(name: string) {
  return screen
    .getByRole("heading", { name })
    .closest("article") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  resultsAre([]);
});

describe("FindGroupsPage - searching", () => {
  it("invites a search before anything is typed", () => {
    render(<FindGroupsPage />);
    expect(screen.getByText("Search for a group to join")).toBeInTheDocument();
    expect(searchGroups).not.toHaveBeenCalled();
  });

  it("asks for more than one character", async () => {
    render(<FindGroupsPage />);
    await search("b");
    expect(
      screen.getByText(/searches need at least 2 characters/),
    ).toBeInTheDocument();
    expect(searchGroups).not.toHaveBeenCalled();
  });

  it("searches for the trimmed term, and says when nothing matched", async () => {
    render(<FindGroupsPage />);
    await search(" bo ");
    await waitFor(() => expect(searchGroups).toHaveBeenLastCalledWith("bo"));
    expect(
      await screen.findByText("No groups found for “bo”"),
    ).toBeInTheDocument();
  });

  it("lists each group with how it is joined and how big it is", async () => {
    resultsAre([
      group(1, { description: "We read.", memberCount: 1 }),
      group(2, { mode: "broadcast", memberCount: 1500 }),
      group(3, { joinMode: "approval" }),
      group(4, { joinMode: "code", logoImage: "https://cdn.example/4.png" }),
    ]);
    const { container } = render(<FindGroupsPage />);
    await search();

    await screen.findByRole("heading", { name: "Group 1" });
    expect(resultCard("Group 1")).toHaveTextContent("Public");
    expect(resultCard("Group 1")).toHaveTextContent("We read.");
    expect(resultCard("Group 1")).toHaveTextContent("1 member");
    expect(resultCard("Group 1")).toHaveTextContent("G");
    expect(resultCard("Group 2")).toHaveTextContent("Broadcast");
    expect(resultCard("Group 2")).toHaveTextContent("1.5K members");
    expect(resultCard("Group 3")).toHaveTextContent("Approval");
    expect(resultCard("Group 3")).toHaveTextContent("12 members");
    expect(
      within(resultCard("Group 3")).getByRole("button", {
        name: "Request to join",
      }),
    ).toBeInTheDocument();
    expect(resultCard("Group 4")).toHaveTextContent("Code required");
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/4.png",
    );
  });

  it("says why a search failed, and clears the old results", async () => {
    resultsAre([group(1)]);
    render(<FindGroupsPage />);
    await search();
    await screen.findByRole("heading", { name: "Group 1" });

    vi.mocked(searchGroups).mockResolvedValue({
      ok: false,
      message: "Unable to search groups.",
    });
    await search("s");
    expect(
      await screen.findByText("Unable to search groups."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Group 1" }),
    ).not.toBeInTheDocument();
  });

  it("hides the results again when the search is cleared", async () => {
    resultsAre([group(1)]);
    render(<FindGroupsPage />);
    await search();
    await screen.findByRole("heading", { name: "Group 1" });
    await userEvent.clear(screen.getByRole("searchbox"));
    expect(screen.getByText("Search for a group to join")).toBeInTheDocument();
  });

  it("ignores results that arrive after the page has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof searchGroups>>>();
    vi.mocked(searchGroups).mockReturnValue(pending.promise);
    const { unmount, container } = render(<FindGroupsPage />);
    await search("bo");
    unmount();
    pending.resolve({ ok: true, groups: [group(1)] });
    await pending.promise;
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FindGroupsPage - joining", () => {
  it("joins an open group, and offers to open it", async () => {
    resultsAre([group(1), group(2)]);
    const answer = deferred<Awaited<ReturnType<typeof joinConversation>>>();
    vi.mocked(joinConversation).mockReturnValue(answer.promise);
    render(<FindGroupsPage />);
    await search();
    await screen.findByRole("heading", { name: "Group 1" });

    const button = within(resultCard("Group 1")).getByRole("button");
    await userEvent.click(button);
    expect(joinConversation).toHaveBeenCalledWith(1);
    expect(button).toBeDisabled();
    expect(within(resultCard("Group 2")).getByRole("button")).toBeEnabled();

    answer.resolve({ ok: true, status: "joined", conversation: {} as never });
    const notice = (await screen.findByText(/You joined/)).closest("p")!;
    expect(notice).toHaveTextContent("You joined Group 1.");
    expect(
      screen.queryByRole("heading", { name: "Group 1" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    expect(push).toHaveBeenCalledWith("/chats/");
  });

  it("says a request is with the admins when approval is needed", async () => {
    resultsAre([group(3, { joinMode: "approval" })]);
    vi.mocked(joinConversation).mockResolvedValue({
      ok: true,
      status: "pending",
    });
    render(<FindGroupsPage />);
    await search();
    await userEvent.click(
      await screen.findByRole("button", { name: "Request to join" }),
    );
    const notice = (await screen.findByText(/Your request to join/)).closest(
      "p",
    )!;
    expect(notice).toHaveTextContent(
      "Your request to join Group 3 is with the admins.",
    );
  });

  it("says why joining failed, and keeps the group listed", async () => {
    resultsAre([group(1)]);
    vi.mocked(joinConversation).mockResolvedValue({
      ok: false,
      message: "This Loop is full.",
    });
    render(<FindGroupsPage />);
    await search();
    await userEvent.click(
      await screen.findByRole("button", { name: "Join group" }),
    );
    expect(await screen.findByText("This Loop is full.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Group 1" }),
    ).toBeInTheDocument();
  });
});

describe("FindGroupsPage - joining with a code", () => {
  async function openCodeModal() {
    resultsAre([group(4, { joinMode: "code" })]);
    render(<FindGroupsPage />);
    await search();
    await userEvent.click(
      await screen.findByRole("button", { name: "Join group" }),
    );
    return screen.getByRole("heading", { name: "Join Group 4" })
      .parentElement as HTMLElement;
  }

  it("asks for the code instead of joining at once", async () => {
    const modal = await openCodeModal();
    expect(joinConversation).not.toHaveBeenCalled();
    expect(within(modal).getByPlaceholderText("e.g. ABC123")).toHaveFocus();

    await userEvent.click(
      within(modal).getByRole("button", { name: "Cancel" }),
    );
    expect(
      screen.queryByRole("heading", { name: "Join Group 4" }),
    ).not.toBeInTheDocument();
  });

  it("wants a code before it sends anything, clearing the error on typing", async () => {
    const modal = await openCodeModal();
    await userEvent.click(
      within(modal).getByRole("button", { name: "Join group" }),
    );
    expect(
      within(modal).getByText("Enter the group code."),
    ).toBeInTheDocument();
    expect(joinConversationWithCode).not.toHaveBeenCalled();

    await userEvent.type(
      within(modal).getByPlaceholderText("e.g. ABC123"),
      "A",
    );
    expect(
      within(modal).queryByText("Enter the group code."),
    ).not.toBeInTheDocument();
  });

  it("says when the code is wrong", async () => {
    vi.mocked(joinConversationWithCode).mockResolvedValue({
      ok: false,
      message: "That code is not valid.",
    });
    const modal = await openCodeModal();
    await userEvent.type(
      within(modal).getByPlaceholderText("e.g. ABC123"),
      " AB12 {Enter}",
    );
    expect(joinConversationWithCode).toHaveBeenCalledWith("AB12");
    expect(
      await within(modal).findByText("That code is not valid."),
    ).toBeInTheDocument();
  });

  it("joins with the right code, and closes", async () => {
    const answer =
      deferred<Awaited<ReturnType<typeof joinConversationWithCode>>>();
    vi.mocked(joinConversationWithCode).mockReturnValue(answer.promise);
    const modal = await openCodeModal();
    await userEvent.type(
      within(modal).getByPlaceholderText("e.g. ABC123"),
      "AB12{Enter}",
    );
    expect(
      within(modal)
        .getAllByRole("button")
        .find((button) => button.getAttribute("type") === "submit"),
    ).toBeDisabled();

    answer.resolve({ ok: true, status: "joined", conversation: {} as never });
    expect(await screen.findByText(/You joined/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Join Group 4" }),
    ).not.toBeInTheDocument();
  });

  it("records a request when the code still needs approval", async () => {
    vi.mocked(joinConversationWithCode).mockResolvedValue({
      ok: true,
      status: "pending",
    });
    const modal = await openCodeModal();
    await userEvent.type(
      within(modal).getByPlaceholderText("e.g. ABC123"),
      "AB12{Enter}",
    );
    expect(await screen.findByText(/Your request to join/)).toBeInTheDocument();
  });
});
