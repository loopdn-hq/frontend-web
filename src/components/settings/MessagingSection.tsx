"use client";

import {
  MESSAGING_GROUPS,
  type MessagingPreferences,
} from "@/lib/user/messagingPreferences";
import {
  PreferenceGroups,
  SettingsError,
  SettingsHeading,
} from "./SettingsRows";
import { useOptimisticChanges } from "./useOptimisticChanges";

/**
 * Messaging: how you send, and how messages reach people outside Loopd'n.
 *
 * Nothing here is particular to this screen - every row comes from
 * MESSAGING_GROUPS. Where each value is kept (on the account, SMS delivery in
 * this browser) is decided in `useUserSettingsProps`, not here; what each
 * row actually does today is written down in lib/user/messagingPreferences.
 */
export function MessagingSection({
  preferences,
  onSave,
}: {
  preferences: MessagingPreferences;
  /** Receives only the keys that changed. Throws when the save failed. */
  onSave?: (change: Partial<MessagingPreferences>) => Promise<void> | void;
}) {
  const { shown, isBusy, change, error } = useOptimisticChanges(
    preferences,
    onSave,
  );

  return (
    <div className="space-y-5">
      <SettingsHeading
        title="Messaging"
        description="How you send messages, and how they're delivered by text and email."
      />

      <PreferenceGroups<MessagingPreferences>
        groups={MESSAGING_GROUPS}
        values={shown}
        isBusy={isBusy}
        onChange={change}
      />

      {error && <SettingsError>{error}</SettingsError>}
    </div>
  );
}
