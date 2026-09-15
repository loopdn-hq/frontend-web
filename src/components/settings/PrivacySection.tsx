"use client";

import { findChoiceRow } from "@/lib/app/localPreferences";
import {
  defaultLocalPrivacyPreferences,
  PRIVACY_GROUPS,
  type LocalPrivacyPreferences,
} from "@/lib/user/privacyPreferences";
import { BlockedUsersList, useBlockedUsers } from "./BlockedUsersList";
import {
  ChoicePicker,
  LinkRow,
  PreferenceGroups,
  SettingsError,
  SettingsGroup,
  SettingsHeading,
} from "./SettingsRows";
import { useOptimisticChanges } from "./useOptimisticChanges";
import { useSubView } from "./useSubView";

/**
 * Everything the Privacy screen saves. Only browser-kept settings for now (see
 * lib/user/privacyPreferences); the name is the screen's, so it can grow
 * account-saved keys later, the way MessagingPreferences adds `emailEnabled`.
 */
export type PrivacyPreferences = LocalPrivacyPreferences;

export const defaultPrivacyPreferences: PrivacyPreferences =
  defaultLocalPrivacyPreferences;

const BLOCKED_VIEW = "blocked";

/**
 * Privacy: who can reach you, who can find you, and what they can see.
 *
 * The rows come from PRIVACY_GROUPS. Blocked users is added here, under
 * Safety, because it is not a setting: it opens the real list from the block
 * API, and unblocking there takes effect at once. It loads when the section
 * opens, so the count is ready on the row.
 */
export function PrivacySection({
  preferences,
  onSave,
}: {
  preferences: PrivacyPreferences;
  /** Receives only the keys that changed. Throws when the save failed. */
  onSave?: (change: Partial<PrivacyPreferences>) => Promise<void> | void;
}) {
  const { shown, isBusy, change, error } = useOptimisticChanges(
    preferences,
    onSave,
  );
  const subView = useSubView();
  const blocked = useBlockedUsers();

  if (subView.view === BLOCKED_VIEW) {
    return (
      <BlockedUsersList
        entries={blocked.entries ?? []}
        onBack={subView.close}
        onUnblocked={blocked.removed}
      />
    );
  }

  const choice = findChoiceRow(PRIVACY_GROUPS, subView.view);
  if (choice) {
    return (
      <ChoicePicker<PrivacyPreferences>
        row={choice}
        values={shown}
        onChange={change}
        backLabel="Privacy"
        onBack={subView.close}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SettingsHeading
        title="Privacy"
        description="Manage who can contact you on Loopd'n."
      />

      <PreferenceGroups<PrivacyPreferences>
        groups={PRIVACY_GROUPS}
        values={shown}
        isBusy={isBusy}
        onChange={change}
        onOpen={subView.open}
        rowRef={subView.rowRef}
      />

      <SettingsGroup title="Safety">
        <LinkRow
          ref={subView.rowRef(BLOCKED_VIEW)}
          label="Blocked users"
          value={blocked.entries?.length}
          disabled={blocked.entries === null}
          onClick={() => subView.open(BLOCKED_VIEW)}
        />
      </SettingsGroup>

      {blocked.error && <SettingsError>{blocked.error}</SettingsError>}
      {error && <SettingsError>{error}</SettingsError>}
    </div>
  );
}
