import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
const openNavDrawer = vi.fn();
const setUserProfile = vi.fn();
let userProfile: Record<string, unknown>;

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("@/lib/app/AppShellProvider", () => ({
  useAppShell: () => ({ userProfile, setUserProfile, openNavDrawer }),
}));
vi.mock("@/lib/auth/client", () => ({
  changePassword: vi.fn(),
  updateUserProfile: vi.fn(),
}));
vi.mock("@/lib/user/accountSettings", () => ({
  fetchAccountSettings: vi.fn(),
  saveAccountSettings: vi.fn(),
}));
vi.mock("@/lib/user/blocks", () => ({
  fetchBlockedUsers: vi.fn(async () => ({ ok: true, blocked: [] })),
  unblockUser: vi.fn(),
}));
vi.mock("@/lib/billing", () => ({
  createCreditCheckoutSession: vi.fn(),
  createPlanCheckoutSession: vi.fn(),
  fetchBillingPlans: vi.fn(),
  fetchBillingSummary: vi.fn(),
  fetchCreditPackages: vi.fn(),
}));
vi.mock("@/lib/platform", () => ({
  platform: { openExternal: vi.fn(async () => {}) },
}));
// Each has a test file of its own; here they only need to be the tab shown.
vi.mock("@/components/whatsapp/WhatsAppSettingsSection", () => ({
  WhatsAppSettingsSection: () => <div data-testid="whatsapp-section" />,
}));
vi.mock("@/components/settings/TransactionHistory", () => ({
  TransactionHistory: () => <div data-testid="transactions-section" />,
}));
vi.mock("@/components/settings/PushOnThisBrowser", () => ({
  PushOnThisBrowser: () => null,
}));

import SettingsPage from "@/app/(app)/settings/page";
import {
  SETTINGS_MODAL_TABS,
  UserSettingsModal,
} from "@/components/settings/UserSettingsModal";
import {
  isSettingsTab,
  settingsHref,
  UserSettingsPanel,
  type UserProfile,
} from "@/components/settings/UserSettingsPanel";
import { useUserSettingsProps } from "@/components/settings/useUserSettingsProps";
import { updateUserProfile } from "@/lib/auth/client";
import {
  createCreditCheckoutSession,
  createPlanCheckoutSession,
  fetchBillingPlans,
  fetchBillingSummary,
  fetchCreditPackages,
  type BillingPlan,
  type BillingSummary,
} from "@/lib/billing";
import { platform } from "@/lib/platform";
import { fetchAccountSettings, saveAccountSettings } from "@/lib/user/accountSettings";
import { deferred, stubLocation } from "@/test/helpers";

const PROFILE: UserProfile = {
  displayName: "Sam Wren",
  username: "sam",
  email: "sam@example.com",
  phone: "+14155552671",
  emailVerified: true,
  phoneVerified: false,
  emailEnabled: true,
  bio: "Hi.",
};

function plan(overrides: Partial<BillingPlan>): BillingPlan {
  return {
    id: "p",
    code: "premium",
    name: "Premium",
    priceDisplay: "$9.99/mo",
    monthlyPriceCents: 999,
    maxGroups: 25,
    maxMembersPerGroup: 100,
    maxAdminsPerGroup: 5,
    storageGb: 20,
    hasWhatsApp: false,
    hasTelegram: false,
    hasCalls: true,
    maxCallParticipants: 12,
    hasScreenShare: false,
    hasCallRecording: false,
    callRecordingRetentionDays: null,
    features: ["Search"],
    isCustomPricing: false,
    ...overrides,
  };
}

const PLANS = [
  plan({ id: "f", code: "free", name: "Free", monthlyPriceCents: 0 }),
  plan({ id: "p", code: "premium", name: "Premium" }),
  plan({ id: "b", code: "business", name: "Business", monthlyPriceCents: null }),
  plan({ id: "e", code: "enterprise", name: "Enterprise", monthlyPriceCents: null }),
];

