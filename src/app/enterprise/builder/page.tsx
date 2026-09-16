"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteTopNav } from "@/components/site/SiteTopNav";
import { PricedOptionGroup } from "@/components/enterprise/PricedOptionGroup";
import { Badge, Button, RadioGroup, Switch } from "@/components/ui";
import { setPostAuthRedirect, useAuth } from "@/lib/auth/client";
import {
  ANALYTICS_OPTIONS,
  BILLING_INTERVAL_OPTIONS,
  CREDIT_PACKAGE_OPTIONS,
  DEFAULT_CONFIGURATION,
  FEATURE_TOGGLES,
  MAX_ADMINS_PER_GROUP_OPTIONS,
  MAX_GROUPS_OPTIONS,
  MAX_MEMBERS_PER_GROUP_OPTIONS,
  STORAGE_GB_OPTIONS,
  calculateEnterprisePrice,
  formatCents,
  type AnalyticsTier,
  type BillingIntervalCode,
  type EnterpriseConfiguration,
  type EnterpriseFeatureKey,
} from "@/lib/enterprise/catalog";
import {
  clearEnterpriseDraft,
  saveEnterpriseDraft,
  useEnterpriseDraft,
  type EnterpriseDraftStatus,
} from "@/lib/enterprise/draft";

const BUILDER_PATH = "/enterprise/builder/";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function EnterprisePlanBuilderPage() {
  const router = useRouter();
  const { session, isLoaded } = useAuth();
  const isAuthenticated = isLoaded && Boolean(session);

  // The draft in localStorage is the single source of truth - no separate
  // local state to keep in sync with it. useEnterpriseDraft() renders null
  // through hydration (matching the server, which has no localStorage) and
  // picks up the real draft, if any, right after as an ordinary update.
  const draft = useEnterpriseDraft();
  const configuration = draft?.configuration ?? DEFAULT_CONFIGURATION;
  const status = draft?.status ?? "draft";

  const estimate = useMemo(
    () => calculateEnterprisePrice(configuration),
    [configuration],
  );

  function persist(next: EnterpriseConfiguration, nextStatus: EnterpriseDraftStatus = "draft") {
    saveEnterpriseDraft(next, nextStatus);
  }

  function updateLimit(key: keyof EnterpriseConfiguration["limits"], value: string) {
    persist({
      ...configuration,
      limits: { ...configuration.limits, [key]: Number(value) },
    });
  }

  function toggleFeature(key: EnterpriseFeatureKey, checked: boolean) {
    persist({
      ...configuration,
      features: { ...configuration.features, [key]: checked },
    });
  }

  function setAnalytics(value: AnalyticsTier) {
    persist({
      ...configuration,
      features: { ...configuration.features, analytics: value },
    });
  }

  function setCredits(value: string) {
    persist({
      ...configuration,
      credits: { monthly_messages: Number(value) },
    });
  }

  function setBillingInterval(value: BillingIntervalCode) {
    persist({ ...configuration, billing_interval: value });
  }

  function handleGoToAuth(path: "/login/" | "/signup/") {
    saveEnterpriseDraft(configuration, "draft");
    setPostAuthRedirect(BUILDER_PATH);
    router.push(path);
  }

  function handleSubmit() {
    persist(configuration, "submitted");
  }

  function handleEditAgain() {
    persist(configuration, "draft");
  }

  function handleStartOver() {
    clearEnterpriseDraft();
  }

  const selectedInterval =
    BILLING_INTERVAL_OPTIONS.find(
      (option) => option.value === configuration.billing_interval,
    ) ?? BILLING_INTERVAL_OPTIONS[0];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#d7efff_0%,#f0f8ff_45%,#f8fbff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_20%_15%,#0f172a_0%,#0b1220_45%,#060b17_100%)] dark:text-slate-100">
      <SiteTopNav />
      <main className="px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase dark:text-sky-300">
                Enterprise
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Build Your Enterprise Plan
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base">
                Choose the limits, features, and messaging credits your
                organization needs. Your estimate updates live as you go -
                the final price is always confirmed before anything is
                billed.
              </p>
            </div>
            <Link
              href="/contact/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Talk to sales instead
            </Link>
          </header>

          {status === "submitted" ? (
            <section className="rounded-3xl border border-emerald-300 bg-emerald-50/60 p-6 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/20 sm:p-8">
              <Badge tone="success">Request saved</Badge>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Your Enterprise configuration is saved
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
                Self-service Enterprise checkout isn&apos;t live yet, so a
                Loopd&apos;n specialist will follow up at the email on your
                account to finalize billing for the plan below.
              </p>

              <dl className="mt-5 grid gap-2 rounded-2xl border border-emerald-200 bg-white/80 p-4 text-sm dark:border-emerald-800 dark:bg-slate-900/60 sm:grid-cols-2">
                {estimate.lines
                  .filter((line) => line.amountCents > 0)
                  .map((line) => (
                    <div
                      key={line.label}
                      className="flex items-center justify-between gap-3"
                    >
                      <dt className="text-slate-600 dark:text-slate-300">
                        {line.label}
                      </dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCents(line.amountCents)}/mo
                      </dd>
                    </div>
                  ))}
                <div className="flex items-center justify-between gap-3 border-t border-emerald-200 pt-2 text-base font-bold dark:border-emerald-800 sm:col-span-2">
                  <dt>Estimated total ({selectedInterval.label.toLowerCase()})</dt>
                  <dd>{formatCents(estimate.periodTotalCents)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleEditAgain}>
                  Edit configuration
                </Button>
                <Button variant="ghost" onClick={handleStartOver}>
                  Start over
                </Button>
              </div>
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
              <div className="space-y-5">
                <SectionCard
                  title="Billing interval"
                  description="Longer commitments include a configured discount."
                >
                  <RadioGroup
                    name="billing-interval"
                    orientation="horizontal"
                    value={configuration.billing_interval}
                    onChange={(value) =>
                      setBillingInterval(value as BillingIntervalCode)
                    }
                    options={BILLING_INTERVAL_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                      description: option.description,
                    }))}
                  />
                </SectionCard>

                <SectionCard
                  title="Limits"
                  description="Scope groups, membership, admin seats, and storage to your organization."
                >
                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Maximum groups
                      </p>
                      <PricedOptionGroup
                        legendId="max-groups"
                        options={MAX_GROUPS_OPTIONS}
                        value={String(configuration.limits.max_groups)}
                        onChange={(value) => updateLimit("max_groups", value)}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Maximum members per group
                      </p>
                      <PricedOptionGroup
                        legendId="max-members"
                        options={MAX_MEMBERS_PER_GROUP_OPTIONS}
                        value={String(configuration.limits.max_members_per_group)}
                        onChange={(value) =>
                          updateLimit("max_members_per_group", value)
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Maximum admins per group
                      </p>
                      <PricedOptionGroup
                        legendId="max-admins"
                        options={MAX_ADMINS_PER_GROUP_OPTIONS}
                        value={String(configuration.limits.max_admins_per_group)}
                        onChange={(value) =>
                          updateLimit("max_admins_per_group", value)
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Storage
                      </p>
                      <PricedOptionGroup
                        legendId="storage"
                        options={STORAGE_GB_OPTIONS}
                        value={String(configuration.limits.storage_gb)}
                        onChange={(value) => updateLimit("storage_gb", value)}
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Features"
                  description="Enable only what your team needs - each toggle adds its own monthly fee."
                >
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {FEATURE_TOGGLES.map((feature) => (
                      <div
                        key={feature.key}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <label
                            htmlFor={`feature-${feature.key}`}
                            className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
                          >
                            {feature.label}
                          </label>
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            {feature.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            +{formatCents(feature.priceCents)}/mo
                          </span>
                          <Switch
                            id={`feature-${feature.key}`}
                            checked={configuration.features[feature.key]}
                            onCheckedChange={(checked) =>
                              toggleFeature(feature.key, checked)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Analytics
                    </p>
                    <PricedOptionGroup
                      legendId="analytics"
                      options={ANALYTICS_OPTIONS}
                      value={configuration.features.analytics}
                      onChange={setAnalytics}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Monthly messaging credits"
                  description="Pick the recurring credit package for your Enterprise subscription."
                >
                  <PricedOptionGroup
                    legendId="credits"
                    options={CREDIT_PACKAGE_OPTIONS}
                    value={String(configuration.credits.monthly_messages)}
                    onChange={setCredits}
                  />
                </SectionCard>
              </div>

              <div className="lg:sticky lg:top-6">
                <section className="rounded-3xl border border-sky-300 bg-white p-5 shadow-[0_12px_32px_rgba(14,165,233,0.18)] dark:border-sky-700 dark:bg-slate-900 sm:p-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Estimated price
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Estimate only. Final pricing is confirmed before billing.
                  </p>

                  <dl className="mt-4 space-y-1.5 text-sm">
                    {estimate.lines.map((line) => (
                      <div
                        key={line.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <dt className="text-slate-600 dark:text-slate-300">
                          {line.label}
                        </dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">
                          {formatCents(line.amountCents)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-600 dark:text-slate-300">
                        Monthly subtotal
                      </dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        {formatCents(estimate.monthlySubtotalCents)}
                      </dd>
                    </div>
                    {estimate.discountCents > 0 && (
                      <div className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400">
                        <dt>{selectedInterval.label} discount</dt>
                        <dd className="font-medium">
                          -{formatCents(estimate.discountCents)}
                        </dd>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Due {selectedInterval.label.toLowerCase()}
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {formatCents(estimate.periodTotalCents)}
                    </span>
                  </div>
                  {selectedInterval.months > 1 && (
                    <p className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
                      ~{formatCents(estimate.monthlyEquivalentCents)}/mo equivalent
                    </p>
                  )}

                  <div className="mt-5 space-y-2">
                    {isAuthenticated ? (
                      <Button fullWidth onClick={handleSubmit}>
                        Save &amp; continue
                      </Button>
                    ) : (
                      <>
                        <Button
                          fullWidth
                          onClick={() => handleGoToAuth("/login/")}
                        >
                          Log in to continue
                        </Button>
                        <Button
                          fullWidth
                          variant="secondary"
                          onClick={() => handleGoToAuth("/signup/")}
                        >
                          Create an account to continue
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    Your configuration is saved automatically and will be
                    here when you come back.
                  </p>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
