"use client";

import { useState } from "react";

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-sky-100 bg-white p-6 shadow-[0_20px_70px_rgba(14,88,148,0.25)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Join a Loop
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Enter the code shared by the Loop admin
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close join loop modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="join-code"
              className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Join code
            </label>
            <input
              id="join-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g., 7F3K9Q"
              autoFocus
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase tracking-widest text-slate-800 outline-none transition placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !code.trim()}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Joining..." : "Join Loop"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
