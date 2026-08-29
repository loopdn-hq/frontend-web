"use client";

import { useState } from "react";
import { LoopAdminSettings } from "./LoopAdminSettings";
import { MemberModeration } from "./MemberModeration";

type AdminTab = "settings" | "members";

type MemberRole = "admin" | "moderator" | "member";

type Member = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: MemberRole;
  joinedAt: string;
  isBlocked?: boolean;
  lastActive?: string;
};

type LoopSettings = {
  id: string;
  name: string;
  posting_permission: "everyone" | "admins" | "selected_roles";
  reply_permission: "group" | "admins_only" | "disabled";
  voice_enabled: boolean;
  media_enabled: boolean;
  reactions_enabled: boolean;
  member_invitation_permission: "everyone" | "admins_only" | "disabled";
  new_member_history_visibility: "full" | "from_join" | "none";
  plan_type: "sponsored_free" | "ad_free";
};

type LoopAdminPanelProps = {
  loopSettings: LoopSettings;
  members: Member[];
  onSaveSettings?: (settings: Partial<LoopSettings>) => Promise<void>;
  onUpdateMemberRole?: (memberId: string, newRole: MemberRole) => Promise<void>;
  onBlockMember?: (memberId: string) => Promise<void>;
  onUnblockMember?: (memberId: string) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  isLoading?: boolean;
};

export function LoopAdminPanel({
  loopSettings,
  members,
  onSaveSettings,
  onUpdateMemberRole,
  onBlockMember,
  onUnblockMember,
  onRemoveMember,
  isLoading = false,
}: LoopAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("settings");

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#e4f4ff_0%,#f8fbff_50%,#f3f8ff_100%)] p-3 sm:p-5">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{loopSettings.name} Admin Panel</h1>
          <p className="mt-2 text-slate-600">Manage your Loop's settings and members</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "settings"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            ⚙️ Loop Settings
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "members"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            👥 Members ({members.length})
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {activeTab === "settings" && (
            <LoopAdminSettings
              loopSettings={loopSettings}
              onSave={onSaveSettings}
              isLoading={isLoading}
            />
          )}

          {activeTab === "members" && (
            <MemberModeration
              loopName={loopSettings.name}
              members={members}
              onUpdateMemberRole={onUpdateMemberRole}
              onBlockMember={onBlockMember}
              onUnblockMember={onUnblockMember}
              onRemoveMember={onRemoveMember}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Tips</p>
          <ul className="mt-2 space-y-1 text-xs text-cyan-900">
            <li>• Changes to settings take effect immediately for all members</li>
            <li>• Admins can always see all messages regardless of posting permissions</li>
            <li>• Blocked members cannot access the Loop or view messages</li>
            <li>• All admin actions are logged for audit purposes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
