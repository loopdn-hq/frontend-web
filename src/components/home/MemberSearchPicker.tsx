"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Mail, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui";
import type { EmailInvite, MemberCandidate } from "@/lib/chat/conversations";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { ChatAvatar } from "./ChatAvatar";

/**
 * Find people to add to a Loop, one search at a time, and collect them.
 *
 * WHAT A SEARCH CAN FIND is the server's rule and is written into the copy
 * here so nobody types the wrong thing: a username by its first letters, and
 * an email or a phone number only in full. A half-typed address finds nobody
 * on purpose - a prefix over addresses would let anybody walk the directory.
 *
 * AT MOST FIVE ROWS, which the server enforces too. More than that in a dialog
 * pushes the buttons off screen, and a list long enough to scroll is a
 * directory rather than a search; past five the answer is to keep typing.
 *
 * Every row says what adding that person would do before they are picked, so
 * somebody already here, or who does not accept group adds, is shown but
 * cannot be picked - the add is all-or-nothing, and one bad pick would fail it.
 *
 * A WHOLE ADDRESS THAT FINDS NOBODY becomes an invitation instead: one row for
 * the address itself, picked like a person and sent as an email invitation.
 * The copy says "invite", never "we emailed them" - the server answers an
 * address whose owner hid it exactly like a free one, and invites nobody.
 */

/** Somebody picked to be added: an account, or an address to invite. */
export type MemberPick =
  | {
      kind: "account";
      id: string;
      name: string;
      username: string;
      avatarUrl?: string;
    }
  | { kind: "email"; id: string; name: string; email: string };

export type MemberSearchResult =
  | {
      ok: true;
      candidates: MemberCandidate[];
      hasMore: boolean;
      invite: EmailInvite | null;
    }
  | { ok: false; message: string };

type MemberSearchPickerProps = {
  inputId: string;
  selected: MemberPick[];
  onSelect: (pick: MemberPick) => void;
  onRemove: (pick: MemberPick) => void;
  onSearch: (term: string) => Promise<MemberSearchResult>;
  disabled?: boolean;
};

/** One line of results, whichever kind it is. */
type Row = {
  pick: MemberPick;
  status: MemberCandidate["status"];
  /** Under the name: the handle, why it cannot be added, or what picking does. */
  subtitle: string;
  /** Shown instead of the + when there is nothing to add. */
  badge: string;
};

