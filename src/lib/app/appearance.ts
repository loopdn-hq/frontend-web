/**
 * Settings → Appearance: text size and message spacing.
 *
 * REAL, and kept in this browser - which is where they belong: they describe
 * a screen, not an account. The theme is NOT kept here; ThemeProvider has
 * saved it (as "loopdn_theme") since before this screen existed.
 *
 * Both are applied as attributes on <html> - `data-text-size` and
 * `data-message-spacing` - which app/globals.css reads. app/layout.tsx sets
 * them before the first paint; `useApplyAppearance` keeps them current after.
 */
import { useEffect } from "react";
import {
  createLocalPreferences,
  type PreferenceGroup,
} from "@/lib/app/localPreferences";
import type { ThemePreference } from "@/lib/theme/ThemeProvider";
import {
  APPEARANCE_STORAGE_KEY,
  defaultLocalAppearancePreferences,
  MESSAGE_SPACINGS,
  TEXT_SIZES,
  type LocalAppearancePreferences,
} from "./appearanceOptions";

export const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match my device" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** Everything the Appearance screen shows: the saved choices, and the theme. */
export type AppearancePreferences = LocalAppearancePreferences & {
  theme: ThemePreference;
};

/** Every row, grouped and in the order the Appearance screen shows them. */
export const APPEARANCE_GROUPS: readonly PreferenceGroup<AppearancePreferences>[] =
  [
    {
      title: "Theme",
      rows: [
        {
          kind: "radio",
          key: "theme",
          label: "Light or dark",
          options: THEME_OPTIONS,
        },
      ],
    },
    {
      title: "Text size",
      rows: [
        {
          kind: "radio",
          key: "textSize",
          label: "Size of text across Loopd'n",
          options: TEXT_SIZES,
        },
      ],
    },
    {
      title: "Message spacing",
      rows: [
        {
          kind: "radio",
          key: "messageSpacing",
          label: "Space between messages in your chats",
          options: MESSAGE_SPACINGS,
        },
      ],
    },
  ];

const store = createLocalPreferences({
  storageKey: APPEARANCE_STORAGE_KEY,
  defaults: defaultLocalAppearancePreferences,
  groups: APPEARANCE_GROUPS,
});

export const useAppearancePreferences = store.useValues;
export const saveAppearancePreferences = store.save;

/**
 * Keeps <html>'s attributes in step with the saved choices.
 *
 * Subscribes directly rather than through `useAppearancePreferences`: during
 * hydration that hook returns the defaults for one render, and applying those
 * would undo the pre-paint script and flash the default size.
 */
export function useApplyAppearance(): void {
  useEffect(() => {
    const apply = () => {
      const { textSize, messageSpacing } = store.get();
      const root = document.documentElement;
      root.dataset.textSize = textSize;
      root.dataset.messageSpacing = messageSpacing;
    };
    apply();
    return store.subscribe(apply);
  }, []);
}
