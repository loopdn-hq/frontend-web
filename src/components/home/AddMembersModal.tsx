"use client";

import { useState } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { InternationalPhoneInput } from "@/components/ui/InternationalPhoneInput";
import { normalizePhone } from "@/lib/validation/auth";

type AddMembersModalProps = {
  isOpen: boolean;
  groupName: string;
  currentMemberCount: number;
  onClose: () => void;
  onAddMembers: (members: string[]) => Promise<void>;
  onInvitePhone: (invite: {
    phone_number: string;
    display_name?: string;
  }) => Promise<void>;
};

export function AddMembersModal({
  isOpen,
  groupName,
  currentMemberCount,
  onClose,
  onAddMembers,
  onInvitePhone,
}: AddMembersModalProps) {
  const [tab, setTab] = useState<"app" | "phone">("app");
  const [value, setValue] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmitApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const members = Array.from(
      new Set(
        value
          .split(/[\n,]+/)
          .map((member) => member.trim())
          .filter(Boolean),
      ),
    );

    if (members.length === 0) {
      setError("Enter at least one username, email, or phone number.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onAddMembers(members);
      setValue("");
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to add members.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone || !isValidPhoneNumber(normalizedPhone)) {
      setError("Enter a valid phone number including country code.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onInvitePhone({
        phone_number: normalizedPhone,
        display_name: displayName.trim() || undefined,
      });
      setPhoneNumber("");
      setDisplayName("");
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to send this invite.",
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
              Add members
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Add people to {groupName}
            </p>
            <p className="mt-1 text-xs font-medium text-sky-600 dark:text-sky-400">
              {currentMemberCount} current member
              {currentMemberCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close add members modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="mt-5 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab("app")}
            disabled={isSubmitting}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === "app"
                ? "bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            Loopdn Account
          </button>
          <button
            type="button"
            onClick={() => setTab("phone")}
            disabled={isSubmitting}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === "phone"
                ? "bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            Via Phone
          </button>
        </div>

        {tab === "app" ? (
          <form onSubmit={handleSubmitApp} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="member-identifiers"
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Usernames, emails, or phone numbers
              </label>
              <textarea
                id="member-identifiers"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="alex\n+14155552671"
                rows={5}
                autoFocus
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Separate multiple people with commas or new lines.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !value.trim()}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add members"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitPhone} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="invite-phone"
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Phone number
              </label>
              <InternationalPhoneInput
                id="invite-phone"
                name="invite-phone"
                value={phoneNumber}
                onChange={setPhoneNumber}
                autoFocus
                autoComplete="tel"
                placeholder="Enter phone number"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="invite-display-name"
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Display name (optional)
              </label>
              <input
                id="invite-display-name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Mom"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !phoneNumber.trim()}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
