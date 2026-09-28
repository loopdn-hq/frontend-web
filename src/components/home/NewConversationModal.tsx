"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Mail, Search, Users } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { ChatAvatar } from "./ChatAvatar";
import { startDirectConversation } from "@/lib/chat/conversations";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { inviteToApp } from "@/lib/user/invites";
import { publicOrigin } from "@/lib/config/origin";
import {
  MIN_USER_SEARCH_LENGTH,
  searchUsers,
  type UserSearchResult,
} from "@/lib/user/search";

/**
 * Where a conversation starts: find one person, or make a group.
 *
 * NOTHING IS LISTED BEFORE YOU TYPE, and that is a limit of what exists, not a
 * choice about the design. There is no endpoint that lists people - the
 * conversation list deliberately carries no members, and search answers
 * nothing under two characters - so a list here would have to be invented.
 *
 * Search is by USERNAME. The server matches a username prefix, or a verified
 * number typed in full; it does not search display names. The placeholder says
 * username because saying "name" would send people typing "Maria" and finding
 * nobody called maria.santos.
 *
 * An email cannot be searched at all - it is not public - but it can still
 * OPEN a conversation if it is verified on somebody's account, so a typed
 * address gets a row of its own. That keeps what the previous direct-message
 * box could do.
 *
 * WHEN NOBODY MATCHES there is an invitation to offer, because a conversation
 * needs an account at both ends. An address we can email ourselves; a phone
 * number we cannot text - see lib/user/invites - so that one becomes a link to
 * send by hand. The wording never says an email was delivered: the server
 * answers a hidden address exactly like a free one, and the screen must not
 * give away what the server is hiding.
 */
