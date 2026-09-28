"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Download, Phone, Trash2, Video } from "lucide-react";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { Button, Modal } from "@/components/ui";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { useCalls } from "@/lib/calls/CallProvider";
import {
  deleteRecording,
  fetchCallRecordings,
  fetchRecording,
  isCallLive,
  type Call,
  type CallRecording,
} from "@/lib/calls/api";
import { formatCallDuration } from "@/lib/calls/format";

const RECORDING_STATUS_LABEL: Record<CallRecording["status"], string> = {
  starting: "Starting",
  recording: "Recording now",
  stopping: "Processing",
  completed: "Ready",
  failed: "Failed",
  deleted: "Deleted",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function callDurationSeconds(call: Call): number | null {
  if (!call.startedAt || !call.endedAt) return null;
  const seconds =
    (Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000;
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Mirrors calls/services.py `may_administer` - whoever started the call,
 * either person in a one-to-one, or a group admin. The server checks again;
 * this only decides whether to offer the button.
 */
function useCanAdminister(call: Call): boolean {
  const { conversations, userProfile } = useAppShell();
  if (
    userProfile.username &&
    call.createdBy?.username === userProfile.username
  ) {
    return true;
  }
  const conversation = conversations.find(
    (row) => String(row.id) === String(call.conversationId),
  );
  return conversation?.kind === "direct" || conversation?.isAdmin === true;
}

type RecordingsState =
  | { status: "loading" }
  | { status: "hidden" }
  | { status: "error"; message: string }
  | { status: "ready"; recordings: CallRecording[] };

function RecordingsSection({ call }: { call: Call }) {
  const canAdminister = useCanAdminister(call);
  const [state, setState] = useState<RecordingsState>({ status: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CallRecording | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCallRecordings(call.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({ status: "ready", recordings: result.recordings });
      } else if (result.status === 404) {
        // Somebody who was never on the call is told nothing by the server;
        // there is nothing to show them either.
        setState({ status: "hidden" });
      } else {
        setState({ status: "error", message: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
    // isRecording: a recording that just started or stopped changes the list.
  }, [call.id, call.isRecording, reloadToken]);

  const download = async (recording: CallRecording) => {
    setActionError(null);
    setDownloadingId(recording.id);
    // The link is signed per request and expires quickly, so it is fetched
    // at the moment it is wanted rather than kept from the list.
    const result = await fetchRecording(recording.id);
    setDownloadingId(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    if (!result.recording.downloadUrl) {
      setActionError("This recording isn't ready to download yet.");
      return;
    }
    window.open(result.recording.downloadUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    const result = await deleteRecording(confirmDelete.id);
    setIsDeleting(false);
    if (!result.ok) {
      setActionError(result.message);
      setConfirmDelete(null);
      return;
    }
    const deletedId = confirmDelete.id;
    setConfirmDelete(null);
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            recordings: current.recordings.map((row) =>
              row.id === deletedId
                ? {
                    ...row,
                    status: "deleted",
                    deletedAt: new Date().toISOString(),
                  }
                : row,
            ),
          }
        : current,
    );
  };

  if (state.status === "hidden") return null;

  return (
    <section className="mt-6">
      <h3 className="text-2xs font-bold tracking-[0.1em] text-slate-400 uppercase dark:text-slate-500">
        Recordings
      </h3>

      {actionError && (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {actionError}
        </p>
      )}

      {state.status === "loading" ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Loading...
        </p>
      ) : state.status === "error" ? (
        <div className="mt-2 flex items-center gap-3 text-sm text-rose-700 dark:text-rose-300">
          <span>{state.message}</span>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setReloadToken((token) => token + 1);
            }}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : state.recordings.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This call wasn&apos;t recorded.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {state.recordings.map((recording) => (
            <li
              key={recording.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {RECORDING_STATUS_LABEL[recording.status]}
                  {recording.durationSeconds !== null &&
                    ` - ${formatCallDuration(recording.durationSeconds)}`}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {recording.startedBy
                    ? `Started by ${recording.startedBy.name}`
                    : "Recording"}
                  {recording.sizeBytes !== null &&
                    recording.status === "completed" &&
                    ` - ${formatBytes(recording.sizeBytes)}`}
                  {recording.expiresAt &&
                    recording.status === "completed" &&
                    ` - kept until ${new Date(recording.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              {recording.status === "completed" && (
                <button
                  type="button"
                  onClick={() => void download(recording)}
                  disabled={downloadingId === recording.id}
                  title="Download"
                  aria-label="Download recording"
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
              {canAdminister &&
                (recording.status === "completed" ||
                  recording.status === "failed") && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(recording)}
                    title="Delete"
                    aria-label="Delete recording"
                    className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this recording?"
        description="The file is removed for everyone. The call history still shows it was recorded."
        maxWidthClassName="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void remove()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        {null}
      </Modal>
    </section>
  );
}

/** One call: who was on it, for how long, what was recorded, and call back. */
export function CallDetailPanel({
  call,
  title,
  onBack,
}: {
  call: Call;
  title: string;
  onBack: () => void;
}) {
  const { startCall, joinCall, activeCall, phase } = useCalls();
  const duration = callDurationSeconds(call);
  const live = isCallLive(call);
  const busy = phase === "starting" || phase === "joining";
  const isCurrent = activeCall?.id === call.id;

  // One row per person, not per stay: somebody who dropped and came back is
  // one attendee whose time is the sum of their stays.
  const attendees = new Map<
    string,
    { name: string; avatarUrl?: string; seconds: number; inNow: boolean }
  >();
  for (const stay of call.participants) {
    const existing = attendees.get(stay.user.id);
    const seconds = stay.duration ?? 0;
    attendees.set(stay.user.id, {
      name: stay.user.name,
      avatarUrl: stay.user.avatarUrl,
      seconds: (existing?.seconds ?? 0) + seconds,
      inNow: (existing?.inNow ?? false) || stay.leftAt === null,
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 md:hidden dark:text-slate-300"
      >
        <ChevronLeft className="h-4 w-4" />
        Calls
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {call.type === "video" ? "Video call" : "Voice call"} -{" "}
            {new Date(call.createdAt).toLocaleString()}
          </p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {live
              ? "In progress"
              : duration !== null
                ? `Lasted ${formatCallDuration(duration)}`
                : call.endReason === "declined"
                  ? "Declined"
                  : "Not answered"}
            {call.createdBy && ` - started by ${call.createdBy.name}`}
          </p>
        </div>

        {live ? (
          <Button
            size="sm"
            onClick={() => void joinCall(call.id)}
            disabled={busy || isCurrent}
            className="shrink-0 bg-none bg-emerald-600 shadow-none hover:bg-emerald-700"
          >
            {isCurrent ? "You're in this call" : "Join"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void startCall(call.conversationId, call.type)}
            disabled={busy}
            className="shrink-0"
          >
            {call.type === "video" ? (
              <Video className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            Call again
          </Button>
        )}
      </div>

      <section className="mt-6">
        <h3 className="text-2xs font-bold tracking-[0.1em] text-slate-400 uppercase dark:text-slate-500">
          Participants
        </h3>
        {attendees.size === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Nobody joined.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {Array.from(attendees, ([id, person]) => (
              <li key={id} className="flex items-center gap-3">
                <ChatAvatar
                  name={person.name}
                  imageUrl={person.avatarUrl ?? null}
                  size={32}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                  {person.name}
                </span>
                <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {person.inNow
                    ? "In the call"
                    : formatCallDuration(person.seconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Keyed by call so switching calls starts from a clean slate. */}
      <RecordingsSection key={call.id} call={call} />
    </div>
  );
}