function rowsFrom(result: MemberSearchResult | null): Row[] {
  if (!result?.ok) return [];
  const rows: Row[] = result.candidates.map((person) => ({
    pick: {
      kind: "account",
      id: person.id,
      name: person.name,
      username: person.username,
      avatarUrl: person.avatarUrl,
    },
    status: person.status,
    subtitle:
      person.status === "refused" ? person.detail : `@${person.username}`,
    badge: "In this Loop",
  }));
  if (result.invite) {
    const { email, status, detail } = result.invite;
    rows.push({
      pick: { kind: "email", id: `email:${email}`, name: email, email },
      status,
      subtitle:
        status === "ready"
          ? "No account found. Invite them by email instead."
          : detail,
      badge: "Invited",
    });
  }
  return rows;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FULL_NUMBER = /^\+\d{7,15}$/;

/** Whether the server would answer this term at all, and if not, why not. */
function readTerm(term: string): { searchable: boolean; wait?: string } {
  if (!term) return { searchable: false };
  if (term.includes("@")) {
    return EMAIL.test(term)
      ? { searchable: true }
      : {
          searchable: false,
          wait: "Finish the email - only a full address finds someone.",
        };
  }
  if (term.startsWith("+")) {
    return FULL_NUMBER.test(term)
      ? { searchable: true }
      : {
          searchable: false,
          wait: "Enter the whole number, with its country code.",
        };
  }
  return term.length >= 2
    ? { searchable: true }
    : { searchable: false, wait: "Keep typing..." };
}

function emptyMessage(term: string): string {
  if (term.includes("@")) return "No Loopd'n account uses that email.";
  if (term.startsWith("+")) {
    return "No Loopd'n account has that number. You can invite them from Via Phone.";
  }
  return `No usernames start with "${term}".`;
}

export function MemberSearchPicker({
  inputId,
  selected,
  onSelect,
  onRemove,
  onSearch,
  disabled = false,
}: MemberSearchPickerProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim(), 300);
  const { searchable, wait } = readTerm(term);

  // Kept with the term it answers, so a slow reply for "ma" is never shown
  // under "mar", and clearing the box needs no effect of its own.
  const [answer, setAnswer] = useState<{
    term: string;
    result: MemberSearchResult;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    void onSearch(term).then((result) => {
      if (!cancelled) setAnswer({ term, result });
    });
    return () => {
      cancelled = true;
    };
  }, [term, searchable, onSearch]);

  const typed = query.trim();
  const current = answer && answer.term === term ? answer.result : null;
  // Still typing, or asked and waiting. The last answer stays on screen,
  // dimmed, rather than the list collapsing and re-growing on every letter.
  // An emptied box hides the list at once, not after the debounce catches up -
  // which is also what makes a pick feel done.
  const isSearching =
    Boolean(typed) && searchable && (typed !== term || current === null);
  const shown =
    typed && searchable ? (current ?? answer?.result ?? null) : null;
  const rows = rowsFrom(shown);

  const selectedIds = new Set(selected.map((person) => person.id));
  const pickable = rows.filter((row) => row.status === "ready");
  const active =
    pickable.find((row) => row.pick.id === activeId) ?? pickable[0] ?? null;

  function pick(row: Row) {
    if (row.status !== "ready") return;
    if (selectedIds.has(row.pick.id)) {
      onRemove(row.pick);
      return;
    }
    onSelect(row.pick);
    // Ready for the next person: one search, one pick is how this is used.
    setQuery("");
    setActiveId(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (pickable.length === 0) return;
      event.preventDefault();
      const at = active ? pickable.indexOf(active) : -1;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (at + step + pickable.length) % pickable.length;
      setActiveId(pickable[next].pick.id);
      return;
    }
    if (event.key === "Enter" && typed) {
      // Never submits mid-search: Enter picks the highlighted person.
      event.preventDefault();
      if (active && !isSearching) pick(active);
      return;
    }
    if (event.key === "Backspace" && !query && selected.length > 0) {
      onRemove(selected[selected.length - 1]);
    }
  }

  const status = !typed
    ? null
    : wait && typed === term
      ? wait
      : shown && !shown.ok
        ? shown.message
        : !isSearching && current?.ok && rows.length === 0
          ? emptyMessage(term)
          : null;

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        // Capped, so picking twenty people scrolls this strip and never
        // pushes the buttons out of the dialog.
        <ul
          aria-label="People to add"
          className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto"
        >
          {selected.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 py-0.5 pr-1 pl-0.5 text-xs font-medium text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
            >
              <PickAvatar pick={person} size={20} />
              <span className="max-w-[10rem] truncate">{person.name}</span>
              <button
                type="button"
                onClick={() => onRemove(person)}
                disabled={disabled}
                aria-label={`Remove ${person.name}`}
                className="rounded-full p-0.5 text-sky-600 transition hover:bg-sky-100 hover:text-sky-900 dark:text-sky-300 dark:hover:bg-sky-900/60"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            active ? `${listId}-${active.pick.id}` : undefined
          }
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by username or email"
          autoFocus
          disabled={disabled}
          className="pr-10 pl-10"
        />
        {isSearching && (
          <Loader2
            aria-hidden
            className="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}
      </div>

      {rows.length > 0 && (
        <div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Search results"
            aria-multiselectable
            className={`divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 transition dark:divide-slate-800 dark:border-slate-700 ${
              isSearching ? "opacity-60" : ""
            }`}
          >
            {rows.map((row) => {
              const isPicked = selectedIds.has(row.pick.id);
              const isReady = row.status === "ready";
              const isActive = active?.pick.id === row.pick.id;
              return (
                <li
                  key={row.pick.id}
                  id={`${listId}-${row.pick.id}`}
                  role="option"
                  aria-selected={isPicked}
                  aria-disabled={!isReady}
                  // mousedown, so the box keeps focus and the keyboard keeps
                  // working after a click.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(row)}
                  onMouseEnter={() => isReady && setActiveId(row.pick.id)}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    isReady
                      ? `cursor-pointer ${
                          isActive
                            ? "bg-sky-50 dark:bg-slate-800"
                            : "bg-white dark:bg-slate-900"
                        }`
                      : "cursor-not-allowed bg-white opacity-70 dark:bg-slate-900"
                  }`}
                >
                  <PickAvatar pick={row.pick} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {row.pick.name}
                    </span>
                    <span
                      title={row.subtitle || undefined}
                      className={`block truncate text-xs ${
                        row.status === "refused"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {row.subtitle}
                    </span>
                  </span>
                  <RowState
                    status={row.status}
                    badge={row.badge}
                    isPicked={isPicked}
                  />
                </li>
              );
            })}
          </ul>
          {shown?.ok && shown.hasMore && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              More people match. Keep typing to narrow it down.
            </p>
          )}
        </div>
      )}

      {status ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          {status}
        </p>
      ) : (
        !typed && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Type a username, or someone&apos;s full email or phone number. No
            account? You can invite an email address.
          </p>
        )
      )}
    </div>
  );
}

/** A person's picture, or an envelope for an address being invited. */
function PickAvatar({ pick, size }: { pick: MemberPick; size: number }) {
  if (pick.kind === "email") {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        style={{ width: size, height: size }}
      >
        <Mail style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    );
  }
  return <ChatAvatar name={pick.name} imageUrl={pick.avatarUrl} size={size} />;
}

function RowState({
  status,
  badge,
  isPicked,
}: {
  status: MemberCandidate["status"];
  badge: string;
  isPicked: boolean;
}) {
  if (status === "already_member") {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {badge}
      </span>
    );
  }
  if (status === "refused") return null;
  return isPicked ? (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
      <Check className="h-3.5 w-3.5" aria-hidden />
    </span>
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-400 dark:border-slate-600">
      <Plus className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}
