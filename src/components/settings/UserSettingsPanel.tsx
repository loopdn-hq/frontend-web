"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CreditCard,
  KeyRound,
  Lock,
  MessageSquare,
  Palette,
  User,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { AvatarPicker } from "./AvatarPicker";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import { MessagingSection } from "./MessagingSection";
import {
  defaultNotificationPreferences,
  NotificationsSection,
  type NotificationPreferences,
} from "./NotificationsSection";
import {
  defaultPrivacyPreferences,
  PrivacySection,
  type PrivacyPreferences,
} from "./PrivacySection";
import { SecuritySection } from "./SecuritySection";
import {
  defaultMessagingPreferences,
  type MessagingPreferences,
} from "@/lib/user/messagingPreferences";
import {
  createCreditCheckoutSession,
  createPlanCheckoutSession,
  fetchBillingPlans,
  fetchBillingSummary,
  fetchCreditPackages,
  type BillingPlan,
  type BillingSummary,
  type CreditPackage,
} from "@/lib/billing";
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";

export type SettingsTab =
  | "profile"
  | "security"
  | "appearance"
  | "messaging"
  | "notifications"
  | "privacy"
  | "billing"
  | "account";

/**
 * Every section, in order, with the label and glyph it is shown by.
 *
 * One list, because there are now two navigations onto the same sections - the
 * page's row of tabs and the dialog's sidebar - and a second list is a second
 * chance for them to disagree about what a section is called.
 */
const TAB_META: { value: SettingsTab; label: string; icon: LucideIcon }[] = [
  { value: "profile", label: "Profile", icon: User },
  { value: "security", label: "Security", icon: KeyRound },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "messaging", label: "Messaging", icon: MessageSquare },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "privacy", label: "Privacy", icon: Lock },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "account", label: "Account", icon: UserCog },
];

const SETTINGS_TABS: SettingsTab[] = TAB_META.map((tab) => tab.value);

export function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as string[]).includes(value);
}

/**
 * A link that opens Settings on one particular tab - `/settings/#billing`.
 *
 * The hash rather than a query string: this is a static export, so
 * `useSearchParams` would force the page behind a Suspense boundary for a
 * value that is only ever read in the browser. The hash needs neither.
 *
 * Exported so nothing else has to spell the fragment itself. "Upgrade plan"
 * in the nav rail has to arrive at Billing, and a caller writing the string
 * by hand is a caller that keeps working after a tab is renamed while quietly
 * landing on Profile.
 */
export function settingsHref(tab?: SettingsTab): string {
  return tab ? `/settings/#${tab}` : "/settings/";
}

export type UserProfile = {
  displayName: string;
  /** Read-only: the API refuses changes, see EditProfileModal. */
  username?: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  // Account-wide group email; mirrors MessagingSettings.email_enabled on the backend.
  emailEnabled?: boolean;
  bio?: string;
  avatarUrl?: string;
};

/**
 * A profile as edited, which is the stored profile plus a file that is not
 * part of it. The avatar is only ever in flight - once saved it comes back as
 * `avatarUrl` - so it rides along here rather than living on UserProfile,
 * where every reader would have to know to ignore it.
 */
export type ProfileEdit = UserProfile & { avatarFile?: File | null };

