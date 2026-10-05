import { act, screen, waitFor, within } from "@testing-library/react";
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

import { createPlanCheckoutSession } from "@/lib/billing";
import {
  addConversationMembers,
  clearConversationHistory,
  deleteConversation,
  deleteConversationMessage,
  editConversationMessage,
  fetchBlockedMembers,
  fetchConversation,
  fetchConversations,
  fetchJoinCode,
  fetchJoinRequests,
  forwardConversationMessage,
  inviteConversationMemberByPhone,
  joinConversationWithCode,
  leaveConversation,
  nudgeConversationMember,
  provisionGroupNumber,
  removeConversationMember,
  respondToJoinRequest,
  searchMemberCandidates,
  sendConversationMessage,
  setConversationArchived,
  setConversationMuted,
  setMessageReaction,
  setPinnedMessage,
  unblockConversationMember,
  updateGroupSettings,
  updateMemberRole,
} from "@/lib/chat/conversations";
import { platform } from "@/lib/platform";
import { GROUP } from "@/lib/rbac/conversation";
import { blockUser, unblockUser } from "@/lib/user/blocks";
import { deferred } from "@/test/helpers";
import { captured, clipboard, shell } from "@/test/homeShell";
import {
  ADA,
  ALL_FEATURES,
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
  panel,
  person,
  planIs,
  renderShell,
  resetHomeShell,
  row,
  rowButton,
} from "@/test/homeShellApi";

const OK = { ok: true } as never;
const refused = (text: string) => ({ ok: false, message: text }) as never;

/** Call something a stubbed dialog was handed, the way the dialog would. */
async function call<T>(run: () => Promise<T> | T): Promise<T> {
  let result!: T;
  let failure: unknown = null;
  await act(async () => {
    try {
      result = await run();
    } catch (error) {
      failure = error;
    }
  });
  await flush();
  if (failure) throw failure;
  return result;
}

async function openActions(sender = "Ada") {
  await userEvent.click(
    panel().getByRole("button", { name: `Actions for message from ${sender}` }),
  );
}

async function choose(item: string | RegExp) {
  await userEvent.click(screen.getByRole("menuitem", { name: item }));
  await flush();
}

