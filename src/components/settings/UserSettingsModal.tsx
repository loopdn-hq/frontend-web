"use client";

import { Modal } from "@/components/ui";
import {
  UserSettingsPanel,
  type SettingsTab,
  type UserSettingsPanelProps,
} from "./UserSettingsPanel";

/**
 * What the dialog offers, in order.
 *
 * Profile is deliberately absent: editing a profile is its own dialog now,
 * opened from the same menu, and a second door onto the same form is how the
 * two come to disagree about what saving means. The /settings/ page keeps it,
 * so `/settings/#profile` still resolves.
 */
export const SETTINGS_MODAL_TABS: SettingsTab[] = [
  "security",
  "appearance",
  "messaging",
  "notifications",
  "privacy",
  "billing",
  "transactions",
  "account",
];

// Re-exported so existing importers of this module keep working; the types now
// live beside the panel that owns them.
export type { UserProfile } from "./UserSettingsPanel";

type UserSettingsModalProps = Omit<
  UserSettingsPanelProps,
  "bodyClassName" | "showHeading" | "layout" | "tabs"
> & {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * The settings panel as a dialog. The same settings render as a plain page at
 * /settings/; this is what the nav rail's account menu opens.
 *
 * Built on the shared Modal rather than its own overlay, which is not tidiness:
 * hand-rolled, it had its own Escape listener and none of the rest - no
 * click-outside, no scroll lock behind it, no accessible name on its only close
 * button, and no focus handling. Every one of those now comes from the one
 * dialog everything else in the app already uses, and cannot drift from them.
 *
 * The panel's own heading is suppressed, because Modal draws the title.
 */
export function UserSettingsModal({
  isOpen,
  onClose,
  ...panelProps
}: UserSettingsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      description="Manage your profile, appearance, and preferences"
      closeLabel="Close settings"
      maxWidthClassName="max-w-3xl"
      // The panel brings its own padding; Modal's would double it.
      bodyClassName="p-0"
    >
      <UserSettingsPanel
        {...panelProps}
        showHeading={false}
        layout="sidebar"
        tabs={SETTINGS_MODAL_TABS}
        // Only the content pane scrolls, so the section list stays put while a
        // long one - Billing - is read.
        bodyClassName="max-h-[60vh] overflow-y-auto pr-1"
      />
    </Modal>
  );
}
