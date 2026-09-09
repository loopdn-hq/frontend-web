"use client";

import { useState } from "react";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

type JoinLoopModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
};

export function JoinLoopModal({ isOpen, onClose, onJoin }: JoinLoopModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function handleClose() {
    setCode("");
    setError("");
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setError("Enter a join code.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onJoin(code.trim());
      setCode("");
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to join this Loop.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join a Loop"
      description="Enter the code shared by the Loop admin"
      closeLabel="Close join loop modal"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            fullWidth
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="join-loop-form"
            disabled={isSubmitting || !code.trim()}
            fullWidth
          >
            {isSubmitting ? "Joining..." : "Join Loop"}
          </Button>
        </div>
      }
    >
      <form id="join-loop-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Join code" htmlFor="join-code">
          <Input
            id="join-code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g., 7F3K9Q"
            autoFocus
            disabled={isSubmitting}
            uppercaseTracking
          />
        </Field>

        {error && <Alert variant="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
