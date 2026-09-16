"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { consumePostAuthRedirect, useAuth } from "@/lib/auth/client";

export default function SignupPage() {
  const router = useRouter();
  const { session, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && session) {
      router.replace(consumePostAuthRedirect() ?? "/chats/");
    }
  }, [router, isLoaded, session]);

  if (!isLoaded || session) return null;

  return <AuthScreen initialMode="signup" />;
}
