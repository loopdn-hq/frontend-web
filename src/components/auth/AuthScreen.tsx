"use client";

import Image from "next/image";
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
import { AccessIcon, SmsWebIcon, VoiceIcon } from "./FeatureIcons";
import { LoadingSpinner } from "./LoadingSpinner";
import { ProgressBar } from "./LoadingSkeletons";
import { InternationalPhoneInput } from "@/components/ui/InternationalPhoneInput";
import { Checkbox } from "@/components/ui/checkbox";

const FEATURES = [
  {
    icon: SmsWebIcon,
    label: "SMS + Web",
    copy: "One conversation. Every channel.",
  },
  { icon: VoiceIcon, label: "Voice", copy: "Record once. Share everywhere." },
  { icon: AccessIcon, label: "Access", copy: "No app. Just join your group." },
] as const;

export type AuthMode = "login" | "signup";

type AuthScreenProps = {
  initialMode: AuthMode;
};

const panelTitle: Record<AuthMode, string> = {
  login: "Welcome Back",
  signup: "Create your Loopdn account",
};

const panelSubTitle: Record<AuthMode, string> = {
  login: "Sign in to manage groups, members, and broadcasts",
  signup: "Create an account with your email and phone number.",
};

export function AuthScreen({ initialMode }: AuthScreenProps) {
  const router = useRouter();
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
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#E8F5FE] px-4 py-8 sm:px-8">
      <section className="relative mx-auto grid w-full max-w-[1020px] overflow-hidden rounded-[40px] border border-[#D1ECFF] bg-white p-[11px] lg:min-h-[676px] lg:grid-cols-[522px_1fr]">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[31px] bg-[radial-gradient(ellipse_58%_78%_at_63%_44%,#04173f_0%,#082255_42%,rgba(11,42,105,0.55)_68%,rgba(11,42,105,0)_86%),radial-gradient(ellipse_62%_58%_at_10%_80%,#dcf0fd_0%,#a2d8fa_32%,rgba(92,176,236,0.45)_62%,rgba(92,176,236,0)_84%),linear-gradient(135deg,#0a2c74_0%,#1663c2_34%,#3392e4_58%,#1a5cb0_100%)] p-7 text-white">
          <div>
            {/* The real lockup, not an approximation of it. RGBA with a
                genuinely transparent ground, so it sits on the gradient
                without a plate behind it. `priority` because this is the
                first thing painted on the one screen nobody is signed in
                for yet. */}
            <Image
              src="/full-logo.png"
              alt="Loopd'n"
              width={1300}
              height={319}
              priority
              className="h-8 w-auto"
            />

            {/* 53px/100%/-3% at weight 500. Clamped below lg because the
                panel is the full card width there and 53px would set three
                words to a line. */}
            <h1 className="mt-[46px] max-w-[400px] text-[40px] leading-[1.17] font-medium tracking-[-0.03em] lg:text-[53px] lg:leading-[62px]">
              One Group. Any Phone. Everyone Connected
            </h1>
            <p className="mt-[38px] max-w-[407px] text-[15px] leading-[150%] font-normal text-white">
              Coordinate chats for members on web and SMS with clear admin
              control, broadcast options, and fast voice updates.
            </p>
          </div>

          {/* 146x119 cards at 15px radius. The inner offsets come straight
              from the spec - 10px inset, heading baseline at 52, copy at 77 -
              so the icon, heading and copy land where they were drawn. */}
          <div className="mt-10 grid gap-[10px] sm:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.label}
                  className="h-[119px] rounded-[15px] bg-white p-[10px] sm:max-w-[146px]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#9CDAF8] text-[#0E357B]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-[10px] text-[13px] leading-[150%] font-semibold text-[#0E357B] uppercase">
                    {feature.label}
                  </p>
                  <p className="mt-[5px] text-2xs leading-[138%] font-medium text-[#0E357B]">
                    {feature.copy}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] p-6 sm:p-10">
          <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
            <div className="mb-[26px] flex h-[52px] items-center gap-[7px] rounded-[13px] bg-[#F4F4F4] p-[5px]">
              <Link
                href="/login/"
                onClick={() => switchMode("login")}
                className={`flex h-[42px] flex-1 items-center justify-center rounded-[10px] text-center text-[16px] leading-[138%] font-medium capitalize transition ${
                  authMode === "login"
                    ? "bg-white text-black"
                    : "text-[#05205A]/60 hover:text-[#05205A]"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Log In
              </Link>
              <Link
                href="/signup/"
                onClick={() => switchMode("signup")}
                className={`flex h-[42px] flex-1 items-center justify-center rounded-[10px] text-center text-[16px] leading-[138%] font-medium capitalize transition ${
                  authMode === "signup"
                    ? "bg-white text-black"
                    : "text-[#05205A]/60 hover:text-[#05205A]"
                } ${isSubmitting ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              >
                Sign Up
              </Link>
            </div>

            <h2 className="text-[30px] leading-none font-medium tracking-[-0.03em] text-[#05205A]">
              {panelTitle[authMode]}
            </h2>
            <p className="mt-3 text-[15px] leading-[150%] font-normal text-[#05205A]">
              {panelSubTitle[authMode]}
            </p>

            {/* 23px, per Frame 22's gap between the Welcome block and the
                Google button. It had none, so the button sat flush
                against the subtitle. */}
            <div className="mt-[23px] flex w-full justify-center [&>div]:w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                width="336"
                text={authMode === "login" ? "signin_with" : "signup_with"}
              />
            </div>
            {isGoogleLoading && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Connecting to Google...
              </p>
            )}

            {authMode === "login" && (
              <div className="mt-[23px] mb-[23px] flex items-center gap-[6px] text-[15px] leading-[150%] text-[#05205A]">
                <div className="h-px flex-1 bg-[#D7D7D7]" />
                or continue with email
                <div className="h-px flex-1 bg-[#D7D7D7]" />
              </div>
            )}

            {authMode === "signup" && (
              <div className="mt-[23px] mb-[23px] flex items-center gap-[6px] text-[15px] leading-[150%] text-[#05205A]">
                <div className="h-px flex-1 bg-[#D7D7D7]" />
                or sign up with email
                <div className="h-px flex-1 bg-[#D7D7D7]" />
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
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Username or Email
                    </span>
                    <input
                      type="text"
                      placeholder="sam.loopdn"
                      {...registerLogin("username")}
                      disabled={isSubmitting}
                      className="h-[56px] w-full rounded-[12px] border border-[#D7D7D7] px-[23px] text-[16px] leading-[150%] text-[#05205A] outline-none transition placeholder:text-[#D7D7D7] focus:border-[#3CB3FD] focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {loginErrors.username && (
                    <p className="text-xs text-rose-600">
                      {loginErrors.username.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Password
                    </span>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        {...registerLogin("password")}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((value) => !value)}
                        disabled={isSubmitting}
                        aria-label={
                          showLoginPassword ? "Hide password" : "Show password"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
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
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Username
                    </span>
                    <input
                      type="text"
                      placeholder="sam.loopdn"
                      {...registerSignup("username")}
                      disabled={isSubmitting}
                      className="h-[56px] w-full rounded-[12px] border border-[#D7D7D7] px-[23px] text-[16px] leading-[150%] text-[#05205A] outline-none transition placeholder:text-[#D7D7D7] focus:border-[#3CB3FD] focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.username && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.username.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Email Address
                    </span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      {...registerSignup("email")}
                      disabled={isSubmitting}
                      className="h-[56px] w-full rounded-[12px] border border-[#D7D7D7] px-[23px] text-[16px] leading-[150%] text-[#05205A] outline-none transition placeholder:text-[#D7D7D7] focus:border-[#3CB3FD] focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>

                  {signupErrors.email && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.email.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Phone Number
                    </span>
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
                  </label>

                  {signupErrors.phoneNumber && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.phoneNumber.message}
                    </p>
                  )}

                  <Checkbox
                    {...registerSignup("smsConsent")}
                    disabled={isSubmitting}
                    className="mt-0.5 border-slate-400 bg-white [color-scheme:light] dark:border-slate-400 dark:bg-white"
                    containerClassName="border-slate-300 bg-white ring-1 ring-slate-200 hover:bg-white dark:border-slate-300 dark:hover:bg-white"
                    labelClassName="text-xs font-normal text-slate-600 dark:text-slate-600"
                    label={
                      <>
                        By providing your number, you agree to receive SMS
                        messages from Loopd&apos;n. Msg &amp; data rates may
                        apply. Msg frequency may vary. Reply HELP for help and
                        STOP to opt out.
                      </>
                    }
                  />

                  {signupErrors.smsConsent && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.smsConsent.message}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-[9px]">
                    <label className="block">
                      <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                        First Name
                      </span>
                      <input
                        type="text"
                        placeholder="Sam"
                        {...registerSignup("firstName")}
                        disabled={isSubmitting}
                        className="h-[56px] w-full rounded-[12px] border border-[#D7D7D7] px-[23px] text-[16px] leading-[150%] text-[#05205A] outline-none transition placeholder:text-[#D7D7D7] focus:border-[#3CB3FD] focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      {signupErrors.firstName && (
                        <p className="mt-1 text-xs text-rose-600">
                          {signupErrors.firstName.message}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                        Last Name
                      </span>
                      <input
                        type="text"
                        placeholder="Taylor"
                        {...registerSignup("lastName")}
                        disabled={isSubmitting}
                        className="h-[56px] w-full rounded-[12px] border border-[#D7D7D7] px-[23px] text-[16px] leading-[150%] text-[#05205A] outline-none transition placeholder:text-[#D7D7D7] focus:border-[#3CB3FD] focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      {signupErrors.lastName && (
                        <p className="mt-1 text-xs text-rose-600">
                          {signupErrors.lastName.message}
                        </p>
                      )}
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Password
                    </span>
                    <div className="relative">
                      <input
                        type={showSignupPassword ? "text" : "password"}
                        placeholder="Create a password"
                        {...registerSignup("password")}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((value) => !value)}
                        disabled={isSubmitting}
                        aria-label={
                          showSignupPassword ? "Hide password" : "Show password"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
                      >
                        {showSignupPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </label>

                  {signupErrors.password && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.password.message}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-[14px] block text-[16px] leading-[150%] font-normal text-[#05205A]">
                      Confirm Password
                    </span>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        {...registerSignup("confirmPassword")}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </label>

                  {signupErrors.confirmPassword && (
                    <p className="text-xs text-rose-600">
                      {signupErrors.confirmPassword.message}
                    </p>
                  )}

                  <p className="rounded-[12px] bg-[#DAFFED] p-[14px] text-center text-[14px] leading-[140%] text-[#1A7351]">
                    We&apos;ll email you a verification code next, then text one
                    to your phone.
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
                className="flex h-[56px] w-full items-center justify-center rounded-[12px] border border-[#1883C6] bg-[#3CB3FD] text-[16px] leading-[150%] font-normal text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <LoadingSpinner /> : ctaText}
              </button>

              {isSubmitting && <ProgressBar />}
            </form>

            <p className="mt-[17px] text-center text-[14px] leading-[150%] text-[#AAAAAA]">
              By continuing, you agree to Loopd&apos;n{" "}
              <Link href="/terms/" className="underline hover:text-slate-700">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy/" className="underline hover:text-slate-700">
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
