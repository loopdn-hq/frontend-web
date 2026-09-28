"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { consumePostAuthRedirect, useAuth } from "@/lib/auth/client";

/**
 * On an auth page, send somebody who ARRIVED already signed in on to where
 * they were going: the page they asked for before being sent here, or
 * /chats/.
 *
 * Once, on arrival, and never again. These pages sign people in themselves,
 * and when their own form does it, the form decides what comes next - the
 * page that was asked for, /add-phone/ for a new Google account,
 * /verify-phone/ after an email code. A check that fired on every change of
 * session would fire then too and race the form: two navigations, and
 * whichever ran last won. That is how somebody who followed a link to their
 * campaign could land in chats instead, or skip verifying their phone.
 */
export function useLeaveIfSignedIn(): void {
  const router = useRouter();
  const { session, isLoaded } = useAuth();
  const decided = useRef(false);

  useEffect(() => {
    if (!isLoaded || decided.current) return;
    decided.current = true;

    if (session) {
      router.replace(consumePostAuthRedirect() ?? "/chats/");
    }
  }, [router, isLoaded, session]);
}
