"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, User } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { EditProfileModal } from "./EditProfileModal";
import type { ProfileEdit, UserProfile } from "./UserSettingsPanel";

/**
 * The account itself: who it says you are, and the one irreversible thing you
 * can do to it.
 *
 * Distinct from Privacy, which is about who can reach you, and from Edit
 * profile, which is the form for changing what is shown here. This screen
 * shows the settled facts.
 *
 * DELETING IS NOT BUILT, and the button says so when pressed rather than by
 * being greyed out. There is no endpoint behind it - not a stub, nothing - so
 * the alternative was either a dead control or one that silently does not
 * delete, and the second is the dangerous one: somebody presses it believing
 * they are gone, and they are not. Pressing it now gives a straight answer.
 */
export function AccountSection({
  profile,
  onSaveProfile,
}: {
  profile: UserProfile;
  onSaveProfile?: (profile: ProfileEdit) => Promise<void> | void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [askedToDelete, setAskedToDelete] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Account
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Who you are on Loopd&apos;n, and what you can do with this account.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
            <User className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Profile
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your public profile and contact information.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          {/* Read-only here. The camera lives in Edit profile, where there is
              a Save to go with it - a picker on a card with nothing to press
              leaves people unsure whether their photo was kept. */}
          <ChatAvatar
            name={profile.displayName || "?"}
            imageUrl={profile.avatarUrl}
            size={64}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
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
            onClick={() => setIsEditing(true)}
            className="shrink-0"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        </div>

        <dl className="mt-5">
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
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/50 dark:bg-rose-950/30">
        <p className="flex items-center gap-2 text-lg font-bold text-rose-600 dark:text-rose-400">
          <Trash2 className="h-5 w-5 shrink-0" />
          Danger zone
        </p>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Delete account
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Permanently delete your account and associated data. This action
              cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={() => setAskedToDelete(true)}
            className="shrink-0"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete account
          </Button>
        </div>
      </section>

      {isEditing && (
        <EditProfileModal
          isOpen
          onClose={() => setIsEditing(false)}
          profile={profile}
          onSave={onSaveProfile}
        />
      )}

      <Modal
        isOpen={askedToDelete}
        onClose={() => setAskedToDelete(false)}
        title="Deleting isn't available yet"
        maxWidthClassName="max-w-sm"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setAskedToDelete(false)}>Close</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your account has not been deleted and nothing has changed.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Deleting an account has to decide what happens to the messages you
          have already sent to other people, and that decision has not been
          made. Until it is, this cannot be done from here — write to support
          and it will be handled by hand.
        </p>
      </Modal>
    </div>
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
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3 text-sm dark:border-slate-800">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right">
        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
          {value || <span className="font-normal text-slate-400">Not set</span>}
        </span>
        {note && <span className="shrink-0 text-slate-400">({note})</span>}
        {value && verified === true && (
          <span
            title="Verified"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            <span className="sr-only">Verified</span>
          </span>
        )}
        {value && verified === false && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Unverified
          </span>
        )}
      </dd>
    </div>
  );
}
