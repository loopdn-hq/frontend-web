"use client";

import { useState } from "react";

type PostingPermission = "everyone" | "admins" | "selected_roles";
type ReplyPermission = "group" | "admins_only" | "disabled";
type MemberInvitationPermission = "everyone" | "admins_only" | "disabled";
type HistoryVisibility = "full" | "from_join" | "none";
type PlanType = "sponsored_free" | "ad_free";

type LoopSettings = {
  id: string;
  name: string;
  posting_permission: PostingPermission;
  reply_permission: ReplyPermission;
  voice_enabled: boolean;
  media_enabled: boolean;
  reactions_enabled: boolean;
  member_invitation_permission: MemberInvitationPermission;
  new_member_history_visibility: HistoryVisibility;
  plan_type: PlanType;
};

type LoopAdminSettingsProps = {
  loopSettings: LoopSettings;
  onSave?: (settings: Partial<LoopSettings>) => Promise<void>;
  isLoading?: boolean;
};

export function LoopAdminSettings({
  loopSettings,
  onSave,
  isLoading = false,
}: LoopAdminSettingsProps) {
  const [settings, setSettings] = useState<Partial<LoopSettings>>(loopSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

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
          Customize how {loopSettings.name} works
        </p>
      </div>

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

      {/* Posting Permissions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Posting Permissions
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Who can post messages in this Loop?
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="posting_permission"
              value="everyone"
              checked={settings.posting_permission === "everyone"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  posting_permission: e.target.value as PostingPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Everyone</p>
              <p className="text-xs text-slate-600">All members can post</p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="posting_permission"
              value="admins"
              checked={settings.posting_permission === "admins"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  posting_permission: e.target.value as PostingPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Admins Only</p>
              <p className="text-xs text-slate-600">Only admins can post</p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="posting_permission"
              value="selected_roles"
              checked={settings.posting_permission === "selected_roles"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  posting_permission: e.target.value as PostingPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Selected Roles</p>
              <p className="text-xs text-slate-600">
                Admins, moderators, and selected roles
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Reply Permissions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Reply Permissions
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Where can members reply to posts?
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="reply_permission"
              value="group"
              checked={settings.reply_permission === "group"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reply_permission: e.target.value as ReplyPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Reply to Group</p>
              <p className="text-xs text-slate-600">Everyone sees replies</p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="reply_permission"
              value="admins_only"
              checked={settings.reply_permission === "admins_only"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reply_permission: e.target.value as ReplyPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Reply to Admins Only</p>
              <p className="text-xs text-slate-600">Only admins see replies</p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="reply_permission"
              value="disabled"
              checked={settings.reply_permission === "disabled"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reply_permission: e.target.value as ReplyPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Replies Disabled</p>
              <p className="text-xs text-slate-600">Announcements only</p>
            </div>
          </label>
        </div>
      </section>

      {/* Feature Toggles */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Features</h3>

        <div className="space-y-4">
          <FeatureToggle
            label="Voice Messages"
            description="Allow members to send voice notes and recordings"
            checked={settings.voice_enabled || false}
            onChange={(value) =>
              setSettings({ ...settings, voice_enabled: value })
            }
            disabled={isSaving || isLoading}
          />

          <FeatureToggle
            label="Media Sharing"
            description="Allow members to share photos, videos, and files"
            checked={settings.media_enabled || false}
            onChange={(value) =>
              setSettings({ ...settings, media_enabled: value })
            }
            disabled={isSaving || isLoading}
          />

          <FeatureToggle
            label="Reactions"
            description="Allow emoji and reaction responses to messages"
            checked={settings.reactions_enabled || false}
            onChange={(value) =>
              setSettings({ ...settings, reactions_enabled: value })
            }
            disabled={isSaving || isLoading}
          />
        </div>
      </section>

      {/* Member Permissions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Member Permissions
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Who can invite new members?
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="member_invitation_permission"
              value="everyone"
              checked={settings.member_invitation_permission === "everyone"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  member_invitation_permission: e.target
                    .value as MemberInvitationPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Everyone</p>
              <p className="text-xs text-slate-600">All members can invite</p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="member_invitation_permission"
              value="admins_only"
              checked={settings.member_invitation_permission === "admins_only"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  member_invitation_permission: e.target
                    .value as MemberInvitationPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Admins Only</p>
              <p className="text-xs text-slate-600">Only admins can invite</p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="member_invitation_permission"
              value="disabled"
              checked={settings.member_invitation_permission === "disabled"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  member_invitation_permission: e.target
                    .value as MemberInvitationPermission,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Disabled</p>
              <p className="text-xs text-slate-600">
                No one can invite (closed group)
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* New Member History */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          New Member History
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          What message history can new members see?
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="history_visibility"
              value="full"
              checked={settings.new_member_history_visibility === "full"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  new_member_history_visibility: e.target
                    .value as HistoryVisibility,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Full History</p>
              <p className="text-xs text-slate-600">
                New members see all previous messages
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="history_visibility"
              value="from_join"
              checked={settings.new_member_history_visibility === "from_join"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  new_member_history_visibility: e.target
                    .value as HistoryVisibility,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">From Join Date</p>
              <p className="text-xs text-slate-600">
                New members see messages only after they joined
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="history_visibility"
              value="none"
              checked={settings.new_member_history_visibility === "none"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  new_member_history_visibility: e.target
                    .value as HistoryVisibility,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">No History</p>
              <p className="text-xs text-slate-600">
                New members see no previous messages
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Plan Type */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Plan Type</h3>
        <p className="mb-4 text-sm text-slate-600">
          Choose how to support this Loop
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="plan_type"
              value="sponsored_free"
              checked={settings.plan_type === "sponsored_free"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  plan_type: e.target.value as PlanType,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">
                Sponsored/Free with Ads
              </p>
              <p className="text-xs text-slate-600">
                Members see occasional ads to support operations
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50">
            <input
              type="radio"
              name="plan_type"
              value="ad_free"
              checked={settings.plan_type === "ad_free"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  plan_type: e.target.value as PlanType,
                })
              }
              disabled={isSaving || isLoading}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <div>
              <p className="font-medium text-slate-900">Ad-Free Premium</p>
              <p className="text-xs text-slate-600">
                No ads, premium experience for members
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Save Button */}
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
