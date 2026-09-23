"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Wallet } from "lucide-react";
import { AnalyticsSkeleton } from "@/components/app/AnalyticsSkeleton";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { DonutChart, type DonutSlice } from "@/components/charts/DonutChart";
import { ShareBar, type ShareSegment } from "@/components/charts/ShareBar";
import {
  fetchBillingAnalytics,
  type BillingAnalytics,
  type BillingAnalyticsAdvanced,
} from "@/lib/billing";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * The three group counts the API sends are NOT three separate groups of
 * groups, and adding them together is meaningless:
 *
 *   member_groups     every group you are an active member of - the TOTAL
 *   admin_groups      the ones where your role is admin - a SUBSET of it
 *   broadcast_groups  the ones in broadcast mode - a subset of it too, cutting
 *                     across the first two
 *
 * A chart of the three as they arrive would sum past 100% and double-count the
 * same group up to three times. So each chart splits the one total along ONE
 * dimension, which is what makes the parts add up to the whole.
 *
 * Both clamp with Math.max: a subset larger than its total can only be a
 * backend disagreement, and a negative width would draw as a broken bar
 * rather than showing that something is wrong.
 */
function groupsByRole(advanced: BillingAnalyticsAdvanced): DonutSlice[] {
  const total = advanced.groupAdminStats.memberGroups;
  const admin = Math.min(advanced.groupAdminStats.adminGroups, total);
  return [
    { label: "You're an admin", value: admin, tone: "series-1" },
    {
      label: "You're a member",
      value: Math.max(0, total - admin),
      tone: "series-2",
    },
  ];
}

function groupsByType(advanced: BillingAnalyticsAdvanced): ShareSegment[] {
  const total = advanced.groupAdminStats.memberGroups;
  const broadcast = Math.min(advanced.groupAdminStats.broadcastGroups, total);
  return [
    { label: "Broadcast", value: broadcast, tone: "series-1" },
    {
      label: "Group chat",
      value: Math.max(0, total - broadcast),
      tone: "series-2",
    },
  ];
}

