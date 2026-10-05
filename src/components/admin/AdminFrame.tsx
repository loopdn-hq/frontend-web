"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {
  Button,
  Skeleton,
  SkeletonRegion,
  ToastProvider,
} from "@/components/ui";
import { logout, setPostAuthRedirect, useAuth } from "@/lib/auth/client";
import { chatSiteUrl, useIsAdminSite } from "@/lib/config/site";
import { meets, useFeatures, type FeaturesState } from "@/lib/rbac";

// The door to the admin site: backend/rbac/registry.py grants it to account
// admins. Decides what to SHOW; every admin endpoint re-checks it on the
// server, alongside its own feature.
const PLATFORM_ACCESS = { account: "platform.access" };

const AdminFeatures = createContext<FeaturesState>({
  features: new Set(),
  loading: true,
});

/**
 * The signed-in admin's features, as the frame already loaded them.
 * For the shell and the pages instead of `useFeatures()`, which fetches its
 * own copy per mount - the menu would start empty and items pop in after.
 */
export function useAdminFeatures(): FeaturesState {
  return useContext(AdminFeatures);
}

/**
 * Everything around an admin page, on the admin site.
 *
 *   not the admin site      -> nothing (SiteRedirect moves them)
 *   not signed in           -> /login/, and back to this page afterwards
 *   no `platform.access`    -> a notice: this is not an admin account
 *   otherwise               -> the page
 *
 * No sidebar here: AdminShell adds it.
 */
export function AdminFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const adminSite = useIsAdminSite();
  const { session, isLoaded } = useAuth();
  const { features, loading } = useFeatures();

  const signedOut = adminSite && isLoaded && !session;

  useEffect(() => {
    if (signedOut) {
      setPostAuthRedirect(window.location.pathname + window.location.search);
      router.replace("/login/");
    }
  }, [router, signedOut]);

  if (!adminSite || !isLoaded || !session) return null;
  if (loading) return <AdminSkeleton />;
  if (!meets(PLATFORM_ACCESS, { features, loading })) {
    return <NotAnAdminAccount username={session} />;
  }

  return (
    <AdminFeatures.Provider value={{ features, loading: false }}>
      <ToastProvider>{children}</ToastProvider>
    </AdminFeatures.Provider>
  );
}

/**
 * Somebody signed in here whose account doesn't have the admin role. Said
 * plainly; there is no "create an account" on this site, so the ways
 * forward are out.
 */
function NotAnAdminAccount({ username }: { username: string }) {
  const router = useRouter();

  async function signOut() {
    await logout();
    router.replace("/login/");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-violet-600 uppercase">
          Loopd&apos;n Admin
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          This isn&apos;t an admin account
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You&apos;re signed in as <strong>{username}</strong>. The admin site
          is for accounts with the admin role.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={() => void signOut()}>
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

function AdminSkeleton() {
  return (
    <SkeletonRegion
      label="Loading the admin site"
      className="flex h-screen w-full bg-slate-50 dark:bg-slate-950"
    >
      {/* The dark sidebar's shape, so nothing flashes white before it. */}
      <div className="hidden w-[260px] space-y-3 bg-slate-950 p-4 md:block">
        <Skeleton className="h-6 w-32 bg-slate-800" />
        <Skeleton className="mt-6 h-9 w-full bg-slate-800" />
        <Skeleton className="h-9 w-full bg-slate-800" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="h-[68px] bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)]" />
        <div className="space-y-4 px-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
