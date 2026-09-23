"use client";

import { Maximize2, Mic, MicOff, Minimize2, PhoneOff } from "lucide-react";
import { Alert } from "@/components/ui";
import { CallControls } from "@/components/calls/CallControls";
import { ParticipantTile } from "@/components/calls/ParticipantTile";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { useCalls } from "@/lib/calls/CallProvider";
import { formatCallDuration, useElapsedSeconds } from "@/lib/calls/format";
import type { CallMediaParticipant } from "@/lib/calls/useLiveKitRoom";
import { cn } from "@/lib/ui/cn";

/** The title and status line both views share. */
function useCallSummary() {
  const { phase, activeCall, pendingStart, media, conversationFor } =
    useCalls();
  const { conversations } = useAppShell();
  const elapsed = useElapsedSeconds(activeCall?.startedAt ?? null);

  const conversation = activeCall
    ? conversationFor(activeCall)
    : pendingStart
      ? conversations.find(
          (row) => String(row.id) === String(pendingStart.conversationId),
        )
      : undefined;
  const title = conversation?.name ?? "Call";
  const isDirect = conversation?.kind === "direct";
  const othersConnected = media.participants.some((p) => !p.isLocal);

  let status: string;
  if (phase === "starting") status = "Calling...";
  else if (phase === "joining") status = "Connecting...";
  else if (media.state === "reconnecting") status = "Reconnecting...";
  else if (activeCall?.status === "ringing" && !othersConnected) {
    status = isDirect ? "Ringing..." : "Waiting for others to join...";
  } else if (elapsed !== null) status = formatCallDuration(elapsed);
  else status = "Connected";

  return { title, status, isDirect };
}

function gridClassFor(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 9) return "grid-cols-2 md:grid-cols-3";
  return "grid-cols-3 md:grid-cols-4";
}

function CallStage({
  participants,
  avatarFor,
}: {
  participants: CallMediaParticipant[];
  avatarFor: (identity: string) => string | undefined;
}) {
  // A shared screen takes the stage; everybody else moves to a strip. Only
  // the first - LiveKit allows several, but two stages is no stage.
  const sharer = participants.find((participant) => participant.screenTrack);

  if (sharer?.screenTrack) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <ParticipantTile
          participant={sharer}
          track={sharer.screenTrack}
          isScreen
          className="min-h-0 flex-1"
        />
        <div className="flex shrink-0 gap-3 overflow-x-auto md:w-56 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.identity}
              participant={participant}
              avatarUrl={avatarFor(participant.identity)}
              compact
              className="aspect-video w-44 shrink-0 md:w-full"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 auto-rows-fr gap-3",
        gridClassFor(participants.length),
      )}
    >
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          avatarUrl={avatarFor(participant.identity)}
          compact={participants.length > 4}
        />
      ))}
    </div>
  );
}

/** The whole-screen call. */
export function ActiveCallView() {
  const { activeCall, media, setMinimized } = useCalls();
  const { title, status } = useCallSummary();

  // Django's call record knows avatars; LiveKit only knows the identity it
  // was given, which is the account id.
  const avatarFor = (identity: string) =>
    activeCall?.participants.find((stay) => stay.user.id === identity)?.user
      .avatarUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call: ${title}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold sm:text-lg">
            {title}
          </h2>
          <p className="text-xs text-slate-400 tabular-nums">{status}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeCall?.isRecording && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300">
              <span
                aria-hidden
                className="h-2 w-2 animate-pulse rounded-full bg-rose-400"
              />
              Recording
            </span>
          )}
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimize call"
            aria-label="Minimize call"
            className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2 px-4 sm:px-6">
        {media.deviceError && (
          <div className="flex items-start justify-between gap-3 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
            <span>{media.deviceError.message}</span>
            <button
              type="button"
              onClick={media.clearDeviceError}
              className="shrink-0 font-semibold text-amber-100 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {media.audioBlocked && (
          <button
            type="button"
            onClick={() => void media.startAudio()}
            className="rounded-xl bg-sky-500/20 px-3 py-2 text-left text-sm text-sky-100 hover:bg-sky-500/30"
          >
            Your browser paused the call audio. Click here to hear everyone.
          </button>
        )}
        {media.state === "reconnecting" && (
          <Alert variant="info">Connection interrupted. Reconnecting...</Alert>
        )}
      </div>

      <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        {media.participants.length > 0 ? (
          <CallStage participants={media.participants} avatarFor={avatarFor} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            {status}
          </div>
        )}
      </main>

      <footer className="px-4 pt-2 pb-6">
        <CallControls />
      </footer>
    </div>
  );
}

/** The call, folded into a corner so the rest of the app can be used. */
export function MinimizedCallBar() {
  const {
    activeCall,
    media,
    setMinimized,
    leaveCall,
    endCallForEveryone,
    canAdministerActiveCall,
  } = useCalls();
  const { title, status, isDirect } = useCallSummary();

  return (
    <div
      role="region"
      aria-label={`Call: ${title}`}
      className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl bg-slate-900 py-2 pr-2 pl-4 text-white shadow-2xl ring-1 ring-white/10"
    >
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="min-w-0 text-left"
        title="Return to call"
      >
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {activeCall?.isRecording && (
            <span
              aria-label="Recording"
              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-400"
            />
          )}
          <span className="truncate">{title}</span>
        </p>
        <p className="text-xs text-slate-400 tabular-nums">{status}</p>
      </button>
      <button
        type="button"
        onClick={() => void media.toggleMicrophone()}
        title={media.isMicrophoneEnabled ? "Mute" : "Unmute"}
        aria-label={media.isMicrophoneEnabled ? "Mute" : "Unmute"}
        aria-pressed={!media.isMicrophoneEnabled}
        className={cn(
          "rounded-full p-2",
          media.isMicrophoneEnabled
            ? "hover:bg-white/10"
            : "bg-white text-slate-900",
        )}
      >
        {media.isMicrophoneEnabled ? (
          <Mic className="h-4 w-4" />
        ) : (
          <MicOff className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setMinimized(false)}
        title="Expand call"
        aria-label="Expand call"
        className="rounded-full p-2 hover:bg-white/10"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() =>
          void (isDirect && canAdministerActiveCall
            ? endCallForEveryone()
            : leaveCall())
        }
        title={isDirect ? "End call" : "Leave call"}
        aria-label={isDirect ? "End call" : "Leave call"}
        className="rounded-full bg-rose-600 p-2 hover:bg-rose-700"
      >
        <PhoneOff className="h-4 w-4" />
      </button>
    </div>
  );
}
