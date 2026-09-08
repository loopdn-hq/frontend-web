"use client";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="flex min-h-screen items-start justify-center bg-black/50 p-4">
        <div className="relative max-h-[90vh] w-full max-w-3xl rounded-2xl bg-[var(--panel)] text-[var(--foreground)]">
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
