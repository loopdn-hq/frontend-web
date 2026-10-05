import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ComposerContextBar,
  DeleteMessageDialog,
  ForwardMessageModal,
  MessageBubble,
  MessageInfoModal,
  MessageReactions,
  MessageThreadSkeleton,
  PinnedMessageBar,
  ReactionBar,
  VoiceNotePreview,
  VoiceRecordingBar,
  type ThreadMessage,
} from "@/components/home/message";
import { LinkPreviewCard } from "@/components/home/message/LinkPreviewCard";
import { MentionPicker } from "@/components/home/message/MentionPicker";
import { formatVoiceDuration } from "@/components/home/message/VoiceNoteComposer";
import type {
  Conversation,
  ConversationMessage,
  ConversationParticipant,
} from "@/lib/chat/conversations";
import { GROUP } from "@/lib/rbac";

function message(overrides: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: 10,
    sender: "Ada",
    senderUsername: "ada",
    text: "See you at noon",
    mine: false,
    time: "10:30",
    createdAt: "2026-03-04T10:30:00.000Z",
    source: "app",
    reactions: [],
    forwarded: false,
    mentions: [],
    mentionsEveryone: false,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function participant(
  id: string,
  overrides: Partial<ConversationParticipant> = {},
): ConversationParticipant {
  return {
    id,
    userId: `u${id}`,
    name: `Member ${id}`,
    username: `member${id}`,
    role: "member",
    joinedAt: "2026-01-01T00:00:00.000Z",
    channels: {},
    blockedByMe: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ReactionBar", () => {
  it("offers each reaction, marking the ones already given", async () => {
    const onSelect = vi.fn();
    render(<ReactionBar mine={["👍"]} onSelect={onSelect} />);
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(6);
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Thumbs up" }),
    ).toBeChecked();

    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Thumbs up" }),
    );
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Heart" }),
    );
    expect(onSelect.mock.calls).toEqual([
      ["👍", true],
      ["❤️", false],
    ]);
  });
});

describe("MessageReactions", () => {
  const reactions = [
    { emoji: "👍", count: 2, usernames: ["sam", "ada"] },
    { emoji: "🎉", count: 1, usernames: ["ada"] },
  ];

  it("shows nothing for a message nobody reacted to", () => {
    const { container } = render(
      <MessageReactions
        reactions={[]}
        currentUsername="sam"
        onToggle={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toggles a reaction, saying whether it was already yours", async () => {
    const onToggle = vi.fn();
    render(
      <MessageReactions
        reactions={reactions}
        currentUsername="sam"
        onToggle={onToggle}
      />,
    );
    const mine = screen.getByRole("button", {
      name: "Thumbs up, 2, including you",
    });
    expect(mine).toHaveAttribute("aria-pressed", "true");
    expect(mine).toHaveAttribute("title", "sam, ada");
    // An emoji with no name of its own is labelled by itself.
    const theirs = screen.getByRole("button", { name: "🎉, 1" });
    expect(theirs).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(mine);
    await userEvent.click(theirs);
    expect(onToggle.mock.calls).toEqual([
      ["👍", true],
      ["🎉", false],
    ]);
  });

  it("cannot be toggled while a change is being saved", () => {
    render(
      <MessageReactions
        reactions={reactions}
        currentUsername={null}
        onToggle={vi.fn()}
        busy
      />,
    );
    expect(screen.getByRole("button", { name: "Thumbs up, 2" })).toBeDisabled();
  });

  it("only shows the counts where reacting is not allowed", () => {
    render(
      <MessageReactions
        reactions={reactions}
        currentUsername="sam"
        onToggle={vi.fn()}
        readOnly
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Thumbs up, 2, including you"),
    ).toHaveTextContent("👍2");
    expect(screen.getByLabelText("🎉, 1")).toBeInTheDocument();
  });
});

describe("PinnedMessageBar", () => {
  const pinned = { id: 4, sender: "Ada", text: "Rules" } as ConversationMessage;

  it("jumps to the pinned message, and lets an admin unpin it", async () => {
    const onJump = vi.fn();
    const onUnpin = vi.fn();
    render(
      <PinnedMessageBar
        message={pinned}
        canUnpin
        onJump={onJump}
        onUnpin={onUnpin}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Pinned · Ada/ }));
    expect(onJump).toHaveBeenCalledWith(4);
    await userEvent.click(
      screen.getByRole("button", { name: "Unpin this message" }),
    );
    expect(onUnpin).toHaveBeenCalled();
  });

  it("stands in for a pinned attachment, with no unpin for a member", () => {
    render(
      <PinnedMessageBar
        message={{ ...pinned, text: "" }}
        canUnpin={false}
        onJump={vi.fn()}
        onUnpin={vi.fn()}
      />,
    );
    expect(screen.getByText("Attachment")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unpin this message" }),
    ).not.toBeInTheDocument();
  });
});

