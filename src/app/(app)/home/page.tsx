"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Chats moved to /chats/. Kept so existing bookmarks and any stale client-side
// links still land somewhere useful - a static export has no server redirects.
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/chats/");
  }, [router]);

  return null;
}
