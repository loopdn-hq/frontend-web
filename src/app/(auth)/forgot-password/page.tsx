"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset } from "@/lib/auth/client";
import {
  forgotPasswordSchema,
  type ForgotPasswordPayload,
} from "@/lib/validation/auth";

// Deliberately generic: the backend never reveals whether the email matched
// an account, so this page shows the same message no matter what happens.
const GENERIC_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordPayload>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit: SubmitHandler<ForgotPasswordPayload> = async (data) => {
    setIsSubmitting(true);
    setRequestFailed(false);

    try {
      const result = await requestPasswordReset(data.email);

      // Any response the backend actually sent (email found, not found,
      // rate-limited, ...) shows the same generic success message - only a
      // genuine request failure (offline, timeout, 5xx) gets a distinct one.
      if (result.ok) {
        setSubmitted(true);
      } else {
        setRequestFailed(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Forgot your password?
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the email on your account and we&apos;ll send you a link to
          reset your password.
        </p>

        {submitted ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {GENERIC_MESSAGE}
          </p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Email address
              </span>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            {errors.email && (
              <p className="text-xs text-rose-600">{errors.email.message}</p>
            )}

            {requestFailed && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                Something went wrong. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

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
