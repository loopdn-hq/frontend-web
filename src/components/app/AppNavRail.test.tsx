import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let pathname = "/chats/";
let features = new Set<string>();
let featuresLoading = false;
let shell: Record<string, unknown>;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/app/AppShellProvider", () => ({ useAppShell: () => shell }));
vi.mock("@/lib/billing", () => ({ fetchBillingSummary: vi.fn() }));
vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return {
    ...actual,
    useFeatures: () => ({ features, loading: featuresLoading }),
  };
});
vi.mock("@/components/settings/useUserSettingsProps", () => ({
  useUserSettingsProps: () => ({ profile: { displayName: "Sam Wren" }, onSaveProfile: vi.fn() }),
}));
vi.mock("@/components/settings/EditProfileModal", () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Edit profile">
      <button onClick={onClose}>Close profile</button>
    </div>
  ),
}));
vi.mock("@/components/settings/UserSettingsModal", () => ({
  SETTINGS_MODAL_TABS: ["account", "billing"],
  UserSettingsModal: ({
    initialTab,
    onClose,
  }: {
    initialTab: string;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label={`Settings: ${initialTab}`}>
      <button onClick={onClose}>Close settings</button>
    </div>
  ),
}));

import { AppNavRail } from "@/components/app/AppNavRail";
import { fetchBillingSummary } from "@/lib/billing";
import { platform } from "@/lib/platform";
import { deferred } from "@/test/helpers";

type Summary = Awaited<ReturnType<typeof fetchBillingSummary>>;

function planHas(planFeatures: string[]) {
  vi.mocked(fetchBillingSummary).mockResolvedValue({
    ok: true,
    data: { subscription: { plan: { features: planFeatures } } },
  } as never);
}

const ALL = [
  "chat.access",
  "broadcast.access",
  "activity.access",
  "find_groups.access",
  "analytics.access",
  "platform.permissions.view",
];

function links() {
  return within(screen.getByRole("navigation", { name: "Primary" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

async function openAccountMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  pathname = "/chats/";
  features = new Set(ALL);
  featuresLoading = false;
  shell = {
    unreadByMode: { chat: 0, broadcast: 0 },
    activityUnread: 0,
    userProfile: { displayName: "Sam Wren", email: "sam@example.com" },
    logOut: vi.fn(async () => {}),
    requestCreateLoop: vi.fn(),
    isNavDrawerOpen: false,
    closeNavDrawer: vi.fn(),
  };
  vi.mocked(fetchBillingSummary).mockResolvedValue({ ok: false, message: "x" } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppNavRail - destinations", () => {
  it("lists what the account may open, leaving out the unreleased", () => {
    render(<AppNavRail />);
    expect(links()).toEqual([
      "Loopd'n",
      "Chats",
      "Broadcast",
      "Activity",
      "Calls",
      "Find groups",
      "Permissions",
    ]);
    expect(screen.getByText("Discover")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("shows only what needs no feature while the features load", () => {
    featuresLoading = true;
    render(<AppNavRail />);
    expect(links()).toEqual(["Loopd'n", "Calls"]);
    expect(screen.queryByText("Discover")).not.toBeInTheDocument();
  });

  it("shows Analytics only when the plan includes it as well", async () => {
    planHas(["Unlimited groups", " Advanced Analytics "]);
    render(<AppNavRail />);
    expect(await screen.findByRole("link", { name: "Analytics" })).toBeInTheDocument();
  });

  it("counts basic analytics as analytics, and nothing else", async () => {
    planHas(["Basic analytics"]);
    const first = render(<AppNavRail />);
    expect(await screen.findByRole("link", { name: "Analytics" })).toBeInTheDocument();
    first.unmount();

    planHas(["Unlimited groups"]);
    render(<AppNavRail />);
    await waitFor(() => expect(fetchBillingSummary).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  });

  it("ignores a plan that arrives after it has gone", async () => {
    const pending = deferred<Summary>();
    vi.mocked(fetchBillingSummary).mockReturnValue(pending.promise);
    const { unmount } = render(<AppNavRail />);
    unmount();
    pending.resolve({
      ok: true,
      data: { subscription: { plan: { features: ["Basic analytics"] } } },
    } as never);
    await pending.promise;
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  });

  it("marks the page you are on, with or without the trailing slash", () => {
    pathname = "/broadcast";
    render(<AppNavRail />);
    expect(screen.getByRole("link", { name: "Broadcast" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Chats" })).not.toHaveAttribute("aria-current");
  });

  it("badges chats, broadcasts and activity with what is unread", () => {
    shell.unreadByMode = { chat: 3, broadcast: 4 };
    shell.activityUnread = 5;
    render(<AppNavRail />);
    expect(screen.getByRole("link", { name: /Chats/ })).toHaveTextContent("Chats3");
    expect(screen.getByRole("link", { name: /Broadcast/ })).toHaveTextContent("Broadcast4");
    expect(screen.getByRole("link", { name: /Activity/ })).toHaveTextContent("Activity5");
    expect(screen.getByRole("link", { name: "Calls" })).toHaveTextContent(/^Calls$/);
  });

  it("closes the drawer when a destination is chosen", async () => {
    shell.isNavDrawerOpen = true;
    render(<AppNavRail />);
    await userEvent.click(screen.getByRole("link", { name: "Calls" }));
    expect(shell.closeNavDrawer).toHaveBeenCalledTimes(1);

    // Both the backdrop and the X close it.
    for (const button of screen.getAllByRole("button", { name: "Close navigation" })) {
      await userEvent.click(button);
    }
    expect(shell.closeNavDrawer).toHaveBeenCalledTimes(3);
  });
});

describe("AppNavRail - collapsing", () => {
  it("collapses to icons, keeping the badges, and remembers it", async () => {
    shell.unreadByMode = { chat: 3, broadcast: 0 };
    render(<AppNavRail />);
    await userEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(localStorage.getItem("loopdn_nav_collapsed")).toBe("1");
    expect(screen.queryByText("Discover")).not.toBeInTheDocument();
    expect(screen.queryByText("Sam Wren")).not.toBeInTheDocument();
    const chats = screen.getByTitle("Chats");
    expect(chats).toHaveTextContent(/^3$/);
    expect(screen.getByTitle("Calls")).toHaveTextContent("");

    await userEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(localStorage.getItem("loopdn_nav_collapsed")).toBe("0");
    expect(screen.getByText("Discover")).toBeInTheDocument();
  });

  it("starts collapsed when it was left that way", () => {
    localStorage.setItem("loopdn_nav_collapsed", "1");
    render(<AppNavRail />);
    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("AppNavRail - the account menu", () => {
  it("shows who is signed in, with the phone ahead of the email", () => {
    shell.userProfile = {
      displayName: "Sam Wren",
      email: "sam@example.com",
      phone: "+14155552671",
    };
    render(<AppNavRail />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("Sam Wren");
    expect(trigger).toHaveTextContent("+14155552671");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("offers settings when there is nothing else to show", () => {
    shell.userProfile = { displayName: "" };
    render(<AppNavRail />);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent(
      "Open settings",
    );
  });

  it("opens the profile editor, mounted only while it is open", async () => {
    render(<AppNavRail />);
    await openAccountMenu();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Profile/ }));
    expect(shell.closeNavDrawer).toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close profile" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens settings on the first tab, or on billing to upgrade", async () => {
    render(<AppNavRail />);
    await openAccountMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
    expect(screen.getByRole("dialog", { name: "Settings: account" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openAccountMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Upgrade plan/ }));
    expect(screen.getByRole("dialog", { name: "Settings: billing" })).toBeInTheDocument();
  });

  it("writes to support for help", async () => {
    const openExternal = vi.spyOn(platform, "openExternal").mockResolvedValue(undefined as never);
    render(<AppNavRail />);
    await openAccountMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Help/ }));
    expect(openExternal).toHaveBeenCalledWith(
      "mailto:support@loopdn.com?subject=Loopd%27n%20support",
    );
  });

  it("signs out from the menu", async () => {
    render(<AppNavRail />);
    await openAccountMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Log out/ }));
    expect(shell.logOut).toHaveBeenCalled();
  });
});
