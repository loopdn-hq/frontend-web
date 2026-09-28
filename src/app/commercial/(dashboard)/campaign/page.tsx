"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LoadFailed } from "@/components/app/LoadFailed";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { CampaignStatusBadge } from "@/components/commercial/StatusBadge";
import { Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchCampaign } from "@/lib/commercial/api";
import {
  CAMPAIGN_OBJECTIVE_LABEL,
  formatCents,
  formatDate,
} from "@/lib/commercial/format";
import type { Campaign } from "@/lib/commercial/types";

/**
 * /commercial/campaign/?id=12 - one campaign.
 *
 * A query string, not /commercial/campaigns/12/: this is a static export, and a
 * dynamic [id] segment would need every campaign id at build time. Singular
 * "campaign" so it cannot collide with the /commercial/campaigns/ list.
 *
 * useSearchParams() must sit under Suspense or `next build` fails - the page
 * is prerendered with no query string at all.
 */
export default function CommercialCampaignPage() {
  return (
    <Suspense fallback={<CampaignSkeleton />}>
      <CampaignFromQuery />
    </Suspense>
  );
}

function CampaignFromQuery() {
  const id = Number(useSearchParams().get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
        No campaign selected.{" "}
        <Link
          href="/commercial/campaigns/"
          className="text-sky-600 hover:underline"
        >
          See all campaigns
        </Link>
      </div>
    );
  }

  // Keyed so moving between two campaigns resets instead of showing the old one.
  return <CampaignDetail key={id} campaignId={id} />;
}

function CampaignDetail({ campaignId }: { campaignId: number }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCampaign(campaignId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCampaign(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <LoadFailed
          what="this campaign"
          message={error}
          onRetry={() => {
            setError(null);
            setReloadToken((token) => token + 1);
          }}
        />
      </div>
    );
  }

  if (!campaign) return <CampaignSkeleton />;

  return (
    <>
      <CommercialPageHeader
        title={campaign.name}
        description={CAMPAIGN_OBJECTIVE_LABEL[campaign.objective]}
        actions={<CampaignStatusBadge status={campaign.status} />}
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="Total budget"
            value={formatCents(campaign.totalBudgetCents)}
          />
          <Fact
            label="Daily cap"
            value={
              campaign.dailyBudgetCents === null
                ? "No cap"
                : formatCents(campaign.dailyBudgetCents)
            }
          />
          <Fact label="Starts" value={formatDate(campaign.startsAt)} />
          <Fact label="Ends" value={formatDate(campaign.endsAt)} />
        </section>

        <NotBuiltYet
          title="Results"
          endpoint="GET /promote/campaigns/{id}/report/"
        >
          Delivered, reach, clicks, calls, texts, conversions and cost per
          result, broken down by group category and region.
        </NotBuiltYet>

        <NotBuiltYet
          title="Creatives"
          endpoint="GET/POST /promote/campaigns/{id}/creatives/"
        >
          Headline, body, image and call to action, each with its own review
          status and the reviewer&apos;s notes when one is rejected.
        </NotBuiltYet>

        <NotBuiltYet
          title="Targeting"
          endpoint="PUT /promote/campaigns/{id}/targeting/"
        >
          Group categories, country or state, and group size. Never anything
          finer, and never a list of groups.
        </NotBuiltYet>

        <NotBuiltYet
          title="Actions"
          endpoint="POST /promote/campaigns/{id}/submit/ · /pause/ · /resume/"
        >
          Submit for review, pause and resume. Every way of stopping a campaign
          is a status change on the server.
        </NotBuiltYet>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </article>
  );
}

function CampaignSkeleton() {
  return (
    <SkeletonRegion label="Loading campaign" className="space-y-4 p-6">
      <Skeleton className="h-6 w-56" />
      <div className="grid gap-3 sm:grid-cols-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </SkeletonRegion>
  );
}
