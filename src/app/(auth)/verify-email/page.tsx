"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getPendingEmail,
  resendEmailVerificationCode,
  setPendingEmail,
  useAuth,
  verifyEmailCode,
} from "@/lib/auth/client";

type SendState = "sending" | "sent" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { session, isLoaded } = useAuth();
  const [email, setEmail] = useState<string | null>(() => getPendingEmail());
  const [emailInput, setEmailInput] = useState("");
  const [emailInputError, setEmailInputError] = useState("");
  const [state, setState] = useState<SendState>("sending");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Already signed in - nothing pending here.
  useEffect(() => {
    if (isLoaded && session) {
      router.replace("/home/");
    }
  }, [router, isLoaded, session]);

  // Auto-send the code as soon as we know which email to verify - covers both
  // the post-signup redirect and the "verify your email" login redirect.
  useEffect(() => {
    if (!email) return;

    let cancelled = false;

    resendEmailVerificationCode(email).then((result) => {
      if (cancelled) return;

      setState(result.ok ? "sent" : "error");
      setMessage(result.ok ? `We sent a code to ${email}.` : result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [email]);

  function handleSubmitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = emailInput.trim();

    if (!trimmed) {
      setEmailInputError("Enter your email address.");
      return;
    }

    setEmailInputError("");
    setPendingEmail(trimmed);
    setEmail(trimmed);
  }

  async function handleResend() {
    if (!email) return;

    setState("sending");
    const result = await resendEmailVerificationCode(email);
    setState(result.ok ? "sent" : "error");
    setMessage(result.ok ? `We sent a new code to ${email}.` : result.message);
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    setVerifyError("");
    setIsVerifying(true);

    try {
      const result = await verifyEmailCode(email, code);

      if (!result.ok) {
        // Verified, but no stashed credentials to log in with (e.g. manual
        // entry outside the signup/login flow) - finish at the login form.
        if (result.message.startsWith("Email verified")) {
          router.push("/login/");
          return;
        }

        setVerifyError(result.message);
        return;
      }

      router.push("/verify-phone/");
    } finally {
      setIsVerifying(false);
    }
  }

  if (!email) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 sm:px-8">
        <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

        <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Verify your email
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the email address on your account and we&apos;ll send you a
            verification code.
          </p>

          <form
            className="mt-4 space-y-3"
            onSubmit={handleSubmitEmail}
            noValidate
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Email address
              </span>
              <input
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            {emailInputError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {emailInputError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110"
            >
              Send code
            </button>
          </form>

          <Link
            href="/login/"
            className="mt-4 block text-center text-xs text-slate-500 underline hover:text-slate-700"
          >
            Back to log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          {state === "sending"
            ? `Sending a verification code to ${email}...`
            : message}
        </p>

        {state === "error" && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {message}
          </p>
        )}

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

        <button
          type="button"
          onClick={handleResend}
          disabled={state === "sending"}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {state === "sending" ? "Sending..." : "Resend code"}
        </button>

        <button
          type="button"
          onClick={() => setEmail(null)}
          className="mt-3 w-full text-center text-xs text-slate-500 underline hover:text-slate-700"
        >
          Use a different email
        </button>

        <Link
          href="/login/"
          className="mt-4 block text-center text-xs text-slate-500 underline hover:text-slate-700"
        >
          Back to log in
        </Link>
      </div>
    </main>
  );
}