export type UserSettingsPanelProps = {
  profile: UserProfile;
  /** Which tab to open on. Defaults to Profile. */
  initialTab?: SettingsTab;
  onSaveProfile?: (profile: ProfileEdit) => Promise<void> | void;
  messagingPreferences?: MessagingPreferences;
  /** Receives only the keys that changed. */
  onSaveMessaging?: (
    change: Partial<MessagingPreferences>,
  ) => Promise<void> | void;
  notificationPreferences?: NotificationPreferences;
  /** Receives only the keys that changed. */
  onSaveNotifications?: (
    change: Partial<NotificationPreferences>,
  ) => Promise<void> | void;
  privacyPreferences?: PrivacyPreferences;
  /** Receives only the keys that changed. */
  onSavePrivacy?: (change: Partial<PrivacyPreferences>) => Promise<void> | void;
  /**
   * The tab the user just picked.
   *
   * The panel does NOT touch the URL itself. It used to, and that was wrong
   * the moment it gained a second host: rendered as a dialog over /chats/,
   * switching to Appearance rewrote the address bar to /settings/, so Back
   * left the conversation and a reload landed somewhere else entirely. Only
   * the host knows whether it IS the page - see the /settings/ route.
   */
  onTabChange?: (tab: SettingsTab) => void;
  /**
   * The panel's own "Settings" heading. Off for a host that already has one,
   * so a dialog does not show its title twice.
   */
  showHeading?: boolean;
  /**
   * Which sections to offer, in this order. Defaults to all of them.
   *
   * The dialog leaves Profile out, because editing a profile has a dialog of
   * its own now and two doors onto one form is how they come to disagree.
   */
  tabs?: SettingsTab[];
  /**
   * How to navigate between sections. A row of tabs suits a full page; a
   * sidebar suits a dialog, where the sections are the width the content is
   * not using anyway.
   */
  layout?: "tabs" | "sidebar";
  // The modal caps the tab body and scrolls it inside the dialog; the /settings
  // page lets the page itself scroll instead.
  bodyClassName?: string;
};

/**
 * The settings UI itself, with no chrome of its own.
 *
 * Rendered both by UserSettingsModal (wrapped in a dialog overlay) and by the
 * /settings route (as a plain page), so the two can never drift apart.
 */
