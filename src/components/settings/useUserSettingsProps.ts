"use client";

import { useAppShell } from "@/lib/app/AppShellProvider";
import { updateUserProfile } from "@/lib/auth/client";
import {
  saveLocalMessagingPreferences,
  useLocalMessagingPreferences,
} from "@/lib/user/messagingPreferences";
import {
  saveLocalNotificationPreferences,
  useLocalNotificationPreferences,
} from "@/lib/user/notificationPreferences";
import {
  saveLocalPrivacyPreferences,
  useLocalPrivacyPreferences,
} from "@/lib/user/privacyPreferences";
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
 * This is also the one place that decides where each setting is kept - on the
 * account, or in this browser until the API has a field for it.
 *
 * Every save handler THROWS on failure rather than logging. The caller is the
 * only one that knows what to do about it - a modal has to stay open and say
 * so, a toggle has to flip itself back - and a handler that swallows the error
 * leaves every caller believing it worked.
 */
export type ConnectedSettingsProps = Pick<
  UserSettingsPanelProps,
  | "profile"
  | "onSaveProfile"
  | "messagingPreferences"
  | "onSaveMessaging"
  | "notificationPreferences"
  | "onSaveNotifications"
  | "privacyPreferences"
  | "onSavePrivacy"
>;

export function useUserSettingsProps(): ConnectedSettingsProps {
  const { userProfile, setUserProfile } = useAppShell();
  const localMessaging = useLocalMessagingPreferences();
  const localNotifications = useLocalNotificationPreferences();
  const localPrivacy = useLocalPrivacyPreferences();

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

    messagingPreferences: {
      ...localMessaging,
      emailEnabled: userProfile.emailEnabled ?? true,
    },

    onSaveMessaging: async ({ emailEnabled, ...local }) => {
      // Everything but email stays in this browser until the API has a field
      // for it. When one lands, read it from `userProfile` above and send it in
      // the PATCH below - after teaching `updateUserProfile` to carry it,
      // because it only sends the fields it names.
      if (Object.keys(local).length > 0) {
        saveLocalMessagingPreferences(local);
      }
      if (emailEnabled === undefined) return;

      // Only email is sent; JSON drops the undefined keys, so ticking the box
      // cannot overwrite a display name somebody is halfway through typing.
      const result = await updateUserProfile({ emailEnabled });
      if (!result.ok) {
        throw new Error(result.message);
      }

      setUserProfile((previous) => ({
        ...previous,
        emailEnabled: result.emailEnabled ?? emailEnabled,
      }));
    },

    notificationPreferences: localNotifications,

    // All of Notifications stays in this browser for now.
    onSaveNotifications: async (change) => {
      saveLocalNotificationPreferences(change);
    },

    privacyPreferences: localPrivacy,

    // All of Privacy stays in this browser for now - and is enforced by
    // nothing (see lib/user/privacyPreferences).
    onSavePrivacy: async (change) => {
      saveLocalPrivacyPreferences(change);
    },
  };
}