const PACKAGES = [
  { id: "1", name: "Starter", priceCents: 500, creditCents: 500 },
  { id: "2", name: "Plus", priceCents: 2000, creditCents: 2200 },
];

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    subscription: {
      plan: plan({ code: "Premium" }),
      status: "active",
      currentPeriodEnd: "2026-11-01T12:00:00Z",
      cancelAtPeriodEnd: true,
    },
    wallet: {
      balanceCents: 250,
      autoRechargeEnabled: true,
      autoRechargePackage: "Starter",
    },
    enterpriseCredits: {
      contractNumber: "ENT-0001",
      status: "active",
      balance: 9400,
      monthlyAllowance: 10000,
    },
    ...overrides,
  };
}

function billingIs(value: BillingSummary = summary()) {
  vi.mocked(fetchBillingSummary).mockResolvedValue({ ok: true, data: value });
  vi.mocked(fetchBillingPlans).mockResolvedValue({ ok: true, data: PLANS });
  vi.mocked(fetchCreditPackages).mockResolvedValue({ ok: true, data: PACKAGES });
}

function tab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  userProfile = { ...PROFILE };
  stubLocation("https://loopdn.com/settings/");
  billingIs();
  vi.mocked(fetchAccountSettings).mockResolvedValue({ ok: false, message: "x" });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("settings addresses", () => {
  it("recognises a tab name, and links to a tab by fragment", () => {
    expect(isSettingsTab("billing")).toBe(true);
    expect(isSettingsTab("nonsense")).toBe(false);
    expect(settingsHref("privacy")).toBe("/settings/#privacy");
    expect(settingsHref()).toBe("/settings/");
  });
});

describe("UserSettingsPanel - tabs", () => {
  it("opens on the profile and shows each section as its tab is chosen", async () => {
    const onTabChange = vi.fn();
    render(<UserSettingsPanel profile={PROFILE} onTabChange={onTabChange} />);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Display Name")).toHaveValue("Sam Wren");

    const sections: [string, () => HTMLElement][] = [
      ["Security", () => screen.getByRole("heading", { name: "Security" })],
      ["Appearance", () => screen.getByRole("heading", { name: "Appearance" })],
      ["Messaging", () => screen.getByRole("heading", { name: "Messaging" })],
      ["WhatsApp", () => screen.getByTestId("whatsapp-section")],
      ["Notifications", () => screen.getByRole("heading", { name: "Notifications" })],
      ["Privacy", () => screen.getByRole("heading", { name: "Privacy" })],
      ["Transactions", () => screen.getByTestId("transactions-section")],
      ["Account", () => screen.getByRole("heading", { name: "Account" })],
    ];
    for (const [name, find] of sections) {
      tab(name);
      expect(find()).toBeInTheDocument();
    }
    expect(onTabChange).toHaveBeenLastCalledWith("account");

    tab("Billing");
    expect(await screen.findByText("Current Plan")).toBeInTheDocument();
  });

  it("starts on the tab it is given, or the first it is allowed", () => {
    const first = render(<UserSettingsPanel profile={PROFILE} initialTab="privacy" />);
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
    first.unmount();

    const second = render(
      <UserSettingsPanel
        profile={PROFILE}
        initialTab="profile"
        tabs={["appearance", "account"]}
        showHeading={false}
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    second.unmount();

    render(<UserSettingsPanel profile={PROFILE} tabs={[]} />);
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
  });

  it("can lay its tabs out down the side", () => {
    render(
      <UserSettingsPanel
        profile={PROFILE}
        layout="sidebar"
        bodyClassName="max-h-64"
        tabs={["security", "account"]}
      />,
    );
    const list = screen.getByRole("tablist", { name: "Settings sections" });
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByRole("tabpanel")).toHaveClass("max-h-64");

    fireEvent.click(within(list).getByRole("tab", { name: "Account" }));
    expect(within(list).getByRole("tab", { name: "Account" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
  });
});

describe("UserSettingsPanel - profile", () => {
  it("shows the contact details read-only, marked when verified", () => {
    render(<UserSettingsPanel profile={PROFILE} />);
    expect(screen.getByLabelText("Email (Verified)")).toBeDisabled();
    expect(screen.getByLabelText("Email (Verified)")).toHaveValue("sam@example.com");
    expect(screen.getByLabelText("Phone")).toBeDisabled();
  });

  it("saves the name, bio and a new photo, and says so for a moment", async () => {
    vi.useFakeTimers();
    const saving = deferred<void>();
    const onSaveProfile = vi.fn(() => saving.promise);
    const { container } = render(
      <UserSettingsPanel profile={PROFILE} onSaveProfile={onSaveProfile} />,
    );
    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Sam W" },
    });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Hello." } });
    const file = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    expect(screen.getByText("New photo selected - save to apply")).toBeInTheDocument();

    click("Save Profile");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(onSaveProfile).toHaveBeenCalledWith({
      ...PROFILE,
      displayName: "Sam W",
      bio: "Hello.",
      avatarFile: file,
    });

    await act(async () => saving.resolve());
    expect(screen.getByText("Saved ✓")).toBeInTheDocument();
    expect(screen.queryByText(/save to apply/)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByText("Saved ✓")).not.toBeInTheDocument();
  });

  it("will not save an empty name, and says why a save failed", async () => {
    const onSaveProfile = vi
      .fn()
      .mockRejectedValueOnce(new Error("That name is taken."))
      .mockRejectedValueOnce(undefined);
    const { container } = render(
      <UserSettingsPanel
        profile={{ ...PROFILE, bio: undefined, email: "", phone: "" }}
        onSaveProfile={onSaveProfile}
      />,
    );
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Save Profile" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "" } });
    expect(screen.getByText("Your name")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Sam" },
    });
    click("Save Profile");
    expect(await screen.findByRole("alert")).toHaveTextContent("That name is taken.");

    click("Save Profile");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't save that. Try again.",
      ),
    );

    const big = new File(["x"], "big.png");
    Object.defineProperty(big, "size", { value: 7 * 1024 * 1024 });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [big] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("7.0MB");
  });

  it("saves with nothing to save to", async () => {
    render(<UserSettingsPanel profile={PROFILE} />);
    click("Save Profile");
    expect(await screen.findByText("Saved ✓")).toBeInTheDocument();
  });
});

