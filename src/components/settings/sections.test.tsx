import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setTheme = vi.fn();
let theme = "system";

vi.mock("@/lib/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme, resolvedTheme: "light", setTheme }),
}));
vi.mock("@/lib/user/blocks", () => ({
  fetchBlockedUsers: vi.fn(),
  unblockUser: vi.fn(),
}));
vi.mock("@/lib/app/push", () => ({
  disablePush: vi.fn(),
  enablePush: vi.fn(),
  readPushState: vi.fn(),
}));
vi.mock("@/lib/auth/client", () => ({ changePassword: vi.fn() }));

import { AccountSection } from "@/components/settings/AccountSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { AvatarPicker } from "@/components/settings/AvatarPicker";
import { BlockedUsersList } from "@/components/settings/BlockedUsersList";
import { EditProfileModal } from "@/components/settings/EditProfileModal";
import { MessagingSection } from "@/components/settings/MessagingSection";
import {
  defaultNotificationPreferences,
  NotificationsSection,
} from "@/components/settings/NotificationsSection";
import {
  defaultPrivacyPreferences,
  PrivacySection,
} from "@/components/settings/PrivacySection";
import { PushOnThisBrowser } from "@/components/settings/PushOnThisBrowser";
import { SecuritySection } from "@/components/settings/SecuritySection";
import {
  LinkRow,
  SelectRow,
  SettingsGroup,
  SettingsHeading,
  SwitchRow,
} from "@/components/settings/SettingsRows";
import { TwoFactorSetup } from "@/components/settings/TwoFactorSetup";
import type { UserProfile } from "@/components/settings/UserSettingsPanel";
import {
  disablePush,
  enablePush,
  readPushState,
  type PushState,
} from "@/lib/app/push";
import { saveAppearancePreferences } from "@/lib/app/appearance";
import { changePassword } from "@/lib/auth/client";
import {
  fetchBlockedUsers,
  unblockUser,
  type BlockedEntry,
} from "@/lib/user/blocks";
import { defaultMessagingPreferences } from "@/lib/user/messagingPreferences";
import { deferred } from "@/test/helpers";

const PROFILE = {
  displayName: "Sam Wren",
  username: "sam",
  email: "sam@example.com",
  phone: "+14155552671",
  emailVerified: true,
  phoneVerified: true,
  bio: "Hi.",
  avatarUrl: undefined,
} as unknown as UserProfile;

const PUSH_READY: PushState = {
  support: "ready",
  permission: "default",
  subscribed: false,
  available: true,
};

