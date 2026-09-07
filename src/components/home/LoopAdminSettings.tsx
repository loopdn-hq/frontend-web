"use client";

import { useState } from "react";
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
        <h2 className="text-2xl font-bold text-slate-900">Loop Settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Customize how {loopName} works
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Only admins can edit these settings. You&apos;re viewing them in
          read-only mode.
        </div>
      )}

      {/* Messages */}
      {saveError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* Communication Mode */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Communication Mode
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          How do members communicate in this Loop?
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="mode"
              value="chat"
              checked={settings.mode === "chat"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mode: e.target.value as GroupSettings["mode"],
                })
              }
              disabled={isSaving || isLoading || !canEdit}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Chat Group</p>
              <p className="text-xs text-slate-600">
                Members communicate with everyone
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="mode"
              value="broadcast"
              checked={settings.mode === "broadcast"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mode: e.target.value as GroupSettings["mode"],
                })
              }
              disabled={isSaving || isLoading || !canEdit}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Broadcast Group</p>
              <p className="text-xs text-slate-600">
                Admins send announcements to members
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Join Mode */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Who Can Join
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          How can new members join this Loop?
        </p>

        <div className="space-y-3">
          {(
            [
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
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50"
            >
              <input
                type="radio"
                name="join_mode"
                value={option.value}
                checked={settings.join_mode === option.value}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    join_mode: e.target.value as GroupSettings["join_mode"],
                  })
                }
                disabled={isSaving || isLoading || !canEdit}
                className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
              />
              <div>
                <p className="font-medium text-slate-900">{option.label}</p>
                <p className="text-xs text-slate-600">{option.description}</p>
              </div>
            </label>
          ))}
        </div>

        {settings.join_mode === "code" && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-900">
              Join Code
            </p>
            {joinCode ? (
              <p className="rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-widest text-slate-900">
                {joinCode}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleShowJoinCode}
                disabled={isLoadingJoinCode || !onFetchJoinCode}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingJoinCode ? "Loading..." : "Show Join Code"}
              </button>
            )}
            {joinCodeError && (
              <p className="mt-2 text-xs text-rose-600">{joinCodeError}</p>
            )}
          </div>
        )}
      </section>

      {/* Member Permissions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Member Permissions
        </h3>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-slate-600">
              Who can add new members?
            </p>
            <div className="space-y-2">
              {(["members", "admins"] as const).map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50"
                >
                  <input
                    type="radio"
                    name="add_member_permission"
                    value={option}
                    checked={settings.add_member_permission === option}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        add_member_permission: e.target
                          .value as GroupSettings["add_member_permission"],
                      })
                    }
                    disabled={isSaving || isLoading || !canEdit}
                    className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                  />
                  <p className="font-medium text-slate-900 capitalize">
                    {option}
                  </p>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-600">
              Who can edit group details?
            </p>
            <div className="space-y-2">
              {(["members", "admins"] as const).map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50"
                >
                  <input
                    type="radio"
                    name="edit_group_permission"
                    value={option}
                    checked={settings.edit_group_permission === option}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        edit_group_permission: e.target
                          .value as GroupSettings["edit_group_permission"],
                      })
                    }
                    disabled={isSaving || isLoading || !canEdit}
                    className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                  />
                  <p className="font-medium text-slate-900 capitalize">
                    {option}
                  </p>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Toggles */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Features</h3>

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
          <button
            type="button"
            disabled={isSaving || isLoading}
            className="flex-1 rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
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
    <div className="flex items-start justify-between rounded-lg border border-slate-200 p-4 hover:border-sky-300 hover:bg-sky-50">
      <div>
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
