"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  InternationalPhoneInput,
  Modal,
  Select,
} from "@/components/ui";
import { fetchConnections, inviteByWhatsApp } from "@/lib/whatsapp/api";
import { useWhatsAppConfig } from "@/lib/whatsapp/useWhatsAppConfig";
import { useWhatsAppConnect } from "@/lib/whatsapp/useWhatsAppConnect";
import type { InviteOutcome, WhatsAppConnection } from "@/lib/whatsapp/types";
import type { ConversationParticipant } from "@/lib/chat/conversations";

type InviteByWhatsAppModalProps = {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string | number;
  /** Existing members, for the "someone already here" mode. Admins only. */
  members?: ConversationParticipant[];
  canInviteMembers?: boolean;
  /** Told after any successful invite, so the caller can refresh its lists. */
  onInvited?: (outcome: InviteOutcome, message: string) => void;
};

type Mode = "number" | "member";

const OUTCOME_VARIANT: Record<
  InviteOutcome,
  "success" | "info" | "error" | "neutral"
> = {
  invited: "success",
  already_opted_in: "info",
  declined: "neutral",
  not_sent: "error",
};

/**
 * "Invite by WhatsApp", from a group's member list.
 *
 * The second of the two places connecting is offered. An admin who has never
 * connected a number does not get an error here: the refusal carries
 * `whatsapp_not_connected`, which runs Embedded Signup and then sends THE SAME
 * invitation again, so the thing they asked for still happens.
 */
