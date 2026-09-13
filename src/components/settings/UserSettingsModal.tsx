"use client";

import { useEffect, useRef } from "react";
import {
  UserSettingsPanel,
  type UserSettingsPanelProps,
} from "./UserSettingsPanel";

// Re-exported so existing importers of this module keep working; the types now
// live beside the panel that owns them.
export type { UserProfile, NotificationPreferences } from "./UserSettingsPanel";

type UserSettingsModalProps = Omit<UserSettingsPanelProps, "bodyClassName"> & {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Dialog wrapper around UserSettingsPanel. The same settings also render as a
 * plain page at /settings/ - this exists for callers that want them inline.
 */
export function UserSettingsModal({
  isOpen,
  onClose,
  ...panelProps
}: UserSettingsModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog when it opens. The menu that opens it puts
  // focus back on its own trigger as it closes - which is behind this overlay,
  // so without this a keyboard user would be tabbing through the nav rail they
  // cannot see. Effect cleanups run before effect bodies, so this lands last.
  useEffect(() => {
    if (!isOpen) return;
    panel.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // z-60 rather than z-50: the nav rail that opens this is itself z-50, and
    // the two overlapping meant the rail sat on top of its own dialog.
    <div className="fixed inset-0 z-[60]">
      <div className="flex min-h-screen items-start justify-center bg-black/50 p-4">
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          tabIndex={-1}
          className="relative max-h-[90vh] w-full max-w-3xl rounded-2xl bg-[var(--panel)] text-[var(--foreground)] focus:outline-none"
        >
          <button
            type="button"
            onClick={onClose}
            className="sticky top-4 right-4 z-10 float-right rounded-lg bg-white/10 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <UserSettingsPanel
            {...panelProps}
            bodyClassName="max-h-[50vh] overflow-y-auto ![scrollbar-width:none] ![&::-webkit-scrollbar]:hidden"
          />
        </div>
      </div>
    </div>
  );
}
