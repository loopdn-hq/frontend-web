"use client";

import { useState } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  Alert,
  Button,
  Field,
  Input,
  InternationalPhoneInput,
  Modal,
  Textarea,
} from "@/components/ui";
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

  const tabButtonClass =
    "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add members"
      description={`Add people to ${groupName}`}
      closeLabel="Close add members modal"
    >
      <p className="mb-4 text-xs font-medium text-sky-600 dark:text-sky-400">
        {currentMemberCount} current member{currentMemberCount === 1 ? "" : "s"}
      </p>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTab("app")}
          disabled={isSubmitting}
          className={`${tabButtonClass} ${
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
          className={`${tabButtonClass} ${
            tab === "phone"
              ? "bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-400"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          Via Phone
        </button>
      </div>

      {tab === "app" ? (
        <form
          id="add-members-app-form"
          onSubmit={handleSubmitApp}
          className="mt-5 space-y-4"
        >
          <Field
            label="Usernames, emails, or phone numbers"
            htmlFor="member-identifiers"
            hint="Separate multiple people with commas or new lines."
          >
            <Textarea
              id="member-identifiers"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={"alex\n+14155552671"}
              rows={5}
              autoFocus
              disabled={isSubmitting}
            />
          </Field>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !value.trim()}
              fullWidth
            >
              {isSubmitting ? "Adding..." : "Add members"}
            </Button>
          </div>
        </form>
      ) : (
        <form
          id="add-members-phone-form"
          onSubmit={handleSubmitPhone}
          className="mt-5 space-y-4"
        >
          <Field label="Phone number" htmlFor="invite-phone">
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
          </Field>

          <Field label="Display name (optional)" htmlFor="invite-display-name">
            <Input
              id="invite-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Mom"
              disabled={isSubmitting}
            />
          </Field>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !phoneNumber.trim()}
              fullWidth
            >
              {isSubmitting ? "Sending..." : "Send invite"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
