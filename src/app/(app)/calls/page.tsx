"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
} from "lucide-react";
import { ActivityFeedSkeleton } from "@/components/app/ActivityFeedSkeleton";
import { LoadFailed } from "@/components/app/LoadFailed";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { dayBucket, timeLabel } from "@/components/app/activityCopy";
import {
  CallDetailPanel,
  callDurationSeconds,
} from "@/components/calls/CallDetailPanel";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { fetchCalls, isCallLive, type Call } from "@/lib/calls/api";
import { parseCallEvent } from "@/lib/calls/events";
import { formatCallDuration } from "@/lib/calls/format";

/** Which way the call went - the arrow on the icon. */
type Direction = "outgoing" | "incoming" | "live";

/**
 * How it turned out - the colour.
 *
 * Kept apart from the direction because they answer different questions, and
 * colouring by direction alone hid the one case a call list exists to show: an
 * outgoing call nobody picked up was drawn exactly like one that connected.
 */
type Outcome = "answered" | "missed" | "live";

function isMine(call: Call, username: string | undefined): boolean {
  return Boolean(username) && call.createdBy?.username === username;
}

function joinedByMe(call: Call, username: string | undefined): boolean {
  return (
    Boolean(username) &&
    call.participants.some((stay) => stay.user.username === username)
  );
}

/**
 * Whether anybody actually picked up.
 *
 * `started_at` is the server's own answer to that: it is stamped when somebody
 * OTHER than the caller joins, which is the moment a call stops ringing (see
 * calls/services.py, join_call). A call that rang out, or was declined, never
 * gets one - so this is true of connected calls only, whatever ended them.
 */
function wasAnswered(call: Call): boolean {
  return call.startedAt !== null;
}

function directionOf(call: Call, username: string | undefined): Direction {
  if (isCallLive(call)) return "live";
  return isMine(call, username) ? "outgoing" : "incoming";
}

/**
 * Green once the call was answered AND this account was on it; red when it was
 * not. Being in the conversation is not the same as having been on the call: a
 * group call that went ahead without you is one you missed, which is the same
 * rule a phone uses.
 */
function outcomeOf(call: Call, username: string | undefined): Outcome {
  if (isCallLive(call)) return "live";
  if (!wasAnswered(call)) return "missed";
  return joinedByMe(call, username) ? "answered" : "missed";
}

function iconFor(direction: Direction, outcome: Outcome) {
  if (direction === "live") return Phone;
  if (outcome === "missed") return PhoneMissed;
  return direction === "outgoing" ? PhoneOutgoing : PhoneIncoming;
}

const OUTCOME_TONE: Record<Outcome, string> = {
  answered: "text-emerald-600 dark:text-emerald-400",
  missed: "text-rose-500",
  live: "text-emerald-500",
};

/** What the second line says when there is no duration to show. */
function outcomeLabel(call: Call, outcome: Outcome): string {
  if (outcome === "live") return "In progress";
  if (call.endReason === "declined") return "Declined";
  return wasAnswered(call) ? "Missed" : "No answer";
}

