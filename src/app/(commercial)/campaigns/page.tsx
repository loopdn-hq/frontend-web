"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NewCampaignLink } from "@/components/commercial/NewCampaignLink";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { CampaignStatusBadge } from "@/components/commercial/StatusBadge";
import { Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchCampaigns } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import {
  CAMPAIGN_OBJECTIVE_LABEL,
  formatCents,
  formatDate,
} from "@/lib/commercial/format";
import type { Campaign } from "@/lib/commercial/types";

/** /campaigns/ - every campaign of the company being shown. */
export default function CommercialCampaignsPage() {
  const { company } = useCompany();

  return (
    <>
      <CommercialPageHeader title="Campaigns" actions={<NewCampaignLink />} />
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        {/* Keyed by company: switching company starts from a clean
            loading state instead of flashing the previous one's campaigns. */}
        {company ? (
          <CampaignList key={company.id} companyId={company.id} />
        ) : (
          <div className="space-y-4">
            <CompanyNotice />
            <NoCampaigns />
          </div>
        )}
      </div>
    </>
  );
}

function CampaignList({ companyId }: { companyId: number }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchCampaigns(companyId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setCampaigns(result.data);
          setError(null);
        } else {
          setError(result.message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, reloadToken]);

  if (isLoading) {
    return (
      <SkeletonRegion label="Loading campaigns" className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </SkeletonRegion>
    );
  }

  if (error) {
    return (
      <LoadFailed
        what="your campaigns"
        message={error}
        onRetry={() => {
          setIsLoading(true);
          setError(null);
          setReloadToken((token) => token + 1);
        }}
      />
    );
  }

  if (campaigns.length === 0) return <NoCampaigns />;

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {campaigns.map((campaign) => (
        <li key={campaign.id}>
          <Link
            href={`/campaign/?id=${campaign.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {campaign.name}
            </span>
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {CAMPAIGN_OBJECTIVE_LABEL[campaign.objective]}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatCents(campaign.totalBudgetCents)} budget
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(campaign.startsAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NoCampaigns() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Megaphone className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        No campaigns yet
      </p>
      <Link
        href="/campaigns/new/"
        className="mt-2 text-sm font-medium text-sky-600 hover:underline"
      >
        Create your first campaign
      </Link>
    </div>
  );
}
