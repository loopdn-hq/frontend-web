"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { LoadFailed } from "@/components/app/LoadFailed";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { DailyBars } from "@/components/commercial/DailyBars";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CampaignStatusBadge } from "@/components/commercial/StatusBadge";
import { Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchCompanyReport } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import {
  campaignName,
  formatCents,
  formatClickRate,
} from "@/lib/commercial/format";
import type { Company, CompanyReport } from "@/lib/commercial/types";

/**
 * /reports/, labelled "Analytics" - how the company's campaigns are doing, all
 * of them at once. Not /analytics/: that is a chat page in the same build.
 *
 * Aggregates only, ever, from the daily totals. People reached is per
 * campaign - people don't add up across campaigns - and a reach covering too
 * few members comes back suppressed rather than as a number, or a narrow
 * slice would be a member count for one identifiable group.
 */
export default function CommercialReportsPage() {
  const { company } = useCompany();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <CommercialPageHeader
        title="Analytics"
        description="How your campaigns are performing"
      />
      <CompanyNotice />
      {/* Keyed by company: a switch starts afresh. */}
      {company && <Report key={company.id} company={company} />}
      <NotBuiltYet title="Results">
        Leads, group joins, calls and texts, with the cost of each.
      </NotBuiltYet>
      <NotBuiltYet title="By group category and region">
        Where your results came from, in aggregate only: small slices come back
        suppressed, never as a number.
      </NotBuiltYet>
    </div>
  );
}

function Report({ company }: { company: Company }) {
  const [report, setReport] = useState<CompanyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCompanyReport(company.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setReport(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [company.id, token]);

  if (error) {
    return (
      <LoadFailed
        what="your results"
        message={error}
        onRetry={() => {
          setError(null);
          setToken((current) => current + 1);
        }}
      />
    );
  }
  if (!report) {
    return (
      <SkeletonRegion label="Loading results" className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </SkeletonRegion>
    );
  }

  const money = (cents: number) => formatCents(cents, report.currency);
  const { totals } = report;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Views" value={totals.viewed.toLocaleString()} />
        <Stat label="Clicks" value={totals.clicks.toLocaleString()} />
        <Stat
          label="Click rate"
          value={formatClickRate(totals.clicks, totals.viewed)}
        />
        <Stat label="Spent" value={money(totals.spendCents)} />
      </section>

      <Panel title="Views by day">
        {report.days.length === 0 ? (
          <Empty>
            Nothing yet. Views appear here a few minutes after members see your
            campaigns.
          </Empty>
        ) : (
          <DailyBars rows={report.days} days={30} />
        )}
      </Panel>

      <Panel title="By campaign">
        {report.campaigns.length === 0 ? (
          <Empty>No submitted campaigns yet.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-2">Campaign</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Views</th>
                  <th className="px-2 py-2 text-right font-medium">Clicks</th>
                  <th className="px-2 py-2 text-right font-medium">
                    People reached
                  </th>
                  <th className="px-4 py-2 text-right font-medium sm:px-2">
                    Spent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.campaigns.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5 sm:px-2">
                      <Link
                        href={`/campaigns/?id=${row.id}`}
                        className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                      >
                        {campaignName(row)}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <CampaignStatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {row.viewed.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {row.clicks.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-600 tabular-nums dark:text-slate-300">
                      {row.viewed === 0
                        ? "-"
                        : row.reach === null
                          ? `Fewer than ${report.reachShownFrom}`
                          : row.reach.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums sm:px-2">
                      {money(row.spendCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
  );
}
