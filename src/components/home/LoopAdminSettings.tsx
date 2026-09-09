"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, RadioGroup, Select } from "@/components/ui";
import type { GroupSettings } from "@/lib/chat/conversations";

type LoopAdminSettingsProps = {
  loopName: string;
  settings: GroupSettings;
  onSave?: (settings: Partial<GroupSettings>) => Promise<void>;
  onFetchJoinCode?: () => Promise<string>;
  canEdit?: boolean;
  isLoading?: boolean;
};

export function LoopAdminSettings({
  loopName,
  settings: initialSettings,
  onSave,
  onFetchJoinCode,
  canEdit = true,
  isLoading = false,
}: LoopAdminSettingsProps) {
  const [settings, setSettings] = useState<GroupSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [isLoadingJoinCode, setIsLoadingJoinCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string>("");

  async function handleShowJoinCode() {
    if (!onFetchJoinCode) return;

    setIsLoadingJoinCode(true);
    setJoinCodeError("");
    try {
      setJoinCode(await onFetchJoinCode());
    } catch (err) {
      setJoinCodeError(
        err instanceof Error ? err.message : "Failed to load join code",
      );
    } finally {
      setIsLoadingJoinCode(false);
    }
  }

  async function handleSave() {
    if (!onSave) return;

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await onSave(settings);
      setSuccessMessage("Settings saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Loop Settings
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Customize how {loopName} works
        </p>
      </div>

      {!canEdit && (
        <Alert
          variant="neutral"
          className="border border-slate-200 px-4 py-3 dark:border-slate-700"
        >
          Only admins can edit these settings. You&apos;re viewing them in
          read-only mode.
        </Alert>
      )}

      {/* Messages */}
      {saveError && (
        <Alert variant="error" className="border border-rose-200 px-4 py-3">
          {saveError}
        </Alert>
      )}
      {successMessage && (
        <Alert
          variant="success"
          className="border border-emerald-200 px-4 py-3 dark:border-emerald-900/40"
        >
          {successMessage}
        </Alert>
      )}

      {/* Communication Mode */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Communication Mode
        </h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          How do members communicate in this Loop?
        </p>

        <RadioGroup
          name="mode"
          value={settings.mode}
          onChange={(value) =>
            setSettings({
              ...settings,
              mode: value,
            })
          }
          disabled={isSaving || isLoading || !canEdit}
          options={[
            {
              value: "chat",
              label: "Chat Group",
              description: "Members communicate with everyone",
            },
            {
              value: "broadcast",
              label: "Broadcast Group",
              description: "Admins send announcements to members",
            },
          ]}
        />
      </section>

      {/* Join Mode */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Who Can Join
        </h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          How can new members join this Loop?
        </p>

        <RadioGroup
          name="join_mode"
          value={settings.join_mode}
          onChange={(value) =>
            setSettings({
              ...settings,
              join_mode: value,
            })
          }
          disabled={isSaving || isLoading || !canEdit}
          options={[
            {
              value: "open",
              label: "Open",
              description: "Anyone with the link can join",
            },
            {
              value: "code",
              label: "Code Required",
              description: "Members need a code to join",
            },
            {
              value: "approval",
              label: "Admin Approval",
              description: "Members request access; admin approves",
            },
            {
              value: "invite",
              label: "Invite Only",
              description: "Only invited members can join",
            },
          ]}
        />

        {settings.join_mode === "code" && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Join Code
            </p>
            {joinCode ? (
              <p className="rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-widest text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                {joinCode}
              </p>
            ) : (
              <Button
                type="button"
                onClick={handleShowJoinCode}
                disabled={isLoadingJoinCode || !onFetchJoinCode}
                size="sm"
              >
                {isLoadingJoinCode ? "Loading..." : "Show Join Code"}
              </Button>
            )}
            {joinCodeError && (
              <p className="mt-2 text-xs text-rose-600">{joinCodeError}</p>
            )}
          </div>
        )}
      </section>

      {/* Member Permissions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Member Permissions
        </h3>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              Who can add new members?
            </p>
            <Select
              value={settings.add_member_permission}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  add_member_permission: event.target
                    .value as GroupSettings["add_member_permission"],
                })
              }
              disabled={isSaving || isLoading || !canEdit}
              options={[
                { value: "members", label: "Members" },
                { value: "admins", label: "Admins" },
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              Who can edit group details?
            </p>
            <Select
              value={settings.edit_group_permission}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  edit_group_permission: event.target
                    .value as GroupSettings["edit_group_permission"],
                })
              }
              disabled={isSaving || isLoading || !canEdit}
              options={[
                { value: "members", label: "Members" },
                { value: "admins", label: "Admins" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Feature Toggles */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Features
        </h3>

        <div className="space-y-4">
          <FeatureToggle
            label="SMS Delivery"
            description="Deliver messages to members via SMS"
            checked={settings.sms_delivery_enabled}
            onChange={(value) =>
              setSettings({ ...settings, sms_delivery_enabled: value })
            }
            disabled={isSaving || isLoading || !canEdit}
          />

          <FeatureToggle
            label="SMS Replies"
            description="Allow members to reply to messages via SMS"
            checked={settings.sms_replies_enabled}
            onChange={(value) =>
              setSettings({ ...settings, sms_replies_enabled: value })
            }
            disabled={isSaving || isLoading || !canEdit}
          />

          <FeatureToggle
            label="Voice Messages"
            description="Allow members to send voice notes and recordings"
            checked={settings.voice_messages_enabled}
            onChange={(value) =>
              setSettings({ ...settings, voice_messages_enabled: value })
            }
            disabled={isSaving || isLoading || !canEdit}
          />
        </div>
      </section>

      {/* Save Button */}
      {canEdit && (
        <div className="flex gap-3">
          <Button
            type="button"
            disabled={isSaving || isLoading}
            fullWidth
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

function FeatureToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
      label={label}
      description={description}
      containerClassName="items-start"
    />
  );
}
