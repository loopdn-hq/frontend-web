"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword, type FieldErrors } from "@/lib/auth/client";
import {
  resetPasswordSchema,
  type ResetPasswordPayload,
} from "@/lib/validation/auth";

// useSearchParams() opts a page out of static prerendering unless it's below
// a Suspense boundary - required here since the whole app is `output: export`.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordScreen />
    </Suspense>
  );
}

function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const linkIsUsable = Boolean(uid && token);

  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [invalidOrExpired, setInvalidOrExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordPayload>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!succeeded) return;
    const timeout = setTimeout(() => router.push("/login/"), 4000);
    return () => clearTimeout(timeout);
  }, [succeeded, router]);

  const onSubmit: SubmitHandler<ResetPasswordPayload> = async (data) => {
    if (!uid || !token) return;

    setGeneralError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await resetPassword({
        uid,
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setGeneralError(result.message);
        setInvalidOrExpired(result.invalidOrExpired);
        return;
      }

      setSucceeded(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const newPasswordErrors = fieldErrors.new_password ?? [];
  const confirmPasswordErrors = fieldErrors.confirm_password ?? [];
  // uid/token/non_field_errors etc. - anything not already shown per-field.
  const otherErrors = Object.entries(fieldErrors)
    .filter(([key]) => key !== "new_password" && key !== "confirm_password")
    .flatMap(([, messages]) => messages);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Reset your password
        </h1>

        {!linkIsUsable || invalidOrExpired ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              This password reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password/"
              className="mt-4 block w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110"
            >
              Request a new link
            </Link>
          </>
        ) : succeeded ? (
          <>
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Your password has been reset. Redirecting you to log in...
            </p>
            <Link
              href="/login/"
              className="mt-4 block w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110"
            >
              Go to login
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Choose a new password for your account.
            </p>

            <form
              className="mt-4 space-y-3"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  New password
                </span>
                <input
                  type="password"
                  placeholder="Create a new password"
                  autoComplete="new-password"
                  {...register("newPassword")}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>

              {errors.newPassword && (
                <p className="text-xs text-rose-600">
                  {errors.newPassword.message}
                </p>
              )}
              {newPasswordErrors.map((message) => (
                <p key={message} className="text-xs text-rose-600">
                  {message}
                </p>
              ))}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Confirm new password
                </span>
                <input
                  type="password"
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>

              {errors.confirmPassword && (
                <p className="text-xs text-rose-600">
                  {errors.confirmPassword.message}
                </p>
              )}
              {confirmPasswordErrors.map((message) => (
                <p key={message} className="text-xs text-rose-600">
                  {message}
                </p>
              ))}

              {otherErrors.map((message) => (
                <p
                  key={message}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                  {message}
                </p>
              ))}
              {otherErrors.length === 0 && generalError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {generalError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Resetting..." : "Reset password"}
              </button>
            </form>
          </>
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