function status() {
  return screen.getByRole("status", { name: "" });
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

describe("HomeShell - acting on a message", () => {
  const admin = () => [
    conversation(1, "Book Club", { features: ALL_FEATURES, isAdmin: true }),
    conversation(2, "Runners"),
  ];

  it("offers a member only what they may do to somebody else's message", async () => {
    historyIs([message(10, "Hello there")]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions();
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Reply", "Forward", "Copy", "Message info"]);
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(6);

    // Pressing the same button again closes the menu.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("offers everything on your own message to an admin", async () => {
    historyIs([mine(10, "Hello there")]);
    await renderShell(admin());
    await openActions("Sam");
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual([
      "Reply",
      "Forward",
      "Copy",
      "Pin",
      "Edit",
      "Message info",
      "Delete",
    ]);
  });

  it("has no reactions to offer where the Loop has them switched off", async () => {
    historyIs([
      message(10, "Hello there", {
        reactions: [{ emoji: "👍", count: 1, usernames: ["ada"] }],
      }),
    ]);
    await renderShell([
      conversation(1, "Book Club", {
        settings: { ...SETTINGS, reactions_enabled: false },
      }),
    ]);
    expect(panel().getByLabelText("Thumbs up, 1").tagName).toBe("SPAN");
    await openActions();
    expect(screen.queryByRole("menuitemcheckbox")).not.toBeInTheDocument();
  });

  it("replies to a message, quoting it in the composer", async () => {
    vi.mocked(sendConversationMessage).mockResolvedValue({
      ok: true,
      message: mine(30, "Sure"),
    } as never);
    historyIs([message(10, "Hello there")]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions();
    await choose("Reply");
    expect(panel().getByText("Replying to Ada")).toBeInTheDocument();

    await userEvent.type(composer(), "Sure{Enter}");
    expect(sendConversationMessage).toHaveBeenCalledWith(
      1,
      "Sure",
      [],
      10,
      [],
      false,
    );
    await flush();
    expect(panel().queryByText("Replying to Ada")).not.toBeInTheDocument();
  });

  it("drops the reply on Escape or from its bar, keeping what was typed", async () => {
    historyIs([message(10, "Hello there")]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions();
    await choose("Reply");
    await userEvent.type(composer(), "Sure{Escape}");
    expect(panel().queryByText("Replying to Ada")).not.toBeInTheDocument();
    expect(composer()).toHaveValue("Sure");

    await openActions();
    await choose("Reply");
    await userEvent.click(
      panel().getByRole("button", { name: "Cancel reply" }),
    );
    expect(panel().queryByText("Replying to Ada")).not.toBeInTheDocument();
  });

  it("edits your own message in the composer, and saves the new words", async () => {
    const answer = deferred<unknown>();
    vi.mocked(editConversationMessage).mockReturnValue(answer.promise as never);
    historyIs([
      mine(10, "Helo @Lin and @everyone", {
        mentionsEveryone: true,
        mentions: [
          {
            participantId: 3,
            userId: 103,
            username: "lin",
            displayLabel: "Lin",
          },
        ],
      }),
    ]);
    await renderShell([
      conversation(1, "Book Club", { participants: [SAM, ADA, LIN] }),
    ]);
    await openActions("Sam");
    await choose("Edit");
    expect(panel().getByText("Editing message")).toBeInTheDocument();
    expect(composer()).toHaveValue("Helo @Lin and @everyone");
    // An edit changes words only, so nothing that makes a file is on offer.
    expect(panel().getByLabelText("Attach files")).toBeDisabled();
    expect(
      panel().getByRole("button", { name: "Record a voice message" }),
    ).toBeDisabled();

    await userEvent.clear(composer());
    expect(panel().getByRole("button", { name: "Save edit" })).toBeDisabled();
    await userEvent.type(composer(), " Hello @Lin ");
    await userEvent.click(panel().getByRole("button", { name: "Save edit" }));
    expect(editConversationMessage).toHaveBeenCalledWith(
      1,
      10,
      "Hello @Lin",
      [3],
      false,
    );
    expect(panel().getByRole("button", { name: "Saving" })).toBeDisabled();

    await act(async () =>
      answer.resolve({
        ok: true,
        message: mine(10, "Hello @Lin", { editedAt: new Date().toISOString() }),
      }),
    );
    expect(panel().queryByText("Editing message")).not.toBeInTheDocument();
    expect(composer()).toHaveValue("");
    expect(panel().getByText("edited")).toBeInTheDocument();
  });

  it("says why an edit was refused, and empties the box when it is abandoned", async () => {
    vi.mocked(editConversationMessage).mockResolvedValue(
      refused("Too late to edit that."),
    );
    historyIs([mine(10, "Hello there")]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions("Sam");
    await choose("Edit");
    await userEvent.type(composer(), "!{Enter}");
    expect(
      await panel().findByText("Too late to edit that."),
    ).toBeInTheDocument();
    expect(panel().getByText("Editing message")).toBeInTheDocument();

    await userEvent.click(panel().getByRole("button", { name: "Cancel edit" }));
    expect(composer()).toHaveValue("");

    // With nothing typed there is nothing to save.
    await openActions("Sam");
    await choose("Edit");
    await userEvent.clear(composer());
    await userEvent.type(composer(), "{Enter}");
    expect(editConversationMessage).toHaveBeenCalledTimes(1);
  });

  it("does not offer Edit on a message that came in by text", async () => {
    historyIs([mine(10, "Hello there", { source: "sms" })]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions("Sam");
    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("copies the words, and has nothing to copy from a bare attachment", async () => {
    historyIs([message(10, "Hello there")]);
    const first = await renderShell([conversation(1, "Book Club")]);
    await openActions();
    await choose("Copy");
    expect(clipboard.copy).toHaveBeenCalledWith("Hello there");
    first.unmount();

    historyIs([
      message(10, "", {
        attachments: [{ url: "/a.pdf", originalName: "a.pdf" }],
      }),
    ]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeDisabled();
  });

  it("says when the words were copied, or could not be", async () => {
    clipboard.copied = true;
    const first = await renderShell([conversation(1, "Book Club")]);
    expect(status()).toHaveTextContent("Message copied");
    first.unmount();

    clipboard.copied = false;
    clipboard.error = "Could not copy that.";
    await renderShell([conversation(1, "Book Club")]);
    expect(status()).toHaveTextContent("Could not copy that.");
  });

  it("pins a message above the thread, and unpins it from there", async () => {
    const pinned = message(10, "Rules");
    historyIs([pinned]);
    vi.mocked(setPinnedMessage)
      .mockResolvedValueOnce({
        ok: true,
        conversation: conversation(1, "Book Club", {
          features: ALL_FEATURES,
          pinnedMessage: pinned,
          participants: [],
        }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        conversation: conversation(1, "Book Club", { features: ALL_FEATURES }),
      } as never);
    await renderShell(admin());
    await openActions();
    await choose("Pin");
    expect(setPinnedMessage).toHaveBeenCalledWith(1, 10, true);
    expect(panel().getByText(/Pinned · Ada/)).toBeInTheDocument();
    // An answer with no members listed keeps the ones already known.
    expect(shell.latest[0].participants).toHaveLength(2);

    await openActions();
    expect(screen.getByRole("menuitem", { name: "Unpin" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      panel().getByRole("button", { name: "Unpin this message" }),
    );
    expect(setPinnedMessage).toHaveBeenLastCalledWith(1, 10, false);
    await flush();
    expect(panel().queryByText(/Pinned · Ada/)).not.toBeInTheDocument();
  });

  it("unpins from the menu, and says when pinning was refused", async () => {
    const pinned = message(10, "Rules");
    historyIs([pinned]);
    vi.mocked(setPinnedMessage).mockResolvedValue(
      refused("Only admins can pin."),
    );
    await renderShell([
      conversation(1, "Book Club", {
        features: ALL_FEATURES,
        pinnedMessage: pinned,
      }),
    ]);
    await openActions();
    await choose("Unpin");
    expect(setPinnedMessage).toHaveBeenCalledWith(1, 10, false);
    expect(status()).toHaveTextContent("Only admins can pin.");
  });

  it("scrolls to the pinned message when its bar is pressed", async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    const pinned = message(10, "Rules");
    historyIs([pinned]);
    await renderShell([
      conversation(1, "Book Club", { pinnedMessage: pinned }),
    ]);
    await userEvent.click(
      panel().getByRole("button", { name: /Pinned · Ada/ }),
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    // A member sees the pin but cannot remove it.
    expect(
      panel().queryByRole("button", { name: "Unpin this message" }),
    ).not.toBeInTheDocument();
  });

  it("does nothing when the pinned message is not loaded", async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    await renderShell([
      conversation(1, "Book Club", { pinnedMessage: message(99, "Old rules") }),
    ]);
    await userEvent.click(
      panel().getByRole("button", { name: /Pinned · Ada/ }),
    );
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("reacts from the menu, and takes a reaction back from the bubble", async () => {
    const reacted = message(10, "Hello there", {
      reactions: [{ emoji: "👍", count: 1, usernames: ["sam"] }],
    });
    historyIs([message(10, "Hello there")]);
    vi.mocked(setMessageReaction)
      .mockResolvedValueOnce({ ok: true, message: reacted } as never)
      .mockResolvedValueOnce({
        ok: true,
        message: message(10, "Hello there"),
      } as never);
    await renderShell([conversation(1, "Book Club")]);
    await openActions();
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Thumbs up" }),
    );
    await flush();
    expect(setMessageReaction).toHaveBeenCalledWith(1, 10, "👍", false);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    const chip = panel().getByRole("button", {
      name: "Thumbs up, 1, including you",
    });
    await openActions();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Thumbs up" }),
    ).toBeChecked();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(chip);
    await flush();
    expect(setMessageReaction).toHaveBeenLastCalledWith(1, 10, "👍", true);
    expect(
      panel().queryByRole("button", { name: /Thumbs up/ }),
    ).not.toBeInTheDocument();
  });

  it("holds reactions while one is being saved, and says when it was refused", async () => {
    const answer = deferred<unknown>();
    vi.mocked(setMessageReaction).mockReturnValue(answer.promise as never);
    historyIs([
      message(10, "Hello there", {
        reactions: [{ emoji: "👍", count: 1, usernames: ["ada"] }],
      }),
    ]);
    await renderShell([conversation(1, "Book Club")]);
    const chip = panel().getByRole("button", { name: "Thumbs up, 1" });
    await userEvent.click(chip);
    expect(chip).toBeDisabled();

    await act(async () =>
      answer.resolve({ ok: false, message: "Reactions are off here." }),
    );
    expect(status()).toHaveTextContent("Reactions are off here.");
    expect(chip).toBeEnabled();
  });

  it("forwards a message to another Loop", async () => {
    const answer = deferred<unknown>();
    vi.mocked(forwardConversationMessage).mockReturnValue(
      answer.promise as never,
    );
    historyIs([message(10, "Hello there")]);
    await renderShell(admin());
    await openActions();
    await choose("Forward");
    const dialog = screen.getByRole("dialog", { name: "Forward message" });
    const target = within(dialog).getByRole("button", { name: /Runners/ });
    await userEvent.click(target);
    expect(forwardConversationMessage).toHaveBeenCalledWith(2, 10);
    expect(target).toBeDisabled();

    await act(async () => answer.resolve({ ok: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says why a forward was refused inside its dialog, and forgets it on closing", async () => {
    vi.mocked(forwardConversationMessage).mockResolvedValue(
      refused("You cannot post there."),
    );
    historyIs([message(10, "Hello there")]);
    await renderShell(admin());
    await openActions();
    await choose("Forward");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Runners/,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You cannot post there.",
    );
    // Said once, in the dialog - not again in the corner.
    expect(screen.queryByRole("status", { name: "" })).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Close forward" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You cannot post there."),
    ).not.toBeInTheDocument();
  });

  it("deletes your own message, leaving a tombstone", async () => {
    const answer = deferred<unknown>();
    vi.mocked(deleteConversationMessage).mockReturnValue(
      answer.promise as never,
    );
    historyIs([mine(10, "Oops")]);
    await renderShell([conversation(1, "Book Club")]);
    await openActions("Sam");
    await choose("Reply");
    await openActions("Sam");
    await choose("Delete");
    const dialog = screen.getByRole("dialog", { name: "Delete this message?" });
    expect(dialog).toHaveTextContent("removed from the thread for everyone.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" }),
    );
    expect(deleteConversationMessage).toHaveBeenCalledWith(1, 10);
    expect(
      within(dialog).getByRole("button", { name: "Deleting…" }),
    ).toBeDisabled();

    await act(async () =>
      answer.resolve({
        ok: true,
        message: mine(10, "", { deletedAt: new Date().toISOString() }),
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panel().getByText("This message was deleted")).toBeInTheDocument();
    // The reply that was being written to it goes with it.
    expect(panel().queryByText("Replying to Sam")).not.toBeInTheDocument();
  });

  it("lets an admin delete somebody else's, and says why when it is refused", async () => {
    vi.mocked(deleteConversationMessage).mockResolvedValue(
      refused("Already deleted."),
    );
    historyIs([message(10, "Spam"), message(11, "Fine")]);
    await renderShell(admin());
    await userEvent.click(
      panel().getAllByRole("button", {
        name: "Actions for message from Ada",
      })[1],
    );
    await choose("Reply");
    await userEvent.click(
      panel().getAllByRole("button", {
        name: "Actions for message from Ada",
      })[0],
    );
    await choose("Delete");
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("for everyone in this Loop.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Already deleted.",
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panel().getByText("Replying to Ada")).toBeInTheDocument();
  });

  it("keeps a reply to another message when one is deleted", async () => {
    vi.mocked(deleteConversationMessage).mockResolvedValue({
      ok: true,
      message: message(10, "", { deletedAt: new Date().toISOString() }),
    } as never);
    historyIs([message(10, "Spam"), message(11, "Fine")]);
    await renderShell(admin());
    await userEvent.click(
      panel().getAllByRole("button", {
        name: "Actions for message from Ada",
      })[1],
    );
    await choose("Reply");
    await userEvent.click(
      panel().getAllByRole("button", {
        name: "Actions for message from Ada",
      })[0],
    );
    await choose("Delete");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await flush();
    expect(panel().getByText("Replying to Ada")).toBeInTheDocument();
  });

  it("shows who has read a message", async () => {
    historyIs([mine(10, "Anyone?")]);
    await renderShell([
      conversation(1, "Book Club", {
        participants: [SAM, person("2", "Ada", { lastReadMessageId: 10 }), LIN],
      }),
    ]);
    await openActions("Sam");
    await choose("Message info");
    const dialog = screen.getByRole("dialog", { name: "Message info" });
    expect(dialog).toHaveTextContent("1 of 2");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close message info" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes whatever was open on a message when another conversation is opened", async () => {
    historyIs([message(10, "Hello there")]);
    await renderShell(admin());
    await openActions();
    await choose("Reply");
    await openActions();
    await choose("Message info");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(rowButton("Runners"));
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panel().queryByText("Replying to Ada")).not.toBeInTheDocument();
  });
});

describe("HomeShell - a row's own menu", () => {
  const options = (name: string) =>
    userEvent.click(
      within(row(name)).getByRole("button", { name: "Chat options" }),
    );
  const item = (name: string, label: string | RegExp) =>
    within(row(name)).getByRole("button", { name: label });
  const pick = async (name: string, label: string | RegExp) => {
    await userEvent.click(item(name, label));
    await flush();
  };

  it("offers a member of a group muting, archiving, leaving and deleting the chat", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await options("Book Club");
    expect(row("Book Club")).toHaveTextContent(
      "Archiving still delivers texts.",
    );
    expect(item("Book Club", "Mute")).toBeInTheDocument();
    expect(item("Book Club", "Leave group")).toBeInTheDocument();
    expect(
      within(row("Book Club")).queryByRole("button", {
        name: "Delete group for everyone",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(row("Book Club")).queryByRole("button", { name: /^Block/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(item("Book Club", "Close menu"));
    expect(
      within(row("Book Club")).queryByRole("button", { name: "Mute" }),
    ).not.toBeInTheDocument();
    await options("Book Club");
    await options("Book Club");
    expect(
      within(row("Book Club")).queryByRole("button", { name: "Mute" }),
    ).not.toBeInTheDocument();
  });

  it("mutes and unmutes, putting it back if the server says no", async () => {
    vi.mocked(setConversationMuted)
      .mockResolvedValueOnce(OK)
      .mockResolvedValueOnce(refused("down"));
    await renderShell([conversation(1, "Book Club")]);
    await options("Book Club");
    await pick("Book Club", "Mute");
    expect(setConversationMuted).toHaveBeenCalledWith(1, true);
    expect(shell.latest[0].muted).toBe(true);

    await options("Book Club");
    expect(row("Book Club")).toHaveTextContent(
      "Muted, so texts are paused too.",
    );
    await pick("Book Club", "Unmute");
    expect(setConversationMuted).toHaveBeenLastCalledWith(1, false);
    expect(shell.latest[0].muted).toBe(true);
  });

  it("archives the open chat out of the list, and brings one back", async () => {
    vi.mocked(setConversationArchived).mockResolvedValue(OK);
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    await options("Book Club");
    await pick("Book Club", "Archive");
    expect(setConversationArchived).toHaveBeenCalledWith(1, true);
    expect(listed()).toEqual(["Runners"]);
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();

    await userEvent.click(list().getByRole("button", { name: /^Archived/ }));
    await options("Book Club");
    await pick("Book Club", "Unarchive");
    expect(setConversationArchived).toHaveBeenLastCalledWith(1, false);
    expect(shell.latest[0].archived).toBe(false);
  });

  it("puts a chat back when archiving is refused", async () => {
    vi.mocked(setConversationArchived).mockResolvedValue(refused("down"));
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    await options("Runners");
    await pick("Runners", "Archive");
    expect(shell.latest[1].archived).toBe(false);
    // It was not the open one, so the open one stays open.
    expect(
      panel().getByRole("heading", { name: "Book Club" }),
    ).toBeInTheDocument();
  });

  it("asks before leaving a group, and can be talked out of it", async () => {
    vi.mocked(leaveConversation)
      .mockResolvedValueOnce(refused("You are the last admin."))
      .mockResolvedValueOnce(OK);
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    await options("Book Club");
    await pick("Book Club", "Leave group");
    expect(row("Book Club")).toHaveTextContent("Leave Book Club?");
    await pick("Book Club", "Cancel");
    expect(item("Book Club", "Leave group")).toBeInTheDocument();

    await pick("Book Club", "Leave group");
    await pick("Book Club", "Leave");
    expect(row("Book Club")).toHaveTextContent("You are the last admin.");

    await pick("Book Club", "Leave");
    expect(leaveConversation).toHaveBeenCalledWith(1);
    expect(listed()).toEqual(["Runners"]);
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
  });

  it("deletes a chat for you only, clearing it from the list", async () => {
    vi.mocked(clearConversationHistory)
      .mockResolvedValueOnce(refused("Try again."))
      .mockResolvedValueOnce(OK);
    await renderShell([
      conversation(1, "Book Club"),
      conversation(2, "Runners"),
    ]);
    await options("Runners");
    await pick("Runners", "Delete chat");
    expect(row("Runners")).toHaveTextContent("Delete this chat?");
    await pick("Runners", "Delete chat");
    expect(row("Runners")).toHaveTextContent("Try again.");

    await pick("Runners", "Delete chat");
    expect(clearConversationHistory).toHaveBeenCalledWith(2);
    expect(listed()).toEqual(["Book Club"]);
    expect(shell.latest[1]).toMatchObject({ cleared: true, unread: 0 });
    expect(
      panel().getByRole("heading", { name: "Book Club" }),
    ).toBeInTheDocument();
  });

  it("closes the open chat when that is the one deleted", async () => {
    vi.mocked(clearConversationHistory).mockResolvedValue(OK);
    await renderShell([conversation(1, "Book Club")]);
    await options("Book Club");
    await pick("Book Club", "Delete chat");
    await pick("Book Club", "Delete chat");
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
  });

  it("lets an admin delete a group for everyone", async () => {
    vi.mocked(deleteConversation)
      .mockResolvedValueOnce(refused("It still has a balance."))
      .mockResolvedValue(OK);
    await renderShell([
      conversation(1, "Book Club", { isAdmin: true }),
      conversation(2, "Runners", { isAdmin: true }),
    ]);
    await options("Runners");
    await pick("Runners", "Delete group for everyone");
    expect(row("Runners")).toHaveTextContent("Delete Runners for everyone?");
    await pick("Runners", "Delete group");
    expect(row("Runners")).toHaveTextContent("It still has a balance.");
    await pick("Runners", "Delete group");
    expect(deleteConversation).toHaveBeenCalledWith(2);
    expect(shell.latest.map((entry) => entry.id)).toEqual([1]);

    await options("Book Club");
    await pick("Book Club", "Delete group for everyone");
    await pick("Book Club", "Delete group");
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
  });

  it("blocks the person a one-to-one is with, and unblocks them", async () => {
    vi.mocked(blockUser)
      .mockResolvedValueOnce(refused("Could not block them."))
      .mockResolvedValueOnce(OK);
    vi.mocked(unblockUser).mockResolvedValue(OK);
    await renderShell([direct(1, ADA), conversation(2, "Book Club")]);
    await options("Ada");
    // There is no leaving a one-to-one.
    expect(
      within(row("Ada")).queryByRole("button", { name: "Leave group" }),
    ).not.toBeInTheDocument();
    await pick("Ada", "Block Ada");
    expect(row("Ada")).toHaveTextContent("Block Ada?");
    await pick("Ada", "Block");
    expect(row("Ada")).toHaveTextContent("Could not block them.");

    await pick("Ada", "Block");
    expect(blockUser).toHaveBeenCalledWith({
      username: "ada",
      phoneNumber: null,
    });
    // Blocked everywhere she appears, not just in this conversation.
    expect(
      shell.latest.map(
        (entry) =>
          entry.participants.find((member) => member.username === "ada")
            ?.blockedByMe,
      ),
    ).toEqual([true, true]);
    expect(
      panel().getByText(/You blocked Ada\. Unblock them to send a message\./),
    ).toBeInTheDocument();

    await options("Ada");
    await pick("Ada", "Unblock Ada");
    expect(row("Ada")).toHaveTextContent("Unblock Ada?");
    await pick("Ada", "Unblock");
    expect(unblockUser).toHaveBeenCalledWith({
      username: "ada",
      phoneNumber: null,
    });
    expect(composer()).toBeInTheDocument();
  });
});

describe("HomeShell - blocking from the open conversation", () => {
  it("blocks the other person after asking", async () => {
    const answer = deferred<unknown>();
    vi.mocked(blockUser).mockReturnValue(answer.promise as never);
    await renderShell([direct(1, ADA)]);
    await userEvent.click(
      panel().getByRole("button", { name: "More about Ada" }),
    );
    await choose("Block Ada");
    const dialog = screen.getByRole("dialog", { name: "Block Ada?" });
    expect(dialog).toHaveTextContent("Ada can't send you direct messages");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Block" }),
    );
    const working = within(dialog).getByRole("button", { name: "Working..." });
    expect(working).toHaveAttribute("aria-disabled", "true");
    // A second press while it is working does nothing, nor does Escape.
    await userEvent.click(working);
    await userEvent.keyboard("{Escape}");
    expect(blockUser).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => answer.resolve({ ok: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panel().getByText(/You blocked Ada/)).toBeInTheDocument();
  });

  it("unblocks from the notice where the composer was", async () => {
    vi.mocked(unblockUser)
      .mockResolvedValueOnce(refused("Could not unblock them."))
      .mockResolvedValueOnce(OK);
    await renderShell([direct(1, person("2", "Ada", { blockedByMe: true }))]);
    await userEvent.click(panel().getByRole("button", { name: "Unblock" }));
    const dialog = screen.getByRole("dialog", { name: "Unblock Ada?" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Unblock" }),
    );
    expect(
      await within(dialog).findByText("Could not unblock them."),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Unblock" }),
    );
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(composer()).toBeInTheDocument();
  });

  it("offers to unblock from the menu, and can be cancelled", async () => {
    await renderShell([direct(1, person("2", "Ada", { blockedByMe: true }))]);
    await userEvent.click(
      panel().getByRole("button", { name: "More about Ada" }),
    );
    await choose("Unblock Ada");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(unblockUser).not.toHaveBeenCalled();

    await userEvent.click(
      panel().getByRole("button", { name: "More about Ada" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("blocks somebody who has no username by nothing at all", async () => {
    vi.mocked(blockUser).mockResolvedValue(OK);
    await renderShell([
      direct(1, ADA, {
        participants: [SAM, ADA, person("9", "Mom", { username: undefined })],
      }),
    ]);
    await userEvent.click(
      panel().getByRole("button", { name: "More about Ada" }),
    );
    await choose("Block Ada");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Block" }),
    );
    await flush();
    const members = shell.latest[0].participants;
    expect(members.find((member) => member.id === "9")?.blockedByMe).toBe(
      false,
    );
  });
});

describe("HomeShell - plan limits", () => {
  const PLANS = [
    { code: "free", name: "Free", priceDisplay: "$0", features: ["3 groups"] },
    { code: "Premium", name: "Premium", priceDisplay: "$9", features: [] },
    { code: "business", name: "Business", priceDisplay: "$29", features: [] },
    {
      code: "enterprise",
      name: "Enterprise",
      priceDisplay: "Custom",
      features: [],
    },
    { code: "team", name: "Team", priceDisplay: "$19", features: [] },
  ];
  const limited = (overrides: Record<string, unknown> = {}) =>
    planIs(
      {
        code: "premium",
        name: "Premium",
        maxGroups: 1,
        maxMembersPerGroup: 2,
        maxAdminsPerGroup: 1,
        ...overrides,
      },
      PLANS,
    );
  const newLoop = async () => {
    await userEvent.click(list().getByRole("button", { name: "Loop menu" }));
    await userEvent.click(list().getByRole("button", { name: "New Loop" }));
  };
  const plan = (name: string) =>
    within(screen.getByRole("dialog"))
      .getByText(name, { selector: "h3,p,h4" })
      .closest("article") as HTMLElement;

  it("opens the create dialog while there is room for another group", async () => {
    await renderShell([]);
    await newLoop();
    expect(screen.getByTestId("create-loop")).toBeInTheDocument();
    await call(() => captured.createLoop.onClose());
    expect(screen.queryByTestId("create-loop")).not.toBeInTheDocument();
  });

  it("offers an upgrade instead once the plan's groups are used up", async () => {
    limited();
    await renderShell([conversation(1, "Mine", { createdByUsername: "sam" })]);
    await newLoop();
    expect(screen.queryByTestId("create-loop")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Group limit reached" });
    expect(dialog).toHaveTextContent(
      "You have reached your Premium plan limit of 1 groups.",
    );
    expect(
      list().getByText(/You have reached your Premium plan limit/),
    ).toBeInTheDocument();

    expect(plan("Free")).toHaveTextContent("Included");
    expect(plan("Free")).toHaveTextContent("Good for getting started");
    expect(plan("Premium")).toHaveTextContent("Current plan");
    expect(plan("Business")).toHaveTextContent("For larger teams");
    expect(plan("Enterprise")).toHaveTextContent("Custom package");
    expect(plan("Team")).toHaveTextContent("Scale your plan");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Not now" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("goes to checkout for the plan that is chosen", async () => {
    limited();
    const answer = deferred<unknown>();
    vi.mocked(createPlanCheckoutSession).mockReturnValue(
      answer.promise as never,
    );
    const openExternal = vi
      .spyOn(platform, "openExternal")
      .mockResolvedValue(undefined as never);
    await renderShell([conversation(1, "Mine", { createdByUsername: "sam" })]);
    await newLoop();
    await userEvent.click(
      within(plan("Business")).getByRole("button", { name: "Choose" }),
    );
    expect(createPlanCheckoutSession).toHaveBeenCalledWith(
      "business",
      "https://loopdn.com/billing/success/?flow=plan&plan=business",
      "https://loopdn.com/billing/cancel/?flow=plan&plan=business",
    );
    expect(
      within(plan("Business")).getByRole("button", { name: "Redirecting..." }),
    ).toBeDisabled();
    expect(
      within(plan("Enterprise")).getByRole("button", { name: "Contact sales" }),
    ).toBeDisabled();

    await act(async () =>
      answer.resolve({
        ok: true,
        data: { checkoutUrl: "https://pay.example/1" },
      }),
    );
    expect(openExternal).toHaveBeenCalledWith("https://pay.example/1");
  });

  it("says why checkout could not be started", async () => {
    limited();
    vi.mocked(createPlanCheckoutSession).mockResolvedValue(
      refused("Billing is unavailable."),
    );
    await renderShell([conversation(1, "Mine", { createdByUsername: "sam" })]);
    await newLoop();
    await userEvent.click(
      within(plan("Team")).getByRole("button", { name: "Choose" }),
    );
    expect(
      await within(screen.getByRole("dialog")).findByText(
        "Billing is unavailable.",
      ),
    ).toBeInTheDocument();
    expect(
      within(plan("Team")).getByRole("button", { name: "Choose" }),
    ).toBeEnabled();
  });

  it("sends an enterprise enquiry to sales", async () => {
    limited();
    await renderShell([conversation(1, "Mine", { createdByUsername: "sam" })]);
    await newLoop();
    await userEvent.click(
      within(plan("Enterprise")).getByRole("button", { name: "Contact sales" }),
    );
    expect(push).toHaveBeenCalledWith("/contact/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says the plans are still loading when there are none to show", async () => {
    planIs({ code: "free", name: "", maxGroups: 0 });
    await renderShell([]);
    await newLoop();
    expect(screen.getByRole("dialog")).toHaveTextContent("Plans are loading.");
    await userEvent.click(
      screen.getByRole("button", { name: "Close upgrade prompt" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the create dialog when another screen asks for it", async () => {
    shell.createLoopRequest = 1;
    await renderShell([]);
    await waitFor(() =>
      expect(screen.getByTestId("create-loop")).toBeInTheDocument(),
    );
  });

  it("opens the create dialog from the new-conversation dialog", async () => {
    await renderShell([]);
    await userEvent.click(
      list().getByRole("button", { name: "New conversation" }),
    );
    expect(screen.getByTestId("new-conversation")).toBeInTheDocument();
    await call(() => captured.newConversation.onCreateGroup());
    expect(screen.queryByTestId("new-conversation")).not.toBeInTheDocument();
    expect(screen.getByTestId("create-loop")).toBeInTheDocument();
  });
});

describe("HomeShell - starting and joining conversations", () => {
  it("opens a direct conversation that was just started", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.click(
      list().getByRole("button", { name: "New conversation" }),
    );
    vi.mocked(fetchConversation).mockResolvedValue({
      ok: true,
      conversation: direct(5, LIN, { cleared: true }),
    } as never);
    await call(() => captured.newConversation.onStarted(5));
    expect(screen.queryByTestId("new-conversation")).not.toBeInTheDocument();
    expect(panel().getByRole("heading", { name: "Lin" })).toBeInTheDocument();
    expect(shell.latest.find((entry) => entry.id === 5)).toMatchObject({
      active: true,
      cleared: false,
    });
  });

  it("stays put when that conversation cannot be fetched, or the dialog is closed", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await userEvent.click(
      list().getByRole("button", { name: "New conversation" }),
    );
    vi.mocked(fetchConversation).mockResolvedValue(refused("x"));
    await call(() => captured.newConversation.onStarted(5));
    expect(
      panel().getByRole("heading", { name: "Book Club" }),
    ).toBeInTheDocument();

    await userEvent.click(
      list().getByRole("button", { name: "New conversation" }),
    );
    await call(() => captured.newConversation.onClose());
    expect(screen.queryByTestId("new-conversation")).not.toBeInTheDocument();
  });

  it("opens the Loop that was just created", async () => {
    await renderShell([conversation(1, "Book Club")]);
    vi.mocked(fetchConversations).mockResolvedValue({
      ok: true,
      conversations: [
        conversation(8, "New Loop"),
        conversation(1, "Book Club"),
      ],
    } as never);
    await call(() => captured.createLoop.onSuccess(8));
    expect(
      panel().getByRole("heading", { name: "New Loop" }),
    ).toBeInTheDocument();
    expect(shell.latest.map((entry) => entry.active)).toEqual([true, false]);
  });

  it("opens the first Loop when the server did not say which was created", async () => {
    await renderShell([]);
    vi.mocked(fetchConversations).mockResolvedValueOnce({
      ok: true,
      conversations: [conversation(8, "New Loop")],
    } as never);
    await call(() => captured.createLoop.onSuccess(null));
    expect(
      panel().getByRole("heading", { name: "New Loop" }),
    ).toBeInTheDocument();

    vi.mocked(fetchConversations).mockResolvedValueOnce({
      ok: true,
      conversations: [],
    } as never);
    await call(() => captured.createLoop.onSuccess(null));
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
  });

  it("leaves the list alone when it cannot be refreshed after creating", async () => {
    await renderShell([conversation(1, "Book Club")]);
    await call(() => captured.createLoop.onSuccess(8));
    expect(listed()).toEqual(["Book Club"]);
  });

  it("joins a Loop by its code, and opens it", async () => {
    await renderShell([
      conversation(1, "Book Club"),
      conversation(7, "Runners"),
    ]);
    vi.mocked(joinConversationWithCode).mockResolvedValue({
      ok: true,
      status: "joined",
      conversation: conversation(7, "Runners"),
    } as never);
    expect(await call(() => captured.joinLoop.onJoin("7F3K"))).toBe("joined");
    expect(shell.latest.map((entry) => [entry.id, entry.active])).toEqual([
      [1, false],
      [7, true],
    ]);
    expect(
      panel().getByRole("heading", { name: "Runners" }),
    ).toBeInTheDocument();
    await call(() => captured.joinLoop.onClose());
  });

  it("reports a request awaiting approval, or why the code was refused", async () => {
    await renderShell([]);
    vi.mocked(joinConversationWithCode).mockResolvedValueOnce({
      ok: true,
      status: "pending",
    } as never);
    expect(await call(() => captured.joinLoop.onJoin("7F3K"))).toBe("pending");

    vi.mocked(joinConversationWithCode).mockResolvedValueOnce(
      refused("That code has expired."),
    );
    await expect(call(() => captured.joinLoop.onJoin("7F3K"))).rejects.toThrow(
      "That code has expired.",
    );
  });
});

describe("HomeShell - adding members", () => {
  const withAdd = (overrides = {}) =>
    conversation(1, "Book Club", {
      features: [GROUP.send, GROUP.addMembers],
      isAdmin: true,
      ...overrides,
    });
  const openAdd = () =>
    userEvent.click(panel().getByRole("button", { name: "Add members" }));
  const refreshed = () =>
    vi.mocked(fetchConversations).mockResolvedValue({
      ok: true,
      conversations: [withAdd({ participants: [SAM, ADA, LIN] })],
    } as never);

  it("is offered only to somebody who may add", async () => {
    await renderShell([conversation(1, "Book Club")]);
    expect(
      panel().queryByRole("button", { name: "Add members" }),
    ).not.toBeInTheDocument();
    expect(captured.addMembers).toMatchObject({
      isOpen: false,
      canInviteMembers: false,
    });
  });

  it("opens the dialog for the open Loop, and closes it", async () => {
    await renderShell([withAdd()]);
    await openAdd();
    expect(screen.getByTestId("add-members")).toHaveTextContent("Book Club");
    expect(captured.addMembers).toMatchObject({
      conversationId: 1,
      canInviteMembers: true,
    });
    await call(() => captured.addMembers.onClose());
    expect(screen.queryByTestId("add-members")).not.toBeInTheDocument();
  });

  it("adds people, then refreshes the list and the members", async () => {
    vi.mocked(addConversationMembers).mockResolvedValue(OK);
    refreshed();
    await renderShell([withAdd(), conversation(2, "Runners")]);
    await call(() =>
      captured.addMembers.onAddMembers(["lin"], ["new@example.com"], "new"),
    );
    expect(addConversationMembers).toHaveBeenCalledWith(
      1,
      ["lin"],
      ["new@example.com"],
      "new",
    );
    expect(
      shell.latest.find((entry) => entry.id === 1)?.participants,
    ).toHaveLength(3);
    expect(shell.latest.find((entry) => entry.id === 1)?.active).toBe(true);
  });

  it("defaults to showing the old messages, and passes on a refusal", async () => {
    vi.mocked(addConversationMembers)
      .mockResolvedValueOnce(OK)
      .mockResolvedValueOnce(refused("They have blocked invitations."));
    await renderShell([withAdd()]);
    await call(() => captured.addMembers.onAddMembers(["lin"]));
    expect(addConversationMembers).toHaveBeenCalledWith(1, ["lin"], [], "all");
    await expect(
      call(() => captured.addMembers.onAddMembers(["lin"])),
    ).rejects.toThrow("They have blocked invitations.");
  });

  it("offers an upgrade when the group is already full", async () => {
    planIs({ code: "free", name: "Free", maxMembersPerGroup: 2 });
    await renderShell([withAdd()]);
    await openAdd();
    expect(screen.queryByTestId("add-members")).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Member limit reached" }),
    ).toHaveTextContent(
      "This group has reached your Free plan limit of 2 members per group.",
    );
  });

  it("refuses to add more than the plan allows", async () => {
    planIs({ code: "free", name: "Free", maxMembersPerGroup: 3 });
    await renderShell([withAdd()]);
    await expect(
      call(() =>
        captured.addMembers.onAddMembers(["lin"], ["new@example.com"]),
      ),
    ).rejects.toThrow(
      "This group is limited to 3 members on your current plan.",
    );
    expect(addConversationMembers).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Adding 2 members exceeds your Free plan limit of 3 members per group.",
    );
  });

  it("counts one member in the singular, and names no plan it does not know", async () => {
    planIs({ code: "free", maxMembersPerGroup: 2 });
    await renderShell([withAdd()]);
    await expect(
      call(() => captured.addMembers.onAddMembers(["lin"])),
    ).rejects.toThrow();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Adding 1 member exceeds your current plan limit of 2 members per group.",
    );
  });

  it("invites by phone within the plan, and refuses beyond it", async () => {
    vi.mocked(inviteConversationMemberByPhone)
      .mockResolvedValueOnce(OK)
      .mockResolvedValueOnce(refused("That number has opted out."));
    planIs({ code: "free", name: "Free", maxMembersPerGroup: 3 });
    const invite = { phone_number: "+14155552671", display_name: "Mom" };
    const first = await renderShell([withAdd()]);
    await call(() => captured.addMembers.onInvitePhone(invite));
    expect(inviteConversationMemberByPhone).toHaveBeenCalledWith(1, invite);
    await expect(
      call(() => captured.addMembers.onInvitePhone(invite)),
    ).rejects.toThrow("That number has opted out.");
    first.unmount();

    planIs({ code: "free", maxMembersPerGroup: 2 });
    await renderShell([withAdd()]);
    await expect(
      call(() => captured.addMembers.onInvitePhone(invite)),
    ).rejects.toThrow(
      "This group is limited to 2 members on your current plan.",
    );
    expect(inviteConversationMemberByPhone).toHaveBeenCalledTimes(2);
  });

  it("searches for people to add in the open Loop", async () => {
    vi.mocked(searchMemberCandidates).mockResolvedValue({
      ok: true,
      candidates: [],
      hasMore: false,
      invite: null,
    } as never);
    await renderShell([withAdd()]);
    await call(() => captured.addMembers.onSearchMembers("li"));
    expect(searchMemberCandidates).toHaveBeenCalledWith(1, "li");
  });

  it("refreshes after a WhatsApp invitation", async () => {
    refreshed();
    await renderShell([withAdd()]);
    await call(() => captured.addMembers.onWhatsAppInvited());
    expect(fetchConversations).toHaveBeenCalled();
  });
});

describe("HomeShell - the Loop panel", () => {
  const adminLoop = (overrides = {}) =>
    conversation(1, "Book Club", {
      description: "We read.",
      logoImage: "/logo.png",
      features: ALL_FEATURES,
      isAdmin: true,
      joinMode: "approval",
      participants: [SAM, ADA, LIN],
      ...overrides,
    });
  const openPanel = async () => {
    await userEvent.click(
      panel().getByRole("button", { name: "Loop Settings" }),
    );
    await flush();
  };
  const updated = (overrides = {}) =>
    ({
      ok: true,
      conversation: adminLoop({ participants: [], ...overrides }),
    }) as never;

  it("opens on the general tab with what an admin may do", async () => {
    vi.mocked(fetchJoinRequests).mockResolvedValue({
      ok: true,
      requests: [person("5", "Kim", { phone: "+14155552671" })],
    } as never);
    await renderShell([adminLoop()]);
    expect(fetchJoinRequests).toHaveBeenCalledWith(1);
    await openPanel();
    expect(screen.getByTestId("admin-panel")).toHaveTextContent(
      "Book Club|general",
    );
    expect(captured.admin).toMatchObject({
      conversationId: 1,
      loopDescription: "We read.",
      loopImageUrl: "/logo.png",
      settings: expect.objectContaining({ mode: "chat" }),
      canEditSettings: true,
      canEditDetails: true,
      canModerateMembers: true,
      viewerUsername: "sam",
      isPendingRequestsLoading: false,
      pendingRequests: [
        { id: "5", name: "Kim", username: "kim", phone: "+14155552671" },
      ],
    });
    expect(captured.admin.onProvisionNumber).toBeTypeOf("function");
    expect(captured.admin.onFetchBlockedMembers).toBeTypeOf("function");
    expect(captured.admin.onAddMembers).toBeTypeOf("function");

    await call(() => captured.admin.onTabChange("members"));
    expect(screen.getByTestId("admin-panel")).toHaveTextContent(
      "Book Club|members",
    );
    await call(() => captured.admin.onClose());
    expect(screen.queryByTestId("admin-panel")).not.toBeInTheDocument();
  });

  it("gives a member none of the admin's powers", async () => {
    vi.mocked(fetchConversation).mockResolvedValue(refused("x"));
    await renderShell([conversation(1, "Book Club", { joinMode: "approval" })]);
    expect(fetchJoinRequests).not.toHaveBeenCalled();
    await openPanel();
    expect(captured.admin).toMatchObject({
      settings: null,
      canEditSettings: false,
      canEditDetails: false,
      canModerateMembers: false,
      pendingRequests: [],
    });
    expect(captured.admin.onProvisionNumber).toBeUndefined();
    expect(captured.admin.onFetchBlockedMembers).toBeUndefined();
    expect(captured.admin.onAddMembers).toBeUndefined();
  });

  it("says the requests are loading until they arrive, and survives a failed load", async () => {
    const pending = deferred<unknown>();
    vi.mocked(fetchJoinRequests).mockReturnValue(pending.promise as never);
    await renderShell([adminLoop()]);
    await openPanel();
    expect(captured.admin.isPendingRequestsLoading).toBe(true);
    await act(async () => pending.resolve({ ok: false, message: "x" }));
    await flush();
    expect(captured.admin.isPendingRequestsLoading).toBe(false);
    expect(captured.admin.pendingRequests).toEqual([]);
  });

  it("approves or declines a request, taking it off the list", async () => {
    vi.mocked(fetchJoinRequests).mockResolvedValue({
      ok: true,
      requests: [person("5", "Kim"), person("6", "Lee")],
    } as never);
    vi.mocked(respondToJoinRequest).mockResolvedValue(OK);
    await renderShell([adminLoop()]);
    await openPanel();
    await call(() => captured.admin.onApproveRequest("5"));
    expect(respondToJoinRequest).toHaveBeenCalledWith(1, "5", "approve");
    expect(
      captured.admin.pendingRequests.map((r: { id: string }) => r.id),
    ).toEqual(["6"]);
    expect(fetchConversations).toHaveBeenCalled();

    await call(() => captured.admin.onDeclineRequest("6"));
    expect(respondToJoinRequest).toHaveBeenLastCalledWith(1, "6", "decline");
    expect(captured.admin.pendingRequests).toEqual([]);

    vi.mocked(respondToJoinRequest).mockResolvedValue(
      refused("Already answered."),
    );
    await expect(
      call(() => captured.admin.onApproveRequest("5")),
    ).rejects.toThrow("Already answered.");
    await expect(
      call(() => captured.admin.onDeclineRequest("5")),
    ).rejects.toThrow("Already answered.");
  });

  it("saves settings and details, and passes on a refusal", async () => {
    vi.mocked(updateGroupSettings).mockResolvedValue(
      updated({
        name: "Readers",
        settings: { ...SETTINGS, mode: "broadcast" },
      }),
    );
    await renderShell([adminLoop()]);
    await openPanel();
    await call(() => captured.admin.onSaveSettings({ mode: "broadcast" }));
    expect(updateGroupSettings).toHaveBeenCalledWith(1, {
      settings: { mode: "broadcast" },
    });
    expect(captured.admin.settings.mode).toBe("broadcast");
    expect(captured.admin.loopName).toBe("Readers");

    await call(() => captured.admin.onSaveDetails({ name: "Readers" }));
    expect(updateGroupSettings).toHaveBeenLastCalledWith(1, {
      name: "Readers",
    });

    vi.mocked(updateGroupSettings).mockResolvedValue(refused("Admins only."));
    await expect(
      call(() => captured.admin.onSaveSettings({ mode: "chat" })),
    ).rejects.toThrow("Admins only.");
    await expect(
      call(() => captured.admin.onSaveDetails({ name: "x" })),
    ).rejects.toThrow("Admins only.");
  });

  it("fetches the join code, and gets the Loop a number", async () => {
    vi.mocked(fetchJoinCode)
      .mockResolvedValueOnce({ ok: true, code: "7F3K9Q" } as never)
      .mockResolvedValueOnce(refused("Admins only."));
    vi.mocked(provisionGroupNumber)
      .mockResolvedValueOnce(
        updated({
          smsNumber: {
            number: "+14155550100",
            country: "US",
            status: "active",
            provider: "x",
          },
        }),
      )
      .mockResolvedValueOnce(refused("No numbers are left."));
    await renderShell([adminLoop()]);
    await openPanel();
    expect(await call(() => captured.admin.onFetchJoinCode())).toBe("7F3K9Q");
    await expect(call(() => captured.admin.onFetchJoinCode())).rejects.toThrow(
      "Admins only.",
    );

    await call(() => captured.admin.onProvisionNumber());
    expect(provisionGroupNumber).toHaveBeenCalledWith(1);
    expect(captured.admin.smsNumber.number).toBe("+14155550100");
    await expect(
      call(() => captured.admin.onProvisionNumber()),
    ).rejects.toThrow("No numbers are left.");
  });

  it("changes a member's role, nudges, removes and blocks, each then refreshing", async () => {
    vi.mocked(updateMemberRole).mockResolvedValue(OK);
    vi.mocked(nudgeConversationMember).mockResolvedValue(OK);
    vi.mocked(removeConversationMember).mockResolvedValue(OK);
    await renderShell([adminLoop()]);
    await openPanel();

    await call(() => captured.admin.onUpdateMemberRole("2", "admin"));
    expect(updateMemberRole).toHaveBeenCalledWith(1, "2", "admin");
    await call(() => captured.admin.onNudgeMember("2", "sms"));
    expect(nudgeConversationMember).toHaveBeenCalledWith(1, "2", "sms");
    await call(() => captured.admin.onRemoveMember("2"));
    expect(removeConversationMember).toHaveBeenLastCalledWith(1, "2", false);
    await call(() => captured.admin.onBlockMember("3"));
    expect(removeConversationMember).toHaveBeenLastCalledWith(1, "3", true);
    expect(fetchConversations).toHaveBeenCalledTimes(4);
  });

  it("passes on each refusal", async () => {
    vi.mocked(updateMemberRole).mockResolvedValue(refused("No."));
    vi.mocked(nudgeConversationMember).mockResolvedValue(refused("Too soon."));
    vi.mocked(removeConversationMember).mockResolvedValue(refused("Not them."));
    await renderShell([adminLoop()]);
    await openPanel();
    await expect(
      call(() => captured.admin.onUpdateMemberRole("2", "member")),
    ).rejects.toThrow("No.");
    await expect(
      call(() => captured.admin.onNudgeMember("2", "sms")),
    ).rejects.toThrow("Too soon.");
    await expect(
      call(() => captured.admin.onRemoveMember("2")),
    ).rejects.toThrow("Not them.");
    await expect(call(() => captured.admin.onBlockMember("2"))).rejects.toThrow(
      "Not them.",
    );
  });

  it("offers an upgrade instead of another admin beyond the plan", async () => {
    planIs({ code: "free", name: "Free", maxAdminsPerGroup: 1 });
    vi.mocked(updateMemberRole).mockResolvedValue(OK);
    await renderShell([adminLoop()]);
    await openPanel();
    await expect(
      call(() => captured.admin.onUpdateMemberRole("2", "admin")),
    ).rejects.toThrow("This group is limited to 1 admin on your current plan.");
    expect(updateMemberRole).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Admin limit reached" }),
    ).toHaveTextContent(
      "This group has reached your Free plan limit of 1 admin. Upgrade",
    );

    // Somebody already an admin does not count against the limit again.
    await call(() => captured.admin.onUpdateMemberRole("1", "admin"));
    expect(updateMemberRole).toHaveBeenCalledWith(1, "1", "admin");
  });

  it("words the admin limit in the plural, with or without a plan name", async () => {
    planIs({ code: "free", maxAdminsPerGroup: 2 });
    await renderShell([
      adminLoop({
        participants: [SAM, person("2", "Ada", { role: "admin" }), LIN],
      }),
    ]);
    await openPanel();
    await expect(
      call(() => captured.admin.onUpdateMemberRole("3", "admin")),
    ).rejects.toThrow(
      "This group is limited to 2 admins on your current plan.",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "your current plan limit of 2 admins.",
    );
  });

  it("lists and lifts blocks", async () => {
    vi.mocked(fetchBlockedMembers)
      .mockResolvedValueOnce({
        ok: true,
        members: [person("9", "Kim")],
      } as never)
      .mockResolvedValueOnce(refused("Admins only."));
    vi.mocked(unblockConversationMember)
      .mockResolvedValueOnce(OK)
      .mockResolvedValueOnce(refused("Not blocked."));
    await renderShell([adminLoop()]);
    await openPanel();
    expect(
      await call(() => captured.admin.onFetchBlockedMembers()),
    ).toHaveLength(1);
    await expect(
      call(() => captured.admin.onFetchBlockedMembers()),
    ).rejects.toThrow("Admins only.");
    await call(() => captured.admin.onUnblockMember("9"));
    expect(unblockConversationMember).toHaveBeenCalledWith(1, "9");
    await expect(
      call(() => captured.admin.onUnblockMember("9")),
    ).rejects.toThrow("Not blocked.");
  });

  it("leaves the Loop, opening whatever is next", async () => {
    vi.mocked(leaveConversation)
      .mockResolvedValueOnce(refused("You are the last admin."))
      .mockResolvedValueOnce(OK);
    await renderShell([adminLoop(), conversation(2, "Runners")]);
    await openPanel();
    expect(await call(() => captured.admin.onLeaveLoop())).toEqual({
      ok: false,
      message: "You are the last admin.",
    });
    expect(await call(() => captured.admin.onLeaveLoop())).toEqual({
      ok: true,
    });
    expect(leaveConversation).toHaveBeenCalledWith(1);
    expect(shell.latest.map((entry) => [entry.id, entry.active])).toEqual([
      [2, true],
    ]);
    expect(
      panel().getByRole("heading", { name: "Runners" }),
    ).toBeInTheDocument();
  });

  it("closes the screen when the only Loop is left", async () => {
    vi.mocked(leaveConversation).mockResolvedValue(OK);
    await renderShell([adminLoop()]);
    await openPanel();
    await call(() => captured.admin.onLeaveLoop());
    expect(
      panel().getByRole("heading", { name: "Select a Loop" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin-panel")).not.toBeInTheDocument();
  });

  it("opens Add members from the panel", async () => {
    await renderShell([adminLoop()]);
    await openPanel();
    await call(() => captured.admin.onAddMembers());
    expect(screen.getByTestId("add-members")).toBeInTheDocument();
  });
});