function statLabel(value: number, singular: string, plural: string): string {
  return value === 1 ? `${value} ${singular}` : `${value} ${plural}`;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchBillingAnalytics()
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setError(result.message);
          setAnalytics(null);
          return;
        }

        setAnalytics(result.data);
        setError("");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasAccess =
    analytics?.access.hasBasicAnalytics ||
    analytics?.access.hasAdvancedAnalytics;

  const matchedBadge = useMemo(() => {
    if (!analytics) return "None";
    if (analytics.access.matchedFeature === "advanced") return "Advanced";
    if (analytics.access.matchedFeature === "basic") return "Basic";
    return "None";
  }, [analytics]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-1">
          <NavDrawerButton className="-ml-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
              Analytics
            </h1>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              Billing-backed insights for your current plan access
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        {isLoading && <AnalyticsSkeleton />}

        {!isLoading && error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        )}

        {!isLoading && !error && analytics && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                title="Plan"
                value={analytics.access.currentPlanCode.toUpperCase() || "N/A"}
              />
              <Card title="Matched access" value={matchedBadge} />
              <Card
                title="Basic"
                value={analytics.access.hasBasicAnalytics ? "Enabled" : "Off"}
              />
              <Card
                title="Advanced"
                value={
                  analytics.access.hasAdvancedAnalytics ? "Enabled" : "Off"
                }
              />
            </section>

            {!hasAccess && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                Your current plan does not include Basic Analytics or Advanced
                Analytics.
              </div>
            )}

            {analytics.basic && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-sky-600" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Basic Analytics ({analytics.basic.windowDays} days)
                  </h2>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card
                    title="Wallet balance"
                    value={formatCurrency(analytics.basic.wallet.balanceCents)}
                  />
                  <Card
                    title="Purchased"
                    value={formatCurrency(
                      analytics.basic.wallet.usageLast30Days.purchasedCents,
                    )}
                  />
                  <Card
                    title="Used"
                    value={formatCurrency(
                      analytics.basic.wallet.usageLast30Days.usedCents,
                    )}
                  />
                  <Card
                    title="Net"
                    value={formatCurrency(
                      analytics.basic.wallet.usageLast30Days.netChangeCents,
                    )}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card
                    title="Conversations"
                    value={String(analytics.basic.conversationCounts.total)}
                  />
                  <Card
                    title="Groups"
                    value={String(analytics.basic.conversationCounts.group)}
                  />
                  <Card
                    title="Direct"
                    value={String(analytics.basic.conversationCounts.direct)}
                  />
                  <Card
                    title="Sent/Received"
                    value={`${analytics.basic.messageActivity.sentLast30Days}/${analytics.basic.messageActivity.receivedLast30Days}`}
                  />
                </div>
              </section>
            )}

            {analytics.advanced && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-violet-600" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Advanced Analytics
                  </h2>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card
                    title="Admin groups"
                    value={String(
                      analytics.advanced.groupAdminStats.adminGroups,
                    )}
                  />
                  {/* `member_groups` is every group you are an active member
                      of, admin ones included - not the ones where you are only
                      a member. It was labelled "Member groups", which read as
                      the second thing and made the three counts look like
                      three separate groups of groups. */}
                  <Card
                    title="Groups in total"
                    value={String(
                      analytics.advanced.groupAdminStats.memberGroups,
                    )}
                  />
                  <Card
                    title="Broadcast groups"
                    value={String(
                      analytics.advanced.groupAdminStats.broadcastGroups,
                    )}
                  />
                  <Card
                    title="Largest active group"
                    value={statLabel(
                      analytics.advanced.groupSize.largestGroupActiveMembers,
                      "member",
                      "members",
                    )}
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <DonutChart
                    title="Your groups, by your role"
                    unit="groups"
                    slices={groupsByRole(analytics.advanced)}
                    emptyMessage="You're not a member of any groups yet."
                  />
                  <ShareBar
                    title="Your groups, by type"
                    unit="groups"
                    segments={groupsByType(analytics.advanced)}
                    emptyMessage="You're not a member of any groups yet."
                  />
                  <ColumnChart
                    title="Wallet movement"
                    subtitle="Last 30 days"
                    data={[
                      {
                        label: "Purchased",
                        value:
                          analytics.advanced.wallet.usageLast30Days
                            .purchasedCents,
                        display: formatCurrency(
                          analytics.advanced.wallet.usageLast30Days
                            .purchasedCents,
                        ),
                        tone: "series-1",
                      },
                      {
                        label: "Used",
                        value:
                          analytics.advanced.wallet.usageLast30Days.usedCents,
                        display: formatCurrency(
                          analytics.advanced.wallet.usageLast30Days.usedCents,
                        ),
                        tone: "series-2",
                      },
                    ]}
                    formatTick={formatCurrency}
                    emptyMessage="No credit was bought or spent in the last 30 days."
                  />
                  {/* One hue, and so no legend: both bars measure the same
                      thing - active members - and the title says so. */}
                  <ColumnChart
                    title="Active members per group"
                    subtitle="Across the groups you are in"
                    data={[
                      {
                        label: "Average",
                        value:
                          analytics.advanced.groupSize.averageActiveMembers,
                        display:
                          analytics.advanced.groupSize.averageActiveMembers.toFixed(
                            1,
                          ),
                        tone: "series-1",
                      },
                      {
                        label: "Largest group",
                        value:
                          analytics.advanced.groupSize
                            .largestGroupActiveMembers,
                        display: String(
                          analytics.advanced.groupSize
                            .largestGroupActiveMembers,
                        ),
                        tone: "series-1",
                      },
                    ]}
                    emptyMessage="No group has an active member count yet."
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </article>
  );
}