export function InviteByWhatsAppModal({
  isOpen,
  onClose,
  conversationId,
  members = [],
  canInviteMembers = false,
  onInvited,
}: InviteByWhatsAppModalProps) {
  const { config, isEnabled } = useWhatsAppConfig();
  const [mode, setMode] = useState<Mode>("number");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    outcome: InviteOutcome;
    message: string;
    reason: string;
  } | null>(null);

  // Asked only when the server says several numbers could serve this group.
  const [choices, setChoices] = useState<WhatsAppConnection[] | null>(null);
  const [chosen, setChosen] = useState("");

  const {
    connect,
    isConnecting,
    error: connectError,
  } = useWhatsAppConnect({
    config,
  });

  // Closing clears the form. Done in the handler rather than an effect on
  // `isOpen`, because an effect would be setting state in its own body - and
  // closing is an event, not something to stay in sync with.
  const close = useCallback(() => {
    setPhone("");
    setDisplayName("");
    setParticipantId("");
    setError(null);
    setNameError(null);
    setResult(null);
    setChoices(null);
    setChosen("");
    onClose();
  }, [onClose]);

  /**
   * One attempt, and the place every `reason` is handled.
   *
   * Recursive by design: connecting or choosing a number produces the same
   * invitation again rather than asking the person to retype it.
   */
  const sendRef = useRef<(connectionId?: number) => Promise<void>>(
    async () => {},
  );

  const send = useCallback(
    async (connectionId?: number): Promise<void> => {
      setIsSending(true);
      setError(null);
      setNameError(null);

      const invite =
        mode === "member"
          ? { participant: Number(participantId), connection: connectionId }
          : {
              phoneNumber: phone.trim(),
              displayName: displayName.trim(),
              connection: connectionId,
            };

      const response = await inviteByWhatsApp(conversationId, invite);
      setIsSending(false);

      if (response.ok) {
        setChoices(null);
        setResult({
          outcome: response.data.outcome,
          message: response.data.reason ? `${response.data.reason}` : "",
          reason: response.data.reason,
        });
        onInvited?.(response.data.outcome, response.data.reason);
        return;
      }

      switch (response.reason) {
        case "whatsapp_not_connected": {
          // Run Embedded Signup, then send the very same invitation.
          const connection = await connect();
          if (!connection) return;
          await sendRef.current(connection.id);
          return;
        }
        case "choose_connection": {
          const list = await fetchConnections();
          if (list.ok && list.data.length > 0) {
            setChoices(list.data);
            setChosen(String(list.data[0].id));
            setError(response.message);
            return;
          }
          setError(response.message);
          return;
        }
        default:
          setError(response.message);
      }
    },
    [
      connect,
      conversationId,
      displayName,
      mode,
      onInvited,
      participantId,
      phone,
    ],
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const submit = useCallback(() => {
    if (mode === "number") {
      if (!phone.trim()) {
        setError("Enter a phone number.");
        return;
      }
      if (!displayName.trim()) {
        // The server refuses this too - a phone-only member with no name shows
        // to the whole group as a bare number.
        setNameError("A name is required, so the group knows who they are.");
        return;
      }
    } else if (!participantId) {
      setError("Choose a member.");
      return;
    }
    void send();
  }, [displayName, mode, participantId, phone, send]);

  if (!isEnabled) return null;

  const busy = isSending || isConnecting;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Invite by WhatsApp"
      description="They get one message asking whether they want this group on WhatsApp. Only they can say yes."
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={busy}>
              {isConnecting
                ? "Connecting..."
                : isSending
                  ? "Sending..."
                  : "Send invitation"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {(error || connectError) && (
          <Alert variant="error">{connectError ?? error}</Alert>
        )}

        {result ? (
          <Alert variant={OUTCOME_VARIANT[result.outcome]}>
            {result.outcome === "invited" &&
              "Invitation sent. They'll get it on WhatsApp."}
            {result.outcome === "already_opted_in" &&
              "They already get this group on WhatsApp."}
            {result.outcome === "declined" &&
              "They have opted out of WhatsApp from this business, so nothing was sent."}
            {result.outcome === "not_sent" &&
              `Added, but the invitation couldn't be sent.${
                result.reason ? ` ${result.reason}` : ""
              }`}
          </Alert>
        ) : choices ? (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Which number should this come from?
            <Select
              className="mt-1"
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
              options={choices.map((connection) => ({
                value: String(connection.id),
                label: `${connection.displayPhoneNumber} - ${
                  connection.verifiedName || "WhatsApp Business"
                }`,
              }))}
            />
            <Button
              className="mt-3"
              onClick={() => void send(Number(chosen))}
              disabled={busy || !chosen}
            >
              Send from this number
            </Button>
          </label>
        ) : (
          <>
            {canInviteMembers && members.length > 0 && (
              <div
                role="radiogroup"
                aria-label="Who to invite"
                className="flex gap-2"
              >
                <ModeButton
                  active={mode === "number"}
                  onClick={() => setMode("number")}
                >
                  A new person
                </ModeButton>
                <ModeButton
                  active={mode === "member"}
                  onClick={() => setMode("member")}
                >
                  Someone in the group
                </ModeButton>
              </div>
            )}

            {mode === "number" ? (
              <>
                {/* htmlFor, not a wrapping label: the country picker is the
                    first labelable element inside this component, so a label
                    that only wraps would name the SELECT and leave the number
                    field itself unlabelled. */}
                <div>
                  <label
                    htmlFor="whatsapp-invite-phone"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Phone number
                  </label>
                  <div className="mt-1">
                    <InternationalPhoneInput
                      id="whatsapp-invite-phone"
                      value={phone}
                      onChange={setPhone}
                      disabled={busy}
                    />
                  </div>
                </div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Their name
                  <Input
                    className="mt-1"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Sam Okafor"
                    disabled={busy}
                    aria-invalid={nameError ? true : undefined}
                  />
                </label>
                {nameError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {nameError}
                  </p>
                )}
              </>
            ) : (
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Member
                <Select
                  className="mt-1"
                  value={participantId}
                  onChange={(event) => setParticipantId(event.target.value)}
                  placeholder="Choose a member"
                  disabled={busy}
                  options={members.map((member) => ({
                    value: String(member.id),
                    label: member.name,
                  }))}
                />
              </label>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
