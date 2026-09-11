"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Wallet } from "lucide-react";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import { fetchBillingAnalytics, type BillingAnalytics } from "@/lib/billing";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
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
        {isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading analytics...
          </p>
        )}

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
                  <Card
                    title="Member groups"
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

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Average active members per group:{" "}
                  {analytics.advanced.groupSize.averageActiveMembers.toFixed(1)}
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
