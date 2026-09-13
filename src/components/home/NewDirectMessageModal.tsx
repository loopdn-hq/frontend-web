"use client";

import { useState } from "react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { startDirectConversation } from "@/lib/chat/conversations";

/**
 * Start a one-to-one conversation.
 *
 * A typed identifier rather than a browsable list of people, matching
 * AddMembersModal and the API behind it: usernames, verified emails and
 * verified numbers are the three things the server will resolve, and there is
 * no endpoint that lists everybody for you to pick from. Search exists, but it
 * matches on a username prefix only - offering it here would quietly imply the
 * other two do not work.
 *
 * Opening a conversation that already exists is not an error; the server hands
 * back the same one.
 */
export function NewDirectMessageModal({
  isOpen,
  onClose,
  onStarted,
}: {
  isOpen: boolean;
  onClose: () => void;
  onStarted: (conversationId: string | number) => Promise<void> | void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = identifier.trim();
    if (!value) {
      setError("Enter a username, email, or phone number.");
      return;
    }

    setError(null);
    setIsBusy(true);
    const result = await startDirectConversation(value);
    setIsBusy(false);

    if (!result.ok) {
      // Shown exactly as the server worded it. It says one thing to somebody
      // who blocked this person and another to everybody else, on purpose.
      setError(result.message);
      return;
    }

    setIdentifier("");
    await onStarted(result.conversationId);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Direct message"
      description="Message one person. Only they will see it."
      closeLabel="Close"
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Username, email, or phone" htmlFor="dm-identifier">
          <Input
            id="dm-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="yulgurz, yul@example.com, or +639171234567"
            autoFocus
            className="rounded-lg px-3 py-2"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            An email or number only finds somebody who has verified it on their
            own account.
          </p>
        </Field>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isBusy || !identifier.trim()}>
            {isBusy ? "Opening..." : "Message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