export function UserSettingsPanel({
  profile,
  initialTab = "profile",
  onSaveProfile,
  messagingPreferences = defaultMessagingPreferences,
  onSaveMessaging,
  notificationPreferences = defaultNotificationPreferences,
  onSaveNotifications,
  privacyPreferences = defaultPrivacyPreferences,
  onSavePrivacy,
  onTabChange,
  showHeading = true,
  tabs = SETTINGS_TABS,
  layout = "tabs",
  bodyClassName = "",
}: UserSettingsPanelProps) {
  const items = useMemo(
    () => TAB_META.filter((tab) => tabs.includes(tab.value)),
    [tabs],
  );

  // Clamped to what is actually on offer. A host can ask for a section it did
  // not include - a stale `/settings/#profile` link, or "Upgrade plan" against
  // a tab list without Billing - and landing on a section with no way back to
  // it is worse than landing on the first one.
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    items.some((tab) => tab.value === initialTab)
      ? initialTab
      : (items[0]?.value ?? "profile"),
  );

  function showTab(tab: SettingsTab) {
    setActiveTab(tab);
    onTabChange?.(tab);
  }

  return (
    <div className="p-6">
      {showHeading && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your profile, appearance, and preferences
          </p>
        </div>
      )}

      {layout === "tabs" && (
        <Tabs<SettingsTab>
          value={activeTab}
          onChange={showTab}
          className="mb-6"
          items={items.map(({ value, label }) => ({ value, label }))}
        />
      )}

      <div className={layout === "sidebar" ? "flex gap-6" : undefined}>
        {layout === "sidebar" && (
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Settings sections"
            className="w-48 shrink-0 space-y-1"
          >
            {items.map(({ value, label, icon: Icon }) => {
              const active = value === activeTab;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => showTab(value)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    active
                      ? "bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div
          role="tabpanel"
          className={`min-w-0 flex-1 ${layout === "tabs" ? "mb-6 " : ""}${bodyClassName}`}
        >
          {activeTab === "profile" && (
            <ProfileSettings profile={profile} onSave={onSaveProfile} />
          )}
          {activeTab === "security" && <SecuritySection profile={profile} />}
          {activeTab === "appearance" && <AppearanceSection />}
          {activeTab === "messaging" && (
            <MessagingSection
              preferences={messagingPreferences}
              onSave={onSaveMessaging}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsSection
              preferences={notificationPreferences}
              onSave={onSaveNotifications}
            />
          )}
          {activeTab === "privacy" && (
            <PrivacySection
              preferences={privacyPreferences}
              onSave={onSavePrivacy}
            />
          )}
          {activeTab === "billing" && <BillingSettings />}
          {activeTab === "account" && (
            <AccountSection profile={profile} onSaveProfile={onSaveProfile} />
          )}
        </div>
      </div>
    </div>
  );
}

function BillingSettings() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "plan" | "credits" | "portal" | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchBillingSummary(),
      fetchBillingPlans(),
      fetchCreditPackages(),
    ])
      .then(([summaryResult, plansResult, creditsResult]) => {
        if (cancelled) return;

        if (!summaryResult.ok) {
          setError(summaryResult.message);
          return;
        }
        if (!plansResult.ok) {
          setError(plansResult.message);
          return;
        }
        if (!creditsResult.ok) {
          setError(creditsResult.message);
          return;
        }

        setSummary(summaryResult.data);
        setPlans(plansResult.data);
        setCreditPackages(creditsResult.data);
        setSelectedPackageId(creditsResult.data[0]?.id ?? "");
        setError("");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activePlan = useMemo(() => {
    return summary?.subscription.plan ?? null;
  }, [summary]);

  const activePlanCode = activePlan?.code.toLowerCase() ?? "";

  const upgradablePlans = useMemo(
    () =>
      plans
        .filter((plan) => {
          const code = plan.code.toLowerCase();
          return code !== "free" && code !== "enterprise";
        })
        .sort(
          (a, b) => (a.monthlyPriceCents ?? 0) - (b.monthlyPriceCents ?? 0),
        ),
    [plans],
  );

  const selectedPackage = useMemo(
    () => creditPackages.find((item) => item.id === selectedPackageId) ?? null,
    [creditPackages, selectedPackageId],
  );

  const walletBalanceCents = summary?.wallet.balanceCents ?? 0;
  const isLowWalletBalance = walletBalanceCents > 0 && walletBalanceCents < 500;

  async function redirectTo(url: string) {
    window.location.assign(url);
  }

  async function handleUpgrade(planCode: string) {
    setBusyAction("plan");
    setError("");
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/billing/success/?flow=plan&plan=${encodeURIComponent(planCode)}`;
      const cancelUrl = `${origin}/billing/cancel/?flow=plan&plan=${encodeURIComponent(planCode)}`;
      const result = await createPlanCheckoutSession(
        planCode,
        successUrl,
        cancelUrl,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await redirectTo(result.data.checkoutUrl);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBuyCredits() {
    if (!selectedPackage) return;
    await handleBuyCreditPackage(selectedPackage);
  }

  async function handleBuyCreditPackage(creditPackage: CreditPackage) {
    setBusyAction("credits");
    setError("");
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/billing/success/?flow=credits&package=${encodeURIComponent(creditPackage.id)}`;
      const cancelUrl = `${origin}/billing/cancel/?flow=credits&package=${encodeURIComponent(creditPackage.id)}`;
      const result = await createCreditCheckoutSession(
        creditPackage.id,
        successUrl,
        cancelUrl,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await redirectTo(result.data.checkoutUrl);
    } finally {
      setBusyAction(null);
    }
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  }

  return (
    <div className="space-y-5">
      {isLoading && (
        <p className="text-sm text-slate-500">Loading billing...</p>
      )}

      {error && (
        <Alert variant="error" className="text-xs">
          {error}
        </Alert>
      )}

      {summary && activePlan && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current Plan
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {activePlan.name}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Status: {summary.subscription.status}
            {summary.subscription.currentPeriodEnd
              ? ` · Renews ${new Date(summary.subscription.currentPeriodEnd).toLocaleDateString()}`
              : ""}
            {summary.subscription.cancelAtPeriodEnd
              ? " · Cancels at period end"
              : ""}
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Limits: {activePlan.maxGroups ?? "Unlimited"} groups, up to{" "}
            {activePlan.maxMembersPerGroup ?? "Unlimited"} members per group
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Wallet balance: {formatCurrency(summary.wallet.balanceCents)}
          </p>
          {summary.wallet.autoRechargeEnabled && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Auto-recharge enabled
              {summary.wallet.autoRechargePackage
                ? ` (${summary.wallet.autoRechargePackage})`
                : ""}
            </p>
          )}
          {activePlan.features.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-400">
              {activePlan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Communication Wallet
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(walletBalanceCents)}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Used for SMS and voice pay-as-you-go usage.
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-2xs font-semibold ${
                  summary.wallet.autoRechargeEnabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {summary.wallet.autoRechargeEnabled
                  ? "Auto-recharge on"
                  : "Auto-recharge off"}
              </span>
              {summary.wallet.autoRechargePackage && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Package: {summary.wallet.autoRechargePackage}
                </p>
              )}
            </div>
          </div>

          {isLowWalletBalance && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Your wallet balance is running low. Top up to avoid interruptions.
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creditPackages.slice(0, 3).map((pkg) => (
              <div
                key={`wallet-quick-${pkg.id}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {pkg.name}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {formatCurrency(pkg.priceCents)} top-up
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => handleBuyCreditPackage(pkg)}
                  disabled={busyAction !== null}
                >
                  {busyAction === "credits" ? "Redirecting..." : "Top up"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          Upgrade plan
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Choose from available paid plans to unlock higher limits.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {upgradablePlans.map((plan) => (
            <Button
              key={plan.id}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleUpgrade(plan.code)}
              disabled={
                busyAction !== null ||
                activePlanCode === plan.code.toLowerCase()
              }
            >
              {activePlanCode === plan.code.toLowerCase()
                ? `${plan.name} (Current)`
                : `${plan.name} ${
                    plan.monthlyPriceCents !== null
                      ? `- ${formatCurrency(plan.monthlyPriceCents)}/mo`
                      : ""
                  }`}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          Buy communication credits
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Top up your wallet for pay-as-you-go messaging.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Credit package" htmlFor="credit-package">
            <Select
              id="credit-package"
              value={selectedPackageId}
              onChange={(event) => setSelectedPackageId(event.target.value)}
              options={creditPackages.map((pkg) => ({
                value: pkg.id,
                label: `${pkg.name} - ${formatCurrency(pkg.priceCents)}`,
              }))}
            />
          </Field>
          <Button
            type="button"
            onClick={handleBuyCredits}
            disabled={busyAction !== null || !selectedPackage}
          >
            {busyAction === "credits"
              ? "Redirecting..."
              : `Buy ${
                  selectedPackage
                    ? formatCurrency(selectedPackage.priceCents)
                    : "credits"
                }`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileSettings({
  profile,
  onSave,
}: {
  profile: UserProfile;
  onSave?: (profile: ProfileEdit) => Promise<void> | void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    setError(null);
    try {
      await onSave?.({ ...profile, displayName, bio, avatarFile });
      // Cleared so the picker stops offering to upload what is already
      // uploaded, and falls back to the URL the server just returned.
      setAvatarFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      // onSaveProfile throws now. Without this the rejection went unhandled
      // and the form said nothing at all about a save that did not happen.
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save that. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <AvatarPicker
          name={displayName || profile.username || "?"}
          currentUrl={profile.avatarUrl}
          file={avatarFile}
          onPick={(picked) => {
            setError(null);
            setAvatarFile(picked);
          }}
          onReject={setError}
          size={64}
          disabled={isSaving}
        />
        <div>
          <p className="font-semibold">{displayName || "Your name"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            JPG or PNG, up to 5MB
          </p>
        </div>
      </div>

      <Field label="Display Name" htmlFor="settings-display-name">
        <Input
          id="settings-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-lg px-3 py-2"
        />
      </Field>

      <Field label="Bio" htmlFor="settings-bio">
        <Textarea
          id="settings-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="rounded-lg px-3 py-2"
          rows={4}
        />
      </Field>

      <Field
        label={`Email ${profile.emailVerified ? "(Verified)" : ""}`}
        htmlFor="settings-email"
      >
        <Input
          id="settings-email"
          type="email"
          value={profile.email || ""}
          placeholder="you@example.com"
          disabled
          className="rounded-lg px-3 py-2"
        />
      </Field>

      <Field
        label={`Phone ${profile.phoneVerified ? "(Verified)" : ""}`}
        htmlFor="settings-phone"
      >
        <Input
          id="settings-phone"
          type="tel"
          value={profile.phone || ""}
          placeholder="+1 (555) 123-4567"
          disabled
          readOnly
          className="rounded-lg px-3 py-2"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !displayName.trim()}
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
        {saved && (
          <p className="text-xs font-medium text-emerald-600">Saved ✓</p>
        )}
        {error && (
          <p
            className="text-xs font-medium text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
