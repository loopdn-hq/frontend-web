"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setPostAuthRedirect, useAuth } from "@/lib/auth/client";

/**
 * Everything under /commercial/ needs a signed-in person, and nothing more.
 *
 * NOT under app/(app)/. That layout is the chat app's frame - it opens the
 * chat websocket, the call layer and the nav rail for every route inside it -
 * and a company looking at a campaign report needs none of it. Keeping the
 * two trees apart is what lets either change without breaking the other.
 *
 * There is no `ads.access` check here, on purpose: /commercial/start/ is where a
 * person with no company yet creates one, so it must be reachable without
 * it. The check is one level down, in (dashboard)/layout.tsx.
 *
 * Same account, same login as chat. A company is OWNED by a user (backend
 * ads.Advertiser.owner); it is never a second kind of account.
 */
export default function CommercialLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { session, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && !session) {
      // Back here after login, not to /chats/: somebody who followed a link
      // to their campaign should land on their campaign.
      setPostAuthRedirect(window.location.pathname + window.location.search);
      router.replace("/login/");
    }
  }, [router, isLoaded, session]);

  if (!isLoaded || !session) return null;

  return children;
}
