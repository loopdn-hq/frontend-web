"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { useSession } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session) {
      router.replace("/home");
    }
  }, [router, session]);

  if (session) return null;

  return <AuthScreen initialMode="login" />;
}