function blocked(
  id: number,
  overrides: Partial<BlockedEntry> = {},
): BlockedEntry {
  return {
    id,
    label: `Person ${id}`,
    username: `person${id}`,
    phoneNumber: null,
    blockedAt: null,
    ...overrides,
  };
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  theme = "system";
  localStorage.clear();
  vi.mocked(readPushState).mockResolvedValue(PUSH_READY);
  vi.mocked(fetchBlockedUsers).mockResolvedValue({ ok: true, blocked: [] });
  // jsdom has neither; the picker previews a chosen file through them.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("settings rows", () => {
  it("focuses a sub-view's heading and offers the way back", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <SettingsHeading title="Sound" description="What you hear." />,
    );
    const top = screen.getByRole("heading", { name: "Sound" });
    expect(top).not.toHaveFocus();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <SettingsHeading
        title="Sound"
        backLabel="Notifications"
        onBack={onBack}
        id="h"
        descriptionId="d"
      />,
    );
    expect(screen.getByRole("heading", { name: "Sound" })).toHaveFocus();
    click("Notifications");
    expect(onBack).toHaveBeenCalled();
  });

  it("reads a group's badge as part of its name", () => {
    render(
      <>
        <SettingsGroup title="Login alerts" badge="Not available yet">
          <p>rows</p>
        </SettingsGroup>
        <SettingsGroup>
          <p>untitled</p>
        </SettingsGroup>
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Login alerts, Not available yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("untitled").closest("section")).not.toHaveAttribute(
      "aria-labelledby",
    );
  });

  it("ties a switch to its label and description, and shows it busy", () => {
    const onChange = vi.fn();
    render(
      <SwitchRow
        label="Read receipts"
        description="Let people see when you have read."
        checked={false}
        busy
        onChange={onChange}
        icon={<svg />}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Read receipts" });
    expect(toggle).toHaveAccessibleDescription(
      "Let people see when you have read.",
    );
    expect(toggle).toHaveAttribute("aria-busy", "true");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reports a dropdown's choice", () => {
    const onChange = vi.fn();
    render(
      <SelectRow
        label="Sound"
        description="On arrival."
        value="default"
        busy={false}
        onChange={onChange}
        options={[
          { value: "default", label: "Default" },
          { value: "none", label: "None" },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Sound"), {
      target: { value: "none" },
    });
    expect(onChange).toHaveBeenCalledWith("none");
  });

  it("shows a link row's current value only when it has one", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <LinkRow label="Blocked users" onClick={onClick} />,
    );
    expect(screen.getByRole("button")).toHaveTextContent(/^Blocked users$/);
    rerender(
      <LinkRow label="Blocked users" value={3} onClick={onClick} disabled />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Blocked users3");
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("AppearanceSection", () => {
  it("changes the theme through the provider and the rest through storage", () => {
    render(<AppearanceSection />);
    expect(
      screen.getByRole("radio", { name: "Match my device" }),
    ).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(setTheme).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Large" }));
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    expect(
      JSON.parse(localStorage.getItem("loopdn_appearance")!),
    ).toMatchObject({
      textSize: "large",
      messageSpacing: "compact",
    });
    expect(setTheme).toHaveBeenCalledTimes(1);

    act(() =>
      saveAppearancePreferences({
        textSize: "default",
        messageSpacing: "comfortable",
      }),
    );
  });
});

describe("MessagingSection", () => {
  it("shows a change at once and saves just that key", async () => {
    const saving = deferred<void>();
    const onSave = vi.fn(() => saving.promise);
    render(
      <MessagingSection
        preferences={defaultMessagingPreferences}
        onSave={onSave}
      />,
    );
    const enter = screen.getByRole("checkbox", { name: "Press Enter to send" });
    expect(enter).toBeChecked();

    fireEvent.click(enter);
    expect(enter).not.toBeChecked();
    expect(enter).toHaveAttribute("aria-busy", "true");
    expect(onSave).toHaveBeenCalledWith({ enterToSend: false });

    // A second press while the first is saving is ignored, not queued.
    fireEvent.click(enter);
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => saving.resolve());
    expect(enter).not.toHaveAttribute("aria-busy");
  });

  it("puts the switch back and says why when the save is refused", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Email is switched off for this account."),
      )
      .mockRejectedValueOnce("nope");
    render(
      <MessagingSection
        preferences={defaultMessagingPreferences}
        onSave={onSave}
      />,
    );
    const email = screen.getByRole("checkbox", {
      name: "Send and receive Loop messages by email",
    });

    fireEvent.click(email);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email is switched off for this account.",
    );
    expect(email).toBeChecked();

    fireEvent.click(email);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't save that. Try again.",
      ),
    );
  });

  it("works with nothing to save to", async () => {
    render(<MessagingSection preferences={defaultMessagingPreferences} />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Show link previews" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Show link previews" }),
      ).not.toHaveAttribute("aria-busy"),
    );
  });
});

