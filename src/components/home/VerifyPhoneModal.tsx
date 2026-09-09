"use client";

import { useEffect, useState } from "react";
import {
  getPendingPhone,
  requestPhoneVerificationCode,
  verifyPhoneCode,
} from "@/lib/auth/client";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

type VerifyPhoneModalProps = {
  onVerified: () => void;
  onClose: () => void;
};

// Gate for actions that require a verified phone (e.g. Create Loop), shown in
// place of navigating away from whatever the user was doing.
export function VerifyPhoneModal({
  onVerified,
  onClose,
}: VerifyPhoneModalProps) {
  const [phone] = useState(() => getPendingPhone());
  const [sendState, setSendState] = useState<"sending" | "sent" | "error">(
    "sending",
  );
  const [sendMessage, setSendMessage] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!phone) return;

    let cancelled = false;

    requestPhoneVerificationCode(phone).then((result) => {
      if (cancelled) return;
      setSendState(result.ok ? "sent" : "error");
      setSendMessage(
        result.ok ? `We sent a code to ${phone}.` : result.message,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [phone]);

  async function handleResend() {
    if (!phone) return;

    setSendState("sending");
    const result = await requestPhoneVerificationCode(phone);
    setSendState(result.ok ? "sent" : "error");
    setSendMessage(
      result.ok ? `We sent a new code to ${phone}.` : result.message,
    );
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyError("");
    setIsVerifying(true);

    try {
      const result = await verifyPhoneCode(code);

      if (!result.ok) {
        setVerifyError(result.message);
        return;
      }

      onVerified();
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Verify your phone to continue"
      closeLabel="Close verify phone modal"
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {!phone
          ? "We couldn't find a pending phone number. Add one from Settings first."
          : sendState === "sending"
            ? `Sending a verification code to ${phone}...`
            : sendMessage}
      </p>

      {phone && sendState === "error" && (
        <Alert variant="error" className="mt-4 text-xs">
          {sendMessage}
        </Alert>
      )}

      {phone && sendState === "sent" && (
        <form className="mt-4 space-y-3" onSubmit={handleVerify} noValidate>
          <Field label="Verification code">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isVerifying}
            />
          </Field>

          {verifyError && <Alert variant="error">{verifyError}</Alert>}

          <Button
            type="submit"
            disabled={isVerifying || code.trim().length === 0}
            fullWidth
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </form>
      )}

      {phone && (
        <Button
          type="button"
          variant="secondary"
          onClick={handleResend}
          disabled={sendState === "sending"}
          fullWidth
          className="mt-3"
        >
          {sendState === "sending" ? "Sending..." : "Resend code"}
        </Button>
      )}
    </Modal>
  );
}
