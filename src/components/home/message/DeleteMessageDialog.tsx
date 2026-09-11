"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { ThreadMessage } from "./MessageBubble";

/**
 * Confirm before removing a message from everybody's thread.
 *
 * Worth a dialog rather than a one-click menu item because it is irreversible
 * and it acts for other people, not just the person clicking.
 *
 * The caveat is the reason this is not a generic confirm box. A message that
 * went out by text or email has already arrived on a phone and in an inbox, and
 * nothing here can recall it - so the dialog says so plainly instead of letting
 * "Delete for everyone" imply a reach it does not have.
 */

type DeleteMessageDialogProps = {
  message: ThreadMessage;
  /** Deleting somebody else's message, using admin standing. */
  asAdmin: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteMessageDialog({
  message,
  asAdmin,
  busy,
  error,
  onConfirm,
  onClose,
}: DeleteMessageDialogProps) {
  const reachedOtherChannels = message.source !== "app";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Delete this message?"
      maxWidthClassName="max-w-sm"
      closeLabel="Cancel delete"
    >
      <div className="space-y-4">
        <blockquote className="rounded-lg border-l-2 border-slate-300 bg-slate-50 py-1.5 pr-2 pl-2.5 text-xs dark:border-slate-600 dark:bg-slate-800">
          <span className="block font-semibold text-slate-700 dark:text-slate-200">
            {message.sender}
          </span>
          <span className="block truncate text-slate-600 dark:text-slate-400">
            {message.text || "Attachment"}
          </span>
        </blockquote>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {asAdmin
            ? "It will be removed from the thread for everyone in this Loop."
            : "It will be removed from the thread for everyone."}{" "}
          This cannot be undone.
        </p>

        {reachedOtherChannels && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            This message also went out by text or email. Those copies have
            already been delivered and cannot be taken back.
          </p>
        )}

        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
