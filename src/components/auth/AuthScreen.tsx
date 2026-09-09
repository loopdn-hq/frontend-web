"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  Controller,
  useForm,
  type SubmitHandler,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import {
  authenticate,
  authenticateWithGoogle,
  registerAccount,
  setPendingEmail,
  stashPendingCredentials,
} from "@/lib/auth/client";
import {
  loginSchema,
  signupSchema,
  type LoginPayload,
  type SignupPayload,
} from "@/lib/validation/auth";
import {
  Alert,
  Button,
  Field,
  Input,
  InternationalPhoneInput,
} from "@/components/ui";
import { useTheme } from "@/lib/theme/ThemeProvider";
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

export function AuthScreen({ initialMode }: AuthScreenProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);

  const [generalError, setGeneralError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

        // New Google accounts have no phone_number yet - collect one before home.
        router.push(result.isNewAccount ? "/add-phone/" : "/chats/");
      } catch {
        setGeneralError("Network error. Please try again.");
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [router],
  );

  function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setGeneralError("Google didn't return a credential. Please try again.");
      return;
    }

    void handleGoogleCredential(credentialResponse.credential);
  }

  function handleGoogleError() {
    setGeneralError("Unable to continue with Google. Please try again.");
  }

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
    control,
    register: registerSignup,
    handleSubmit: handleSignupFormSubmit,
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

  const signupFirstName = useWatch({
    control,
    name: "firstName",
  });
  const signupLastName = useWatch({
    control,
    name: "lastName",
  });

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
        if (result.emailNotVerified) {
          setPendingEmail(data.username);
          stashPendingCredentials(data.username, data.password);
          router.push("/verify-email/");
          return;
        }

        setGeneralError(result.message);
        return;
      }

      router.push("/chats/");
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

      router.push("/verify-email/");
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_15%_20%,#1e293b_0%,#0f172a_45%,#020617_100%)] sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-700/20" />

      <section className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/60 bg-white/40 shadow-[0_20px_80px_rgba(0,102,179,0.17)] backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 dark:shadow-[0_22px_80px_rgba(2,6,23,0.55)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex flex-col justify-between bg-[linear-gradient(150deg,#00a6ff_0%,#0574cc_56%,#12386e_100%)] p-8 text-white dark:bg-[linear-gradient(150deg,#0369a1_0%,#1e3a8a_55%,#0f172a_100%)] sm:p-12">
          <div>
            <p className="inline-flex rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs tracking-[0.14em] uppercase">
              Loopdn
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

        <div className="flex items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] p-6 dark:bg-[linear-gradient(180deg,#0f172a_0%,#0b1220_100%)] sm:p-10">
          <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_44px_rgba(2,6,23,0.5)] sm:p-8">
            <div className="mb-6 flex items-center justify-between rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <Link
                href="/login/"
                onClick={() => switchMode("login")}
                className={`w-1/2 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  authMode === "login"
                    ? "bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Log In
              </Link>
              <Link
                href="/signup/"
                onClick={() => switchMode("signup")}
                className={`w-1/2 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  authMode === "signup"
                    ? "bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Sign Up
              </Link>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {panelTitle[authMode]}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {panelSubTitle[authMode]}
            </p>

            <div className="mt-4 rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
              <div className="flex w-auto justify-center [&>div]:w-auto">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  width="336"
                  text={authMode === "login" ? "signin_with" : "signup_with"}
                  theme={resolvedTheme === "dark" ? "filled_black" : "outline"}
                />
              </div>
            </div>
            {isGoogleLoading && (
              <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                Connecting to Google...
              </p>
            )}

            {authMode === "login" && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                or continue with email
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
            )}

            {authMode === "signup" && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                or sign up with email
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
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
                  <Field
                    label="Username or Email"
                    htmlFor="login-username"
                    error={loginErrors.username?.message}
                  >
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="sam.loopdn"
                      {...registerLogin("username")}
                      disabled={isSubmitting}
                      state={loginErrors.username ? "error" : "default"}
                    />
                  </Field>

                  <Field
                    label="Password"
                    htmlFor="login-password"
                    error={loginErrors.password?.message}
                  >
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        {...registerLogin("password")}
                        disabled={isSubmitting}
                        className="pr-11"
                        state={loginErrors.password ? "error" : "default"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((value) => !value)}
                        disabled={isSubmitting}
                        aria-label={
                          showLoginPassword ? "Hide password" : "Show password"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label="Username"
                    htmlFor="signup-username"
                    error={signupErrors.username?.message}
                  >
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="sam.loopdn"
                      {...registerSignup("username")}
                      disabled={isSubmitting}
                      state={signupErrors.username ? "error" : "default"}
                    />
                  </Field>

                  <Field
                    label="Email Address"
                    htmlFor="signup-email"
                    error={signupErrors.email?.message}
                  >
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      {...registerSignup("email")}
                      disabled={isSubmitting}
                      state={signupErrors.email ? "error" : "default"}
                    />
                  </Field>

                  <Field
                    label="Phone Number"
                    error={signupErrors.phoneNumber?.message}
                    hint={
                      "By providing your number, you agree to receive SMS messages from Loopd'n. Msg & data rates may apply. Msg frequency may vary. Reply HELP for help and STOP to opt out."
                    }
                  >
                    <Controller
                      control={control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <InternationalPhoneInput
                          id="signup-phone"
                          name={field.name}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          autoComplete="tel"
                          placeholder="Enter your phone number"
                          disabled={isSubmitting}
                        />
                      )}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="First Name"
                      htmlFor="signup-first-name"
                      error={signupErrors.firstName?.message}
                    >
                      <Input
                        id="signup-first-name"
                        type="text"
                        placeholder="Sam"
                        {...registerSignup("firstName")}
                        disabled={isSubmitting}
                        state={signupErrors.firstName ? "error" : "default"}
                      />
                    </Field>

                    <Field
                      label="Last Name"
                      htmlFor="signup-last-name"
                      error={signupErrors.lastName?.message}
                    >
                      <Input
                        id="signup-last-name"
                        type="text"
                        placeholder="Taylor"
                        {...registerSignup("lastName")}
                        disabled={isSubmitting}
                        state={signupErrors.lastName ? "error" : "default"}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Password"
                    htmlFor="signup-password"
                    error={signupErrors.password?.message}
                  >
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? "text" : "password"}
                        placeholder="Create a password"
                        {...registerSignup("password")}
                        disabled={isSubmitting}
                        className="pr-11"
                        state={signupErrors.password ? "error" : "default"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((value) => !value)}
                        disabled={isSubmitting}
                        aria-label={
                          showSignupPassword ? "Hide password" : "Show password"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        {showSignupPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field
                    label="Confirm Password"
                    htmlFor="signup-confirm-password"
                    error={signupErrors.confirmPassword?.message}
                  >
                    <div className="relative">
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        {...registerSignup("confirmPassword")}
                        disabled={isSubmitting}
                        className="pr-11"
                        state={
                          signupErrors.confirmPassword ? "error" : "default"
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        disabled={isSubmitting}
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Alert variant="success" className="text-xs">
                    We&apos;ll email you a verification code next, then text one
                    to your phone.
                  </Alert>
                </>
              )}

              {generalError && (
                <Alert variant="error" className="text-xs">
                  {generalError}
                </Alert>
              )}

              <Button type="submit" disabled={isSubmitting} fullWidth>
                {isSubmitting ? <LoadingSpinner /> : ctaText}
              </Button>

              {isSubmitting && <ProgressBar />}
            </form>

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              By continuing, you agree to Loopd&apos;n{" "}
              <Link
                href="/terms/"
                className="underline hover:text-slate-700 dark:hover:text-slate-200"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy/"
                className="underline hover:text-slate-700 dark:hover:text-slate-200"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
