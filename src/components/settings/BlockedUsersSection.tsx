"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, ChevronRight } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import {
  fetchBlockedUsers,
  unblockUser,
  type BlockedEntry,
} from "@/lib/user/blocks";

/**
 * Privacy: who you have stopped hearing from.
 *
 * Two views in one section rather than a route of its own - the summary row
 * with a count, and the list behind it - because the settings dialog has no
 * router and a person on this screen is answering one question: "who did I
 * block, and do I still mean it".
 *
 * Nothing here can ADD a block. That happens where you meet somebody, not in
 * a settings list, and the list is the only place it can be undone.
 */
export function BlockedUsersSection() {
  const [entries, setEntries] = useState<BlockedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchBlockedUsers().then((result) => {
      if (cancelled) return;
      if (result.ok) setEntries(result.blocked);
      else setError(result.message);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function removed(entry: BlockedEntry) {
    setEntries((current) =>
      (current ?? []).filter((row) => row.id !== entry.id),
    );
  }

  if (showList) {
    return (
      <BlockedUsersList
        entries={entries ?? []}
        onBack={() => setShowList(false)}
        onUnblocked={removed}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Privacy
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage who can contact you on Loopd&apos;n.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowList(true)}
        disabled={entries === null}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950/40">
          <Ban className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-900 dark:text-slate-100">
            Blocked users
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Manage people you&apos;ve blocked
          </span>
        </span>
        {entries !== null && (
          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            {entries.length}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function BlockedUsersList({
  entries,
  onBack,
  onUnblocked,
}: {
  entries: BlockedEntry[];
  onBack: () => void;
  onUnblocked: (entry: BlockedEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<BlockedEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      [entry.label, entry.username, entry.phoneNumber]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [entries, query]);

  async function confirmUnblock() {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    const result = await unblockUser(confirming);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    onUnblocked(confirming);
    setConfirming(null);
  }

  return (
    <div className="space-y-4">
      <div>
        {/* The design has no way back out of this view. Without one the only
            escape is closing the whole dialog, so there is one. */}
        <button
          type="button"
          onClick={onBack}
          className="mb-2 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Privacy
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Blocked users
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          People you block can&apos;t message you directly or add you to a
          group. Groups you already share are unaffected - you both stay
          members, and you both still see each other&apos;s messages there.
        </p>
      </div>

      {entries.length > 0 && (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocked users"
          aria-label="Search blocked users"
          className="rounded-lg px-3 py-2"
        />
      )}

      {entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          You haven&apos;t blocked anyone.
        </p>
      )}

      {entries.length > 0 && matches.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nobody matches “{query.trim()}”.
        </p>
      )}

      <ul className="space-y-2">
        {matches.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <ChatAvatar name={entry.label} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {entry.label}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {entry.username ? `@${entry.username}` : entry.phoneNumber}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setConfirming(entry);
              }}
            >
              Unblock
            </Button>
          </li>
        ))}
      </ul>

      {error && !confirming && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <Modal
        isOpen={confirming !== null}
        onClose={() => (busy ? undefined : setConfirming(null))}
        title={`Unblock ${confirming?.label ?? ""}?`}
        closeLabel="Keep them blocked"
        maxWidthClassName="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirming(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={confirmUnblock} disabled={busy}>
              {busy ? "Unblocking..." : "Unblock"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {confirming?.label} will be able to send you direct messages and add
          you to groups again.
        </p>
        {error && (
          <p
            className="mt-3 text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}
