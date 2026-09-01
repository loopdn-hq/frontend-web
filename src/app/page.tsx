"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/client";

export default function RootPage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    router.replace(session ? "/home/" : "/login/");
  }, [router, session]);

  return null;
}
