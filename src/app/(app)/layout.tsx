"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActivityToasts } from "@/components/app/ActivityToasts";
import { AppNavRail } from "@/components/app/AppNavRail";
import { CallLayer } from "@/components/calls/CallLayer";
import { AppShellProvider } from "@/lib/app/AppShellProvider";
import { CallProvider } from "@/lib/calls/CallProvider";
import { fetchCurrentUser, useAuth } from "@/lib/auth/client";
import { isDesktop } from "@/lib/config/origin";
import { commercialSiteUrl } from "@/lib/config/site";
import { useFeatures } from "@/lib/rbac";

/**
 * Frame shared by every signed-in route: the auth guard, the shell state that
 * has to outlive navigation, and the nav rail beside the active page.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, isLoaded } = useAuth();
  const { features, loading: featuresLoading } = useFeatures();

  // A commercial account has no chat: it holds `commercial.access` and not
  // `chat.access`, so everything here would be empty or refused. Send it to its
  // own site instead. Signing in is per site (tokens live in this origin's
  // storage), so it signs in once more there. Not in the desktop app, which is
  // chat only and has no commercial site to go to.
  const commercialOnly =
    !featuresLoading &&
    features.has("commercial.access") &&
    !features.has("chat.access");

  useEffect(() => {
    if (commercialOnly && !isDesktop()) {
      window.location.replace(commercialSiteUrl("/"));
    }
  }, [commercialOnly]);

  useEffect(() => {
    if (isLoaded && !session) {
      router.replace("/login/");
    }
  }, [router, isLoaded, session]);

  // Refresh the cached phone_no_verified flag from the backend, in case it
  // changed on another device or the local cache is stale.
  useEffect(() => {
    if (isLoaded && session) {
      void fetchCurrentUser();
    }
  }, [isLoaded, session]);

  if (!isLoaded || !session) return null;

  return (
    <AppShellProvider>
      {/* Inside the shell for its socket; above the routes so a call
          survives navigating between them. */}
      <CallProvider>
        {/* Full-bleed: the shell fills the viewport rather than floating as an
            inset card, so there is no gutter around the app. */}
        <main className="flex h-screen w-full overflow-hidden bg-[#f7fbff] dark:bg-slate-900">
          <AppNavRail />
          <div className="min-h-0 min-w-0 flex-1">{children}</div>
          <ActivityToasts />
          <CallLayer />
        </main>
      </CallProvider>
    </AppShellProvider>
  );
}
