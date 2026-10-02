"use client";

import { useEffect, useMemo, useRef } from "react";
import { Camera } from "lucide-react";
import { ChatAvatar } from "@/components/home/ChatAvatar";

/**
 * The server is the authority: `ProfileSerializer.validate_avatar` and
 * `validate_group_image` both refuse anything larger, and their wording -
 * "Keep the image under 5MB." - is what the user is shown. This copy exists
 * only so a 40MB photo fails the instant it is chosen rather than after a long
 * upload on a phone connection.
 */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Choose a new profile picture, or a Loop's photo.
 *
 * Holds no state of its own beyond the preview URL: the FILE belongs to
 * whichever form is going to save it, because that form decides when it is
 * sent and when it is thrown away. One component so the Edit profile dialog,
 * the Profile tab of Settings and a Loop's own photo cannot drift on what a
 * picture is allowed to be.
 */
export function AvatarPicker({
  name,
  currentUrl,
  file,
  onPick,
  onReject,
  size = 96,
  disabled = false,
  isGroup = false,
  pendingNote = "New photo selected - save to apply",
}: {
  name: string;
  currentUrl?: string | null;
  /** The pending choice, held by the parent. Null means "unchanged". */
  file: File | null;
  onPick: (file: File) => void;
  /** Told why a file was refused before it was ever offered to the server. */
  onReject: (message: string) => void;
  size?: number;
  disabled?: boolean;
  /** A Loop's photo: the group glyph when empty, and the square groups wear. */
  isGroup?: boolean;
  /** Said under a chosen photo. Null where the preview says enough. */
  pendingNote?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);

  // Built during render rather than in an effect, so the preview is on screen
  // in the same paint as the choice. Revoked when it is replaced or the form
  // goes away - an object URL pins the whole file in memory until it is.
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change event -
    // otherwise picking a photo, cancelling the dialog and picking it once
    // more does nothing at all.
    event.target.value = "";
    if (!picked) return;

    if (picked.size > MAX_BYTES) {
      onReject(
        `That image is ${(picked.size / (1024 * 1024)).toFixed(1)}MB. Keep it under ${MAX_BYTES / (1024 * 1024)}MB.`,
      );
      return;
    }
    onPick(picked);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <ChatAvatar
          name={name}
          imageUrl={preview ?? currentUrl}
          size={size}
          isGroup={isGroup}
          shape={isGroup ? "square" : "circle"}
        />

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled}
          aria-label={
            preview || currentUrl
              ? `Change ${isGroup ? "Loop" : "profile"} photo`
              : `Add a ${isGroup ? "Loop" : "profile"} photo`
          }
          className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm transition hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none disabled:opacity-50 dark:border-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* Hidden rather than absent: the button above is the visible control,
            and a bare file input cannot be styled to match anything. */}
        <input
          ref={input}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          tabIndex={-1}
        />
      </div>

      {file && pendingNote && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {pendingNote}
        </p>
      )}
    </div>
  );
}
