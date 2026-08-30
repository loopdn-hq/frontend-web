"use client";

import { useState } from "react";

type CommunicationMode = "chat" | "broadcast";
type BroadcastReplyMode = "private" | "group_wide" | "disabled";

type LoopCommunicationModeProps = {
  loopName: string;
  currentMode: CommunicationMode;
  broadcastReplyMode?: BroadcastReplyMode;
  onModeChange?: (
    mode: CommunicationMode,
    replyMode?: BroadcastReplyMode,
  ) => Promise<void>;
  isLoading?: boolean;
  isAdmin?: boolean;
};

export function LoopCommunicationMode({
  loopName,
  currentMode,
  broadcastReplyMode = "private",
  onModeChange,
  isLoading = false,
  isAdmin = true,
}: LoopCommunicationModeProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleModeChange(newMode: CommunicationMode) {
    if (!isAdmin || isChanging || isLoading) return;

    setIsChanging(true);
    setError("");

    try {
      await onModeChange?.(
        newMode,
        newMode === "broadcast" ? broadcastReplyMode : undefined,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update communication mode",
      );
    } finally {
      setIsChanging(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Current Mode Display */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
              Communication Mode
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {loopName}
            </h3>
          </div>
          {currentMode === "chat" ? (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Chat Group
            </span>
          ) : (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
              Broadcast
            </span>
          )}
        </div>

        <p className="text-sm text-slate-600">
          {currentMode === "chat"
            ? "Members can communicate with everyone according to admin permissions."
            : "You send announcements; member replies based on current settings."}
        </p>

        {currentMode === "broadcast" && (
          <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
            <p className="text-xs font-semibold text-purple-900">
              Member Reply Settings:
            </p>
            <p className="mt-1 text-xs text-purple-800">
              {broadcastReplyMode === "private" &&
                "Members can only reply privately to admins"}
              {broadcastReplyMode === "group_wide" &&
                "Members can reply to everyone in the group"}
              {broadcastReplyMode === "disabled" &&
                "Members cannot reply; receive announcements only"}
            </p>
          </div>
        )}
      </div>

      {/* Mode Toggle (Admin only) */}
      {isAdmin && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            Switch Communication Mode
          </p>

          <div className="space-y-2">
            <button
              onClick={() => handleModeChange("chat")}
              disabled={currentMode === "chat" || isChanging || isLoading}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
                currentMode === "chat"
                  ? "border-blue-300 bg-blue-100 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              <p className="font-semibold">Chat Group</p>
              <p className="text-xs text-slate-600">
                Members communicate with everyone
              </p>
            </button>

            <button
              onClick={() => handleModeChange("broadcast")}
              disabled={currentMode === "broadcast" || isChanging || isLoading}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
                currentMode === "broadcast"
                  ? "border-purple-300 bg-purple-100 text-purple-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              <p className="font-semibold">Broadcast Group</p>
              <p className="text-xs text-slate-600">
                You send announcements to members
              </p>
            </button>
          </div>

          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
          {isChanging && (
            <p className="mt-3 text-xs text-slate-600">Updating mode...</p>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-600">
            Only admins can change the communication mode for this Loop.
          </p>
        </div>
      )}
    </div>
  );
}
