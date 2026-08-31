"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeShell } from "@/components/home/HomeShell";
import { displayNameForSession, useSession } from "@/lib/auth/client";

export default function HomePage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  if (!session) return null;

  return <HomeShell displayName={displayNameForSession(session)} />;
}
