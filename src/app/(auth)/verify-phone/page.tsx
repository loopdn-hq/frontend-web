"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  consumePostAuthRedirect,
  getPendingPhone,
  requestPhoneVerificationCode,
  useAuth,
  verifyPhoneCode,
} from "@/lib/auth/client";

type SendState = "sending" | "sent" | "error";

export default function VerifyPhonePage() {
  const router = useRouter();
  const { session, isLoaded } = useAuth();
  const [phone] = useState<string | null>(() => getPendingPhone());
  const [state, setState] = useState<SendState>("sending");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // No signed-in session or nothing pending to verify - nowhere for this page to work from.
  useEffect(() => {
    if (isLoaded && !session) {
      router.replace("/login/");
      return;
    }

    // `phone` is fixed on arrival, so this never races the success path below.
    // It is also the way out after an email code when no phone is waiting to
    // be verified - verify-email sends everybody here.
    if (isLoaded && !phone) {
      router.replace(consumePostAuthRedirect() ?? "/chats/");
    }
  }, [router, isLoaded, session, phone]);

  // Auto-send the code as soon as we know which phone number to verify.
  useEffect(() => {
    if (!phone) return;

    let cancelled = false;

    requestPhoneVerificationCode(phone).then((result) => {
      if (cancelled) return;

      setState(result.ok ? "sent" : "error");
      setMessage(result.ok ? `We sent a code to ${phone}.` : result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [phone]);

  async function handleResend() {
    if (!phone) return;

    setState("sending");
    const result = await requestPhoneVerificationCode(phone);
    setState(result.ok ? "sent" : "error");
    setMessage(result.ok ? `We sent a new code to ${phone}.` : result.message);
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

      router.push(consumePostAuthRedirect() ?? "/chats/");
    } finally {
      setIsVerifying(false);
    }
  }

  if (!phone) return null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_15%_20%,#1e293b_0%,#0f172a_45%,#020617_100%)] sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-700/20" />

      <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_44px_rgba(2,6,23,0.5)] sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verify your phone
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {state === "sending"
            ? `Sending a verification code to ${phone}...`
            : message}
        </p>

        {state === "error" && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {message}
          </p>
        )}

        {state === "sent" && (
          <form className="mt-4 space-y-3" onSubmit={handleVerify} noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={isVerifying}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              />
            </label>

            {verifyError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
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

        <button
          type="button"
          onClick={handleResend}
          disabled={state === "sending"}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {state === "sending" ? "Sending..." : "Resend code"}
        </button>

        <Link
          href="/chats/"
          className="mt-4 block text-center text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Skip for now
        </Link>
      </div>
    </main>
  );
}
