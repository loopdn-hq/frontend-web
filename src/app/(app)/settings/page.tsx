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
      <div className="mx-auto max-w-3xl">
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
          onSaveNotifications={async (prefs) => {
            console.log("Saving notification preferences:", prefs);
            // Will connect to Django backend
          }}
          onLogout={() => void logOut()}
        />
      </div>
    </div>
  );
}
