"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DUMMY_ACCOUNT } from "@/lib/auth/session";
import { authPayloadSchema, toFieldErrors } from "@/lib/validation/auth";
import { LoadingSpinner } from "./LoadingSpinner";
import { ProgressBar } from "./LoadingSkeletons";

export type AuthMode = "login" | "signup";
type ContactMode = "email" | "phone";

type AuthScreenProps = {
  initialMode: AuthMode;
};

const panelTitle: Record<AuthMode, string> = {
  login: "Welcome back",
  signup: "Create your Loopdn account",
};

const panelSubTitle: Record<AuthMode, string> = {
  login: "Sign in to manage groups, members, and broadcasts.",
  signup: "Create an account with email or phone to get started.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.69-.06-1.35-.18-1.99H12v3.76h5.39a4.6 4.6 0 0 1-1.99 3.02v2.5h3.22c1.89-1.74 2.98-4.3 2.98-7.29Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.22-2.5c-.9.6-2.06.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H.81v2.58A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.41 19.88A6.02 6.02 0 0 1 6 16.7V14.1H2.72A9.97 9.97 0 0 0 2 12c0-1.61.39-3.13 1.08-4.46L6.41 10.3A6.04 6.04 0 0 1 6 12c0 .75.13 1.48.41 2.18v5.7Z"
        fill="#FBBC05"
      />
      <path
        d="M12 3.98c1.47 0 2.8.5 3.84 1.5l2.87-2.87A9.95 9.95 0 0 0 12 2a10 10 0 0 0-9.19 5.54l3.7 2.88A6.03 6.03 0 0 1 12 3.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthScreen({ initialMode }: AuthScreenProps) {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [contactMode, setContactMode] = useState<ContactMode>("email");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"contact" | "password", string>>
  >({});
  const [generalError, setGeneralError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ctaText = useMemo(() => {
    if (authMode === "login") {
      return contactMode === "email"
        ? "Continue with email"
        : "Continue with phone";
    }

    return contactMode === "email" ? "Create account" : "Create phone account";
  }, [authMode, contactMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");

    const payload = {
      mode: authMode,
      contactMode,
      contact,
      password,
    };

    const parsed = authPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const endpoint =
        authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        redirectTo?: string;
        errors?: Partial<Record<"contact" | "password", string>>;
      };

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? {});
        setGeneralError(
          data.message ?? "Unable to continue. Please try again.",
        );
        return;
      }

      router.push(data.redirectTo ?? "/home");
      router.refresh();
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <section className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/60 bg-white/40 shadow-[0_20px_80px_rgba(0,102,179,0.17)] backdrop-blur-sm lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex flex-col justify-between bg-[linear-gradient(150deg,#00a6ff_0%,#0574cc_56%,#12386e_100%)] p-8 text-white sm:p-12">
          <div>
            <p className="inline-flex rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs tracking-[0.14em] uppercase">
              Loopdn MVP
            </p>
            <h1 className="mt-6 max-w-md text-4xl leading-tight font-bold sm:text-5xl">
              One group. Any phone. Everyone connected.
            </h1>
            <p className="mt-4 max-w-lg text-sm text-cyan-100 sm:text-base">
              Coordinate chats for members on web and SMS with clear admin
              control, broadcast options, and fast voice updates.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-cyan-100">
                Realtime
              </p>
              <p className="mt-1 text-lg font-semibold">
                Web + SMS thread sync
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-cyan-100">
                Voice
              </p>
              <p className="mt-1 text-lg font-semibold">
                Record once, share everywhere
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] p-6 sm:p-10">
          <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
            <div className="mb-6 flex items-center justify-between rounded-xl bg-slate-100 p-1">
              <Link
                href="/login"
                onClick={() => setAuthMode("login")}
                className={`w-1/2 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  authMode === "login"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                onClick={() => setAuthMode("signup")}
                className={`w-1/2 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  authMode === "signup"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Sign Up
              </Link>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">
              {panelTitle[authMode]}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {panelSubTitle[authMode]}
            </p>

            <button
              type="button"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition hover:bg-slate-50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <GoogleIcon />
              </span>
              Continue with Google
            </button>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              or continue with email or phone
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="mt-4 flex gap-2 rounded-xl bg-sky-50 p-1">
              <button
                type="button"
                onClick={() => {
                  setContactMode("email");
                  setContact("");
                  setErrors({});
                }}
                disabled={isSubmitting}
                className={`w-1/2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  contactMode === "email"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } ${isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setContactMode("phone");
                  setContact("");
                  setErrors({});
                }}
                disabled={isSubmitting}
                className={`w-1/2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  contactMode === "phone"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } ${isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}
              >
                Phone
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
              {contactMode === "email" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Email Address
                  </span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Phone Number
                  </span>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
              )}

              {errors.contact && (
                <p className="text-xs text-rose-600">{errors.contact}</p>
              )}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  placeholder={
                    authMode === "signup"
                      ? "Create a password"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>

              {errors.password && (
                <p className="text-xs text-rose-600">{errors.password}</p>
              )}

              {authMode === "signup" && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  We will verify your{" "}
                  {contactMode === "email" ? "email" : "phone number"} before
                  enabling admin actions.
                </p>
              )}

              {generalError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {generalError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <LoadingSpinner /> : ctaText}
              </button>

              {isSubmitting && <ProgressBar />}
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              By continuing, you agree to Loopdn Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
