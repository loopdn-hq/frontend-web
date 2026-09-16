"use client";

import { useState, useSyncExternalStore } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Alert, Badge, Button, Field, Input, Modal } from "@/components/ui";
import { describeBrowser } from "@/lib/app/describeBrowser";
import { changePassword, type FieldErrors } from "@/lib/auth/client";
import { changePasswordSchema } from "@/lib/validation/auth";
import { SettingsGroup, SettingsHeading, SwitchRow } from "./SettingsRows";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { useSubView } from "./useSubView";
import type { UserProfile } from "./UserSettingsPanel";

const TWO_FACTOR_VIEW = "two-factor";
const NOT_AVAILABLE = "Not available yet";

/**
 * Security: your password, and how the account is protected at sign-in.
 *
 * ONLY THE PASSWORD IS REAL. Two-factor authentication, login alerts and the
 * list of active sessions are FRONTEND ONLY and marked "Not available yet"
 * (2026-09-14, the user's choice). Unlike the other settings screens, nothing
 * here is even saved in the browser: a security setting that looks on but
 * protects nothing is worse than no setting.
 *
 * So: switches for what does not exist are shown off and locked, and the
 * buttons that would do something - Set up, Sign out of all other devices -
 * give a straight answer when pressed, as Delete account does in
 * AccountSection.
 *
 * AND A PASSWORD CHANGE DOES NOT SIGN ANYONE OUT. The backend does not revoke
 * refresh tokens when a password changes, so a device already signed in stays
 * signed in. The screen says so wherever a password change could look like
 * the way to lock someone out.
 */
export function SecuritySection({ profile }: { profile: UserProfile }) {
  const subView = useSubView();
  const [askedSignOutOthers, setAskedSignOutOthers] = useState(false);
  const inTwoFactor = subView.view === TWO_FACTOR_VIEW;

  return (
    <>
      {inTwoFactor && (
        <TwoFactorSetup profile={profile} onBack={subView.close} />
      )}

      {/* Hidden, not unmounted, while two-factor is open: the password form
          is real, and leaving to look at Set up must not throw away what was
          typed or a change that is still saving. */}
      <div className="space-y-5" hidden={inTwoFactor}>
        <SettingsHeading
          title="Security"
          description="Your password, and how your account is protected when you sign in."
        />

        <SettingsGroup title="Password">
          <div className="space-y-4 p-4">
            <ChangePasswordForm />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A new password stops anyone signing in with the old one. It does
              not sign out devices that are already signed in.
            </p>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Two-factor authentication" badge={NOT_AVAILABLE}>
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Ask for a code when I sign in{" "}
                <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                  Off
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                A one-time code, sent by text or email to a phone or address
                you&apos;ve verified.
              </p>
            </div>
            <Button
              ref={subView.rowRef(TWO_FACTOR_VIEW)}
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => {
                // A dialog left open would sit inside the now-hidden view and
                // take the next Escape unseen.
                setAskedSignOutOthers(false);
                subView.open(TWO_FACTOR_VIEW);
              }}
            >
              Set up
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Login alerts" badge={NOT_AVAILABLE}>
          <SwitchRow
            label="Email me about new sign-ins"
            description="When a device or browser you haven't used before signs in to your account."
            checked={false}
            busy={false}
            disabled
            onChange={ignore}
          />
          <SwitchRow
            label="Text me about new sign-ins"
            checked={false}
            busy={false}
            disabled
            onChange={ignore}
          />
        </SettingsGroup>

        <SettingsGroup title="Active sessions" badge={NOT_AVAILABLE}>
          <CurrentSession />
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Other devices and browsers you&apos;re signed in on will be listed
              here once this is available.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAskedSignOutOthers(true)}
            >
              Sign out of all other devices
            </Button>
          </div>
        </SettingsGroup>

        <Modal
          isOpen={askedSignOutOthers}
          onClose={() => setAskedSignOutOthers(false)}
          title="Signing out other devices isn't available yet"
          maxWidthClassName="max-w-sm"
          footer={
            <div className="flex justify-end">
              <Button onClick={() => setAskedSignOutOthers(false)}>
                Close
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No device has been signed out, and nothing has changed.
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            To sign out of this browser, use Log out in the account menu. If you
            think someone else knows your password, change it on this screen:
            that stops anyone signing in with the old one, but it does not sign
            out a device that is already signed in.
          </p>
        </Modal>
      </div>
    </>
  );
}

const ignore = () => {};
const subscribeToNothing = () => () => {};

/**
 * The one session that can be shown truthfully without a backend: this one.
 * The name comes from the browser's own user agent, read after hydration.
 */
function CurrentSession() {
  const browser = useSyncExternalStore(
    subscribeToNothing,
    () => describeBrowser(navigator.userAgent),
    () => null,
  );

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
        <MonitorSmartphone aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {browser ?? "This browser"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This device · active now
        </p>
      </div>
      <Badge tone="success">Current</Badge>
    </div>
  );
}

/** Changing the password - real, and moved here unchanged from the panel. */
function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");
    setFieldErrors({});
    setSaved(false);

    const parsed = changePasswordSchema.safeParse({ oldPassword, newPassword });
    if (!parsed.success) {
      const issues: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key =
          issue.path[0] === "oldPassword" ? "old_password" : "new_password";
        issues[key] = [...(issues[key] ?? []), issue.message];
      }
      setFieldErrors(issues);
      return;
    }

    setIsSaving(true);
    try {
      const result = await changePassword({ oldPassword, newPassword });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setGeneralError(result.message);
        return;
      }

      setOldPassword("");
      setNewPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  }

  const oldPasswordErrors = fieldErrors.old_password ?? [];
  const newPasswordErrors = fieldErrors.new_password ?? [];

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <Field label="Current Password" htmlFor="settings-current-password">
        <Input
          id="settings-current-password"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          autoComplete="current-password"
          disabled={isSaving}
          className="rounded-lg px-3 py-2"
        />
        {oldPasswordErrors.map((message) => (
          <p key={message} className="mt-1 text-xs text-rose-600">
            {message}
          </p>
        ))}
      </Field>

      <Field label="New Password" htmlFor="settings-new-password">
        <Input
          id="settings-new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          disabled={isSaving}
          className="rounded-lg px-3 py-2"
        />
        {newPasswordErrors.map((message) => (
          <p key={message} className="mt-1 text-xs text-rose-600">
            {message}
          </p>
        ))}
      </Field>

      {generalError && (
        <Alert variant="error" className="text-xs">
          {generalError}
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isSaving || !oldPassword || !newPassword}
        >
          {isSaving ? "Saving..." : "Change Password"}
        </Button>
        {saved && (
          <p className="text-xs font-medium text-emerald-600">
            Password changed ✓
          </p>
        )}
      </div>
    </form>
  );
}
