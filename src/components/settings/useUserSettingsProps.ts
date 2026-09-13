"use client";

import { useAppShell } from "@/lib/app/AppShellProvider";
import { updateUserProfile } from "@/lib/auth/client";
import type {
  ProfileEdit,
  UserProfile,
  UserSettingsPanelProps,
} from "./UserSettingsPanel";

/**
 * The settings panel, wired to the account it is editing.
 *
 * Everything here used to live inline in the /settings/ page, which was the
 * only thing rendering the panel. It is now also rendered as a modal from the
 * nav rail, and a second copy of "PATCH the profile, then put the answer back
 * into the shell" is a second copy that can disagree with the first about what
 * a failed save means. So it lives once, here.
 *
 * Both save handlers THROW on failure rather than logging. The caller is the
 * only one that knows what to do about it - a modal has to stay open and say
 * so, a toggle has to flip itself back - and a handler that swallows the error
 * leaves every caller believing it worked.
 */
export type ConnectedSettingsProps = Pick<
  UserSettingsPanelProps,
  | "profile"
  | "onSaveProfile"
  | "notificationPreferences"
  | "onSaveNotifications"
  | "onLogout"
>;

export function useUserSettingsProps(): ConnectedSettingsProps {
  const { userProfile, setUserProfile, logOut } = useAppShell();

  return {
    profile: userProfile,

    onSaveProfile: async (profile: ProfileEdit) => {
      const result = await updateUserProfile(profile);
      if (!result.ok) {
        throw new Error(result.message);
      }
      // The File is deliberately not kept: what comes back is an `avatarUrl`
      // the server is now serving, and holding both would leave the shell with
      // two answers to "what is their picture".
      setUserProfile(result as UserProfile);
    },

    notificationPreferences: { emailEnabled: userProfile.emailEnabled ?? true },

    onSaveNotifications: async (prefs) => {
      // Only the switch is sent; JSON drops the undefined keys, so flipping it
      // cannot overwrite a display name somebody is halfway through typing.
      const result = await updateUserProfile({
        emailEnabled: prefs.emailEnabled,
      });
      if (!result.ok) {
        throw new Error(result.message);
      }

      setUserProfile((previous) => ({
        ...previous,
        emailEnabled: result.emailEnabled ?? prefs.emailEnabled,
      }));
    },

    onLogout: () => void logOut(),
  };
}
