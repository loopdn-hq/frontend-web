"use client";

import { X } from "lucide-react";
import type { ThreadMessage } from "./MessageBubble";

/**
 * The strip above the composer saying what the next send will do.
 *
 * Two jobs, one strip: answering a message, and rewriting one. They look and
 * behave identically - a coloured rule, who and what, and a way out - so a
 * second component would be the same forty lines with one word changed.
 *
 * Its own component rather than more JSX inside HomeShell, which is already
 * ~2900 lines. It owns no state: the composer decides what is pending and
 * clears it on send.
 *
 * Sits in the stack of full-width strips inside the composer card, beside the
 * error, recording and attachment rows, so it shares their layout and needs no
 * special case in the flex row below it.
 */

export type ComposerContext =
  | { kind: "reply"; message: ThreadMessage }
  | { kind: "edit"; message: ThreadMessage };

type ComposerContextBarProps = {
  context: ComposerContext;
  onCancel: () => void;
};

export function ComposerContextBar({
  context,
  onCancel,
}: ComposerContextBarProps) {
  const { kind, message } = context;
  const isEdit = kind === "edit";

  return (
    <div
      className={`mx-2 mb-2 flex items-start gap-2 rounded-lg border-l-2 py-1.5 pr-1.5 pl-2.5 ${
        isEdit
          ? "border-amber-500 bg-amber-50 dark:bg-slate-800"
          : "border-sky-500 bg-sky-50 dark:bg-slate-800"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-semibold ${
            isEdit
              ? "text-amber-700 dark:text-amber-300"
              : "text-sky-700 dark:text-sky-300"
          }`}
        >
          {isEdit ? "Editing message" : `Replying to ${message.sender}`}
        </p>
        <p className="truncate text-xs text-slate-600 dark:text-slate-400">
          {message.text || "Attachment"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={isEdit ? "Cancel edit" : "Cancel reply"}
        className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