export default function CallsPage() {
  const { conversations, userProfile, subscribeToSocket } = useAppShell();
  const [calls, setCalls] = useState<Call[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCalls().then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setCalls(result.calls);
      setPage(1);
      setHasMore(result.hasMore);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // The socket carries the whole call on every change, so the list keeps
  // itself current - a call that rings, is answered or ends updates in place.
  useEffect(
    () =>
      subscribeToSocket((message) => {
        const event = parseCallEvent(message);
        if (!event) return;
        setCalls((current) => {
          const index = current.findIndex((row) => row.id === event.callId);
          if (index === -1) return [event.call, ...current];
          const next = current.slice();
          next[index] = event.call;
          return next;
        });
      }),
    [subscribeToSocket],
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    fetchCalls({ page: nextPage }).then((result) => {
      setIsLoadingMore(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCalls((current) => {
        const known = new Set(current.map((row) => row.id));
        return [
          ...current,
          ...result.calls.filter((row) => !known.has(row.id)),
        ];
      });
      setPage(nextPage);
      setHasMore(result.hasMore);
    });
  }, [hasMore, isLoadingMore, page]);

  const titleFor = useCallback(
    (call: Call) =>
      conversations.find(
        (row) => String(row.id) === String(call.conversationId),
      )?.name ?? "Conversation",
    [conversations],
  );

  const groups = useMemo(() => {
    const buckets: { bucket: string; rows: Call[] }[] = [];
    for (const row of calls) {
      const bucket = dayBucket(row.createdAt);
      const last = buckets[buckets.length - 1];
      if (last && last.bucket === bucket) last.rows.push(row);
      else buckets.push({ bucket, rows: [row] });
    }
    return buckets;
  }, [calls]);

  const selected = calls.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="grid h-full min-h-0 w-full overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[420px_1fr]">
      <section
        className={`${
          selected ? "hidden md:flex" : "flex"
        } min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
      >
        <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-1">
            <NavDrawerButton className="-ml-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
                Calls
              </h1>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                Voice and video calls in your Loops
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isLoading && calls.length === 0 ? (
            <ActivityFeedSkeleton />
          ) : error && calls.length === 0 ? (
            <LoadFailed
              what="your calls"
              message={error}
              onRetry={() => {
                setIsLoading(true);
                setError(null);
                setReloadToken((token) => token + 1);
              }}
            />
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <Phone className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                No calls yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Start one from the phone or camera button in any chat.
              </p>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.bucket} className="mb-4">
                  <p className="mb-2 px-1 text-2xs font-bold tracking-[0.1em] text-slate-400 uppercase dark:text-slate-500">
                    {group.bucket}
                  </p>
                  <div className="space-y-1">
                    {group.rows.map((call) => {
                      const direction = directionOf(call, userProfile.username);
                      const outcome = outcomeOf(call, userProfile.username);
                      const Icon = iconFor(direction, outcome);
                      const duration = callDurationSeconds(call);
                      return (
                        <button
                          key={call.id}
                          type="button"
                          onClick={() => setSelectedId(call.id)}
                          aria-current={call.id === selectedId}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                            call.id === selectedId
                              ? "bg-sky-50 dark:bg-slate-800"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          {/* The colour is the outcome, the arrow is the
                              direction, and the label says both - so the
                              answered/missed distinction is never carried by
                              colour alone. */}
                          <Icon
                            className={`h-4 w-4 shrink-0 ${OUTCOME_TONE[outcome]}`}
                            aria-label={
                              outcome === "live"
                                ? "In progress"
                                : outcome === "missed"
                                  ? outcomeLabel(call, outcome)
                                  : `Answered, ${direction}`
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-semibold ${
                                outcome === "missed"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {titleFor(call)}
                            </p>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                              {call.type === "video" ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <Phone className="h-3 w-3" />
                              )}
                              {/* A duration is only shown for a call this
                                  account was actually on; for one that went
                                  ahead without you, how long it ran is not
                                  the answer to "did I miss it". */}
                              {outcome === "answered" && duration !== null
                                ? formatCallDuration(duration)
                                : outcomeLabel(call, outcome)}
                            </p>
                          </div>
                          <span className="shrink-0 text-2xs text-slate-400">
                            {timeLabel(call.createdAt, group.bucket)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="w-full rounded-xl py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                >
                  {isLoadingMore ? "Loading..." : "Load older calls"}
                </button>
              )}
              {error && calls.length > 0 && (
                <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section
        className={`${
          selected ? "flex" : "hidden md:flex"
        } min-h-0 flex-col overflow-y-auto bg-[#f7fbff] dark:bg-slate-950`}
      >
        {selected ? (
          <CallDetailPanel
            call={selected}
            title={titleFor(selected)}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Select a call to see who was on it and any recordings.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
