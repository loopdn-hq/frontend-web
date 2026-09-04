"use client";

import { useState } from "react";
import { LoopAdminSettings } from "./LoopAdminSettings";
import { MemberModeration } from "./MemberModeration";
import type { GroupSettings } from "@/lib/chat/conversations";

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

type PendingRequest = {
  id: string;
  name: string;
  username?: string;
  phone?: string;
};

type LoopAdminPanelProps = {
  loopName: string;
  settings: GroupSettings | null;
  isSettingsLoading?: boolean;
  canEditSettings?: boolean;
  members: Member[];
  pendingRequests?: PendingRequest[];
  isPendingRequestsLoading?: boolean;
  onApproveRequest?: (participantId: string) => Promise<void>;
  onDeclineRequest?: (participantId: string) => Promise<void>;
  onSaveSettings?: (settings: Partial<GroupSettings>) => Promise<void>;
  onFetchJoinCode?: () => Promise<string>;
  onUpdateMemberRole?: (memberId: string, newRole: MemberRole) => Promise<void>;
  onBlockMember?: (memberId: string) => Promise<void>;
  onUnblockMember?: (memberId: string) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  isLoading?: boolean;
};

export function LoopAdminPanel({
  loopName,
  settings,
  isSettingsLoading = false,
  canEditSettings = true,
  members,
  pendingRequests = [],
  isPendingRequestsLoading = false,
  onApproveRequest,
  onDeclineRequest,
  onSaveSettings,
  onFetchJoinCode,
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
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {loopName} Admin Panel
            </h1>
            <p className="mt-2 text-slate-600">
              Manage your Loop&apos;s settings and members
            </p>
          </div>
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
          {activeTab === "settings" &&
            (settings ? (
              <LoopAdminSettings
                loopName={loopName}
                settings={settings}
                onSave={onSaveSettings}
                onFetchJoinCode={onFetchJoinCode}
                canEdit={canEditSettings}
                isLoading={isLoading}
              />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                {isSettingsLoading
                  ? "Loading settings…"
                  : "Unable to load settings."}
              </p>
            ))}

          {activeTab === "members" && (
            <>
              {settings?.join_mode === "approval" && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-amber-900">
                    Pending Requests
                    {pendingRequests.length > 0 &&
                      ` (${pendingRequests.length})`}
                  </h3>
                  {isPendingRequestsLoading ? (
                    <p className="text-sm text-amber-800">Loading requests…</p>
                  ) : pendingRequests.length === 0 ? (
                    <p className="text-sm text-amber-800">
                      No pending join requests.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {pendingRequests.map((request) => (
                        <li
                          key={request.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {request.name}
                            </p>
                            {(request.username || request.phone) && (
                              <p className="text-xs text-slate-600">
                                {request.username ?? request.phone}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onDeclineRequest?.(request.id)}
                              disabled={isLoading}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => onApproveRequest?.(request.id)}
                              disabled={isLoading}
                              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Approve
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <MemberModeration
                loopName={loopName}
                members={members}
                onUpdateMemberRole={onUpdateMemberRole}
                onBlockMember={onBlockMember}
                onUnblockMember={onUnblockMember}
                onRemoveMember={onRemoveMember}
                isLoading={isLoading}
              />
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">
            Tips
          </p>
          <ul className="mt-2 space-y-1 text-xs text-cyan-900">
            <li>
              • Changes to settings take effect immediately for all members
            </li>
            <li>
              • Admins can always see all messages regardless of posting
              permissions
            </li>
            <li>• Blocked members cannot access the Loop or view messages</li>
            <li>• All admin actions are logged for audit purposes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
