"use client";

import { useEffect, useState } from "react";
import {
  getPendingPhone,
  requestPhoneVerificationCode,
  verifyPhoneCode,
} from "@/lib/auth/client";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">
            Verify your phone to continue
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          {!phone
            ? "We couldn't find a pending phone number. Add one from Settings first."
            : sendState === "sending"
              ? `Sending a verification code to ${phone}...`
              : sendMessage}
        </p>

        {phone && sendState === "error" && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {sendMessage}
          </p>
        )}

        {phone && sendState === "sent" && (
          <form className="mt-4 space-y-3" onSubmit={handleVerify} noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={isVerifying}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            {verifyError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {verifyError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying || code.trim().length === 0}
              className="w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isVerifying ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        {phone && (
          <button
            type="button"
            onClick={handleResend}
            disabled={sendState === "sending"}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {sendState === "sending" ? "Sending..." : "Resend code"}
          </button>
        )}
      </div>
    </div>
  );
}
