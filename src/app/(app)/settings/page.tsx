"use client";

import { useAppShell } from "@/lib/app/AppShellProvider";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { UserSettingsPanel } from "@/components/settings/UserSettingsPanel";
import { updateUserProfile, type ProfileResult } from "@/lib/auth/client";
import type { UserProfile } from "@/components/settings/UserSettingsPanel";

export default function SettingsPage() {
  const { userProfile, setUserProfile, logOut } = useAppShell();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl">
        <NavDrawerButton className="mt-4 ml-4 bg-slate-900 text-white" />
        <UserSettingsPanel
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
