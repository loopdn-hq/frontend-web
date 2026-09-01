"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeShell } from "@/components/home/HomeShell";
import {
  displayNameForSession,
  fetchCurrentUser,
  useAuth,
} from "@/lib/auth/client";

export default function HomePage() {
  const router = useRouter();
  const { session, isLoaded } = useAuth();

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

  return <HomeShell displayName={displayNameForSession(session)} />;
}