export function NewConversationModal({
  onClose,
  onStarted,
  onCreateGroup,
}: {
  onClose: () => void;
  onStarted: (conversationId: string | number) => Promise<void> | void;
  onCreateGroup: () => void;
}) {
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim(), 300);

  // Stored with the term it answers, so a slow response for "ma" can never be
  // shown under "mar" - and so shortening the query needs no clearing effect.
  const [results, setResults] = useState<{
    term: string;
    users: UserSearchResult[];
    hasMore: boolean;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  // Kept with the term it belongs to, like the results above: typing on is
  // what clears a sent invitation, so one address's answer is never shown
  // under another.
  const [invite, setInvite] = useState<{
    term: string;
    status: "offered" | "sending" | "sent" | "already" | "copied";
    error?: string;
  } | null>(null);

  const searchable =
    term.length >= MIN_USER_SEARCH_LENGTH && !term.includes("@");

  useEffect(() => {
    if (!searchable) return;

    let cancelled = false;
    const run = async () => {
      const result = await searchUsers(term);
      if (cancelled) return;

      if (result.ok) {
        setSearchError(null);
        setResults({ term, users: result.users, hasMore: result.hasMore });
      } else {
        setSearchError(result.message);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [term, searchable]);

  const current = results && results.term === term ? results : null;
  const isSearching = searchable && current === null && !searchError;
  const looksLikeEmail = term.includes("@") && term.length >= 3;
  const inviteState = invite && invite.term === term ? invite : null;

  async function sendInvite(email: string) {
    setInvite({ term: email, status: "sending" });

    const result = await inviteToApp(email);
    if (!result.ok) {
      setInvite({ term: email, status: "offered", error: result.message });
      return;
    }
    setInvite({ term: email, status: result.alreadyHere ? "already" : "sent" });
  }

  async function copyInviteLink() {
    // Must be a link the recipient can open in a browser, so the public web
    // origin rather than the desktop build's tauri://localhost.
    const link = `${publicOrigin()}/signup`;
    try {
      await navigator.clipboard.writeText(link);
      setInvite({ term, status: "copied" });
    } catch {
      // A browser that refuses the clipboard - or any page not on https -
      // still leaves them the link itself, which is all the button was for.
      setInvite({ term, status: "offered", error: `Copy it by hand: ${link}` });
    }
  }

  async function open(identifier: string, key: string) {
    setOpenError(null);
    setOpeningKey(key);
    const result = await startDirectConversation(identifier);
    setOpeningKey(null);

    if (!result.ok) {
      // In the server's own words: it tells the person who made a block
      // something different from everybody else, on purpose.
      setOpenError(result.message);
      // There is nobody to open a conversation with, so offer the one thing
      // that can change that. Whether the address is free or merely hidden is
      // the server's secret, and the invitation endpoint keeps it too.
      if (key.startsWith("email:")) {
        setInvite({ term: identifier, status: "offered" });
      }
      return;
    }
    await onStarted(result.conversationId);
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New conversation"
      closeLabel="Close"
      maxWidthClassName="max-w-lg"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by username"
            aria-label="Search by username"
            autoFocus
            className="rounded-xl py-2.5 pr-3 pl-9"
          />
        </div>

        {openError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {openError}
          </p>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {term.length < MIN_USER_SEARCH_LENGTH && (
            <p className="px-1 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Type at least two letters of a username. A full phone number or
              email also works if it&apos;s verified on their account.
            </p>
          )}

          {looksLikeEmail && (
            <Row
              avatar={
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
                  <Mail className="h-5 w-5" />
                </span>
              }
              title={term}
              subtitle="Opens a conversation if this email is verified"
              busy={openingKey === `email:${term}`}
              disabled={openingKey !== null}
              onMessage={() => open(term, `email:${term}`)}
            />
          )}

          {looksLikeEmail && inviteState && (
            <InviteNote>
              {inviteState.status === "sent" ? (
                <p>
                  If nobody has that address yet, an invitation is on its way.
                  They can reach you here once they sign up.
                </p>
              ) : inviteState.status === "already" ? (
                <p>They already have an account &mdash; try Message again.</p>
              ) : (
                <>
                  <p>Not on Loopd&apos;n yet? Email them an invitation.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => sendInvite(term)}
                    disabled={inviteState.status === "sending"}
                  >
                    {inviteState.status === "sending"
                      ? "Sending..."
                      : "Send invite"}
                  </Button>
                </>
              )}
              {inviteState.error && (
                <p className="text-red-600 dark:text-red-400" role="alert">
                  {inviteState.error}
                </p>
              )}
            </InviteNote>
          )}

          {isSearching && (
            <p className="px-1 py-4 text-center text-sm text-slate-400">
              Searching...
            </p>
          )}

          {searchError && searchable && (
            <p className="px-1 py-4 text-center text-sm text-red-600 dark:text-red-400">
              {searchError}
            </p>
          )}

          {current && current.users.length === 0 && !term.startsWith("+") && (
            <p className="px-1 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {`No usernames start with “${term}”.`}
            </p>
          )}

          {current && current.users.length === 0 && term.startsWith("+") && (
            <InviteNote>
              <p>No account has verified that number.</p>
              <p>
                Loopd&apos;n cannot text an invitation yet, so send them this
                link from your own messages.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copyInviteLink}
              >
                {inviteState?.status === "copied"
                  ? "Link copied"
                  : "Copy invite link"}
              </Button>
              {inviteState?.error && (
                <p className="text-red-600 dark:text-red-400" role="alert">
                  {inviteState.error}
                </p>
              )}
            </InviteNote>
          )}

          {current?.users.map((user) => (
            <Row
              key={user.id}
              avatar={
                <ChatAvatar
                  name={user.name}
                  imageUrl={user.avatarUrl}
                  size={40}
                />
              }
              title={user.name}
              subtitle={`@${user.username}`}
              busy={openingKey === user.id}
              disabled={openingKey !== null}
              onMessage={() => open(user.username, user.id)}
            />
          ))}

          {current?.hasMore && (
            <p className="px-1 pt-1 text-center text-xs text-slate-400">
              Showing the first {current.users.length}. Keep typing to narrow it
              down.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onCreateGroup}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
            <Users className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-900 dark:text-slate-100">
              Create group
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Start a group conversation
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>
    </Modal>
  );
}

/** The dashed box under the rows, where an invitation is offered. */
function InviteNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300">
      {children}
    </div>
  );
}

function Row({
  avatar,
  title,
  subtitle,
  busy,
  disabled,
  onMessage,
}: {
  avatar: React.ReactNode;
  title: string;
  subtitle: string;
  busy: boolean;
  disabled: boolean;
  onMessage: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <span className="shrink-0">{avatar}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
          {title}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </span>
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onMessage}
        disabled={disabled}
        className="shrink-0"
      >
        {busy ? "Opening..." : "Message"}
      </Button>
    </div>
  );
}
