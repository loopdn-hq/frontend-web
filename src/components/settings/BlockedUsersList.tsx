"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import {
  fetchBlockedUsers,
  unblockUser,
  type BlockedEntry,
} from "@/lib/user/blocks";
import { SettingsError, SettingsHeading } from "./SettingsRows";

/**
 * The people you have blocked, loaded once when Privacy opens.
 *
 * `entries` is null until the list arrives, so Privacy can leave the count off
 * rather than claim zero while it is still loading. `removed` takes somebody
 * off after an unblock, so the count on the way back is already right.
 */
export function useBlockedUsers() {
  const [entries, setEntries] = useState<BlockedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return { entries, error, removed };
}

/**
 * Who you have blocked, and a way to undo each one - the view behind
 * Privacy → Blocked users.
 *
 * Nothing here can ADD a block. That happens where you meet somebody - the
 * menu on a one-to-one conversation, in the chat list or in its header - not
 * in a settings list.
 *
 * Undoing one happens in both places. This list is the one that still works
 * when the conversation it was made from is gone, and the only place a block
 * on a bare phone number can be reached at all.
 */
export function BlockedUsersList({
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

  // After an unblock the focused button is gone with its row, so the dialog's
  // own return-focus has nothing to go back to and focus would fall to the
  // page behind. Send it to the Unblock now in the same place, or to the
  // heading once nobody is left.
  const root = useRef<HTMLDivElement>(null);
  const refocusAt = useRef<number | null>(null);

  useEffect(() => {
    const index = refocusAt.current;
    if (confirming !== null || index === null) return;
    refocusAt.current = null;

    const buttons = root.current?.querySelectorAll<HTMLElement>("li button");
    const next =
      buttons && buttons.length > 0
        ? buttons[Math.min(index, buttons.length - 1)]
        : null;
    (next ?? root.current?.querySelector<HTMLElement>("h2"))?.focus();
  }, [confirming]);

  async function confirmUnblock() {
    if (!confirming || busy) return;
    setBusy(true);
    setError(null);
    const result = await unblockUser(confirming);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    refocusAt.current = matches.indexOf(confirming);
    onUnblocked(confirming);
    setConfirming(null);
  }

  return (
    <div ref={root} className="space-y-4">
      {/* The design has no way back out of this view. Without one the only
          escape is closing the whole dialog, so there is one. */}
      <SettingsHeading
        title="Blocked users"
        description="People you block can't message you directly or add you to a group. Groups you already share stay as they are - you both stay members and see each other's messages - except that their messages there no longer reach you by text or email."
        backLabel="Privacy"
        onBack={onBack}
      />

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

      {error && !confirming && <SettingsError>{error}</SettingsError>}

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
            {/* aria-disabled, not disabled: this button has focus, and
                disabling it would throw focus out of the dialog mid-request. */}
            <Button
              onClick={confirmUnblock}
              aria-disabled={busy}
              className="aria-disabled:opacity-60"
            >
              {busy ? "Unblocking..." : "Unblock"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {confirming?.label} will be able to send you direct messages and add
          you to groups again.
        </p>
        {error && <SettingsError className="mt-3">{error}</SettingsError>}
      </Modal>
    </div>
  );
}
