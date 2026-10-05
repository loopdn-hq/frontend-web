import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const copy = vi.fn();
let clipboard: { copied: boolean; error: string };

vi.mock("@/lib/hooks/useCopyToClipboard", () => ({
  useCopyToClipboard: () => ({ copy, ...clipboard }),
}));
vi.mock("@/lib/chat/conversations", () => ({ createConversation: vi.fn() }));
vi.mock("@/components/settings/AvatarPicker", () => ({
  AvatarPicker: ({
    file,
    onPick,
    onReject,
    onRemove,
  }: {
    file: File | null;
    onPick: (file: File) => void;
    onReject: (message: string) => void;
    onRemove: () => void;
  }) => (
    <div>
      <span>{file ? `new:${file.name}` : "no picture"}</span>
      <button type="button" onClick={() => onPick(new File(["x"], "logo.png"))}>
        pick picture
      </button>
      <button type="button" onClick={() => onReject("That file is too big.")}>
        pick bad picture
      </button>
      <button type="button" onClick={onRemove}>
        remove picture
      </button>
    </div>
  ),
}));
vi.mock("@/components/home/LoopDetailsForm", () => ({
  LoopDetailsForm: ({
    name,
    canEdit,
    onSave,
  }: {
    name: string;
    canEdit: boolean;
    onSave?: (change: { name: string }) => Promise<void>;
  }) => (
    <div data-testid="details-form">
      {name}:{String(canEdit)}
      <button onClick={() => void onSave?.({ name: "Renamed" })}>
        save details
      </button>
    </div>
  ),
}));
vi.mock("@/components/home/LoopKindAndPlace", () => ({
  LoopKindAndPlace: ({
    category,
    region,
    disabled,
    onCategory,
    onRegion,
  }: {
    category: string | null;
    region: string;
    disabled?: boolean;
    onCategory: (slug: string | null) => void;
    onRegion: (code: string) => void;
  }) => (
    <div data-testid="kind-and-place">
      {String(category)}:{region}:{String(Boolean(disabled))}
      <button onClick={() => onCategory("sports")}>pick kind</button>
      <button onClick={() => onRegion("PH-00")}>pick region</button>
    </div>
  ),
}));

import { CreateLoopForm } from "@/components/home/CreateLoopForm";
import { LoopPanelGeneral } from "@/components/home/LoopPanelGeneral";
import { LoopPanelMembers } from "@/components/home/LoopPanelMembers";
import {
  createConversation,
  type ConversationParticipant,
  type GroupSettings,
} from "@/lib/chat/conversations";
import { deferred } from "@/test/helpers";

beforeEach(() => {
  vi.clearAllMocks();
  clipboard = { copied: false, error: "" };
});

