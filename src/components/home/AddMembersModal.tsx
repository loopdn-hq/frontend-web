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
import { InviteByWhatsAppForm } from "@/components/whatsapp/InviteByWhatsAppForm";
import type { ConversationParticipant } from "@/lib/chat/conversations";
import { normalizePhone } from "@/lib/validation/auth";
import { useWhatsAppConfig } from "@/lib/whatsapp/useWhatsAppConfig";
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
  /** Which group this is, for the WhatsApp tab's own requests. */
  conversationId: string | number;
  groupName: string;
  /** Who is here already: the count, and the WhatsApp tab's member picker. */
  members: ConversationParticipant[];
  /** Whether the WhatsApp tab may invite somebody already in the group. */
  canInviteMembers?: boolean;
  onClose: () => void;
  /**
   * Accounts by username, addresses with no account to invite, and what they
   * may read - everything said before ("all") or only what comes next ("new").
   */
  onAddMembers: (
    members: string[],
    inviteEmails: string[],
    history: "all" | "new",
  ) => Promise<void>;
  /** People who could be added, and what adding each would do. */
  onSearchMembers: (term: string) => Promise<MemberSearchResult>;
  onInvitePhone: (invite: {
    phone_number: string;
    display_name: string;
  }) => Promise<void>;
  /** Told after a WhatsApp invite, so the caller can refresh its lists. */
  onWhatsAppInvited?: () => void;
};

export function AddMembersModal({
  isOpen,
  conversationId,
  groupName,
  members,
  canInviteMembers = false,
  onClose,
  onAddMembers,
  onSearchMembers,
  onInvitePhone,
  onWhatsAppInvited,
}: AddMembersModalProps) {
  // Absent when the deployment has no WhatsApp, so the tab is not offered.
  const { isEnabled: isWhatsAppEnabled } = useWhatsAppConfig();
  const currentMemberCount = members.length;
  const [tab, setTab] = useState<"app" | "phone" | "whatsapp">("app");
  const [selected, setSelected] = useState<MemberPick[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Who is about to be added, held while the admin answers whether they may
  // see the old messages. Nothing is sent until they do.
  const [pendingAdd, setPendingAdd] = useState<{
    members: string[];
    inviteEmails: string[];
  } | null>(null);

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

    // Asked every time rather than only where the group has messages: the
    // admin's own view is not proof of that, and in an empty group either
    // answer is harmless.
    setError("");
    setPendingAdd({ members, inviteEmails });
  }

  async function confirmAdd(history: "all" | "new") {
    if (!pendingAdd) return;
    setIsSubmitting(true);
    try {
      await onAddMembers(pendingAdd.members, pendingAdd.inviteEmails, history);
      setSelected([]);
      setPendingAdd(null);
      onClose();
    } catch (submissionError) {
      // Back to the form, where the people are still picked, to say why.
      setPendingAdd(null);
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

    // Required by the API, not just here: this person has chosen no name, so
    // without one the group sees only a masked number, and the admin adding
    // them is the only one who knows who it is.
    const name = displayName.trim();
    if (!name) {
      setError("Enter a name so the group knows who this is.");
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
        display_name: name,
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
        {isWhatsAppEnabled && (
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            disabled={isSubmitting}
            className={`${tabButtonClass} ${
              tab === "whatsapp"
                ? "bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            Via WhatsApp
          </button>
        )}
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
      ) : tab === "whatsapp" ? (
        <InviteByWhatsAppForm
          conversationId={conversationId}
          members={members}
          canInviteMembers={canInviteMembers}
          onClose={onClose}
          onInvited={onWhatsAppInvited}
        />
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

          <Field label="Display name" htmlFor="invite-display-name">
            <Input
              id="invite-display-name"
              type="text"
              maxLength={80}
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

      {pendingAdd && (
        <HistoryChoice
          count={pendingAdd.members.length + pendingAdd.inviteEmails.length}
          groupName={groupName}
          isSubmitting={isSubmitting}
          onChoose={(history) => void confirmAdd(history)}
          onCancel={() => setPendingAdd(null)}
        />
      )}
    </Modal>
  );
}

/**
 * The question asked as people are added: may they read what was said before?
 *
 * Two answers of equal weight, so neither is styled as the "right" one - it is
 * the admin's call about their group. Only for the app tab: somebody added by
 * phone is only ever texted what is sent after they join, so there is nothing
 * to ask.
 */
function HistoryChoice({
  count,
  groupName,
  isSubmitting,
  onChoose,
  onCancel,
}: {
  count: number;
  groupName: string;
  isSubmitting: boolean;
  onChoose: (history: "all" | "new") => void;
  onCancel: () => void;
}) {
  const who = count === 1 ? "this person" : `these ${count} people`;

  return (
    <Modal
      isOpen
      onClose={() => (isSubmitting ? undefined : onCancel())}
      title="Can they see old messages?"
      description={`Choose what ${who} can read in ${groupName}.`}
      maxWidthClassName="max-w-sm"
      closeLabel="Go back"
    >
      <div className="space-y-2">
        <HistoryOption
          label="Allow to see old messages"
          hint="They can scroll back through everything said before they joined."
          disabled={isSubmitting}
          onClick={() => onChoose("all")}
        />
        <HistoryOption
          label="Only show new messages"
          hint="They only see messages sent from now on."
          disabled={isSubmitting}
          onClick={() => onChoose("new")}
        />
        {isSubmitting && (
          <p className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
            Adding...
          </p>
        )}
      </div>
    </Modal>
  );
}

function HistoryOption({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-sky-500/60 dark:hover:bg-slate-800"
    >
      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
        {label}
      </span>
      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
        {hint}
      </span>
    </button>
  );
}