describe("UserSettingsPanel - billing", () => {
  async function openBilling() {
    const view = render(<UserSettingsPanel profile={PROFILE} initialTab="billing" />);
    await waitFor(() =>
      expect(screen.queryByText("Loading billing...")).not.toBeInTheDocument(),
    );
    return view;
  }

  it("shows the plan, the wallet and the enterprise credits", async () => {
    render(<UserSettingsPanel profile={PROFILE} initialTab="billing" />);
    expect(screen.getByText("Loading billing...")).toBeInTheDocument();
    expect(await screen.findByText("Current Plan")).toBeInTheDocument();

    const body = screen.getByRole("tabpanel");
    expect(body).toHaveTextContent("Status: active");
    expect(body).toHaveTextContent("Renews");
    expect(body).toHaveTextContent("Cancels at period end");
    expect(body).toHaveTextContent("25 groups");
    expect(body).toHaveTextContent("20 GB storage");
    expect(body).toHaveTextContent("Wallet balance: $2.50");
    expect(body).toHaveTextContent("Auto-recharge enabled (Starter)");
    expect(body).toHaveTextContent("Auto-recharge on");
    expect(body).toHaveTextContent("Package: Starter");
    expect(body).toHaveTextContent("Your wallet balance is running low.");
    expect(body).toHaveTextContent("9,400 / 10,000 messages");
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("describes an unlimited plan and a healthy, manual wallet", async () => {
    billingIs(
      summary({
        subscription: {
          plan: plan({
            code: "enterprise",
            name: "Enterprise (ENT-0001)",
            maxGroups: null,
            maxMembersPerGroup: null,
            maxAdminsPerGroup: null,
            storageGb: null,
            features: [],
          }),
          status: "trialing",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        wallet: { balanceCents: 5000, autoRechargeEnabled: false, autoRechargePackage: null },
        enterpriseCredits: {
          contractNumber: "ENT-0001",
          status: "paused",
          balance: 0,
          monthlyAllowance: 0,
        },
      }),
    );
    await openBilling();
    const body = screen.getByRole("tabpanel");
    expect(body).toHaveTextContent("Unlimited groups");
    expect(body).not.toHaveTextContent("Renews");
    expect(body).not.toHaveTextContent("GB storage");
    expect(body).toHaveTextContent("Auto-recharge off");
    expect(body).not.toHaveTextContent("running low");
    expect(body).toHaveTextContent("paused");
  });

  it("leaves out the enterprise block for an account without credits", async () => {
    billingIs(summary({ enterpriseCredits: null }));
    await openBilling();
    expect(screen.queryByText("Enterprise Message Credits")).not.toBeInTheDocument();
  });

  it("offers the paid plans to move to, but not the one already held", async () => {
    await openBilling();
    expect(screen.getByRole("button", { name: "Premium (Current)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Business/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Free/ })).not.toBeInTheDocument();

    click("Enterprise: Customize Plan");
    expect(push).toHaveBeenCalledWith("/enterprise/builder/");
  });

  it("starts a plan checkout and hands the page to Stripe", async () => {
    const checkout = deferred<Awaited<ReturnType<typeof createPlanCheckoutSession>>>();
    vi.mocked(createPlanCheckoutSession).mockReturnValue(checkout.promise);
    await openBilling();

    click(/^Business/);
    expect(createPlanCheckoutSession).toHaveBeenCalledWith(
      "business",
      "https://loopdn.com/billing/success/?flow=plan&plan=business",
      "https://loopdn.com/billing/cancel/?flow=plan&plan=business",
    );
    expect(screen.getByRole("button", { name: /^Business/ })).toBeDisabled();

    await act(async () =>
      checkout.resolve({ ok: true, data: { checkoutUrl: "https://stripe/c/1" } }),
    );
    expect(platform.openExternal).toHaveBeenCalledWith("https://stripe/c/1");
    expect(screen.getByRole("button", { name: /^Business/ })).toBeEnabled();
  });

  it("says why a plan checkout could not start", async () => {
    vi.mocked(createPlanCheckoutSession).mockResolvedValue({
      ok: false,
      message: "Card required.",
    });
    await openBilling();
    click(/^Business/);
    expect(await screen.findByText("Card required.")).toBeInTheDocument();
    expect(platform.openExternal).not.toHaveBeenCalled();
  });

  it("buys the selected credit package", async () => {
    vi.mocked(createCreditCheckoutSession).mockResolvedValue({
      ok: true,
      data: { checkoutUrl: "https://stripe/c/2" },
    });
    await openBilling();
    expect(screen.getByRole("button", { name: "Buy $5.00" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Credit package"), { target: { value: "2" } });
    click("Buy $20.00");
    await waitFor(() =>
      expect(platform.openExternal).toHaveBeenCalledWith("https://stripe/c/2"),
    );
    expect(createCreditCheckoutSession).toHaveBeenCalledWith(
      "2",
      "https://loopdn.com/billing/success/?flow=credits&package=2",
      "https://loopdn.com/billing/cancel/?flow=credits&package=2",
    );
  });

  it("tops up straight from the wallet card, and reports a refusal", async () => {
    const checkout =
      deferred<Awaited<ReturnType<typeof createCreditCheckoutSession>>>();
    vi.mocked(createCreditCheckoutSession).mockReturnValue(checkout.promise);
    await openBilling();

    fireEvent.click(screen.getAllByRole("button", { name: "Top up" })[1]);
    expect(createCreditCheckoutSession).toHaveBeenCalledWith(
      "2",
      expect.any(String),
      expect.any(String),
    );
    expect(screen.getAllByRole("button", { name: "Redirecting..." })).toHaveLength(3);

    await act(async () => checkout.resolve({ ok: false, message: "Wallet is frozen." }));
    expect(screen.getByText("Wallet is frozen.")).toBeInTheDocument();
    expect(platform.openExternal).not.toHaveBeenCalled();
  });

  it("has nothing to buy when no package is on sale", async () => {
    vi.mocked(fetchCreditPackages).mockResolvedValue({ ok: true, data: [] });
    await openBilling();
    expect(screen.getByRole("button", { name: "Buy credits" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Top up" })).not.toBeInTheDocument();
  });

  it("reports whichever of the three loads failed", async () => {
    vi.mocked(fetchBillingSummary).mockResolvedValue({ ok: false, message: "No summary." });
    const first = await openBilling();
    expect(screen.getByText("No summary.")).toBeInTheDocument();
    expect(screen.queryByText("Current Plan")).not.toBeInTheDocument();
    first.unmount();

    billingIs();
    vi.mocked(fetchBillingPlans).mockResolvedValue({ ok: false, message: "No plans." });
    const second = await openBilling();
    expect(screen.getByText("No plans.")).toBeInTheDocument();
    second.unmount();

    billingIs();
    vi.mocked(fetchCreditPackages).mockResolvedValue({
      ok: false,
      message: "No packages.",
    });
    await openBilling();
    expect(screen.getByText("No packages.")).toBeInTheDocument();
  });

  it("ignores billing that arrives after the tab has been left", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchBillingSummary>>>();
    vi.mocked(fetchBillingSummary).mockReturnValue(pending.promise);
    render(<UserSettingsPanel profile={PROFILE} initialTab="billing" />);
    tab("Profile");
    await act(async () => pending.resolve({ ok: true, data: summary() }));
    expect(screen.queryByText("Current Plan")).not.toBeInTheDocument();
  });
});

describe("UserSettingsModal", () => {
  it("is the settings panel in a dialog, without the profile tab", () => {
    const onClose = vi.fn();
    render(<UserSettingsModal isOpen onClose={onClose} profile={PROFILE} />);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(
      within(dialog)
        .getAllByRole("tab")
        .map((item) => item.textContent),
    ).toEqual([
      "Security",
      "Appearance",
      "Messaging",
      "Notifications",
      "Privacy",
      "Billing",
      "Transactions",
      "Account",
    ]);
    expect(SETTINGS_MODAL_TABS).not.toContain("profile");
    expect(within(dialog).getByRole("heading", { name: "Security" })).toBeInTheDocument();

    click("Close settings");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(<UserSettingsModal isOpen={false} onClose={() => {}} profile={PROFILE} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("useUserSettingsProps", () => {
  it("fills the browser's copy from the account on arrival", async () => {
    vi.mocked(fetchAccountSettings).mockResolvedValue({
      ok: true,
      settings: {
        messaging: { enterToSend: false, emailEnabled: false },
        notifications: { sound: "none" },
        privacy: { groupAdds: "nobody" },
      },
    });
    const { result } = renderHook(() => useUserSettingsProps());

    await waitFor(() => expect(result.current.notificationPreferences?.sound).toBe("none"));
    expect(result.current.privacyPreferences?.groupAdds).toBe("nobody");
    expect(result.current.messagingPreferences?.enterToSend).toBe(false);

    const update = setUserProfile.mock.calls[0][0] as (p: UserProfile) => UserProfile;
    expect(update(PROFILE)).toEqual({ ...PROFILE, emailEnabled: false });
  });

  it("takes the email setting from the profile, on unless it says otherwise", () => {
    userProfile = { ...PROFILE, emailEnabled: undefined };
    const first = renderHook(() => useUserSettingsProps());
    expect(first.result.current.messagingPreferences?.emailEnabled).toBe(true);
    expect(first.result.current.profile).toBe(userProfile);

    userProfile = { ...PROFILE, emailEnabled: false };
    const second = renderHook(() => useUserSettingsProps());
    expect(second.result.current.messagingPreferences?.emailEnabled).toBe(false);
  });

  it("saves the profile and keeps what the server sent back", async () => {
    const saved = { ok: true as const, displayName: "Sam W", bio: "Hello." };
    vi.mocked(updateUserProfile).mockResolvedValue(saved);
    const { result } = renderHook(() => useUserSettingsProps());

    await act(() => result.current.onSaveProfile!({ ...PROFILE, displayName: "Sam W" }));
    expect(updateUserProfile).toHaveBeenCalledWith({ ...PROFILE, displayName: "Sam W" });
    expect(setUserProfile).toHaveBeenCalledWith(saved);

    vi.mocked(updateUserProfile).mockResolvedValue({ ok: false, message: "Too long." });
    await expect(result.current.onSaveProfile!(PROFILE)).rejects.toThrow("Too long.");
  });

  it("saves each screen to the account and mirrors the answer locally", async () => {
    const { result } = renderHook(() => useUserSettingsProps());

    vi.mocked(saveAccountSettings).mockResolvedValue({
      ok: true,
      values: { enterToSend: false, emailEnabled: false },
    });
    await act(() => result.current.onSaveMessaging!({ enterToSend: false }));
    expect(saveAccountSettings).toHaveBeenLastCalledWith("messaging", {
      enterToSend: false,
    });
    expect(result.current.messagingPreferences?.enterToSend).toBe(false);
    expect(setUserProfile).toHaveBeenCalledTimes(1);

    // An answer that does not mention email leaves the profile alone.
    vi.mocked(saveAccountSettings).mockResolvedValue({
      ok: true,
      values: { linkPreviews: false },
    });
    await act(() => result.current.onSaveMessaging!({ linkPreviews: false }));
    expect(setUserProfile).toHaveBeenCalledTimes(1);

    vi.mocked(saveAccountSettings).mockResolvedValue({
      ok: true,
      values: { missedCalls: false },
    });
    await act(() => result.current.onSaveNotifications!({ missedCalls: false }));
    expect(result.current.notificationPreferences?.missedCalls).toBe(false);

    vi.mocked(saveAccountSettings).mockResolvedValue({
      ok: true,
      values: { readReceipts: false },
    });
    await act(() => result.current.onSavePrivacy!({ readReceipts: false }));
    expect(saveAccountSettings).toHaveBeenLastCalledWith("privacy", {
      readReceipts: false,
    });
    expect(result.current.privacyPreferences?.readReceipts).toBe(false);
  });

  it("throws the server's reason so the row can put itself back", async () => {
    vi.mocked(saveAccountSettings).mockResolvedValue({ ok: false, message: "Refused." });
    const { result } = renderHook(() => useUserSettingsProps());
    await expect(result.current.onSaveMessaging!({})).rejects.toThrow("Refused.");
    await expect(result.current.onSaveNotifications!({})).rejects.toThrow("Refused.");
    await expect(result.current.onSavePrivacy!({})).rejects.toThrow("Refused.");
  });

  it("ignores account settings that arrive after unmount", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchAccountSettings>>>();
    vi.mocked(fetchAccountSettings).mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useUserSettingsProps());
    unmount();
    await act(async () =>
      pending.resolve({
        ok: true,
        settings: { messaging: { emailEnabled: false }, notifications: {}, privacy: {} },
      }),
    );
    expect(setUserProfile).not.toHaveBeenCalled();
  });
});

describe("SettingsPage", () => {
  it("opens on the profile, and keeps the address in step with the tab", () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    render(<SettingsPage />);
    expect(screen.getByLabelText("Display Name")).toHaveValue("Sam Wren");

    tab("Privacy");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/#privacy");

    click("Open navigation");
    expect(openNavDrawer).toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("opens on the tab named in the address, and follows a change to it", () => {
    const location = stubLocation("https://loopdn.com/settings/#account");
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();

    location.hash = "#appearance";
    act(() => {
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();

    location.hash = "#nonsense";
    act(() => {
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
  });
});
