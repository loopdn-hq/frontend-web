"use client";

/**
 * A Loop's photo, name and description, edited after it was created.
 *
 * A Save button, unlike the switches below it on General: these are typed, and
 * saving on every keystroke would rename the group for every member once per
 * letter. It is the same shape as the profile form, which edits the same three
 * things about a person.
 *
 * Only what changed is sent. That keeps a name the app's own rules would now
 * refuse - one made on another client, say - from blocking a change to the
 * photo.
 */
import { useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { AvatarPicker } from "@/components/settings/AvatarPicker";
import { SettingsError } from "@/components/settings/SettingsRows";
import {
  GROUP_DESCRIPTION_MAX,
  groupDescriptionSchema,
  groupNameSchema,
} from "@/lib/validation/group";

export type LoopDetailsChange = {
  name?: string;
  description?: string;
  image?: File;
};

type LoopDetailsFormProps = {
  name: string;
  description: string;
  imageUrl: string | null;
  canEdit: boolean;
  /** Throws on failure; its message is what the form shows. */
  onSave?: (change: LoopDetailsChange) => Promise<void>;
};

export function LoopDetailsForm({
  name,
  description,
  imageUrl,
  canEdit,
  onSave,
}: LoopDetailsFormProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [image, setImage] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Another admin can rename the Loop while this is open, and the broadcast
  // updates the props. A field nobody has touched follows it; one being typed
  // in keeps what was typed. Adjusted during render rather than in an effect,
  // so the new name is never one paint behind.
  const [seen, setSeen] = useState({ name, description });
  if (seen.name !== name || seen.description !== description) {
    setSeen({ name, description });
    if (draftName === seen.name) setDraftName(name);
    if (draftDescription === seen.description) {
      setDraftDescription(description);
    }
  }

  const nameChanged = draftName.trim() !== name;
  const descriptionChanged = draftDescription.trim() !== description;
  const isDirty = nameChanged || descriptionChanged || image !== null;

  function discard() {
    setDraftName(name);
    setDraftDescription(description);
    setImage(null);
    setError(null);
  }

  async function save() {
    const change: LoopDetailsChange = {};
    if (nameChanged) {
      const parsed = groupNameSchema.safeParse(draftName);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      change.name = parsed.data;
    }
    if (descriptionChanged) {
      const parsed = groupDescriptionSchema.safeParse(draftDescription);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      change.description = parsed.data;
    }
    if (image) change.image = image;

    setIsSaving(true);
    setSaved(false);
    setError(null);
    try {
      await onSave?.(change);
      // Cleared so the picker falls back to the URL the server just returned
      // rather than offering to upload what is already uploaded.
      setImage(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
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
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (isDirty && !isSaving) void save();
      }}
      className="space-y-4"
    >
      {error && <SettingsError>{error}</SettingsError>}

      <div className="flex items-start gap-4">
        {canEdit ? (
          <AvatarPicker
            name={name}
            currentUrl={imageUrl}
            file={image}
            onPick={(picked) => {
              setError(null);
              setImage(picked);
            }}
            onReject={setError}
            size={64}
            disabled={isSaving}
            isGroup
            pendingNote={null}
          />
        ) : (
          <ChatAvatar
            name={name}
            imageUrl={imageUrl}
            size={64}
            isGroup
            shape="square"
          />
        )}

        <Field
          label="Loop Name"
          htmlFor="loop-details-name"
          className="min-w-0 flex-1"
          hint={canEdit ? "Photo: JPG or PNG, up to 5MB" : undefined}
        >
          <Input
            id="loop-details-name"
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            disabled={!canEdit || isSaving}
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="loop-details-description"
        hint={
          canEdit
            ? `${draftDescription.trim().length}/${GROUP_DESCRIPTION_MAX}`
            : undefined
        }
      >
        <Textarea
          id="loop-details-description"
          value={draftDescription}
          onChange={(event) => setDraftDescription(event.target.value)}
          placeholder="What is this Loop about?"
          disabled={!canEdit || isSaving}
          rows={3}
        />
      </Field>

      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {saved && !isDirty && (
            <span
              role="status"
              className="text-sm text-emerald-600 dark:text-emerald-400"
            >
              Saved
            </span>
          )}
          {isDirty && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={discard}
              disabled={isSaving}
            >
              Discard
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!isDirty || isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}
