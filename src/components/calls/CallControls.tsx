"use client";

import type { ReactNode } from "react";
import {
  Disc,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useCalls } from "@/lib/calls/CallProvider";
import { cn } from "@/lib/ui/cn";

function ControlButton({
  label,
  onClick,
  active = true,
  tone = "neutral",
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  /** Off-state devices are drawn inverted, so "muted" reads at a glance. */
  active?: boolean;
  tone?: "neutral" | "danger" | "recording";
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={tone === "neutral" ? !active : undefined}
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-full transition focus-visible:ring-4 focus-visible:ring-sky-400/40 focus-visible:outline-none disabled:opacity-50",
        tone === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        tone === "recording" &&
          (active
            ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
            : "bg-white/10 text-white hover:bg-white/20"),
        tone === "neutral" &&
          (active
            ? "bg-white/10 text-white hover:bg-white/20"
            : "bg-white text-slate-900 hover:bg-slate-200"),
      )}
    >
      {children}
    </button>
  );
}

/** The bar along the bottom of a call. */
export function CallControls() {
  const {
    activeCall,
    media,
    canAdministerActiveCall,
    conversationFor,
    isRecordingBusy,
    toggleRecording,
    leaveCall,
    endCallForEveryone,
  } = useCalls();

  if (!activeCall) return null;

  const isDirect = conversationFor(activeCall)?.kind === "direct";
  const connected =
    media.state === "connected" || media.state === "reconnecting";

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ControlButton
        label={media.isMicrophoneEnabled ? "Mute" : "Unmute"}
        active={media.isMicrophoneEnabled}
        onClick={() => void media.toggleMicrophone()}
        disabled={!connected}
      >
        {media.isMicrophoneEnabled ? (
          <Mic className="h-5 w-5" />
        ) : (
          <MicOff className="h-5 w-5" />
        )}
      </ControlButton>

      {/* The token only grants a camera on a video call - see
          calls/services.py `_sources_for` - so an audio call has no button
          for one rather than a button that fails. */}
      {activeCall.type === "video" && (
        <ControlButton
          label={media.isCameraEnabled ? "Turn camera off" : "Turn camera on"}
          active={media.isCameraEnabled}
          onClick={() => void media.toggleCamera()}
          disabled={!connected}
        >
          {media.isCameraEnabled ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </ControlButton>
      )}

      {/* Shown even when it cannot be used, and saying why. Hiding it was
          worse than disabling it: a plan limit and a missing feature look
          identical when the control is simply not there. */}
      <ControlButton
        label={
          media.screenShareSupport === "unsupported"
            ? "This browser can't share a screen"
            : media.screenShareSupport === "not-in-plan"
              ? "Screen sharing isn't included in this plan"
              : media.isScreenSharing
                ? "Stop sharing"
                : "Share your screen"
        }
        active={!media.isScreenSharing}
        onClick={() => void media.toggleScreenShare()}
        disabled={!connected || media.screenShareSupport !== "ready"}
      >
        {media.isScreenSharing ? (
          <ScreenShareOff className="h-5 w-5" />
        ) : (
          <ScreenShare className="h-5 w-5" />
        )}
      </ControlButton>

      {canAdministerActiveCall && (
        <ControlButton
          label={activeCall.isRecording ? "Stop recording" : "Record"}
          tone="recording"
          active={activeCall.isRecording}
          onClick={() => void toggleRecording()}
          disabled={!connected || isRecordingBusy}
        >
          <Disc
            className={cn("h-5 w-5", activeCall.isRecording && "fill-rose-400")}
          />
        </ControlButton>
      )}

      {/* A one-to-one hangs up for both, the way a phone does; in a group,
          hanging up only takes you out. */}
      <ControlButton
        label={isDirect ? "End call" : "Leave call"}
        tone="danger"
        onClick={() =>
          void (isDirect && canAdministerActiveCall
            ? endCallForEveryone()
            : leaveCall())
        }
      >
        <PhoneOff className="h-5 w-5" />
      </ControlButton>

      {!isDirect && canAdministerActiveCall && (
        <button
          type="button"
          onClick={() => void endCallForEveryone()}
          className="rounded-full px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/15"
        >
          End for everyone
        </button>
      )}
    </div>
  );
}
