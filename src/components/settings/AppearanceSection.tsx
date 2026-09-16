"use client";

import {
  APPEARANCE_GROUPS,
  saveAppearancePreferences,
  useAppearancePreferences,
  type AppearancePreferences,
} from "@/lib/app/appearance";
import type { LocalAppearancePreferences } from "@/lib/app/appearanceOptions";
import { useTheme, type ThemePreference } from "@/lib/theme/ThemeProvider";
import { PreferenceGroups, SettingsHeading } from "./SettingsRows";

/**
 * Appearance: how Loopd'n looks on this device.
 *
 * All three settings are real and take effect the moment they are chosen -
 * nothing waits on the backend, because none of it belongs to the account.
 * The theme is saved by ThemeProvider; text size and message spacing by
 * lib/app/appearance. This is the one place that routes each key to its home.
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const saved = useAppearancePreferences();
  const values: AppearancePreferences = { ...saved, theme };

  return (
    <div className="space-y-5">
      <SettingsHeading
        title="Appearance"
        description="How Loopd'n looks on this device."
      />

      <PreferenceGroups<AppearancePreferences>
        groups={APPEARANCE_GROUPS}
        values={values}
        isBusy={neverBusy}
        onChange={(key, value) => {
          if (key === "theme") {
            setTheme(value as ThemePreference);
            return;
          }
          // A computed key widens to `string`; the row list keeps it honest.
          saveAppearancePreferences({
            [key]: value,
          } as Partial<LocalAppearancePreferences>);
        }}
      />
    </div>
  );
}

// Both stores save synchronously, so nothing is ever in flight.
const neverBusy = () => false;
