"use client";

import { MicOff, WifiOff } from "lucide-react";
import type { VideoTrack } from "livekit-client";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { VideoTrackView } from "@/components/calls/MediaTracks";
import type { CallMediaParticipant } from "@/lib/calls/useLiveKitRoom";
import { cn } from "@/lib/ui/cn";

type ParticipantTileProps = {
  participant: CallMediaParticipant;
  avatarUrl?: string;
  /** Which of their videos this tile shows. Defaults to the camera. */
  track?: VideoTrack;
  isScreen?: boolean;
  compact?: boolean;
  className?: string;
};

/**
 * One person (or one person's shared screen) in the call grid.
 *
 * Camera off falls back to their avatar, so an audio call is still a grid of
 * people rather than a grid of black boxes.
 */
export function ParticipantTile({
  participant,
  avatarUrl,
  track,
  isScreen = false,
  compact = false,
  className,
}: ParticipantTileProps) {
  const video = track ?? participant.cameraTrack;
  const label = participant.isLocal
    ? isScreen
      ? "Your screen"
      : `${participant.name} (you)`
    : isScreen
      ? `${participant.name}'s screen`
      : participant.name;

  return (
    <div
      className={cn(
        "relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-800 ring-2 transition",
        participant.isSpeaking && !isScreen
          ? "ring-emerald-400"
          : "ring-transparent",
        className,
      )}
    >
      {video ? (
        <VideoTrackView
          track={video}
          mirror={participant.isLocal && !isScreen}
          fit={isScreen ? "contain" : "cover"}
        />
      ) : (
        <ChatAvatar
          name={participant.name}
          imageUrl={avatarUrl ?? null}
          size={compact ? 48 : 88}
        />
      )}

      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
        {!participant.isMicrophoneEnabled && !isScreen && (
          <MicOff
            className="h-3.5 w-3.5 shrink-0 text-rose-300"
            aria-label="Muted"
          />
        )}
        {participant.poorConnection && (
          <WifiOff
            className="h-3.5 w-3.5 shrink-0 text-amber-300"
            aria-label="Poor connection"
          />
        )}
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}
