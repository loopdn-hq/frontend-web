"use client";

import { allows, GROUP } from "@/lib/rbac";
import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ChatAvatar } from "../ChatAvatar";
import type { Conversation } from "@/lib/chat/conversations";
import type { ThreadMessage } from "./MessageBubble";

/**
 * Pick where a message goes next.
 *
 * The list is the conversations the viewer is already in - there is nowhere
 * else a forward could land - filtered by a plain substring search, which is
 * enough for a list this size and needs no endpoint.
 *
 * A BROADCAST group the viewer does not administer is offered but disabled
 * rather than hidden: a group that silently vanishes from this list reads as a
 * bug, while a greyed row with a reason reads as the rule it is.
 *
 * The warning at the bottom is not decoration. A forward is a real message in
 * the destination, so the people there who take that group by text will be
 * texted - and that costs money and reaches a phone.
 */

type ForwardMessageModalProps = {
  message: Pick<ThreadMessage, "sender" | "text">;
  conversations: Conversation[];
  /** Where it already is. Forwarding a message to its own thread is a no-op. */
  sourceConversationId: string | number | null;
  busy: boolean;
  error: string | null;
  onForward: (conversationId: string | number) => void;
  onClose: () => void;
};

function cannotPostReason(conversation: Conversation): string | null {
  // The server already applied broadcast mode when it built `features`, so
  // this no longer restates the rule - it reads the answer.
  if (!allows(conversation, GROUP.send)) {
    return "Only admins can post here";
  }
  return null;
}

export function ForwardMessageModal({
  message,
  conversations,
  sourceConversationId,
  busy,
  error,
  onForward,
  onClose,
}: ForwardMessageModalProps) {
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter(
      (conversation) =>
        String(conversation.id) !== String(sourceConversationId) &&
        (!needle || conversation.name.toLowerCase().includes(needle)),
    );
  }, [conversations, query, sourceConversationId]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Forward message"
      description="Pick where to send it."
      maxWidthClassName="max-w-md"
      closeLabel="Close forward"
    >
      <div className="space-y-3">
        <blockquote className="rounded-lg border-l-2 border-slate-300 bg-slate-50 py-1.5 pr-2 pl-2.5 text-xs dark:border-slate-600 dark:bg-slate-800">
          <span className="block font-semibold text-slate-700 dark:text-slate-200">
            {message.sender}
          </span>
          <span className="block truncate text-slate-600 dark:text-slate-400">
            {message.text || "Attachment"}
          </span>
        </blockquote>

        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your Loops"
            aria-label="Search your Loops"
            className="w-full rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {candidates.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No other Loops to forward to.
            </li>
          )}
          {candidates.map((conversation) => {
            const refusal = cannotPostReason(conversation);
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  disabled={busy || refusal !== null}
                  onClick={() => onForward(conversation.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  <ChatAvatar
                    name={conversation.name}
                    imageUrl={conversation.logoImage ?? undefined}
                    size={32}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {conversation.name}
                    </span>
                    {refusal && (
                      <span className="block text-xs text-slate-400">
                        {refusal}
                      </span>
                    )}
                  </span>
                  <Send
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          A forward is a new message there — members who take that Loop by text
          or email will receive it that way.
        </p>
      </div>
    </Modal>
  );
}
