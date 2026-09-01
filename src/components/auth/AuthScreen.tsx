"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  authenticate,
  authenticateWithGoogle,
  registerAccount,
} from "@/lib/auth/client";
import {
  loginSchema,
  signupSchema,
  type LoginPayload,
  type SignupPayload,
} from "@/lib/validation/auth";
import { LoadingSpinner } from "./LoadingSpinner";
import { ProgressBar } from "./LoadingSkeletons";

export type AuthMode = "login" | "signup";

type AuthScreenProps = {
  initialMode: AuthMode;
};

const panelTitle: Record<AuthMode, string> = {
  login: "Welcome back",
  signup: "Create your Loopdn account",
};

const panelSubTitle: Record<AuthMode, string> = {
  login: "Sign in to manage groups, members, and broadcasts.",
  signup: "Create an account with your email and phone number.",
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

  const [generalError, setGeneralError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setGeneralError("");
      setIsGoogleLoading(true);

      try {
        const result = await authenticateWithGoogle(credential);

        if (!result.ok) {
          setGeneralError(result.message);
          return;
        }

        router.push("/home/");
      } catch {
        setGeneralError("Network error. Please try again.");
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [router],
  );

  // Google Identity Services loads async (see layout.tsx); initialize once it's ready.
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;

    function init() {
      if (cancelled || !window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: (response) => {
          void handleGoogleCredential(response.credential);
        },
      });
    }

    if (window.google) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          init();
        }
      }, 100);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential]);

  // Login form, POST /users/login/ (username field accepts a username or email).
  const {
    register: registerLogin,
    handleSubmit: handleLoginFormSubmit,
    reset: resetLoginForm,
    formState: { errors: loginErrors },
  } = useForm<LoginPayload>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Signup form, required by POST /users/register/.
  const {
    register: registerSignup,
    handleSubmit: handleSignupFormSubmit,
    watch: watchSignup,
    reset: resetSignupForm,
    formState: { errors: signupErrors },
  } = useForm<SignupPayload>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      displayName: "",
      phoneNumber: "",
    },
  });

  const signupFirstName = watchSignup("firstName");
  const signupLastName = watchSignup("lastName");

  const ctaText =
    authMode === "login" ? "Continue with email" : "Create account";

  // Derived in the background: first name + last initial, e.g. "Sam T.".
  const computedDisplayName = useMemo(() => {
    const trimmedFirst = signupFirstName.trim();
    const trimmedLast = signupLastName.trim();

    if (!trimmedFirst) return trimmedLast;
    if (!trimmedLast) return trimmedFirst;

    return `${trimmedFirst} ${trimmedLast.charAt(0).toUpperCase()}.`;
  }, [signupFirstName, signupLastName]);

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    resetLoginForm();
    resetSignupForm();
    setGeneralError("");
  }

  const onLoginSubmit: SubmitHandler<LoginPayload> = async (data) => {
    setGeneralError("");
    setIsSubmitting(true);

    try {
      const result = await authenticate(data);

      if (!result.ok) {
        setGeneralError(result.message);
        return;
      }

      router.push("/home/");
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignupSubmit: SubmitHandler<SignupPayload> = async (data) => {
    setGeneralError("");
    setIsSubmitting(true);

    try {
      const result = await registerAccount({
        ...data,
        displayName: computedDisplayName,
      });

      if (!result.ok) {
        setGeneralError(result.message);
        return;
      }

      router.push("/verify-phone/");
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  function handleGoogleClick() {
    if (!window.google) {
      setGeneralError("Google sign-in is still loading. Please try again.");
      return;
    }

    window.google.accounts.id.prompt();
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
                href="/login/"
                onClick={() => switchMode("login")}
                className={`w-1/2 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  authMode === "login"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Log In
              </Link>
              <Link
                href="/signup/"
                onClick={() => switchMode("signup")}
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
              onClick={handleGoogleClick}
              disabled={isSubmitting || isGoogleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition hover:bg-slate-50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <GoogleIcon />
              </span>
              {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
            </button>

            {authMode === "login" && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <div className="h-px flex-1 bg-slate-200" />
                or continue with email
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            {authMode === "signup" && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <div className="h-px flex-1 bg-slate-200" />
                or sign up with email
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            <form
              className="mt-4 space-y-4"
              onSubmit={
                authMode === "login"
                  ? handleLoginFormSubmit(onLoginSubmit)
                  : handleSignupFormSubmit(onSignupSubmit)
              }
              noValidate
            >
              {authMode === "login" ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Username or Email
                    </span>
                    <input
                      type="text"
                      placeholder="sam.loopdn"
                      {...registerLogin("username")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {loginErrors.username && (
                    <p className="text-xs text-rose-600">
                      {loginErrors.username.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Password
                    </span>
                    <input
                      type="password"
                      placeholder="Enter your password"
                      {...registerLogin("password")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {loginErrors.password && (
                    <p className="text-xs text-rose-600">
                      {loginErrors.password.message}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Username
                    </span>
                    <input
                      type="text"
                      placeholder="sam.loopdn"
                      {...registerSignup("username")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.username && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.username.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Email Address
                    </span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      {...registerSignup("email")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.email && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.email.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Phone Number
                    </span>
                    <input
                      type="tel"
                      placeholder="+14155552671"
                      {...registerSignup("phoneNumber")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.phoneNumber && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.phoneNumber.message}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        First Name
                      </span>
                      <input
                        type="text"
                        placeholder="Sam"
                        {...registerSignup("firstName")}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      {signupErrors.firstName && (
                        <p className="mt-1 text-xs text-rose-600">
                          {signupErrors.firstName.message}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Last Name
                      </span>
                      <input
                        type="text"
                        placeholder="Taylor"
                        {...registerSignup("lastName")}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      {signupErrors.lastName && (
                        <p className="mt-1 text-xs text-rose-600">
                          {signupErrors.lastName.message}
                        </p>
                      )}
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Password
                    </span>
                    <input
                      type="password"
                      placeholder="Create a password"
                      {...registerSignup("password")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.password && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.password.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Confirm Password
                    </span>
                    <input
                      type="password"
                      placeholder="Re-enter your password"
                      {...registerSignup("confirmPassword")}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.confirmPassword && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.confirmPassword.message}
                    </p>
                  )}

                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    We&apos;ll text a verification code to your phone next.
                  </p>
                </>
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
