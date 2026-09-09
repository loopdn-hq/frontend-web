"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Search, Users } from "lucide-react";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { LoadingSpinner } from "@/components/auth/LoadingSpinner";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
  joinConversation,
  joinConversationWithCode,
  searchGroups,
  type DiscoverableGroup,
} from "@/lib/chat/conversations";

// The server refuses a shorter term rather than returning the whole product,
// so the client says why instead of firing a request it knows will be empty.
const MIN_QUERY_LENGTH = 2;

type Outcome = { id: string; kind: "joined" | "requested"; name: string };

/** What the card's button says, which is the whole of how a mode is explained. */
function actionLabel(group: DiscoverableGroup): string {
  return group.joinMode === "approval" ? "Request to join" : "Join group";
}

function badgeFor(group: DiscoverableGroup): { label: string; tone: string } {
  if (group.mode === "broadcast") {
    return {
      label: "Broadcast",
      tone: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    };
  }
  if (group.joinMode === "approval") {
    return {
      label: "Approval",
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    };
  }
  if (group.joinMode === "code") {
    return {
      label: "Code required",
      tone: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    };
  }
  return {
    label: "Public",
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
}

function memberLabel(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K members`;
  return count === 1 ? "1 member" : `${count} members`;
}

export default function FindGroupsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [groups, setGroups] = useState<DiscoverableGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [codeFor, setCodeFor] = useState<DiscoverableGroup | null>(null);

  const term = debouncedQuery.trim();
  const isTooShort = term.length > 0 && term.length < MIN_QUERY_LENGTH;

  // Nothing is cleared here when the term gets too short - the memo below
  // derives that instead. An effect that writes state on the way in has to
  // re-render to undo itself, and React lints against it for that reason.
  useEffect(() => {
    if (term.length < MIN_QUERY_LENGTH) return;

    let cancelled = false;
    const run = async () => {
      setIsSearching(true);
      const result = await searchGroups(term);
      if (cancelled) return;

      setIsSearching(false);
      if (!result.ok) {
        setError(result.message);
        setGroups([]);
        return;
      }
      setError("");
      setGroups(result.groups);
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [term]);

  const settle = useCallback(
    (group: DiscoverableGroup, kind: Outcome["kind"]) => {
      // Drop it from the results: they are in it now (or waiting on an admin),
      // and the server would not return it on the next search either.
      setGroups((prev) =>
        prev.filter((row) => String(row.id) !== String(group.id)),
      );
      setOutcomes((prev) => [
        ...prev,
        { id: String(group.id), kind, name: group.name },
      ]);
    },
    [],
  );

  const join = useCallback(
    async (group: DiscoverableGroup) => {
      if (group.joinMode === "code") {
        setCodeFor(group);
        return;
      }

      setJoiningId(String(group.id));
      setError("");
      const result = await joinConversation(group.id);
      setJoiningId(null);

      if (!result.ok) {
        setError(result.message);
        return;
      }
      settle(group, result.status === "pending" ? "requested" : "joined");
    },
    [settle],
  );

  const results = useMemo(() => {
    // A term below the threshold shows nothing rather than the previous term's
    // results, which would otherwise sit there looking like an answer.
    const visible = term.length < MIN_QUERY_LENGTH ? [] : groups;

    return visible.map((group) => {
      const badge = badgeFor(group);
      const busy = joiningId === String(group.id);
      return (
        <article
          key={group.id}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3">
            {group.logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.logoImage}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {group.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}
            >
              {badge.label}
            </span>
          </div>

          <h2 className="mt-3 truncate font-semibold text-slate-900 dark:text-slate-100">
            {group.name}
          </h2>
          {group.description && (
            <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
              {group.description}
            </p>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Users className="h-4 w-4" />
            {memberLabel(group.memberCount)}
          </p>

          <button
            type="button"
            onClick={() => join(group)}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {busy ? <LoadingSpinner /> : actionLabel(group)}
          </button>
        </article>
      );
    });
  }, [groups, join, joiningId, term]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-1">
          <NavDrawerButton className="-ml-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
              Find groups
            </h1>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              Search public Loops by name
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <label className="relative block">
          <span className="sr-only">Search groups</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search groups by name"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pr-4 pl-12 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>

        {outcomes.length > 0 && (
          <div className="mt-4 space-y-2">
            {outcomes.map((outcome) => (
              <p
                key={`${outcome.id}-${outcome.kind}`}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              >
                {outcome.kind === "joined" ? (
                  <>
                    You joined <strong>{outcome.name}</strong>.
                    <button
                      type="button"
                      onClick={() => router.push("/chats/")}
                      className="font-semibold underline underline-offset-2"
                    >
                      Open it
                    </button>
                  </>
                ) : (
                  <>
                    Your request to join <strong>{outcome.name}</strong> is with
                    the admins.
                  </>
                )}
              </p>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-6">
          {isSearching ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Searching…
            </p>
          ) : results.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results}
            </div>
          ) : (
            <EmptyState term={term} isTooShort={isTooShort} />
          )}
        </div>
      </div>

      {codeFor && (
        <CodeModal
          group={codeFor}
          onClose={() => setCodeFor(null)}
          onJoined={(group) => {
            setCodeFor(null);
            settle(group, "joined");
          }}
        />
      )}
    </div>
  );
}

function EmptyState({
  term,
  isTooShort,
}: {
  term: string;
  isTooShort: boolean;
}) {
  if (isTooShort) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Keep typing — searches need at least {MIN_QUERY_LENGTH} characters.
      </p>
    );
  }
  if (!term) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <Search className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">
          Search for a group to join
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Groups you are already in will not appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
      <p className="font-semibold text-slate-900 dark:text-slate-100">
        No groups found for “{term}”
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Invite-only groups never appear in search, and neither do groups you are
        already in.
      </p>
    </div>
  );
}

/**
 * The code is asked for at the moment of joining rather than up front.
 *
 * A standing "enter a code" box asks people to prove something before they
 * have chosen anything; here the group is already named on screen, so the box
 * has an obvious subject.
 */
function CodeModal({
  group,
  onClose,
  onJoined,
}: {
  group: DiscoverableGroup;
  onClose: () => void;
  onJoined: (group: DiscoverableGroup) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the group code.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    const result = await joinConversationWithCode(trimmed);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    onJoined(group);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Join {group.name}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          This group needs a code. Ask an admin if you do not have one.
        </p>

        <form onSubmit={submit} className="mt-5" noValidate>
          <label className="relative block">
            <span className="sr-only">Group code</span>
            <KeyRound className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={code}
              autoFocus
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. ABC123"
              className="w-full rounded-xl border border-slate-200 py-3 pr-4 pl-12 tracking-widest text-slate-800 uppercase outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>

          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {isSubmitting ? <LoadingSpinner /> : "Join group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
