"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { AvatarPicker } from "./AvatarPicker";
import type { ProfileEdit, UserProfile } from "./UserSettingsPanel";

/**
 * The quick edit behind "Profile" in the account menu.
 *
 * Deliberately smaller than the Profile tab of Settings: the two fields
 * somebody actually changes, in a dialog that opens over whatever they were
 * doing, rather than a navigation away from it. The full tab keeps its place
 * for the rest.
 *
 * The save handler is the SAME one the settings panel uses - see
 * useUserSettingsProps - so there is one description of what saving a profile
 * means and two ways to ask for it.
 */
export function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave?: (profile: ProfileEdit) => Promise<void> | void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameField = useRef<HTMLInputElement>(null);

  // An effect rather than `autoFocus`, and the difference is not cosmetic.
  // The menu that opens this dialog restores focus to its trigger as it
  // closes, in a passive effect cleanup - which React runs AFTER the commit
  // that applies `autoFocus`. The dialog would open with focus sitting on the
  // nav rail behind it. Effect cleanups all run before effect bodies, so
  // asking here lands last and wins.
  useEffect(() => {
    if (!isOpen) return;
    nameField.current?.focus();
  }, [isOpen]);

  const unchanged =
    avatarFile === null &&
    displayName.trim() === profile.displayName.trim() &&
    bio.trim() === (profile.bio ?? "").trim();
  // The same rule the Profile tab enforces. A blank display name is not a
  // change worth saving - it leaves the account labelled by whatever the
  // serializer falls back to, which is not what the person meant to do.
  const cannotSave = isSaving || unchanged || !displayName.trim();

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      await onSave?.({
        ...profile,
        displayName: displayName.trim(),
        bio,
        avatarFile,
      });
      onClose();
    } catch (err) {
      // Stay open. Closing on a failed save would leave the new name on
      // screen - the shell still holds the old one - and nothing said why.
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save that. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit profile"
      closeLabel="Close profile editor"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={cannotSave}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AvatarPicker
          name={displayName || profile.username || "?"}
          currentUrl={profile.avatarUrl}
          file={avatarFile}
          onPick={(picked) => {
            setError(null);
            setAvatarFile(picked);
          }}
          onReject={setError}
          disabled={isSaving}
        />

        <Field label="Display name" htmlFor="edit-profile-display-name">
          <Input
            id="edit-profile-display-name"
            type="text"
            ref={nameField}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="rounded-lg px-3 py-2"
          />
        </Field>

        {profile.username && (
          <Field label="Username" htmlFor="edit-profile-username">
            <Input
              id="edit-profile-username"
              type="text"
              value={profile.username}
              readOnly
              disabled
              className="rounded-lg px-3 py-2"
            />
            {/* Shown but not editable, and the reason is worth stating: the
                API refuses it on purpose, because a username already appears
                on every message this account has ever sent. */}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your username cannot be changed - it is how your past messages are
              attributed.
            </p>
          </Field>
        )}

        <Field label="Bio" htmlFor="edit-profile-bio">
          <Textarea
            id="edit-profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="rounded-lg px-3 py-2"
            rows={3}
          />
        </Field>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
