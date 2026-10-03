"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  InternationalPhoneInput,
  Select,
} from "@/components/ui";
import {
  fetchConnections,
  fetchGroupWhatsApp,
  inviteByWhatsApp,
} from "@/lib/whatsapp/api";
import { useWhatsAppConfig } from "@/lib/whatsapp/useWhatsAppConfig";
import { useWhatsAppConnect } from "@/lib/whatsapp/useWhatsAppConnect";
import type { InviteOutcome, WhatsAppConnection } from "@/lib/whatsapp/types";
import type { ConversationParticipant } from "@/lib/chat/conversations";

type InviteByWhatsAppFormProps = {
  /** Cancel, and Done once an invitation has gone out. */
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
 * "Via WhatsApp", the third way to add somebody in the Add members modal.
 *
 * The second of the two places connecting is offered, and here it comes
 * FIRST: somebody with no number to send from is shown Connect before any
 * form, rather than filling one in and only then being told. The refusal
 * `whatsapp_not_connected` is still handled on send, for the case this check
 * could not see - it runs Embedded Signup and then sends THE SAME invitation
 * again, so the thing they asked for still happens.
 *
 * Holds no state past its own lifetime: the host unmounts it on close or on a
 * change of tab, and that is what clears the form.
 */
export function InviteByWhatsAppForm({
  onClose,
  conversationId,
  members = [],
  canInviteMembers = false,
  onInvited,
}: InviteByWhatsAppFormProps) {
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

  // Whether there is a number to send from; null while that is not known yet.
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  // The number connected right here, so the invitation goes out from it.
  const [connectedId, setConnectedId] = useState<number | undefined>();

  useEffect(() => {
    if (!isEnabled) return;
    let cancelled = false;
    // Either is enough: a number of their own, or a group already on
    // somebody else's - an admin who is not the number's owner has no
    // connection to list and must not be asked for one.
    Promise.all([fetchConnections(), fetchGroupWhatsApp(conversationId)]).then(
      ([connections, group]) => {
        if (cancelled) return;
        // Only a clear "no" from both shows Connect. A lookup that failed
        // falls through to the form, where the send says what is wrong.
        setIsConnected(
          !(
            connections.ok &&
            connections.data.length === 0 &&
            group.ok &&
            !group.data.connected
          ),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [conversationId, isEnabled]);

  const connectFirst = useCallback(async () => {
    const connection = await connect();
    if (!connection) return;
    setConnectedId(connection.id);
    setIsConnected(true);
  }, [connect]);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // While the number is being chosen, that step has its own button.
    if (result || choices) return;
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
    void send(connectedId);
  }

  if (!isEnabled) return null;

  if (isConnected === null) {
    return (
      <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
        Loading WhatsApp...
      </p>
    );
  }

  if (!isConnected) {
    return (
      <div className="mt-5 space-y-4">
        {connectError && <Alert variant="error">{connectError}</Alert>}
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Connect your WhatsApp Business number first. Invitations to this group
          are sent from it.
        </p>
        <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void connectFirst()}
            disabled={isConnecting}
            fullWidth
          >
            {isConnecting ? "Connecting..." : "Connect WhatsApp Business"}
          </Button>
        </div>
      </div>
    );
  }

  const busy = isSending || isConnecting;

  return (
    <form
      id="add-members-whatsapp-form"
      onSubmit={handleSubmit}
      className="mt-5 space-y-4"
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">
        They get one message asking whether they want this group on WhatsApp.
        Only they can say yes.
      </p>

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
            type="button"
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

      <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
        <Button type="button" variant="secondary" onClick={onClose} fullWidth>
          {result ? "Done" : "Cancel"}
        </Button>
        {!result && !choices && (
          <Button type="submit" disabled={busy} fullWidth>
            {isConnecting
              ? "Connecting..."
              : isSending
                ? "Sending..."
                : "Send invitation"}
          </Button>
        )}
      </div>
    </form>
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
