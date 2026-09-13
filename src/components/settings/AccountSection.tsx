"use client";

import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Download,
  LogOut,
  Monitor,
  Pencil,
  TriangleAlert,
  User,
} from "lucide-react";
import { Button } from "@/components/ui";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { EditProfileModal } from "./EditProfileModal";
import type { ProfileEdit, UserProfile } from "./UserSettingsPanel";

/**
 * The account itself: who it says you are, the session you are in, your data,
 * and the end of it.
 *
 * Distinct from Privacy, which is about who can reach you, and from Profile,
 * which is the form for changing what is shown here. This screen shows the
 * settled facts and offers the four things you can do TO an account rather
 * than with one.
 *
 * TWO OF THESE DO NOTHING YET, AND SAY SO. Data export and account deletion
 * have no endpoint behind them - not a stub, nothing - so their buttons are
 * disabled and labelled. A live-looking Delete account that silently does not
 * delete is the worst possible version of this screen: somebody presses it
 * believing they are gone, and they are not.
 */
export function AccountSection({
  profile,
  onSaveProfile,
  onLogout,
}: {
  profile: UserProfile;
  onSaveProfile?: (profile: ProfileEdit) => Promise<void> | void;
  onLogout?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Account
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Who you are on Loopd&apos;n, and what you can do with this account.
        </p>
      </div>

      <Card icon={<User className="h-5 w-5" />} title="Profile">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your public profile and contact information.
        </p>

        <div className="mt-4 flex items-center gap-4">
          {/* Read-only here. The camera lives in Edit profile, where there is
              a Save to go with it - a picker on a card with nothing to press
              leaves people wondering whether their photo was kept. */}
          <ChatAvatar
            name={profile.displayName || "?"}
            imageUrl={profile.avatarUrl}
            size={56}
          />

          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {profile.displayName || "Your name"}
            </p>
            {profile.username && (
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                @{profile.username}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="shrink-0"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit profile
          </Button>
        </div>

        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Detail
            label="Username"
            value={profile.username}
            note="Cannot be changed"
          />
          <Detail
            label="Email"
            value={profile.email}
            verified={profile.emailVerified}
          />
          <Detail
            label="Phone"
            value={profile.phone}
            verified={profile.phoneVerified}
          />
        </dl>
      </Card>

      <Card icon={<Monitor className="h-5 w-5" />} title="Session">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sign out of Loopd&apos;n on this device. You can always sign back in
          later.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onLogout}
          className="mt-3"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          Log out
        </Button>
      </Card>

      <Card icon={<Download className="h-5 w-5" />} title="Data">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Download a copy of your account information.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled
          className="mt-3"
        >
          Request export
        </Button>
        <NotBuiltYet />
      </Card>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
        <p className="flex items-center gap-2 font-medium text-rose-700 dark:text-rose-400">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          Danger zone
        </p>
        <p className="mt-2 font-medium text-rose-700 dark:text-rose-400">
          Delete account
        </p>
        <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/70">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled
          className="mt-3"
        >
          Delete account
        </Button>
        <p className="mt-2 text-xs text-rose-600/70 dark:text-rose-400/60">
          Not available yet — deleting an account has to decide what happens to
          the messages you have already sent to other people, and nothing has
          decided that.
        </p>
      </div>

      {isEditing && (
        <EditProfileModal
          isOpen
          onClose={() => setIsEditing(false)}
          profile={profile}
          onSave={onSaveProfile}
        />
      )}
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
        <span className="text-sky-600 dark:text-sky-400">{icon}</span>
        {title}
      </p>
      {children}
    </section>
  );
}

/**
 * One settled fact. Shown rather than edited: the form for changing any of
 * these is Edit profile, and a value that looks like a field but is not one
 * invites people to type into it.
 */
function Detail({
  label,
  value,
  verified,
  note,
}: {
  label: string;
  value?: string | null;
  verified?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right">
        <span className="truncate text-slate-900 dark:text-slate-100">
          {value || <span className="text-slate-400">Not set</span>}
        </span>
        {value && verified === true && (
          <BadgeCheck
            className="h-4 w-4 shrink-0 text-emerald-500"
            aria-label="Verified"
          />
        )}
        {value && verified === false && (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Unverified
          </span>
        )}
        {note && (
          <span className="shrink-0 text-xs text-slate-400">({note})</span>
        )}
      </dd>
    </div>
  );
}

function NotBuiltYet() {
  return (
    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
      Not available yet.
    </p>
  );
}
