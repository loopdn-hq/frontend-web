"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import {
  Button,
  Skeleton,
  SkeletonRegion,
  ToastProvider,
} from "@/components/ui";
import { logout, setPostAuthRedirect, useAuth } from "@/lib/auth/client";
import { CompanyProvider } from "@/lib/commercial/CompanyProvider";
import { chatSiteUrl, useIsCommercialSite } from "@/lib/config/site";
import { meets, useFeatures } from "@/lib/rbac";

// The account-axis feature backend/rbac/registry.py grants to the `commercial`
// role. Decides what to SHOW; every /commercial/ API endpoint re-checks.
const COMMERCIAL_ACCESS = { account: "commercial.access" };

/**
 * Everything around a commercial page, on the commercial site.
 *
 *   not the commercial site   -> nothing (SiteRedirect moves them)
 *   not signed in             -> /login/, and back to this page afterwards
 *   no `commercial.access`    -> a notice: this is not a commercial account
 *   otherwise                 -> the page, straight away
 *
 * No sidebar here: CommercialDashboard adds it.
 * Nothing waits on the company. CompanyProvider loads it in the background and
 * each page shows what it can without one, so a slow or missing API never
 * replaces the whole dashboard with an error.
 */
export function CommercialFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const commercialSite = useIsCommercialSite();
  const { session, isLoaded } = useAuth();
  const { features, loading } = useFeatures();

  const signedOut = commercialSite && isLoaded && !session;

  useEffect(() => {
    if (signedOut) {
      setPostAuthRedirect(window.location.pathname + window.location.search);
      router.replace("/login/");
    }
  }, [router, signedOut]);

  if (!commercialSite || !isLoaded || !session) return null;
  if (loading) return <DashboardSkeleton />;
  if (!meets(COMMERCIAL_ACCESS, { features, loading })) {
    return <NotACommercialAccount username={session} />;
  }

  return (
    <ToastProvider>
      <CompanyProvider>{children}</CompanyProvider>
    </ToastProvider>
  );
}

/**
 * Somebody signed in here with an account that is not commercial - a chat
 * account, most likely. Said plainly, with the two ways forward.
 */
function NotACommercialAccount({ username }: { username: string }) {
  const router = useRouter();

  async function signOutTo(path: string) {
    await logout();
    router.replace(path);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-600 uppercase">
          Loopd&apos;n Commercial
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          This isn&apos;t a commercial account
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You&apos;re signed in as <strong>{username}</strong>, a Loopd&apos;n
          chat account. To advertise, create a commercial account.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => void signOutTo("/signup/")}>
            Create a commercial account
          </Button>
          <Button variant="secondary" onClick={() => void signOutTo("/login/")}>
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
        <a
          href={chatSiteUrl("/chats/")}
          className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline"
        >
          Go to Loopd&apos;n chat
        </a>
      </section>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <SkeletonRegion
      label="Loading your dashboard"
      className="flex h-screen w-full bg-[#f7fbff] dark:bg-slate-900"
    >
      {/* The dark sidebar's shape, so nothing flashes white before it. */}
      <div className="hidden w-[260px] space-y-3 bg-slate-900 p-4 md:block">
        <Skeleton className="h-6 w-32 bg-slate-800" />
        <Skeleton className="mt-6 h-9 w-full bg-slate-800" />
        <Skeleton className="h-9 w-full bg-slate-800" />
        <Skeleton className="h-9 w-full bg-slate-800" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="h-[68px] bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)]" />
        <div className="space-y-4 px-6">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}
