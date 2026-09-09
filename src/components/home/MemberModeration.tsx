"use client";

import { useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";

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

type MemberModerationProps = {
  loopName: string;
  members: Member[];
  onUpdateMemberRole?: (memberId: string, newRole: MemberRole) => Promise<void>;
  onBlockMember?: (memberId: string) => Promise<void>;
  onUnblockMember?: (memberId: string) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  isLoading?: boolean;
  canEdit?: boolean;
};

export function MemberModeration({
  loopName,
  members,
  onUpdateMemberRole,
  onBlockMember,
  onUnblockMember,
  onRemoveMember,
  isLoading = false,
  canEdit = false,
}: MemberModerationProps) {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone?.includes(searchTerm),
  );

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setActionInProgress(memberId);
    setError("");

    try {
      await onUpdateMemberRole?.(memberId, newRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleBlockMember(memberId: string) {
    setActionInProgress(memberId);
    setError("");

    try {
      await onBlockMember?.(memberId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block member");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleUnblockMember(memberId: string) {
    setActionInProgress(memberId);
    setError("");

    try {
      await onUnblockMember?.(memberId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unblock member");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!window.confirm("Are you sure you want to remove this member?")) return;

    setActionInProgress(memberId);
    setError("");

    try {
      await onRemoveMember?.(memberId);
      setExpandedMemberId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Member Management
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage members of {loopName}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="error" className="border border-rose-200 px-4 py-3">
          {error}
        </Alert>
      )}

      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder="Search members by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Member Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Members" value={members.length.toString()} />
        <StatCard
          label="Admins"
          value={members.filter((m) => m.role === "admin").length.toString()}
        />
        <StatCard
          label="Moderators"
          value={members
            .filter((m) => m.role === "moderator")
            .length.toString()}
        />
        <StatCard
          label="Blocked"
          value={members.filter((m) => m.isBlocked).length.toString()}
          highlight
        />
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No members found
            </p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isExpanded={expandedMemberId === member.id}
              onToggleExpand={() =>
                setExpandedMemberId(
                  expandedMemberId === member.id ? null : member.id,
                )
              }
              onRoleChange={(role) => handleRoleChange(member.id, role)}
              onBlock={() => handleBlockMember(member.id)}
              onUnblock={() => handleUnblockMember(member.id)}
              onRemove={() => handleRemoveMember(member.id)}
              isActionInProgress={actionInProgress === member.id}
              isLoading={isLoading}
              canEdit={canEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-400"}`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold ${highlight ? "text-rose-900 dark:text-rose-100" : "text-slate-900 dark:text-slate-100"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MemberCard({
  member,
  isExpanded,
  onToggleExpand,
  onRoleChange,
  onBlock,
  onUnblock,
  onRemove,
  isActionInProgress,
  isLoading,
  canEdit,
}: {
  member: Member;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRoleChange: (role: MemberRole) => Promise<void>;
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
  onRemove: () => Promise<void>;
  isActionInProgress: boolean;
  isLoading: boolean;
  canEdit?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border transition ${
        member.isBlocked
          ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      }`}
    >
      {/* Main Row */}
      <button
        onClick={onToggleExpand}
        className={`w-full px-6 py-4 text-left hover:opacity-80 ${canEdit ? "" : "!cursor-not-allowed"}`}
        disabled={isActionInProgress || isLoading}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {member.name}
                  {member.isBlocked && (
                    <span className="ml-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                      BLOCKED
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {member.email || member.phone || "No contact info"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleAdjective role={member.role} />
            <svg
              className={`h-5 w-5 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>

        {member.lastActive && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Last active: {member.lastActive}
          </p>
        )}
      </button>

      {/* Expanded Section */}
      {isExpanded && canEdit && (
        <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="space-y-4">
            {/* Join Date */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase dark:text-slate-400">
                Joined
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                {member.joinedAt}
              </p>
            </div>

            {/* Role Selection */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600 uppercase dark:text-slate-400">
                Role
              </p>
              <Select
                value={member.role}
                onChange={(event) =>
                  void onRoleChange(event.target.value as MemberRole)
                }
                disabled={isActionInProgress || isLoading}
                options={[
                  { value: "member", label: "Member" },
                  { value: "moderator", label: "Moderator" },
                  { value: "admin", label: "Admin" },
                ]}
                className="max-w-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              {member.isBlocked ? (
                <Button
                  onClick={onUnblock}
                  disabled={isActionInProgress || isLoading}
                  variant="secondary"
                  className="flex-1 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  Unblock
                </Button>
              ) : (
                <Button
                  onClick={onBlock}
                  disabled={isActionInProgress || isLoading}
                  variant="secondary"
                  className="flex-1 border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-900/40"
                >
                  Block
                </Button>
              )}

              <Button
                onClick={onRemove}
                disabled={isActionInProgress || isLoading}
                variant="secondary"
                className="flex-1 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleAdjective({ role }: { role: MemberRole }) {
  switch (role) {
    case "admin":
      return (
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Admin
        </span>
      );
    case "moderator":
      return (
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Moderator
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Member
        </span>
      );
  }
}
