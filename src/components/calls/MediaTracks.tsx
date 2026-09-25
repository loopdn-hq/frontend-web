"use client";

import { useEffect, useRef } from "react";
import type { AudioTrack, VideoTrack } from "livekit-client";
import { cn } from "@/lib/ui/cn";

/**
 * A LiveKit video track in a <video>.
 *
 * Attached in an effect and detached on the way out: LiveKit counts the
 * elements a track is attached to for adaptive streaming, so a leaked one keeps
 * a hidden tile downloading full resolution.
 */
export function VideoTrackView({
  track,
  mirror = false,
  fit = "cover",
  className,
}: {
  track: VideoTrack;
  /** For your own camera, so it moves the way a mirror does. */
  mirror?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      // Video elements carry no sound here; audio has its own elements, so
      // muting these is what lets them autoplay.
      muted
      className={cn(
        "h-full w-full bg-black",
        fit === "cover" ? "object-cover" : "object-contain",
        mirror && "-scale-x-100",
        className,
      )}
    />
  );
}

/** A remote audio track, played. Rendered for as long as the call lasts. */
export function AudioTrackPlayer({ track }: { track: AudioTrack }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return <audio ref={ref} autoPlay />;
}
