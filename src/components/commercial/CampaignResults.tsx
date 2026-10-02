"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { DailyBars } from "@/components/commercial/DailyBars";
import { Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchCampaignReport } from "@/lib/commercial/api";
import { formatCents } from "@/lib/commercial/format";
import type { CampaignDetail, CampaignReport } from "@/lib/commercial/types";

/**
 * A campaign's results on its page: views, people reached, spend and the
 * cost per 1,000 views, and views by day. From the daily totals, which are
 * rolled up every few minutes - aggregates only, and reach shown only above
 * the privacy floor. Before it has run, what will appear here.
 */
export function CampaignResults({ campaign }: { campaign: CampaignDetail }) {
  const hasRun =
    campaign.status === "running" ||
    campaign.status === "paused" ||
    campaign.status === "ended";
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRun) return;
    let cancelled = false;
    fetchCampaignReport(campaign.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setReport(result.data);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [campaign.id, campaign.status, hasRun]);

  if (!hasRun) {
    return (
      <Note title="Results will appear here once your campaign starts running.">
        After it&apos;s approved and running, you&apos;ll see views, people
        reached, spend and cost per 1,000 views.
      </Note>
    );
  }
  if (error) return <Note title="Results couldn't be loaded.">{error}</Note>;
  if (!report) {
    return (
      <SkeletonRegion label="Loading results" className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </SkeletonRegion>
    );
  }

  const money = (cents: number) => formatCents(cents, report.currency);
  const { totals } = report;
  if (totals.viewed === 0 && totals.served === 0) {
    return (
      <Note title="No views yet.">
        Your campaign is shown when members open a group that matches its
        audience. Views appear here within a few minutes.
      </Note>
    );
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Stat label="Views" value={totals.viewed.toLocaleString()} />
        <Stat
          label="People reached"
          value={
            totals.reach === null
              ? `Fewer than ${report.reachShownFrom}`
              : totals.reach.toLocaleString()
          }
        />
        <Stat label="Spent" value={money(totals.spendCents)} />
        <Stat
          label="Per 1,000 views"
          value={
            totals.costPer1000ViewsCents === null
              ? "-"
              : money(totals.costPer1000ViewsCents)
          }
        />
      </dl>
      <DailyBars rows={report.days} />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Updated every few minutes. A view is half the card on screen for at
        least a second. Small numbers of people aren&apos;t shown, to keep
        members private.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
      <BarChart3
        className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
        aria-hidden
      />
      <div className="text-sm">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-0.5 text-slate-600 dark:text-slate-400">{children}</p>
      </div>
    </div>
  );
}
