"use client";

import { RefreshCw } from "lucide-react";

/**
 * A request did not come back, said plainly, with a way to ask again.
 *
 * Its own component because the alternative is what this replaces: a failed
 * fetch leaving a list empty, and the empty state then announcing "No chats
 * yet" to somebody who has plenty. EMPTY AND UNREACHABLE ARE DIFFERENT FACTS.
 * One is about the account, the other about the network, and a screen that
 * confuses them sends people looking for a problem that is not theirs.
 *
 * The retry is a button rather than "reload the page" advice. A list that
 * failed to load is unusable until it succeeds, and a transient blip should
 * cost one tap, not a full reload of an app that has a websocket to re-establish.
 */

type LoadFailedProps = {
  /** What could not be loaded, in the user's words: "your chats". */
  what: string;
  /** The server's reason, when there is one worth showing. */
  message?: string | null;
  onRetry: () => void;
  className?: string;
};

export function LoadFailed({
  what,
  message,
  onRetry,
  className,
}: LoadFailedProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-dashed border-rose-300 bg-rose-50/60 p-6 text-center dark:border-rose-900/60 dark:bg-rose-950/20 ${className ?? ""}`}
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Couldn&apos;t load {what}
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {/* The server's own words when it gave any - "Network error. Please try
            again." is already what the client says for an unreachable host. */}
        {message || "Check your connection and try again."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Try again
      </button>
    </div>
  );
}
