"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme, type ThemePreference } from "@/lib/theme/ThemeProvider";
import { changePassword, type FieldErrors } from "@/lib/auth/client";
import { changePasswordSchema } from "@/lib/validation/auth";
import {
  createBillingPortalLink,
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
  Checkbox,
  Field,
  Input,
  RadioGroup,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";

type SettingsTab =
  | "profile"
  | "security"
  | "appearance"
  | "notifications"
  | "privacy"
  | "billing";

export type UserProfile = {
  displayName: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  bio?: string;
  avatarUrl?: string;
};

export type NotificationPreferences = {
  messageAlerts: boolean;
  emailDigest: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  messageAlerts: true,
  emailDigest: false,
  soundEnabled: true,
  desktopNotifications: true,
};

export type UserSettingsPanelProps = {
  profile: UserProfile;
  onSaveProfile?: (profile: UserProfile) => Promise<void> | void;
  notificationPreferences?: NotificationPreferences;
  onSaveNotifications?: (
    prefs: NotificationPreferences,
  ) => Promise<void> | void;
  onLogout?: () => void;
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
  onSaveProfile,
  notificationPreferences = defaultNotificationPreferences,
  onSaveNotifications,
  onLogout,
  bodyClassName = "",
}: UserSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your profile, appearance, and preferences
        </p>
      </div>

      <Tabs<SettingsTab>
        value={activeTab}
        onChange={setActiveTab}
        className="mb-6"
        items={[
          { value: "profile", label: "Profile" },
          { value: "security", label: "Security" },
          { value: "appearance", label: "Appearance" },
          { value: "notifications", label: "Notifications" },
          { value: "privacy", label: "Privacy" },
          { value: "billing", label: "Billing" },
        ]}
      />

      <div className={`mb-6 ${bodyClassName}`}>
        {activeTab === "profile" && (
          <ProfileSettings profile={profile} onSave={onSaveProfile} />
        )}
        {activeTab === "security" && <ChangePasswordSettings />}
        {activeTab === "appearance" && <AppearanceSettings />}
        {activeTab === "notifications" && (
          <NotificationSettings
            preferences={notificationPreferences}
            onSave={onSaveNotifications}
          />
        )}
        {activeTab === "privacy" && <PrivacySettings onLogout={onLogout} />}
        {activeTab === "billing" && <BillingSettings />}
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

  const upgradablePlans = useMemo(
    () =>
      plans
        .filter((plan) =>
          ["premium", "business"].includes(plan.code.toLowerCase()),
        )
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

  async function handleOpenPortal() {
    setBusyAction("portal");
    setError("");
    try {
      const returnUrl = `${window.location.origin}/settings/`;
      const result = await createBillingPortalLink(returnUrl);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await redirectTo(result.data.portalUrl);
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
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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
          Move to Premium or Business to unlock higher limits.
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
                summary?.subscription.plan.code === plan.code
              }
            >
              {summary?.subscription.plan.code === plan.code
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
  onSave?: (profile: UserProfile) => Promise<void> | void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    try {
      await onSave?.({
        ...profile,
        displayName,
        bio,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] text-2xl font-bold text-white">
          {initial}
        </div>
        <div>
          <p className="font-semibold">{displayName || "Your name"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Avatar upload coming soon
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
      </div>
    </div>
  );
}

function ChangePasswordSettings() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");
    setFieldErrors({});
    setSaved(false);

    const parsed = changePasswordSchema.safeParse({ oldPassword, newPassword });
    if (!parsed.success) {
      const issues: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key =
          issue.path[0] === "oldPassword" ? "old_password" : "new_password";
        issues[key] = [...(issues[key] ?? []), issue.message];
      }
      setFieldErrors(issues);
      return;
    }

    setIsSaving(true);
    try {
      const result = await changePassword({ oldPassword, newPassword });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setGeneralError(result.message);
        return;
      }

      setOldPassword("");
      setNewPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  }

  const oldPasswordErrors = fieldErrors.old_password ?? [];
  const newPasswordErrors = fieldErrors.new_password ?? [];

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <Field label="Current Password" htmlFor="settings-current-password">
        <Input
          id="settings-current-password"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          autoComplete="current-password"
          disabled={isSaving}
          className="rounded-lg px-3 py-2"
        />
        {oldPasswordErrors.map((message) => (
          <p key={message} className="mt-1 text-xs text-rose-600">
            {message}
          </p>
        ))}
      </Field>

      <Field label="New Password" htmlFor="settings-new-password">
        <Input
          id="settings-new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          disabled={isSaving}
          className="rounded-lg px-3 py-2"
        />
        {newPasswordErrors.map((message) => (
          <p key={message} className="mt-1 text-xs text-rose-600">
            {message}
          </p>
        ))}
      </Field>

      {generalError && (
        <Alert variant="error" className="text-xs">
          {generalError}
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isSaving || !oldPassword || !newPassword}
        >
          {isSaving ? "Saving..." : "Change Password"}
        </Button>
        {saved && (
          <p className="text-xs font-medium text-emerald-600">
            Password changed ✓
          </p>
        )}
      </div>
    </form>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  const options: {
    id: ThemePreference;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      id: "light",
      label: "Light",
      description: "Bright background, dark text",
      icon: "☀️",
    },
    {
      id: "dark",
      label: "Dark",
      description: "Dark background, light text",
      icon: "🌙",
    },
    {
      id: "system",
      label: "System",
      description: "Match your device setting",
      icon: "🖥️",
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Theme
      </p>
      <RadioGroup
        name="theme-preference"
        value={theme}
        onChange={setTheme}
        orientation="horizontal"
        options={options.map((option) => ({
          value: option.id,
          label: `${option.icon} ${option.label}`,
          description: option.description,
        }))}
      />
    </div>
  );
}

function NotificationSettings({
  preferences,
  onSave,
}: {
  preferences: NotificationPreferences;
  onSave?: (prefs: NotificationPreferences) => Promise<void> | void;
}) {
  const [prefs, setPrefs] = useState(preferences);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle(
    key: keyof NotificationPreferences,
    value: boolean,
  ) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setIsSaving(true);
    try {
      await onSave?.(next);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <ToggleRow
        label="Message Alerts"
        description="Get notified when new messages arrive"
        checked={prefs.messageAlerts}
        onChange={(v) => handleToggle("messageAlerts", v)}
      />
      <ToggleRow
        label="Email Digest"
        description="Receive a daily summary of Loop activity by email"
        checked={prefs.emailDigest}
        onChange={(v) => handleToggle("emailDigest", v)}
      />
      <ToggleRow
        label="Sound"
        description="Play a sound for incoming messages"
        checked={prefs.soundEnabled}
        onChange={(v) => handleToggle("soundEnabled", v)}
      />
      <ToggleRow
        label="Desktop Notifications"
        description="Show browser notifications when the tab isn't focused"
        checked={prefs.desktopNotifications}
        onChange={(v) => handleToggle("desktopNotifications", v)}
      />
      {isSaving && <p className="text-xs text-slate-400">Saving...</p>}
    </div>
  );
}

function PrivacySettings({ onLogout }: { onLogout?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          Log Out
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Sign out of Loopdn on this device.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onLogout}
          className="mt-3"
        >
          Log Out
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          Data Export
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Request a copy of your account data. This will be available once the
          backend is connected.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled
          className="mt-3"
        >
          Request Export (coming soon)
        </Button>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
        <p className="font-medium text-rose-700 dark:text-rose-400">
          Delete Account
        </p>
        <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/70">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled
          className="mt-3"
        >
          Delete Account (coming soon)
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      label={label}
      description={description}
      containerClassName="items-start justify-between"
      className="mt-1"
    />
  );
}
