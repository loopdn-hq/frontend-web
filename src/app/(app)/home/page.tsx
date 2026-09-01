"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeShell } from "@/components/home/HomeShell";
import {
  displayNameForSession,
  fetchCurrentUser,
  useSession,
} from "@/lib/auth/client";

export default function HomePage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  // Refresh the cached phone_no_verified flag from the backend, in case it
  // changed on another device or the local cache is stale.
  useEffect(() => {
    if (session) fetchCurrentUser();
  }, [session]);

  if (!session) return null;

  return <HomeShell displayName={displayNameForSession(session)} />;
}