describe("ComposerContextBar", () => {
  it("says who is being replied to", async () => {
    const onCancel = vi.fn();
    render(
      <ComposerContextBar
        context={{ kind: "reply", message: message() }}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Replying to Ada")).toBeInTheDocument();
    expect(screen.getByText("See you at noon")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel reply" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("says a message is being edited", () => {
    render(
      <ComposerContextBar
        context={{ kind: "edit", message: message({ text: "" }) }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Editing message")).toBeInTheDocument();
    expect(screen.getByText("Attachment")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel edit" }),
    ).toBeInTheDocument();
  });
});

describe("LinkPreviewCard", () => {
  const preview = {
    url: "https://www.example.com/post",
    title: "A post",
    description: "About things.",
    imageUrl: "https://cdn.example.com/a.png",
    siteName: "Example",
  };

  it("links to the page, with its title, description and picture", () => {
    render(<LinkPreviewCard preview={preview} mine={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.example.com/post");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("Example");
    expect(link).toHaveTextContent("A post");
    expect(link).toHaveTextContent("About things.");
    expect(link.querySelector("img")).not.toBeNull();
  });

  it("drops a picture that fails to load", () => {
    render(<LinkPreviewCard preview={preview} mine />);
    fireEvent.error(screen.getByRole("link").querySelector("img")!);
    expect(screen.getByRole("link").querySelector("img")).toBeNull();
  });

  it("names the site by its host when the page does not say", () => {
    const bare = {
      title: null,
      description: null,
      imageUrl: null,
      siteName: null,
    };
    const first = render(
      <LinkPreviewCard
        preview={{ ...bare, url: "https://www.example.com/post" }}
        mine
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent(/^example\.com$/);
    first.unmount();

    render(
      <LinkPreviewCard preview={{ ...bare, url: "not a url" }} mine={false} />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("not a url");
  });
});

describe("MentionPicker", () => {
  const options = [
    { id: "everyone" as const, label: "everyone", hint: "Everyone in this Loop" },
    { id: 3, label: "Ada" },
  ];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows nothing when nobody matches", () => {
    const { container } = render(
      <MentionPicker
        id="mentions"
        options={[]}
        activeIndex={0}
        onPick={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists who can be named, keeping the active one in view", async () => {
    const onPick = vi.fn();
    const onHover = vi.fn();
    render(
      <MentionPicker
        id="mentions"
        options={options}
        activeIndex={1}
        onPick={onPick}
        onHover={onHover}
      />,
    );
    const rows = screen.getAllByRole("option");
    expect(rows[0]).toHaveTextContent("everyoneEveryone in this Loop");
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
    expect(rows[1]).toHaveAttribute("id", "mentions-option-1");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    await userEvent.hover(within(rows[0]).getByRole("button"));
    expect(onHover).toHaveBeenCalledWith(0);
    await userEvent.click(within(rows[1]).getByRole("button"));
    expect(onPick).toHaveBeenCalledWith(options[1]);
  });

  it("keeps the focus in the composer when a name is pressed", () => {
    render(
      <MentionPicker
        id="mentions"
        options={options}
        activeIndex={0}
        onPick={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    const pressed = fireEvent.mouseDown(screen.getAllByRole("button")[0]);
    // fireEvent returns false when the default was prevented.
    expect(pressed).toBe(false);
  });
});

describe("DeleteMessageDialog", () => {
  it("quotes the message, and deletes it on confirmation", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <DeleteMessageDialog
        message={message()}
        asAdmin={false}
        busy={false}
        error={null}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete this message?" });
    expect(dialog).toHaveTextContent("See you at noon");
    expect(dialog).toHaveTextContent(
      "It will be removed from the thread for everyone. This cannot be undone.",
    );
    expect(dialog).not.toHaveTextContent("also went out by text or email");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("warns an admin about copies that already went out, and shows a failure", () => {
    render(
      <DeleteMessageDialog
        message={message({ text: "", source: "sms" })}
        asAdmin
        busy
        error="Unable to delete this message."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Attachment");
    expect(dialog).toHaveTextContent("for everyone in this Loop.");
    expect(dialog).toHaveTextContent("also went out by text or email");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to delete this message.",
    );
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});

describe("ForwardMessageModal", () => {
  const loop = (id: number, name: string, features: string[] = [GROUP.send]) =>
    ({ id, name, features, logoImage: null }) as unknown as Conversation;
  const loops = [
    loop(1, "Book Club"),
    loop(2, "Runners"),
    loop(3, "Announcements", []),
  ];

  function show(overrides: { busy?: boolean; error?: string | null } = {}) {
    const onForward = vi.fn();
    render(
      <ForwardMessageModal
        message={{ sender: "Ada", text: "See you at noon" }}
        conversations={loops}
        sourceConversationId="1"
        busy={overrides.busy ?? false}
        error={overrides.error ?? null}
        onForward={onForward}
        onClose={vi.fn()}
      />,
    );
    return onForward;
  }

  it("offers every other Loop, but not the ones you cannot post in", async () => {
    const onForward = show();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Runners"),
      expect.stringContaining("Only admins can post here"),
    ]);
    expect(within(rows[1]).getByRole("button")).toBeDisabled();

    await userEvent.click(within(rows[0]).getByRole("button"));
    expect(onForward).toHaveBeenCalledWith(2);
  });

  it("narrows the list by name, and says when nothing is left", async () => {
    show();
    const search = screen.getByRole("searchbox", { name: "Search your Loops" });
    await userEvent.type(search, " RUN ");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await userEvent.type(search, "zzz");
    expect(
      screen.getByText("No other Loops to forward to."),
    ).toBeInTheDocument();
  });

  it("holds every choice while forwarding, and shows a failure", () => {
    show({ busy: true, error: "Unable to forward this message." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to forward this message.",
    );
    for (const row of screen.getAllByRole("listitem")) {
      expect(within(row).getByRole("button")).toBeDisabled();
    }
  });

  it("stands in for a forwarded attachment", () => {
    render(
      <ForwardMessageModal
        message={{ sender: "Ada", text: "" }}
        conversations={[]}
        sourceConversationId={null}
        busy={false}
        error={null}
        onForward={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Attachment")).toBeInTheDocument();
  });
});

describe("MessageInfoModal", () => {
  const people = [
    participant("1", { username: "sam", lastReadMessageId: 99 }),
    participant("2", { username: "ada", lastReadMessageId: 99 }),
    participant("3", { lastReadMessageId: 10 }),
    participant("4", { lastReadMessageId: 9 }),
    participant("5"),
    participant("6", { userId: undefined, lastReadMessageId: 99 }),
  ];

  it("shows nothing until a message is chosen", () => {
    const { container } = render(
      <MessageInfoModal
        message={null}
        participants={people}
        currentUsername="sam"
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists who has read it, leaving out you, the sender and text-only members", () => {
    render(
      <MessageInfoModal
        message={message()}
        participants={people}
        currentUsername="sam"
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Message info" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
    expect(within(dialog).getByRole("listitem")).toHaveTextContent("Member 3");
    expect(dialog).toHaveTextContent("1 of 3");
    expect(dialog).toHaveTextContent("Sent from the app");
    expect(screen.queryByText("Edited")).not.toBeInTheDocument();
    expect(screen.queryByText("Origin")).not.toBeInTheDocument();
    expect(screen.queryByText("Attachments")).not.toBeInTheDocument();
  });

  it("says when nobody has read it yet", () => {
    render(
      <MessageInfoModal
        message={message({ id: 500 })}
        participants={people}
        currentUsername="sam"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Not read yet.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("0 of 3");
  });

  it("cannot report reads for a message that has no number yet", () => {
    render(
      <MessageInfoModal
        message={message({ id: "pending-1" })}
        participants={people}
        currentUsername="sam"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Not read yet.")).toBeInTheDocument();
  });

  it("explains why nobody can report reading it", () => {
    render(
      <MessageInfoModal
        message={message()}
        participants={[people[0], people[1], people[5]]}
        currentUsername="sam"
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Nobody here can report reading a message/),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveTextContent(/\d of \d/);
  });

  it("describes how the message travelled and what it carries", () => {
    render(
      <MessageInfoModal
        message={message({
          text: "",
          source: "sms",
          editedAt: "2026-03-04T11:00:00.000Z",
          forwarded: true,
          attachments: [{ url: "/a.pdf", originalName: "a.pdf" }],
        })}
        participants={[]}
        currentUsername={null}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Arrived by SMS");
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Forwarded from another Loop");
    expect(dialog).toHaveTextContent("1 file");
  });

  it("copes with an unknown channel, a missing time and several files", () => {
    render(
      <MessageInfoModal
        message={message({
          createdAt: "",
          source: "carrier-pigeon" as never,
          attachments: [
            { url: "/a.pdf", originalName: "a.pdf" },
            { url: "/b.pdf", originalName: "b.pdf" },
          ],
        })}
        participants={[]}
        currentUsername={null}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Unknown");
    expect(dialog).toHaveTextContent("Sent from the app");
    expect(dialog).toHaveTextContent("2 files");
  });

  it("treats a message with no source as sent from the app", () => {
    render(
      <MessageInfoModal
        message={message({ source: undefined as never })}
        participants={[]}
        currentUsername={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Sent from the app");
  });
});

describe("voice notes", () => {
  it("formats a duration as minutes and seconds", () => {
    expect(formatVoiceDuration(0)).toBe("0:00");
    expect(formatVoiceDuration(65.9)).toBe("1:05");
    expect(formatVoiceDuration(-4)).toBe("0:00");
  });

  it("counts up while recording, and can be discarded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T10:00:00.000Z"));
    const onDiscard = vi.fn();
    const { unmount } = render(
      <VoiceRecordingBar startedAt={Date.now()} onDiscard={onDiscard} />,
    );
    expect(screen.getByText("0:00")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("0:03")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays the recording back before it is sent, then frees it", async () => {
    const createObjectURL = vi.fn(() => "blob:voice");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const onRemove = vi.fn();
    const file = new File(["x"], "voice.webm", { type: "audio/webm" });

    const { unmount } = render(
      <VoiceNotePreview file={file} durationSeconds={7} onRemove={onRemove} />,
    );
    expect(
      screen.getByLabelText("Your voice message, before sending"),
    ).toHaveAttribute("src", "blob:voice");
    expect(screen.getByText("0:07")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete voice message" }),
    );
    expect(onRemove).toHaveBeenCalled();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice");
  });

  it("cannot be deleted while it is being sent, and may have no length", () => {
    URL.createObjectURL = vi.fn(() => "blob:voice");
    URL.revokeObjectURL = vi.fn();
    render(
      <VoiceNotePreview
        file={new File(["x"], "voice.webm")}
        onRemove={vi.fn()}
        disabled
      />,
    );
    expect(
      screen.getByRole("button", { name: "Delete voice message" }),
    ).toBeDisabled();
    expect(screen.queryByText(/^\d:\d\d$/)).not.toBeInTheDocument();
  });
});

describe("MessageThreadSkeleton", () => {
  it("announces that messages are loading", () => {
    render(<MessageThreadSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading messages");
  });
});

describe("MessageBubble", () => {
  const onOpenMenu = vi.fn();
  const onToggleReaction = vi.fn();

  function show(
    overrides: Partial<ThreadMessage> = {},
    props: Partial<Parameters<typeof MessageBubble>[0]> = {},
  ) {
    return render(
      <MessageBubble
        message={message(overrides)}
        startsRun
        isLastOwn={false}
        readers={0}
        readableCount={0}
        isMenuOpen={false}
        onOpenMenu={onOpenMenu}
        currentUsername="sam"
        onToggleReaction={onToggleReaction}
        {...props}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the sender at the start of a run, with the time", () => {
    const { container } = show();
    const bubble = screen.getByRole("article");
    expect(bubble).toHaveTextContent("Ada");
    expect(bubble).toHaveTextContent("See you at noon");
    expect(bubble).toHaveTextContent("10:30");
    expect(container.querySelector("[data-message-id='10']")).not.toBeNull();
  });

  it("does not repeat the sender on the rest of a run, or on your own", () => {
    const first = show({}, { startsRun: false });
    expect(screen.getByRole("article")).not.toHaveTextContent("Ada");
    first.unmount();

    show({ mine: true });
    expect(screen.getByRole("article")).not.toHaveTextContent("Ada");
  });

  it("marks a forward, a reply and an edit", () => {
    show({
      forwarded: true,
      replyTo: { id: 3, sender: "Lin", text: "When?" },
      editedAt: "2026-03-04T11:00:00.000Z",
    });
    const bubble = screen.getByRole("article");
    expect(bubble).toHaveTextContent("Forwarded");
    expect(within(bubble).getByText("Lin").closest("blockquote")).toHaveTextContent(
      "LinWhen?",
    );
    expect(within(bubble).getByText("edited")).toBeInTheDocument();
  });

  it("marks them the same way on your own message", () => {
    show({
      mine: true,
      forwarded: true,
      replyTo: { id: 3, sender: "Lin", text: "When?" },
    });
    expect(screen.getByRole("article")).toHaveTextContent("Forwarded");
    expect(screen.getByText("When?")).toBeInTheDocument();
  });

  it("leaves only a tombstone where a message was deleted", () => {
    show({
      deletedAt: "2026-03-04T11:00:00.000Z",
      editedAt: "2026-03-04T10:45:00.000Z",
      forwarded: true,
      reactions: [{ emoji: "👍", count: 1, usernames: ["ada"] }],
      attachments: [{ url: "/a.pdf", originalName: "a.pdf" }],
      linkPreview: {
        url: "https://example.com",
        title: "x",
        description: null,
        imageUrl: null,
        siteName: null,
      },
    });
    const bubble = screen.getByRole("article");
    expect(bubble).toHaveTextContent("This message was deleted");
    expect(bubble).not.toHaveTextContent("See you at noon");
    expect(bubble).not.toHaveTextContent("Forwarded");
    expect(bubble).not.toHaveTextContent("edited");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Actions for message/ }),
    ).not.toBeInTheDocument();
  });

  it("shows your own deleted message the same way", () => {
    show({ mine: true, deletedAt: "2026-03-04T11:00:00.000Z" });
    expect(screen.getByRole("article")).toHaveTextContent(
      "This message was deleted",
    );
  });

  it("highlights the names a message mentions, yours hardest", () => {
    show({
      text: "@Sam and @Lin, tell @everyone",
      mentions: [
        { participantId: 1, userId: 1, username: "sam", displayLabel: "Sam" },
        { participantId: 2, userId: 2, username: "lin", displayLabel: "Lin" },
      ],
      mentionsEveryone: true,
    });
    expect(screen.getByText("@Sam").className).toContain("bg-amber-100");
    expect(screen.getByText("@Lin").className).toContain("text-brand-ink");
    expect(screen.getByText("@everyone").className).toContain("bg-amber-100");
  });

  it("underlines a mention on your own bubble instead", () => {
    show({
      mine: true,
      text: "ask @Lin",
      mentions: [
        { participantId: 2, userId: 2, username: "lin", displayLabel: "Lin" },
      ],
    });
    expect(screen.getByText("@Lin").className).toContain("underline");
  });

  it("copes with a message that carries no mention fields", () => {
    show({ mentions: undefined as never, mentionsEveryone: undefined as never });
    expect(screen.getByText("See you at noon")).toBeInTheDocument();
  });

  it("shows a picture, a voice note and a document each in its own way", () => {
    const { container } = show({
      text: "",
      attachments: [
        { id: 1, url: "/a.png", originalName: "a.png", contentType: "image/png" },
        { id: 2, url: "/b.webm", originalName: "b.webm", contentType: "audio/webm" },
        { url: "/c.pdf", originalName: "c.pdf", contentType: "application/pdf" },
        { url: "/d", originalName: "d" },
      ],
    });
    expect(screen.getByRole("link", { name: "Open a.png" })).toHaveAttribute(
      "href",
      "/a.png",
    );
    expect(container.querySelector("audio")).toHaveAttribute("src", "/b.webm");
    expect(screen.getByRole("link", { name: "c.pdf" })).toHaveAttribute(
      "href",
      "/c.pdf",
    );
    expect(screen.getByRole("link", { name: "d" })).toBeInTheDocument();
    expect(screen.queryByText("b.webm")).not.toBeInTheDocument();
  });

  it("shows the card for a link", () => {
    show({
      linkPreview: {
        url: "https://example.com/post",
        title: "A post",
        description: null,
        imageUrl: null,
        siteName: null,
      },
    });
    expect(screen.getByRole("link")).toHaveTextContent("A post");
  });

  it("ticks your own message once, then twice when it has been read", () => {
    const sent = show({ mine: true }, { readableCount: 3, readers: 0 });
    expect(screen.getByLabelText("Sent")).toBeInTheDocument();
    sent.unmount();

    const some = show({ mine: true }, { readableCount: 3, readers: 2 });
    expect(screen.getByLabelText("Read by 2")).toBeInTheDocument();
    some.unmount();

    show({ mine: true }, { readableCount: 3, readers: 3, isLastOwn: true });
    expect(screen.getByLabelText("Read by 3")).toBeInTheDocument();
    expect(screen.getByText("3 read 10:30")).toBeInTheDocument();
  });

  it("shows no ticks where nobody could report reading it", () => {
    show({ mine: true }, { readableCount: 0, readers: 0, isLastOwn: true });
    expect(screen.queryByLabelText("Sent")).not.toBeInTheDocument();
    expect(screen.queryByText(/read 10:30/)).not.toBeInTheDocument();
  });

  it("passes a reaction on with the message it belongs to", async () => {
    show({ reactions: [{ emoji: "👍", count: 1, usernames: ["ada"] }] });
    await userEvent.click(screen.getByRole("button", { name: "Thumbs up, 1" }));
    expect(onToggleReaction).toHaveBeenCalledWith(10, "👍", false);
  });

  it("shows reactions without buttons where reacting is off", () => {
    show(
      { reactions: [{ emoji: "👍", count: 1, usernames: ["ada"] }] },
      { reactionsEnabled: false, reactionBusy: true },
    );
    expect(screen.getByLabelText("Thumbs up, 1").tagName).toBe("SPAN");
  });

  it("opens the menu where the button was pressed", () => {
    show({}, { isMenuOpen: true });
    const button = screen.getByRole("button", {
      name: "Actions for message from Ada",
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button, { clientX: 40, clientY: 50 });
    expect(onOpenMenu).toHaveBeenCalledWith(10, { x: 40, y: 50 });
  });

  it("opens the menu under the button when it is pressed from the keyboard", () => {
    show({ mine: true });
    const button = screen.getByRole("button", {
      name: "Actions for message from Ada",
    });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      right: 120,
      bottom: 80,
    } as DOMRect);
    fireEvent.click(button);
    expect(onOpenMenu).toHaveBeenCalledWith(10, { x: 120, y: 80 });
  });

  it("opens the menu on a right-click, but leaves links their own menu", () => {
    show({
      attachments: [{ url: "/c.pdf", originalName: "c.pdf" }],
    });
    fireEvent.contextMenu(screen.getByText("See you at noon"), {
      clientX: 5,
      clientY: 6,
    });
    expect(onOpenMenu).toHaveBeenCalledWith(10, { x: 5, y: 6 });

    onOpenMenu.mockClear();
    fireEvent.contextMenu(screen.getByRole("link", { name: "c.pdf" }));
    expect(onOpenMenu).not.toHaveBeenCalled();
  });

  it("opens no menu on a deleted message", () => {
    vi.useFakeTimers();
    show({ deletedAt: "2026-03-04T11:00:00.000Z" });
    const text = screen.getByText("This message was deleted");
    fireEvent.contextMenu(text);
    fireEvent.touchStart(text, { touches: [{ clientX: 1, clientY: 2 }] });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onOpenMenu).not.toHaveBeenCalled();
  });

  it("opens the menu on a long press, where the finger is", () => {
    vi.useFakeTimers();
    show();
    const text = screen.getByText("See you at noon");
    fireEvent.touchStart(text, { touches: [{ clientX: 11, clientY: 22 }] });
    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(onOpenMenu).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onOpenMenu).toHaveBeenCalledWith(10, { x: 11, y: 22 });

    // Lifting afterwards has nothing left to cancel.
    fireEvent.touchEnd(text);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it.each(["touchMove", "touchEnd", "touchCancel"] as const)(
    "takes a %s as a scroll or a tap, not a long press",
    (gesture) => {
      vi.useFakeTimers();
      show();
      const text = screen.getByText("See you at noon");
      fireEvent.touchStart(text, { touches: [{ clientX: 1, clientY: 2 }] });
      fireEvent[gesture](text);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onOpenMenu).not.toHaveBeenCalled();
    },
  );

  it("ignores a touch with no finger, or one on a link", () => {
    vi.useFakeTimers();
    show({ attachments: [{ url: "/c.pdf", originalName: "c.pdf" }] });
    fireEvent.touchStart(screen.getByText("See you at noon"), { touches: [] });
    fireEvent.touchStart(screen.getByRole("link", { name: "c.pdf" }), {
      touches: [{ clientX: 1, clientY: 2 }],
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onOpenMenu).not.toHaveBeenCalled();
  });
});
