"use client";

import { useState } from "react";
import { LoopAdminSettings } from "./LoopAdminSettings";
import { MemberModeration } from "./MemberModeration";
import type { GroupSettings } from "@/lib/chat/conversations";

export type AdminTab = "settings" | "members";

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
  canModerateMembers?: boolean;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
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
  handleLeaveLoop?: () => Promise<
    { ok: true } | { ok: false; message: string }
  >;
  selectedConversation?: {
    id?: string;
    name?: string;
  };
};

export function LoopAdminPanel({
  loopName,
  settings,
  isSettingsLoading = false,
  canEditSettings = true,
  canModerateMembers = false,
  activeTab,
  onTabChange,
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
  selectedConversation,
  handleLeaveLoop,
}: LoopAdminPanelProps) {
  const [isLeaveLoopConfirmOpen, setIsLeaveLoopConfirmOpen] = useState(false);
  const [isLeavingLoop, setIsLeavingLoop] = useState(false);
  const [leaveLoopError, setLeaveLoopError] = useState("");

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#e4f4ff_0%,#f8fbff_50%,#f3f8ff_100%)] p-3 sm:p-5 dark:bg-[linear-gradient(160deg,#0b1220_0%,#0e1626_50%,#0b1220_100%)]">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {loopName} Panel
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Manage your Loop&apos;s settings and members
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLeaveLoopError("");
              setIsLeaveLoopConfirmOpen(true);
            }}
            title="Leave Loop"
            aria-label="Leave Loop"
            className="rounded-lg border mr-6 border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => onTabChange("settings")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "settings"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            ⚙️ Loop Settings
          </button>
          <button
            onClick={() => onTabChange("members")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "members"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            👥 Members ({members.length})
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {isSettingsLoading
                  ? "Loading settings…"
                  : "Unable to load settings."}
              </p>
            ))}

          {activeTab === "members" && (
            <>
              {settings?.join_mode === "approval" && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h3 className="mb-3 text-sm font-semibold text-amber-900 dark:text-amber-300">
                    Pending Requests
                    {pendingRequests.length > 0 &&
                      ` (${pendingRequests.length})`}
                  </h3>
                  {isPendingRequestsLoading ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Loading requests…
                    </p>
                  ) : pendingRequests.length === 0 ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      No pending join requests.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {pendingRequests.map((request) => (
                        <li
                          key={request.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900/40 dark:bg-slate-900"
                        >
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {request.name}
                            </p>
                            {(request.username || request.phone) && (
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {request.username ?? request.phone}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onDeclineRequest?.(request.id)}
                              disabled={isLoading}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                canEdit={canModerateMembers}
              />
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 px-6 py-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
            Tips
          </p>
          <ul className="mt-2 space-y-1 text-xs text-cyan-900 dark:text-cyan-100">
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
      {isLeaveLoopConfirmOpen && selectedConversation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(14,88,148,0.25)] dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Leave {selectedConversation.name}?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You will no longer receive messages from this Loop. You&apos;ll
              need to be re-added or rejoin to come back.
            </p>

            {leaveLoopError && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {leaveLoopError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setIsLeaveLoopConfirmOpen(false)}
                disabled={isLeavingLoop}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsLeavingLoop(true);
                  setLeaveLoopError("");
                  const result = await handleLeaveLoop?.();
                  setIsLeavingLoop(false);
                  if (result && !result.ok) {
                    setLeaveLoopError(result.message);
                    return;
                  }
                  setIsLeaveLoopConfirmOpen(false);
                }}
                disabled={isLeavingLoop}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLeavingLoop ? "Leaving..." : "Leave Loop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