describe("NotificationsSection", () => {
  it("flips a switch, and opens the sound choice as a view of its own", async () => {
    const onSave = vi.fn(async () => {});
    render(
      <NotificationsSection
        preferences={defaultNotificationPreferences}
        onSave={onSave}
      />,
    );
    await screen.findByText(/Turn it on to be notified/);

    fireEvent.click(screen.getByRole("switch", { name: "Missed calls" }));
    expect(onSave).toHaveBeenCalledWith({ missedCalls: false });

    const soundRow = screen.getByRole("button", { name: /sound/i });
    expect(soundRow).toHaveTextContent("Loopd'n default");
    fireEvent.click(soundRow);

    expect(screen.getByRole("heading", { name: "Sound" })).toHaveFocus();
    fireEvent.click(screen.getByRole("radio", { name: "None" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ sound: "none" }));

    click("Notifications");
    expect(
      screen.getByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
    // Focus goes back to the row that opened the view.
    expect(screen.getByRole("button", { name: /sound/i })).toHaveFocus();
  });

  it("says why a save failed", async () => {
    render(
      <NotificationsSection
        preferences={defaultNotificationPreferences}
        onSave={vi.fn().mockRejectedValue(new Error("Offline."))}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Messages" }));
    expect(await screen.findByText("Offline.")).toBeInTheDocument();
  });
});

describe("PrivacySection", () => {
  it("opens an audience choice and saves what is picked", async () => {
    const onSave = vi.fn(async () => {});
    render(
      <PrivacySection
        preferences={defaultPrivacyPreferences}
        onSave={onSave}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /who can send me direct messages/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Who can send me direct messages" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "People in my Loops" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ directMessages: "loops" }),
    );

    click("Privacy");
    fireEvent.click(screen.getByRole("switch", { name: "Read receipts" }));
    expect(onSave).toHaveBeenCalledWith({ readReceipts: false });
  });

  it("counts the blocked list, opens it, and drops somebody once unblocked", async () => {
    vi.mocked(fetchBlockedUsers).mockResolvedValue({
      ok: true,
      blocked: [blocked(1), blocked(2)],
    });
    vi.mocked(unblockUser).mockResolvedValue({ ok: true });
    render(<PrivacySection preferences={defaultPrivacyPreferences} />);

    const row = screen.getByRole("button", { name: /blocked users/i });
    expect(row).toBeDisabled();
    await waitFor(() => expect(row).toBeEnabled());
    expect(row).toHaveTextContent("2");

    fireEvent.click(row);
    expect(
      screen.getByRole("heading", { name: "Blocked users" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Unblock" })[0]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Unblock",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Person 1")).not.toBeInTheDocument(),
    );

    click("Privacy");
    expect(
      screen.getByRole("button", { name: /blocked users/i }),
    ).toHaveTextContent("1");
  });

  it("says when the blocked list could not be loaded", async () => {
    vi.mocked(fetchBlockedUsers).mockResolvedValue({
      ok: false,
      message: "Could not load your blocked list.",
    });
    render(<PrivacySection preferences={defaultPrivacyPreferences} />);
    expect(
      await screen.findByText("Could not load your blocked list."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /blocked users/i }),
    ).toBeDisabled();
  });

  it("ignores a blocked list that arrives after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchBlockedUsers>>>();
    vi.mocked(fetchBlockedUsers).mockReturnValue(pending.promise);
    const { unmount } = render(
      <PrivacySection preferences={defaultPrivacyPreferences} />,
    );
    unmount();
    pending.resolve({ ok: true, blocked: [] });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("BlockedUsersList", () => {
  const entries = [
    blocked(1, { label: "Sam Wren", username: "sam" }),
    blocked(2, {
      label: "+1 415 555 2671",
      username: null,
      phoneNumber: "+14155552671",
    }),
    blocked(3, { label: "Alex", username: "alex" }),
  ];

  it("says so when nobody is blocked, with no search box", () => {
    render(
      <BlockedUsersList
        entries={[]}
        onBack={() => {}}
        onUnblocked={() => {}}
      />,
    );
    expect(screen.getByText("You haven't blocked anyone.")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("searches by name, username or number", () => {
    render(
      <BlockedUsersList
        entries={entries}
        onBack={() => {}}
        onUnblocked={() => {}}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("@sam")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", {
      name: "Search blocked users",
    });
    fireEvent.change(search, { target: { value: " 5552671 " } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(search, { target: { value: "ALEX" } });
    expect(screen.getByRole("listitem")).toHaveTextContent("Alex");

    fireEvent.change(search, { target: { value: "zed" } });
    expect(screen.getByText("Nobody matches “zed”.")).toBeInTheDocument();
  });

  it("asks before unblocking, and can be cancelled", () => {
    const onUnblocked = vi.fn();
    render(
      <BlockedUsersList
        entries={entries}
        onBack={() => {}}
        onUnblocked={onUnblocked}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Unblock" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Unblock Sam Wren?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Unblock" })[0]);
    click("Keep them blocked");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(unblockUser).not.toHaveBeenCalled();
    expect(onUnblocked).not.toHaveBeenCalled();
  });

  it("unblocks, then puts focus on the row that took its place", async () => {
    const pending = deferred<Awaited<ReturnType<typeof unblockUser>>>();
    vi.mocked(unblockUser).mockReturnValue(pending.promise);

    function Harness() {
      const [rows, setRows] = useState(entries);
      return (
        <BlockedUsersList
          entries={rows}
          onBack={() => {}}
          onUnblocked={(entry) =>
            setRows(rows.filter((row) => row.id !== entry.id))
          }
        />
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("button", { name: "Unblock" })[1]);
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Unblock" });
    fireEvent.click(confirm);
    expect(confirm).toHaveTextContent("Unblocking...");
    expect(confirm).toHaveAttribute("aria-disabled", "true");

    // Nothing closes it mid-request, and a second press does not send twice.
    fireEvent.click(confirm);
    click("Keep them blocked");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(unblockUser).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ ok: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Unblock" })[1]).toHaveFocus();
  });

  it("focuses the heading when the last person is unblocked", async () => {
    vi.mocked(unblockUser).mockResolvedValue({ ok: true });
    function Harness() {
      const [rows, setRows] = useState([entries[0]]);
      return (
        <BlockedUsersList
          entries={rows}
          onBack={() => {}}
          onUnblocked={() => setRows([])}
        />
      );
    }
    render(<Harness />);
    click("Unblock");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Unblock",
      }),
    );
    await screen.findByText("You haven't blocked anyone.");
    expect(
      screen.getByRole("heading", { name: "Blocked users" }),
    ).toHaveFocus();
  });

  it("keeps the dialog open and says why when the unblock is refused", async () => {
    vi.mocked(unblockUser).mockResolvedValue({
      ok: false,
      message: "Could not unblock them.",
    });
    const onUnblocked = vi.fn();
    render(
      <BlockedUsersList
        entries={entries}
        onBack={() => {}}
        onUnblocked={onUnblocked}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Unblock" })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Unblock" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not unblock them.",
    );
    expect(onUnblocked).not.toHaveBeenCalled();

    // Left on the list too, once the dialog is put away.
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not unblock them.",
    );
  });
});

describe("PushOnThisBrowser", () => {
  async function shows(state: PushState, text: RegExp) {
    vi.mocked(readPushState).mockResolvedValue(state);
    const view = render(<PushOnThisBrowser />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    return view;
  }

  it("says it is checking until it knows", () => {
    vi.mocked(readPushState).mockReturnValue(new Promise(() => {}));
    render(<PushOnThisBrowser />);
    expect(screen.getByText("Checking…")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains each reason notifications cannot be turned on here", async () => {
    const first = await shows(
      { ...PUSH_READY, support: "needs-install" },
      /add Loopd'n to your Home Screen first/,
    );
    expect(screen.getByText("Not available")).toBeInTheDocument();
    first.unmount();

    const second = await shows(
      { ...PUSH_READY, support: "unsupported" },
      /This browser cannot show notifications/,
    );
    second.unmount();

    const third = await shows(
      { ...PUSH_READY, available: false },
      /not switched on for this server yet/,
    );
    expect(screen.getByText("Not available")).toBeInTheDocument();
    third.unmount();

    await shows(
      { ...PUSH_READY, permission: "denied" },
      /Blocked in your browser's settings/,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("turns notifications on, then reads the state again", async () => {
    vi.mocked(enablePush).mockResolvedValue({ ok: true });
    await shows(PUSH_READY, /^Off\. Turn it on/);

    vi.mocked(readPushState).mockResolvedValue({
      ...PUSH_READY,
      permission: "granted",
      subscribed: true,
    });
    click("Turn on");
    expect(
      await screen.findByText(/^On\. You will be notified here/),
    ).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();
    expect(enablePush).toHaveBeenCalledTimes(1);
  });

  it("says why it could not be turned on", async () => {
    vi.mocked(enablePush).mockResolvedValue({
      ok: false,
      message: "Notifications are blocked for this site.",
    });
    await shows(PUSH_READY, /^Off\./);
    click("Turn on");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Notifications are blocked for this site.",
    );
  });

  it("turns notifications off, and reports a failure to", async () => {
    vi.mocked(disablePush).mockResolvedValue({
      ok: false,
      message: "Could not turn notifications off.",
    });
    await shows(
      { ...PUSH_READY, permission: "granted", subscribed: true },
      /^On\./,
    );
    click("Turn off");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not turn notifications off.",
    );

    vi.mocked(disablePush).mockResolvedValue({ ok: true });
    vi.mocked(readPushState).mockResolvedValue(PUSH_READY);
    click("Turn off");
    expect(
      await screen.findByRole("button", { name: "Turn on" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AvatarPicker", () => {
  function pick(container: HTMLElement, file: File) {
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("offers to add a photo, and hands over the one picked", () => {
    const onPick = vi.fn();
    const onReject = vi.fn();
    const { container } = render(
      <AvatarPicker
        name="Sam"
        file={null}
        onPick={onPick}
        onReject={onReject}
      />,
    );
    const button = screen.getByRole("button", { name: "Add a profile photo" });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const opened = vi.spyOn(input, "click");
    fireEvent.click(button);
    expect(opened).toHaveBeenCalled();

    const file = new File(["png"], "me.png", { type: "image/png" });
    pick(container, file);
    expect(onPick).toHaveBeenCalledWith(file);
    expect(onReject).not.toHaveBeenCalled();
  });

  it("refuses a file over 5MB, saying how big it was", () => {
    const onPick = vi.fn();
    const onReject = vi.fn();
    const { container } = render(
      <AvatarPicker
        name="Sam"
        file={null}
        onPick={onPick}
        onReject={onReject}
      />,
    );
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6.5 * 1024 * 1024 });
    pick(container, big);
    expect(onReject).toHaveBeenCalledWith(
      "That image is 6.5MB. Keep it under 5MB.",
    );
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [] },
    });
    expect(onPick).not.toHaveBeenCalled();
  });

  it("previews a pending photo, and releases the preview afterwards", () => {
    const file = new File(["png"], "me.png", { type: "image/png" });
    const onRemove = vi.fn();
    const { container, unmount } = render(
      <AvatarPicker
        name="Book club"
        file={file}
        onPick={() => {}}
        onReject={() => {}}
        onRemove={onRemove}
        isGroup
        size={64}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "blob:preview",
    );
    expect(
      screen.getByRole("button", { name: "Change Loop photo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("New photo selected - save to apply"),
    ).toBeInTheDocument();
    click("Remove photo");
    expect(onRemove).toHaveBeenCalled();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("offers removal only when there is a photo, and no note when told not to", () => {
    const { rerender } = render(
      <AvatarPicker
        name="Sam"
        file={null}
        onPick={() => {}}
        onReject={() => {}}
        onRemove={() => {}}
        isGroup
      />,
    );
    expect(
      screen.getByRole("button", { name: "Add a Loop photo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove photo" }),
    ).not.toBeInTheDocument();

    rerender(
      <AvatarPicker
        name="Sam"
        currentUrl="https://cdn.example/sam.png"
        file={new File(["x"], "x.png")}
        onPick={() => {}}
        onReject={() => {}}
        onRemove={() => {}}
        pendingNote={null}
        disabled
      />,
    );
    expect(
      screen.getByRole("button", { name: "Change profile photo" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeDisabled();
    expect(screen.queryByText(/save to apply/)).not.toBeInTheDocument();
  });
});

describe("EditProfileModal", () => {
  function open(onSave?: Parameters<typeof EditProfileModal>[0]["onSave"]) {
    const onClose = vi.fn();
    const view = render(
      <EditProfileModal
        isOpen
        onClose={onClose}
        profile={PROFILE}
        onSave={onSave}
      />,
    );
    return { onClose, ...view };
  }

  it("starts on the name, with nothing to save until something changes", () => {
    open();
    expect(screen.getByLabelText("Display name")).toHaveFocus();
    expect(screen.getByLabelText("Username")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  " },
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the trimmed name and bio, then closes", async () => {
    const saving = deferred<void>();
    const onSave = vi.fn(() => saving.promise);
    const { onClose } = open(onSave);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: " Sam W " },
    });
    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "Hello." },
    });
    click("Save");

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Sam W",
        bio: "Hello.",
        avatarFile: null,
        username: "sam",
      }),
    );
    await act(async () => saving.resolve());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves a new photo on its own", async () => {
    const onSave = vi.fn(async () => {});
    const { container } = open(onSave);
    const file = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.change(
      container.ownerDocument.querySelector('input[type="file"]')!,
      {
        target: { files: [file] },
      },
    );
    click("Save");
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ avatarFile: file }),
      ),
    );
  });

  it("stays open and says why when the save is refused", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("That name is too long."))
      .mockRejectedValueOnce(null);
    const { onClose } = open(onSave);
    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "New." },
    });

    click("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That name is too long.",
    );
    expect(onClose).not.toHaveBeenCalled();

    click("Save");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't save that. Try again.",
      ),
    );
  });

  it("reports a rejected photo, and clears it when a good one is picked", () => {
    const { container } = open();
    const input = container.ownerDocument.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const big = new File(["x"], "big.png");
    Object.defineProperty(big, "size", { value: 9 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByRole("alert")).toHaveTextContent("9.0MB");

    fireEvent.change(input, { target: { files: [new File(["x"], "ok.png")] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    click("Cancel");
  });

  it("hides the username row for an account without one, and does nothing closed", () => {
    const { rerender } = render(
      <EditProfileModal
        isOpen
        onClose={() => {}}
        profile={
          { ...PROFILE, username: "", bio: undefined, displayName: "" } as never
        }
      />,
    );
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();

    rerender(
      <EditProfileModal isOpen={false} onClose={() => {}} profile={PROFILE} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("TwoFactorSetup", () => {
  it("is a preview: it offers the verified destinations and changes nothing", () => {
    render(<TwoFactorSetup profile={PROFILE} onBack={() => {}} />);
    expect(
      screen.getByText(/two-factor authentication isn't available yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /text message/i })).toBeChecked();
    expect(screen.getByText("To •••• 2671")).toBeInTheDocument();
    expect(screen.getByText("To s•••@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /email/i }));
    click("Continue");
    expect(
      screen.getByText(/a 6-digit code will be sent to s•••@example.com/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("6-digit code")).toHaveFocus();
  });

  it("takes six digits, then says plainly that nothing was turned on", () => {
    render(<TwoFactorSetup profile={PROFILE} onBack={() => {}} />);
    click("Continue");
    const code = screen.getByLabelText("6-digit code");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();

    fireEvent.change(code, { target: { value: "12ab34567" } });
    expect(code).toHaveValue("123456");
    click("Verify");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nothing was turned on",
    );

    fireEvent.change(code, { target: { value: "12345" } });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    click("Back");
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus();
  });

  it("falls back to whichever destination is verified", () => {
    const { rerender } = render(
      <TwoFactorSetup
        profile={{ ...PROFILE, phoneVerified: false } as never}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: /email/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /text message/i })).toBeDisabled();
    expect(
      screen.getByText("Only a verified phone number can receive codes"),
    ).toBeInTheDocument();

    rerender(
      <TwoFactorSetup
        profile={{ ...PROFILE, emailVerified: false, email: "odd" } as never}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: /text message/i })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /text message/i }));
  });

  it("cannot continue with nothing verified", () => {
    const onBack = vi.fn();
    render(
      <TwoFactorSetup
        profile={
          { ...PROFILE, emailVerified: false, phoneVerified: false } as never
        }
        onBack={onBack}
      />,
    );
    expect(
      screen.getByText(/Codes can only go to a phone number or email address/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    click("Security");
    expect(onBack).toHaveBeenCalled();
  });

  it("masks an address with no domain by leaving it alone", () => {
    render(
      <TwoFactorSetup
        profile={
          { ...PROFILE, phoneVerified: false, email: "localonly" } as never
        }
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("To localonly")).toBeInTheDocument();
  });
});

describe("SecuritySection", () => {
  function fill(current: string, next: string) {
    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: current },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: next },
    });
  }

  it("names this browser, and marks what is not available yet", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36",
    });
    render(<SecuritySection profile={PROFILE} />);
    expect(screen.getByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Login alerts, Not available yet" }),
    ).toBeInTheDocument();
    for (const toggle of screen.getAllByRole("switch"))
      expect(toggle).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Change Password" }),
    ).toBeDisabled();
  });

  it("checks the new password before sending it", () => {
    render(<SecuritySection profile={PROFILE} />);
    fill("old", "weak");
    click("Change Password");
    expect(
      screen.getByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Password must include at least one capital letter."),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("changes the password, clears the form and says so for a moment", async () => {
    vi.useFakeTimers();
    const pending = deferred<Awaited<ReturnType<typeof changePassword>>>();
    vi.mocked(changePassword).mockReturnValue(pending.promise);
    render(<SecuritySection profile={PROFILE} />);
    fill("old-pass", "Str0ng!pass");
    click("Change Password");

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(changePassword).toHaveBeenCalledWith({
      oldPassword: "old-pass",
      newPassword: "Str0ng!pass",
    });

    await act(async () => pending.resolve({ ok: true }));
    expect(screen.getByText("Password changed ✓")).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toHaveValue("");

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByText("Password changed ✓")).not.toBeInTheDocument();
  });

  it("puts the server's errors beside their fields", async () => {
    vi.mocked(changePassword).mockResolvedValue({
      ok: false,
      message: "Could not change your password.",
      fieldErrors: {
        old_password: ["That is not your current password."],
        new_password: ["Too similar to your username."],
      },
    });
    render(<SecuritySection profile={PROFILE} />);
    fill("wrong", "Str0ng!pass");
    click("Change Password");

    expect(
      await screen.findByText("That is not your current password."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Too similar to your username."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Could not change your password."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toHaveValue("wrong");
  });

  it("opens the two-factor preview without losing what was typed", () => {
    render(<SecuritySection profile={PROFILE} />);
    fill("old-pass", "Str0ng!pass");
    click("Set up");
    expect(
      screen.getByRole("heading", { name: "Two-factor authentication" }),
    ).toBeInTheDocument();

    click("Security");
    expect(screen.getByLabelText("Current Password")).toHaveValue("old-pass");
    expect(screen.getByRole("button", { name: "Set up" })).toHaveFocus();
  });

  it("is honest that other devices cannot be signed out yet", () => {
    render(<SecuritySection profile={PROFILE} />);
    click("Sign out of all other devices");
    const dialog = screen.getByRole("dialog", {
      name: "Signing out other devices isn't available yet",
    });
    expect(dialog).toHaveTextContent("No device has been signed out");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    click("Sign out of all other devices");
    click("Close modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AccountSection", () => {
  it("shows who the account is, and what is verified", () => {
    render(<AccountSection profile={PROFILE} />);
    expect(screen.getByText("Sam Wren")).toBeInTheDocument();
    expect(screen.getByText("@sam")).toBeInTheDocument();
    expect(screen.getByText("(Cannot be changed)")).toBeInTheDocument();
    expect(screen.getAllByText("Verified")).toHaveLength(2);
    expect(screen.queryByText("Unverified")).not.toBeInTheDocument();
  });

  it("marks what is unverified or missing", () => {
    render(
      <AccountSection
        profile={
          {
            ...PROFILE,
            displayName: "",
            username: "",
            phone: "",
            emailVerified: false,
          } as never
        }
      />,
    );
    expect(screen.getByText("Your name")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.getAllByText("Not set")).toHaveLength(2);
    expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
  });

  it("opens the profile editor and saves through it", async () => {
    const onSaveProfile = vi.fn(async () => {});
    render(<AccountSection profile={PROFILE} onSaveProfile={onSaveProfile} />);
    click("Edit profile");
    const dialog = screen.getByRole("dialog", { name: "Edit profile" });
    fireEvent.change(within(dialog).getByLabelText("Bio"), {
      target: { value: "New bio." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ bio: "New bio." }),
    );
  });

  it("is honest that an account cannot be deleted from here yet", () => {
    render(<AccountSection profile={PROFILE} />);
    click("Delete account");
    const dialog = screen.getByRole("dialog", {
      name: "Deleting isn't available yet",
    });
    expect(dialog).toHaveTextContent("Your account has not been deleted");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    click("Delete account");
    click("Close modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
