"use client";

/**
 * The two strips the composer shows for a voice note: one while it is being
 * recorded, and one once it is recorded and waiting to be sent.
 *
 * Their own components rather than more JSX in HomeShell, which is large
 * enough already - and the timer in particular ticks twice a second, which
 * re-rendering all of HomeShell for would be wasteful.
 *
 * Both sit in the stack of full-width strips inside the composer card, beside
 * the error, reply and attachment rows.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Trash2 } from "lucide-react";

/** "0:07", "1:32", "12:05". */
export function formatVoiceDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Recording, and for how long.
 *
 * The time is read from the clock on every tick rather than counted up, so a
 * tab the browser throttles in the background still shows the right length
 * when it comes back.
 */
export function VoiceRecordingBar({
  startedAt,
  onDiscard,
}: {
  /** `Date.now()` when recording began. */
  startedAt: number;
  /** Stops recording and keeps nothing. */
  onDiscard: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-2 px-2 pb-2 text-xs text-rose-600">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-600"
      />
      <span>Recording</span>
      {/* Read out once by a screen reader rather than on every tick. */}
      <span className="font-medium tabular-nums" aria-live="off">
        {formatVoiceDuration(elapsed)}
      </span>
      <button
        type="button"
        onClick={onDiscard}
        className="ml-auto rounded px-1.5 py-0.5 font-medium text-ink-muted transition hover:bg-hover hover:text-ink"
      >
        Discard
      </button>
    </div>
  );
}

/**
 * A recorded voice note, playable before it is sent.
 *
 * The browser's own player, the same one a sent voice note gets in the thread,
 * so it sounds and behaves the same before and after.
 *
 * The object URL is made in an effect and handed to the element directly. Made
 * during render and revoked in an effect, React's development double-run of
 * effects revokes it before the player has loaded it, and the preview is
 * silent in dev. This way each run makes its own and cleans up only that one.
 *
 * `durationSeconds` is shown beside the player because Chrome's recordings
 * carry no length in the file itself, and its player shows 0:00 until the note
 * has been played through once.
 */
export function VoiceNotePreview({
  file,
  durationSeconds,
  onRemove,
  disabled = false,
}: {
  file: File;
  durationSeconds?: number;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (audio.current) audio.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex w-full items-center gap-2 rounded-lg bg-tint px-2 py-1">
      <Mic aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" />
      <audio
        ref={audio}
        controls
        preload="metadata"
        aria-label="Your voice message, before sending"
        className="h-8 min-w-0 flex-1"
      />
      {durationSeconds !== undefined && (
        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
          {formatVoiceDuration(durationSeconds)}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Delete voice message"
        title="Delete voice message"
        className="shrink-0 rounded p-1 text-ink-muted transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
