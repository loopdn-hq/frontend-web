"use client";

import { findChoiceRow } from "@/lib/app/localPreferences";
import {
  defaultLocalNotificationPreferences,
  NOTIFICATION_GROUPS,
  type LocalNotificationPreferences,
} from "@/lib/user/notificationPreferences";
import {
  ChoicePicker,
  PreferenceGroups,
  SettingsError,
  SettingsHeading,
} from "./SettingsRows";
import { useOptimisticChanges } from "./useOptimisticChanges";
import { useSubView } from "./useSubView";

/**
 * Everything the Notifications screen saves. Only browser-kept settings for
 * now (see lib/user/notificationPreferences); the name is the screen's, so it
 * can grow account-saved keys later.
 *
 * Group email used to have a card here. It is on Messaging now, where the
 * design puts it - one setting, one switch.
 */
export type NotificationPreferences = LocalNotificationPreferences;

export const defaultNotificationPreferences: NotificationPreferences =
  defaultLocalNotificationPreferences;

/**
 * Notifications: what you are told about, and how.
 *
 * The rows come from NOTIFICATION_GROUPS; this file adds only the view the
 * Sound row opens.
 */
export function NotificationsSection({
  preferences,
  onSave,
}: {
  preferences: NotificationPreferences;
  /** Receives only the keys that changed. Throws when the save failed. */
  onSave?: (change: Partial<NotificationPreferences>) => Promise<void> | void;
}) {
  const { shown, isBusy, change, error } = useOptimisticChanges(
    preferences,
    onSave,
  );
  const subView = useSubView();

  const choice = findChoiceRow(NOTIFICATION_GROUPS, subView.view);
  if (choice) {
    return (
      <ChoicePicker<NotificationPreferences>
        row={choice}
        values={shown}
        onChange={change}
        backLabel="Notifications"
        onBack={subView.close}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SettingsHeading
        title="Notifications"
        description="Choose what Loopd'n tells you about, and how."
      />

      <PreferenceGroups<NotificationPreferences>
        groups={NOTIFICATION_GROUPS}
        values={shown}
        isBusy={isBusy}
        onChange={change}
        onOpen={subView.open}
        rowRef={subView.rowRef}
      />

      {error && <SettingsError>{error}</SettingsError>}
    </div>
  );
}