describe("CreateLoopForm", () => {
  function show() {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<CreateLoopForm onClose={onClose} onSuccess={onSuccess} />);
    return { onClose, onSuccess };
  }
  const submit = () =>
    userEvent.click(screen.getByRole("button", { name: "Create Loop" }));
  // Each group of choices sits inside one outer label, so every control in a
  // group answers to the whole group's text; they are found by name instead.
  const control = (name: string, value?: string) =>
    document.querySelector(
      `input[name="${name}"]${value ? `[value="${value}"]` : ""}`,
    ) as HTMLInputElement;

  it("creates a Loop with the defaults when only a name is given", async () => {
    vi.mocked(createConversation).mockResolvedValue({
      ok: true,
      conversationId: 12,
    });
    const { onClose, onSuccess } = show();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "  Book Club ");
    await submit();

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation).toHaveBeenCalledWith({
      name: "Book Club",
      description: "",
      settings: {
        mode: "chat",
        join_mode: "open",
        add_member_permission: "admins",
        edit_group_permission: "admins",
        sms_delivery_enabled: true,
        sms_replies_enabled: true,
        voice_messages_enabled: true,
        media_enabled: true,
        reactions_enabled: true,
      },
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(12));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends every choice, the picture and the members that were made", async () => {
    vi.mocked(createConversation).mockResolvedValue({
      ok: true,
      conversationId: 12,
    });
    show();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "News");
    await userEvent.type(screen.getByLabelText("Description"), "Daily.");
    await userEvent.click(screen.getByRole("button", { name: "pick picture" }));
    await userEvent.type(
      screen.getByLabelText("Members"),
      "@sam,ada@example.com,+14155552671,",
    );
    await userEvent.click(control("join_mode", "code"));
    await userEvent.click(control("mode", "broadcast"));
    await userEvent.click(control("add_member_permission", "members"));
    await userEvent.click(control("edit_group_permission", "members"));
    for (const feature of [
      "sms_delivery_enabled",
      "sms_replies_enabled",
      "voice_messages_enabled",
      "media_enabled",
      "reactions_enabled",
    ]) {
      await userEvent.click(control(feature));
    }
    await submit();

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(vi.mocked(createConversation).mock.calls[0][0]).toEqual({
      name: "News",
      description: "Daily.",
      members: ["sam"],
      invite: [
        { phone_number: "+14155552671", display_name: expect.any(String) },
      ],
      invite_email: ["ada@example.com"],
      image: expect.any(File),
      settings: {
        mode: "broadcast",
        join_mode: "code",
        add_member_permission: "members",
        edit_group_permission: "members",
        sms_delivery_enabled: false,
        sms_replies_enabled: false,
        voice_messages_enabled: false,
        media_enabled: false,
        reactions_enabled: false,
      },
    });
  });

  it("adds a member still being typed when the form is sent", async () => {
    vi.mocked(createConversation).mockResolvedValue({
      ok: true,
      conversationId: null,
    });
    const { onSuccess } = show();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "News");
    fireEvent.change(screen.getByLabelText("Members"), {
      target: { value: "@sam" },
    });
    fireEvent.submit(screen.getByLabelText("Loop Name *").closest("form")!);
    await waitFor(() =>
      expect(vi.mocked(createConversation).mock.calls[0][0].members).toEqual([
        "sam",
      ]),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(null));
  });

  it("stops on a member it cannot read", async () => {
    show();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "News");
    fireEvent.change(screen.getByLabelText("Members"), {
      target: { value: "@!!" },
    });
    fireEvent.submit(screen.getByLabelText("Loop Name *").closest("form")!);
    expect(
      await screen.findByText('"@!!" is not a valid username.'),
    ).toBeInTheDocument();
    expect(createConversation).not.toHaveBeenCalled();
  });

  it("wants a name of a sensible length", async () => {
    show();
    await submit();
    expect(
      await screen.findByText("Loop name is required"),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "ab");
    await submit();
    expect(
      await screen.findByText("Loop name must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(createConversation).not.toHaveBeenCalled();
  });

  it("holds the form while the Loop is being created", async () => {
    const answer = deferred<Awaited<ReturnType<typeof createConversation>>>();
    vi.mocked(createConversation).mockReturnValue(answer.promise);
    const { onClose } = show();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "News");
    await submit();
    await waitFor(() =>
      expect(screen.getByLabelText("Loop Name *")).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await act(async () =>
      answer.resolve({ ok: false, message: "You have reached your limit." }),
    );
    expect(
      await screen.findByText("You have reached your limit."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says so when creating fails outright", async () => {
    vi.mocked(createConversation).mockRejectedValue(new Error("offline"));
    show();
    await userEvent.type(screen.getByLabelText("Loop Name *"), "News");
    await submit();
    expect(
      await screen.findByText("Failed to create loop. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows why a picture was refused, until a good one is picked", async () => {
    show();
    await userEvent.click(
      screen.getByRole("button", { name: "pick bad picture" }),
    );
    expect(
      await screen.findByText("That file is too big."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "pick picture" }));
    expect(screen.queryByText("That file is too big.")).not.toBeInTheDocument();
    expect(screen.getByText("new:logo.png")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "remove picture" }),
    );
    expect(screen.getByText("no picture")).toBeInTheDocument();
  });

  it("closes from Cancel, and copes with nobody waiting for the result", async () => {
    vi.mocked(createConversation).mockResolvedValue({
      ok: true,
      conversationId: 1,
    });
    const onClose = vi.fn();
    render(<CreateLoopForm onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.type(screen.getByLabelText("Loop Name *"), "News");
    await submit();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});

const SETTINGS: GroupSettings = {
  mode: "chat",
  join_mode: "open",
  add_member_permission: "admins",
  edit_group_permission: "admins",
  sms_delivery_enabled: true,
  sms_replies_enabled: true,
  voice_messages_enabled: true,
  media_enabled: true,
  reactions_enabled: true,
  category: null,
  region: "",
};

describe("LoopPanelGeneral", () => {
  const DETAILS = {
    name: "Book Club",
    description: "We read.",
    imageUrl: null,
  };

  function show(props: Partial<Parameters<typeof LoopPanelGeneral>[0]> = {}) {
    const onSave = vi.fn(async () => {});
    const view = render(
      <LoopPanelGeneral
        settings={SETTINGS}
        details={DETAILS}
        onSave={onSave}
        {...props}
      />,
    );
    return { onSave, ...view };
  }

  it("saves each setting as it is changed", async () => {
    const { onSave } = show();
    await userEvent.click(
      screen.getByRole("radio", { name: /Broadcast Group/ }),
    );
    expect(onSave).toHaveBeenLastCalledWith({ mode: "broadcast" });
    await userEvent.click(
      screen.getByRole("radio", { name: /Admin Approval/ }),
    );
    expect(onSave).toHaveBeenLastCalledWith({ join_mode: "approval" });

    await userEvent.selectOptions(
      screen.getByLabelText("Who can add new members?"),
      "members",
    );
    expect(onSave).toHaveBeenLastCalledWith({
      add_member_permission: "members",
    });
    await userEvent.selectOptions(
      screen.getByLabelText("Who can edit group details?"),
      "members",
    );
    expect(onSave).toHaveBeenLastCalledWith({
      edit_group_permission: "members",
    });

    for (const [label, key] of [
      ["SMS Delivery", "sms_delivery_enabled"],
      ["SMS Replies", "sms_replies_enabled"],
      ["Voice Messages", "voice_messages_enabled"],
      ["Photos & Files", "media_enabled"],
      ["Reactions", "reactions_enabled"],
    ]) {
      await userEvent.click(screen.getByRole("switch", { name: label }));
      expect(onSave).toHaveBeenLastCalledWith({ [key]: false });
    }

    await userEvent.click(screen.getByRole("button", { name: "pick kind" }));
    expect(onSave).toHaveBeenLastCalledWith({ category: "sports" });
    await userEvent.click(screen.getByRole("button", { name: "pick region" }));
    expect(onSave).toHaveBeenLastCalledWith({ region: "PH-00" });
  });

  it("shows a change at once, holds that control, and says when it fails", async () => {
    const answer = deferred<void>();
    const onSave = vi.fn(() => answer.promise);
    show({ onSave });
    const broadcast = screen.getByRole("radio", { name: /Broadcast Group/ });
    await userEvent.click(broadcast);
    expect(broadcast).toBeChecked();
    expect(broadcast).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Open/ })).toBeEnabled();

    await act(async () => answer.reject(new Error("Only admins can do that.")));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only admins can do that.",
    );
    expect(broadcast).not.toBeChecked();
    expect(broadcast).toBeEnabled();
  });

  it("explains that replies need delivery", () => {
    show({ settings: { ...SETTINGS, sms_delivery_enabled: false } });
    expect(
      screen.getByText("Needs SMS Delivery on - there is nothing to reply to."),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "SMS Replies" })).toBeDisabled();
  });

  it("is read-only for a member, who is told why", () => {
    show({ canEdit: false });
    expect(
      screen.getByText(
        "Only admins can change these. You are seeing them as they are.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Broadcast Group/ }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Who can add new members?")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Reactions" })).toBeDisabled();
    expect(screen.getByTestId("details-form")).toHaveTextContent(
      "Book Club:false",
    );
    expect(screen.getByTestId("kind-and-place")).toHaveTextContent(
      "null::true",
    );
  });

  it("lets a member who may edit details change only those", async () => {
    const onSaveDetails = vi.fn(async () => {});
    show({ canEdit: false, canEditDetails: true, onSaveDetails });
    expect(
      screen.getByText(/You can change the photo, name and description/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("details-form")).toHaveTextContent(
      "Book Club:true",
    );
    await userEvent.click(screen.getByRole("button", { name: "save details" }));
    expect(onSaveDetails).toHaveBeenCalledWith({ name: "Renamed" });
  });

  it("explains each choice from its info button", async () => {
    show();
    const tip = screen.getByRole("button", {
      name: 'What "Invite Only" means',
    });
    expect(tip).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(tip);
    expect(tip).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("Only invited members can join").className,
    ).not.toContain("sr-only");

    // Opening another closes the first; leaving it closes that one.
    const other = screen.getByRole("button", { name: 'What "Open" means' });
    await userEvent.hover(other);
    expect(tip).toHaveAttribute("aria-expanded", "false");
    expect(other).toHaveAttribute("aria-expanded", "true");
    await userEvent.unhover(other);
    expect(other).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(tip);
    await userEvent.click(screen.getByText("Features"));
    expect(tip).toHaveAttribute("aria-expanded", "false");
  });

  describe("the join code", () => {
    const withCode = { ...SETTINGS, join_mode: "code" as const };

    it("is offered only for a Loop joined by code", () => {
      show({ onFetchJoinCode: vi.fn() });
      expect(
        screen.queryByRole("button", { name: "Show code" }),
      ).not.toBeInTheDocument();
    });

    it("is not offered when there is no way to fetch it", () => {
      show({ settings: withCode });
      expect(
        screen.queryByRole("button", { name: "Show code" }),
      ).not.toBeInTheDocument();
    });

    it("is fetched on request, then can be copied", async () => {
      const answer = deferred<string>();
      const onFetchJoinCode = vi.fn(() => answer.promise);
      show({ settings: withCode, onFetchJoinCode });
      await userEvent.click(screen.getByRole("button", { name: "Show code" }));
      expect(
        screen.getByRole("button", { name: "Loading..." }),
      ).toHaveAttribute("aria-disabled", "true");

      await act(async () => answer.resolve("7F3K9Q"));
      expect(screen.getByText("7F3K9Q")).toBeInTheDocument();
      const section = screen.getByText("7F3K9Q").parentElement as HTMLElement;
      await userEvent.click(
        within(section).getByRole("button", { name: "Copy" }),
      );
      expect(copy).toHaveBeenCalledWith("7F3K9Q");
    });

    it("says why it could not be fetched", async () => {
      const onFetchJoinCode = vi
        .fn()
        .mockRejectedValueOnce(new Error("Only admins can see the code."))
        .mockRejectedValueOnce("nope");
      show({ settings: withCode, onFetchJoinCode });
      await userEvent.click(screen.getByRole("button", { name: "Show code" }));
      expect(
        await screen.findByText("Only admins can see the code."),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Show code" }));
      expect(
        await screen.findByText("Could not load the code."),
      ).toBeInTheDocument();
    });

    it("says when it was copied, or could not be", async () => {
      clipboard = { copied: true, error: "Could not copy that." };
      show({
        settings: withCode,
        onFetchJoinCode: vi.fn(async () => "7F3K9Q"),
      });
      await userEvent.click(screen.getByRole("button", { name: "Show code" }));
      const section = (await screen.findByText("7F3K9Q"))
        .parentElement as HTMLElement;
      expect(
        within(section).getByRole("button", { name: "Copied" }),
      ).toBeInTheDocument();
      expect(
        within(section).getByText("Could not copy that."),
      ).toBeInTheDocument();
    });
  });

  describe("the group number", () => {
    const NUMBER = {
      number: "+14155550100",
      country: "US",
      status: "active",
      provider: "twilio",
    };

    it("shows the number, and copies it", async () => {
      show({ smsNumber: NUMBER });
      expect(screen.getByText("+14155550100")).toBeInTheDocument();
      expect(
        screen.getByText("Anyone can text this number to post here."),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /Copy/ }));
      expect(copy).toHaveBeenCalledWith("+14155550100");
    });

    it("warns about a number that is not active, and reports a failed copy", () => {
      clipboard = { copied: true, error: "Could not copy that." };
      show({ smsNumber: { ...NUMBER, status: "suspended" } });
      expect(
        screen.getByText("This number is suspended and may not receive texts."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Copied/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not copy that.",
      );
    });

    it("says there is none, with nothing to press for somebody who cannot get one", () => {
      show();
      expect(
        screen.getByText(/This Loop has no number yet/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Generate number/ }),
      ).not.toBeInTheDocument();
    });

    it("gets a number on request, saying why when it cannot", async () => {
      const first = deferred<void>();
      const onProvisionNumber = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockRejectedValueOnce(new Error(""));
      show({ onProvisionNumber });
      await userEvent.click(
        screen.getByRole("button", { name: /Generate number/ }),
      );
      expect(screen.getByRole("button", { name: /Generating/ })).toBeDisabled();

      await act(async () => first.reject(new Error("No numbers are left.")));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No numbers are left.",
      );

      await userEvent.click(
        screen.getByRole("button", { name: /Generate number/ }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not get a number. Try again.",
      );
    });

    it("clears the complaint once a number is on its way", async () => {
      const onProvisionNumber = vi.fn(async () => {});
      show({ onProvisionNumber });
      await userEvent.click(
        screen.getByRole("button", { name: /Generate number/ }),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Generate number/ }),
        ).toBeEnabled(),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

describe("LoopPanelMembers", () => {
  function member(
    id: string,
    name: string,
    overrides: Partial<ConversationParticipant> = {},
  ): ConversationParticipant {
    return {
      id,
      name,
      username: name.toLowerCase(),
      role: "member",
      joinedAt: `2026-01-0${id}T00:00:00.000Z`,
      channels: {},
      blockedByMe: false,
      ...overrides,
    };
  }
  const MEMBERS = [
    member("1", "Sam", { role: "admin", email: "sam@example.com" }),
    member("2", "Ada", { phone: "+14155552671", isOnline: true }),
    member("3", "Lin", {
      role: "admin",
      channels: {
        sms: {
          status: "pending",
          allowsDelivery: false,
          askedAt: null,
          consentedAt: null,
          optedOutAt: null,
          canNudge: true,
        } as never,
        email: {
          status: "opted_in",
          allowsDelivery: true,
          askedAt: null,
          consentedAt: null,
          optedOutAt: null,
          canNudge: false,
        } as never,
      },
    }),
  ];

  function show(props: Partial<Parameters<typeof LoopPanelMembers>[0]> = {}) {
    return render(
      <LoopPanelMembers
        loopName="Book Club"
        members={MEMBERS}
        viewerUsername="sam"
        {...props}
      />,
    );
  }
  const names = () =>
    screen.getAllByRole("listitem").map((row) => {
      const name = /(Sam|Ada|Lin)/.exec(row.textContent ?? "");
      return name?.[1];
    });
  /** "Admins" is also a filter option, so the card is the paragraph. */
  const stat = (label: string) =>
    screen.getAllByText(label).find((element) => element.tagName === "P")!
      .parentElement as HTMLElement;

  it("lists everybody by name, with the totals above", () => {
    show();
    expect(screen.getByText("Manage members of Book Club")).toBeInTheDocument();
    expect(stat("Total members")).toHaveTextContent("3");
    expect(stat("Admins")).toHaveTextContent("2");
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(names()).toEqual(["Ada", "Lin", "Sam"]);
    expect(
      screen.getByRole("heading", { name: "Members (3)" }),
    ).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("+14155552671 · Joined");
    expect(rows[1]).toHaveTextContent("No contact info");
    expect(rows[1]).toHaveTextContent("SMS pending");
    expect(rows[2]).toHaveTextContent("(you)");
    expect(rows[2]).toHaveTextContent("sam@example.com");
  });

  it("searches by name, username, email or phone, and filters by role", async () => {
    show();
    const search = screen.getByRole("searchbox", { name: "Search members" });
    await userEvent.type(search, " 4155 ");
    expect(names()).toEqual(["Ada"]);
    await userEvent.clear(search);
    await userEvent.type(search, "EXAMPLE");
    expect(names()).toEqual(["Sam"]);
    await userEvent.clear(search);

    await userEvent.selectOptions(
      screen.getByLabelText("Filter members by role"),
      "admin",
    );
    expect(names()).toEqual(["Lin", "Sam"]);
    await userEvent.type(search, "zzz");
    expect(screen.getByText("Nobody matches that.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Members (0)" }),
    ).toBeInTheDocument();
  });

  it("sorts by name, by when they joined, or by role", async () => {
    show();
    const sort = screen.getByLabelText("Sort by");
    await userEvent.selectOptions(sort, "name-desc");
    expect(names()).toEqual(["Sam", "Lin", "Ada"]);
    await userEvent.selectOptions(sort, "joined");
    expect(names()).toEqual(["Lin", "Ada", "Sam"]);
    await userEvent.selectOptions(sort, "role");
    expect(names()).toEqual(["Lin", "Sam", "Ada"]);
  });

  it("says when the list is loading, or empty", () => {
    const first = show({ members: [], isLoading: true });
    expect(screen.getByText("Loading members...")).toBeInTheDocument();
    first.unmount();
    show({ members: [] });
    expect(screen.getByText("Nobody here yet.")).toBeInTheDocument();
  });

  it("shows a join date it cannot read as it came", () => {
    show({ members: [member("1", "Sam", { joinedAt: "a while ago" })] });
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Joined a while ago",
    );
  });

  it("offers a member nothing to manage with", async () => {
    const onOpenPendingRequests = vi.fn();
    const onAddMembers = vi.fn();
    show({ pendingRequestCount: 2, onOpenPendingRequests, onAddMembers });
    expect(
      screen.queryByRole("button", { name: /^Manage / }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Managing members")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Blocked members/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Pending requests (2)" }),
    );
    expect(onOpenPendingRequests).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Add members/ }));
    expect(onAddMembers).toHaveBeenCalled();
  });

  it("holds the links that lead nowhere", () => {
    show({ canModerate: true });
    expect(
      screen.getByRole("button", { name: /Blocked members/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Pending requests (0)" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Add members/ }),
    ).not.toBeInTheDocument();
  });

  describe("for an admin", () => {
    function showAdmin(
      props: Partial<Parameters<typeof LoopPanelMembers>[0]> = {},
    ) {
      const handlers = {
        onUpdateMemberRole: vi.fn(async () => {}),
        onRemoveMember: vi.fn(async () => {}),
        onBlockMember: vi.fn(async () => {}),
        onNudgeMember: vi.fn(async () => {}),
        onOpenBlocked: vi.fn(),
      };
      show({ canModerate: true, ...handlers, ...props });
      return handlers;
    }
    const openMenu = (name: string) =>
      userEvent.click(screen.getByRole("button", { name: `Manage ${name}` }));

    it("counts the blocked, with a dash until the list arrives", async () => {
      const first = show({ canModerate: true });
      expect(stat("Blocked")).toHaveTextContent("-");
      first.unmount();

      const { onOpenBlocked } = showAdmin({ blockedCount: 2 });
      expect(stat("Blocked")).toHaveTextContent("2");
      await userEvent.click(
        screen.getByRole("button", { name: /Blocked members/ }),
      );
      expect(onOpenBlocked).toHaveBeenCalled();
    });

    it("has no menu on your own row", () => {
      showAdmin();
      expect(
        screen.queryByRole("button", { name: "Manage Sam" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Manage Ada" }),
      ).toBeInTheDocument();
    });

    it("promotes a member, holding their row until it is done", async () => {
      const answer = deferred<void>();
      const onUpdateMemberRole = vi.fn(() => answer.promise);
      showAdmin({ onUpdateMemberRole });
      await openMenu("Ada");
      expect(screen.getByRole("menu", { name: "Ada" })).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: /Make a member/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: /Nudge/ }),
      ).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Make admin" }),
      );
      expect(onUpdateMemberRole).toHaveBeenCalledWith("2", "admin");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Manage Ada" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Manage Lin" })).toBeEnabled();

      await act(async () => answer.resolve());
      expect(screen.getByRole("button", { name: "Manage Ada" })).toBeEnabled();
    });

    it("demotes an admin, and nudges about a channel still waiting", async () => {
      const { onUpdateMemberRole, onNudgeMember } = showAdmin();
      await openMenu("Lin");
      // Only the channel that can be nudged is offered.
      expect(
        screen.queryByRole("menuitem", { name: /Nudge about EMAIL/ }),
      ).not.toBeInTheDocument();
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Make a member/ }),
      );
      expect(onUpdateMemberRole).toHaveBeenCalledWith("3", "member");

      await openMenu("Lin");
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Nudge about SMS/ }),
      );
      expect(onNudgeMember).toHaveBeenCalledWith("3", "sms");
    });

    it("removes or blocks a member", async () => {
      const { onRemoveMember, onBlockMember } = showAdmin();
      await openMenu("Ada");
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Remove from Loop/ }),
      );
      expect(onRemoveMember).toHaveBeenCalledWith("2");

      await openMenu("Ada");
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Block from Loop/ }),
      );
      await waitFor(() => expect(onBlockMember).toHaveBeenCalledWith("2"));
    });

    it("says why an action failed", async () => {
      const onRemoveMember = vi
        .fn()
        .mockRejectedValueOnce(new Error("They are the last admin."))
        .mockRejectedValueOnce(new Error(""));
      showAdmin({ onRemoveMember });
      await openMenu("Ada");
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Remove from Loop/ }),
      );
      expect(
        await screen.findByText("They are the last admin."),
      ).toBeInTheDocument();

      await openMenu("Ada");
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Remove from Loop/ }),
      );
      expect(
        await screen.findByText("That did not work. Try again."),
      ).toBeInTheDocument();
    });

    it("does nothing harmful when an action has no handler", async () => {
      show({ canModerate: true });
      for (const item of [
        "Make admin",
        /Remove from Loop/,
        /Block from Loop/,
      ]) {
        await openMenu("Ada");
        await userEvent.click(screen.getByRole("menuitem", { name: item }));
      }
      await openMenu("Lin");
      await userEvent.click(
        screen.getByRole("menuitem", { name: /Nudge about SMS/ }),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Manage Lin" }),
        ).toBeEnabled(),
      );
      expect(screen.queryByText(/did not work/)).not.toBeInTheDocument();
    });

    it("closes the menu without choosing, and dismisses the tip", async () => {
      showAdmin();
      await openMenu("Ada");
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();

      expect(screen.getByText("Managing members")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByText("Managing members")).not.toBeInTheDocument();
    });
  });
});
