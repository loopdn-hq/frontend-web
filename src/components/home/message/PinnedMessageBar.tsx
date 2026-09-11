"use client";

import { Pin, X } from "lucide-react";
import type { ConversationMessage } from "@/lib/chat/conversations";

/**
 * The one message held above the thread.
 *
 * Sits between the conversation header and the scrolling list, so it stays put
 * while the thread moves under it - which is the whole point of a pin.
 *
 * Clicking it jumps to the message in place. The X is offered only to somebody
 * who may unpin; for everyone else the bar is a link and nothing more, rather
 * than a button that will be refused.
 */

type PinnedMessageBarProps = {
  message: ConversationMessage;
  canUnpin: boolean;
  onJump: (messageId: string | number) => void;
  onUnpin: () => void;
};

export function PinnedMessageBar({
  message,
  canUnpin,
  onJump,
  onUnpin,
}: PinnedMessageBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-sky-100 bg-sky-50/70 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/60">
      <Pin
        className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => onJump(message.id)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-[11px] font-semibold text-sky-700 dark:text-sky-300">
          Pinned · {message.sender}
        </span>
        <span className="block truncate text-xs text-slate-600 dark:text-slate-400">
          {message.text || "Attachment"}
        </span>
      </button>
      {canUnpin && (
        <button
          type="button"
          onClick={onUnpin}
          aria-label="Unpin this message"
          className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
