"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, Field, Input, RadioGroup } from "@/components/ui";
import { SettingsHeading } from "./SettingsRows";
import type { UserProfile } from "./UserSettingsPanel";

type Method = "sms" | "email";

/**
 * Setting up two-factor authentication - AS A PREVIEW.
 *
 * The flow is here so the design can be seen and walked through; nothing
 * behind it exists. No code is sent, nothing is checked and the account does
 * not change, and the screen says so at the top and again at the one button
 * that would matter. When the backend can send and check a sign-in code, the
 * two places marked BACKEND become calls and the notices come out.
 *
 * Codes only ever go to an address the account has VERIFIED: a code sent to
 * an unproven number is a code sent to whoever typed that number in.
 */
export function TwoFactorSetup({
  profile,
  onBack,
}: {
  profile: UserProfile;
  onBack: () => void;
}) {
  const id = useId();
  const phone = profile.phoneVerified && profile.phone ? profile.phone : null;
  const email = profile.emailVerified && profile.email ? profile.email : null;

  const [chosen, setChosen] = useState<Method>("sms");
  const [step, setStep] = useState<"method" | "code">("method");
  const [code, setCode] = useState("");
  const [triedVerify, setTriedVerify] = useState(false);

  // What was picked, unless it cannot be used - the profile can arrive after
  // this view opens, so this is worked out on every render, not stored.
  // Null when there is nowhere verified to send a code - then nothing may
  // look selected, not even a disabled option.
  const method: Method | null =
    (chosen === "sms" ? phone : email) !== null
      ? chosen
      : phone
        ? "sms"
        : email
          ? "email"
          : null;
  const destination =
    method === "sms"
      ? phone && maskPhone(phone)
      : method === "email"
        ? email && maskEmail(email)
        : null;

  // Moving between steps unmounts the focused button, so focus is placed on
  // the new step. Not on first render: the heading has just taken it.
  const codeInput = useRef<HTMLInputElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const hasMoved = useRef(false);
  useEffect(() => {
    if (!hasMoved.current) return;
    if (step === "code") codeInput.current?.focus();
    else continueButton.current?.focus();
  }, [step]);

  function goTo(next: "method" | "code") {
    hasMoved.current = true;
    setTriedVerify(false);
    setStep(next);
  }

  return (
    <div className="space-y-4">
      <SettingsHeading
        title="Two-factor authentication"
        description="Ask for a one-time code, sent by text or email, when you sign in."
        backLabel="Security"
        onBack={onBack}
      />

      <Alert variant="info">
        Preview: two-factor authentication isn&apos;t available yet. No code is
        sent, and nothing about your account changes.
      </Alert>

      {step === "method" && (
        <div className="space-y-4">
          <p
            id={`${id}-question`}
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Where should codes go?
          </p>
          <RadioGroup<Method | "">
            name={`${id}-method`}
            aria-labelledby={`${id}-question`}
            value={method ?? ""}
            onChange={(value) => {
              if (value) setChosen(value);
            }}
            options={[
              {
                value: "sms",
                label: "Text message",
                description: phone
                  ? `To ${maskPhone(phone)}`
                  : "Only a verified phone number can receive codes",
                disabled: !phone,
              },
              {
                value: "email",
                label: "Email",
                description: email
                  ? `To ${maskEmail(email)}`
                  : "Only a verified email address can receive codes",
                disabled: !email,
              },
            ]}
          />
          {method === null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Codes can only go to a phone number or email address you&apos;ve
              verified.
            </p>
          )}
          <Button
            ref={continueButton}
            type="button"
            onClick={() => {
              // BACKEND: send the code here, before moving on.
              goTo("code");
            }}
            disabled={!destination}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "code" && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            // BACKEND: check the code here, then turn two-factor on.
            setTriedVerify(true);
          }}
        >
          <p
            id={`${id}-code-help`}
            className="text-sm text-slate-600 dark:text-slate-300"
          >
            When this is live, a 6-digit code will be sent to {destination}, and
            you&apos;ll enter it here to finish.
          </p>

          <Field label="6-digit code" htmlFor={`${id}-code`}>
            <Input
              ref={codeInput}
              id={`${id}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-describedby={`${id}-code-help`}
              placeholder="123456"
              value={code}
              onChange={(event) => {
                // Digits first, then six: a pasted "482 913" keeps all six.
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setTriedVerify(false);
              }}
              className="rounded-lg px-3 py-2 tracking-widest"
            />
          </Field>

          <div role="status">
            {triedVerify && (
              <Alert variant="neutral">
                Nothing was turned on: checking codes isn&apos;t available yet.
                Your account is exactly as it was.
              </Alert>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => goTo("method")}
            >
              Back
            </Button>
            <Button type="submit" disabled={code.length !== 6}>
              Verify
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** "•••• 4567" - enough to recognise your own number, not enough to use. */
function maskPhone(phone: string): string {
  return `•••• ${phone.slice(-4)}`;
}

/** "y•••@gmail.com" - the first letter and the domain, never the length. */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}•••@${domain}` : email;
}
