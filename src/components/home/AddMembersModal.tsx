"use client";

import { useState } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  InternationalPhoneInput,
  Modal,
} from "@/components/ui";
import { normalizePhone } from "@/lib/validation/auth";
import {
  MemberSearchPicker,
  type MemberPick,
  type MemberSearchResult,
} from "./MemberSearchPicker";

// Required for Telnyx/carrier compliance: an admin must affirmatively confirm
// consent for this specific number before an invite SMS goes out. Tied to the
// phone field's onChange (below) rather than left to persist, so editing the
// number after checking this always forces a fresh confirmation - the
// checkbox is a claim about one specific person, not a sticky preference.
const SMS_CONSENT_LABEL =
  "I confirm that I have permission from this person to add them to this group and that they have agreed to receive SMS messages related to this group.";

/** Says what the button will do: add people, send invitations, or both. */
function submitLabel(selected: MemberPick[]): string {
  const invites = selected.filter((pick) => pick.kind === "email").length;
  if (invites > 0 && invites === selected.length) {
    return invites === 1 ? "Send invitation" : `Send ${invites} invitations`;
  }
  return selected.length > 1 ? `Add ${selected.length} members` : "Add member";
}

type AddMembersModalProps = {
  isOpen: boolean;
  groupName: string;
  currentMemberCount: number;
  onClose: () => void;
  /** Accounts by username, and addresses with no account to invite. */
  onAddMembers: (members: string[], inviteEmails: string[]) => Promise<void>;
  /** People who could be added, and what adding each would do. */
  onSearchMembers: (term: string) => Promise<MemberSearchResult>;
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
  onSearchMembers,
  onInvitePhone,
}: AddMembersModalProps) {
  const [tab, setTab] = useState<"app" | "phone">("app");
  const [selected, setSelected] = useState<MemberPick[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePhoneNumberChange(nextPhoneNumber: string) {
    setPhoneNumber(nextPhoneNumber);
    setSmsConsent(false);
  }

  if (!isOpen) return null;

  async function handleSubmitApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // By username: it is what the search found them by, and the one handle
    // that cannot resolve to anybody else between the search and the add.
    const members = selected.flatMap((pick) =>
      pick.kind === "account" ? [pick.username] : [],
    );
    const inviteEmails = selected.flatMap((pick) =>
      pick.kind === "email" ? [pick.email] : [],
    );

    if (members.length === 0 && inviteEmails.length === 0) {
      setError("Search for at least one person to add.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onAddMembers(members, inviteEmails);
      setSelected([]);
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

    if (!smsConsent) {
      setError(
        "Confirm you have this person's permission before sending an invite.",
      );
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
      setSmsConsent(false);
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
          Loopd&apos;n Account
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
          <Field label="Find people" htmlFor="member-search">
            <MemberSearchPicker
              inputId="member-search"
              selected={selected}
              onSelect={(person) => {
                setError("");
                setSelected((current) => [...current, person]);
              }}
              onRemove={(person) =>
                setSelected((current) =>
                  current.filter((other) => other.id !== person.id),
                )
              }
              onSearch={onSearchMembers}
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
              disabled={isSubmitting || selected.length === 0}
              fullWidth
            >
              {isSubmitting ? "Adding..." : submitLabel(selected)}
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
              onChange={handlePhoneNumberChange}
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

          <Checkbox
            id="invite-sms-consent"
            checked={smsConsent}
            onChange={(event) => setSmsConsent(event.target.checked)}
            disabled={isSubmitting || !phoneNumber.trim()}
            label={SMS_CONSENT_LABEL}
          />

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
              disabled={isSubmitting || !phoneNumber.trim() || !smsConsent}
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
