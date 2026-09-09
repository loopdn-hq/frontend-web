"use client";

import { useState } from "react";
import { useTheme, type ThemePreference } from "@/lib/theme/ThemeProvider";
import { changePassword, type FieldErrors } from "@/lib/auth/client";
import { changePasswordSchema } from "@/lib/validation/auth";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  RadioGroup,
  Tabs,
  Textarea,
} from "@/components/ui";

type SettingsTab =
  "profile" | "security" | "appearance" | "notifications" | "privacy";

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
