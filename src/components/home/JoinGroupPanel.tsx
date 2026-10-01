"use client";

import type { JoinMode } from "@/lib/chat/conversations";

type JoinGroupPanelProps = {
  name: string;
  description?: string;
  joinMode: JoinMode | null;
  code: string;
  onCodeChange: (code: string) => void;
  onJoin: () => void;
  onJoinWithCode: () => void;
  isJoining?: boolean;
  requestSent?: boolean;
  error?: string;
};

/**
 * The way into a group you are not in yet.
 *
 * What it offers is decided by the group's join mode, because that is what
 * decides whether there IS a way in: open lets you straight through, code
 * wants the code, approval is a request somebody has to answer, and
 * invite-only cannot be asked at all.
 *
 * Shared by the Chats screen and the Activity detail rather than written
 * twice. Two copies of a four-way branch is how they end up disagreeing about
 * what an approval group does.
 */
export function JoinGroupPanel({
  name,
  description,
  joinMode,
  code,
  onCodeChange,
  onJoin,
  onJoinWithCode,
  isJoining = false,
  requestSent = false,
  error,
}: JoinGroupPanelProps) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 text-center shadow-xl">
      <h3 className="text-lg font-semibold text-ink">{name}</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {description || "No description"}
      </p>

      {requestSent ? (
        <p className="mt-4 rounded-lg bg-tint px-3 py-2 text-sm text-ink">
          Request sent. An admin needs to approve your request to join.
        </p>
      ) : joinMode === "code" ? (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="Enter join code"
            disabled={isJoining}
            className="w-full rounded-xl bg-field px-4 py-2.5 text-center text-sm tracking-widest text-ink uppercase transition outline-none placeholder:tracking-normal placeholder:text-placeholder placeholder:normal-case focus:ring-4 focus:ring-focus"
          />
          <button
            type="button"
            onClick={onJoinWithCode}
            disabled={isJoining || !code.trim()}
            className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isJoining ? "Joining..." : "Submit Code"}
          </button>
        </div>
      ) : joinMode === "invite" ? (
        <p className="mt-4 rounded-lg bg-tint px-3 py-2 text-sm text-ink-muted">
          This Loop is invite-only. Ask a member to invite you.
        </p>
      ) : (
        <button
          type="button"
          onClick={onJoin}
          disabled={isJoining}
          className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isJoining
            ? "Joining..."
            : joinMode === "approval"
              ? "Request to Join"
              : "Join Group"}
        </button>
      )}

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
