"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  ActiveCallView,
  MinimizedCallBar,
} from "@/components/calls/ActiveCallView";
import { IncomingCallPrompt } from "@/components/calls/IncomingCallPrompt";
import { AudioTrackPlayer } from "@/components/calls/MediaTracks";
import { useCalls } from "@/lib/calls/CallProvider";

const NOTICE_MS = 3500;
const ERROR_MS = 8000;

/**
 * Every piece of call UI, mounted once beside the routes.
 *
 * Audio is rendered here and not inside the call view, so minimizing the call
 * to keep chatting does not also silence it.
 */
export function CallLayer() {
  const {
    phase,
    activeCall,
    isMinimized,
    media,
    notice,
    error,
    dismissNotice,
    dismissError,
  } = useCalls();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(dismissError, ERROR_MS);
    return () => window.clearTimeout(timer);
  }, [error, dismissError]);

  const inCall =
    phase === "starting" || phase === "joining" || phase === "in-call";

  return (
    <>
      {media.participants.flatMap((participant) =>
        participant.audioTracks.map((track) => (
          <AudioTrackPlayer
            key={track.sid ?? track.mediaStreamTrack.id}
            track={track}
          />
        )),
      )}

      {inCall &&
        (isMinimized && activeCall ? <MinimizedCallBar /> : <ActiveCallView />)}

      <IncomingCallPrompt />

      {(notice || error) && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl ring-1 ring-white/10"
        >
          <p className={error ? "flex-1 text-rose-200" : "flex-1"}>
            {error ?? notice}
          </p>
          <button
            type="button"
            onClick={error ? dismissError : dismissNotice}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
