"use client";

import { useSyncExternalStore } from "react";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import {
  isSettingsTab,
  UserSettingsPanel,
  type SettingsTab,
} from "@/components/settings/UserSettingsPanel";
import { updateUserProfile, type ProfileResult } from "@/lib/auth/client";
import type { UserProfile } from "@/components/settings/UserSettingsPanel";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function tabFromHash(): SettingsTab | undefined {
  const fragment = window.location.hash.replace(/^#/, "");
  return isSettingsTab(fragment) ? fragment : undefined;
}

/**
 * The tab named by the URL, or undefined for plain `/settings/`.
 *
 * `useSyncExternalStore` rather than reading the hash into state on mount:
 * this page is prerendered at build time, where there is no hash at all, and
 * this is the hook whose whole purpose is to serve the server snapshot during
 * hydration and swap to the real one immediately after - so the tab is right
 * on the first paint the user sees, with no mismatch and no flash of Profile.
 */
function useTabFromHash(): SettingsTab | undefined {
  return useSyncExternalStore(subscribeToHash, tabFromHash, () => undefined);
}

export default function SettingsPage() {
  const { userProfile, setUserProfile, logOut } = useAppShell();
  const tab = useTabFromHash();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl">
        <NavDrawerButton className="mt-4 ml-4 bg-slate-900 text-white" />
        <UserSettingsPanel
          // Remounted when the URL names a different tab, which is what makes
          // arriving from the nav rail's menu land where it said it would -
          // including when Settings is already the open page.
          key={tab ?? "profile"}
          initialTab={tab}
          profile={userProfile}
          onSaveProfile={async (profile) => {
            const res: ProfileResult = await updateUserProfile(profile);
            if (!res.ok) {
              console.error("Failed to update profile:", res.message);
              return;
            }

            setUserProfile(res as UserProfile);
          }}
          notificationPreferences={{
            emailEnabled: userProfile.emailEnabled ?? true,
          }}
          onSaveNotifications={async (prefs) => {
            // Same PATCH as the profile form; only the switch is sent. Throwing
            // is how the panel learns to put the toggle back.
            const res = await updateUserProfile({
              emailEnabled: prefs.emailEnabled,
            });
            if (!res.ok) {
              throw new Error(res.message);
            }

            setUserProfile((prev) => ({
              ...prev,
              emailEnabled: res.emailEnabled ?? prefs.emailEnabled,
            }));
          }}
          onLogout={() => void logOut()}
        />
      </div>
    </div>
  );
}
