"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { updateUserProfile } from "@/lib/auth/client";
import {
  fetchAccountSettings,
  saveAccountSettings,
  type AccountMessagingPreferences,
} from "@/lib/user/accountSettings";
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
 * This is also the one place that decides where each setting is kept.
 * Messaging, Notifications and Privacy are saved on the account
 * (lib/user/accountSettings). The browser stores hold a copy of what the
 * account last said, and that copy is what every screen and the chat box
 * read - so they draw at once, and a save shows only once the server has it.
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

  // Load the account's settings over the browser copy. Until this answers -
  // or if it fails - the screens show what this browser last held.
  useEffect(() => {
    let cancelled = false;

    fetchAccountSettings().then((result) => {
      if (cancelled || !result.ok) return;
      saveLocalNotificationPreferences(result.settings.notifications);
      saveLocalPrivacyPreferences(result.settings.privacy);
      holdMessaging(result.settings.messaging, setUserProfile);
    });

    return () => {
      cancelled = true;
    };
  }, [setUserProfile]);

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

    onSaveMessaging: async (change) => {
      const result = await saveAccountSettings("messaging", change);
      if (!result.ok) {
        throw new Error(result.message);
      }
      holdMessaging(result.values, setUserProfile);
    },

    notificationPreferences: localNotifications,

    onSaveNotifications: async (change) => {
      const result = await saveAccountSettings("notifications", change);
      if (!result.ok) {
        throw new Error(result.message);
      }
      saveLocalNotificationPreferences(result.values);
    },

    privacyPreferences: localPrivacy,

    onSavePrivacy: async (change) => {
      const result = await saveAccountSettings("privacy", change);
      if (!result.ok) {
        throw new Error(result.message);
      }
      saveLocalPrivacyPreferences(result.values);
    },
  };
}

/**
 * Messaging's account values have two homes: email on the profile, where the
 * app already reads it, and the rest in the browser copy.
 */
function holdMessaging(
  { emailEnabled, ...rest }: Partial<AccountMessagingPreferences>,
  setUserProfile: Dispatch<SetStateAction<UserProfile>>,
) {
  saveLocalMessagingPreferences(rest);
  if (emailEnabled !== undefined) {
    setUserProfile((previous) => ({ ...previous, emailEnabled }));
  }
}
