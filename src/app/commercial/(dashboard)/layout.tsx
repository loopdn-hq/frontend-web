"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadFailed } from "@/components/app/LoadFailed";
import { CommercialShell } from "@/components/commercial/CommercialShell";
import { Skeleton, SkeletonRegion } from "@/components/ui";
import {
  CompanyProvider,
  useCompanyList,
} from "@/lib/commercial/CompanyProvider";
import { meets, useFeatures } from "@/lib/rbac";

// The account-axis feature backend/rbac/registry.py grants to the
// `advertiser` role. Decides what to SHOW; every /promote/ endpoint re-checks.
const ADS_ACCESS = { account: "ads.access" };

/**
 * The dashboard proper: every /commercial/ page except /commercial/start/.
 *
 * Three gates, in order, and each failure has one destination:
 *
 *   1. no `ads.access`        -> /commercial/start/   (no access yet)
 *   2. companies failed      -> LoadFailed         (network, or API not live)
 *   3. zero companies        -> /commercial/start/   (access, but no company)
 *
 * Past all three, every page below can call useCompany() and get a real
 * company - no page handles "no company" on its own.
 */
export default function CommercialDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { features, loading } = useFeatures();
  const hasAccess = meets(ADS_ACCESS, { features, loading });
  const { state, reload } = useCompanyList(hasAccess);

  const noAccess = !loading && !hasAccess;
  const hasNone = state.status === "ready" && state.companies.length === 0;

  useEffect(() => {
    if (noAccess || hasNone) router.replace("/commercial/start/");
  }, [router, noAccess, hasNone]);

  if (state.status === "failed") {
    return (
      <div className="mx-auto w-full max-w-md p-6">
        <LoadFailed
          what="your company"
          message={state.message}
          onRetry={reload}
        />
      </div>
    );
  }

  if (state.status === "loading" || noAccess || hasNone) {
    return <DashboardSkeleton />;
  }

  return (
    <CompanyProvider companies={state.companies} reload={reload}>
      <CommercialShell>{children}</CommercialShell>
    </CompanyProvider>
  );
}

function DashboardSkeleton() {
  return (
    <SkeletonRegion
      label="Loading your dashboard"
      className="flex h-screen w-full"
    >
      <div className="hidden w-64 space-y-3 border-r border-slate-200 p-4 md:block dark:border-slate-800">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
