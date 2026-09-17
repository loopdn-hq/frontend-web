"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteTopNav } from "@/components/site/SiteTopNav";
import { Alert, Button, RadioGroup, Switch } from "@/components/ui";
import { InvoicePreviewModal } from "@/components/enterprise/InvoicePreviewModal";
import { setPostAuthRedirect, useAuth } from "@/lib/auth/client";
import {
  fetchEnterprisePricingCatalog,
  submitEnterpriseConfiguration,
  type EnterpriseInvoicePreview,
} from "@/lib/enterprise/api";
import {
  DEFAULT_CATALOG,
  DEFAULT_CONFIGURATION,
  calculateEnterprisePrice,
  formatCents,
  type AnalyticsTier,
  type BillingIntervalCode,
  type EnterpriseCatalog,
  type EnterpriseConfiguration,
  type EnterpriseFeatureKey,
  type PricedOption,
} from "@/lib/enterprise/catalog";
import {
  saveEnterpriseDraft,
  setRemoteDraftId,
  useEnterpriseDraft,
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

// No per-option prices shown here on purpose: the catalog's numbers are
// internal weights used only to move the one live "estimated total" - never
// rendered as a committed price for a specific scope or feature. The backend
// recalculates the authoritative price from scratch once Continue is
// pressed, so a dollar figure next to "500 groups" would be a promise this
// page can't actually keep.
function OptionGroup<T extends string>({
  legendId,
  options,
  value,
  onChange,
}: {
  legendId: string;
  options: PricedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <RadioGroup
      name={legendId}
      value={value}
      onChange={onChange}
      orientation="horizontal"
      aria-labelledby={legendId}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
    />
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

  // Starts as DEFAULT_CATALOG (this package's own PLACEHOLDER data) for a
  // consistent first paint, then swaps in the live, database-driven catalog
  // once GET /enterprise/pricing/ resolves. A failed fetch (offline, or this
  // environment's backend not deployed yet) just keeps the estimate-only
  // fallback rather than breaking the page.
  const [catalog, setCatalog] = useState<EnterpriseCatalog>(DEFAULT_CATALOG);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEnterprisePricingCatalog().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCatalog(result.catalog);
        setCatalogNotice(null);
      } else {
        setCatalogNotice(
          "Showing estimated pricing - live pricing is temporarily unavailable.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [invoicePreview, setInvoicePreview] =
    useState<EnterpriseInvoicePreview | null>(null);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(
    null,
  );
  const [isRedirecting, setIsRedirecting] = useState(false);

  const estimate = useMemo(
    () => calculateEnterprisePrice(configuration, catalog),
    [configuration, catalog],
  );

  function persist(next: EnterpriseConfiguration) {
    setCheckoutError(null);
    saveEnterpriseDraft(next, "draft");
  }

  function updateLimit(
    key: keyof EnterpriseConfiguration["limits"],
    value: string,
  ) {
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

  async function handleContinueToCheckout() {
    setCheckoutError(null);
    setIsCheckingOut(true);
    try {
      const current = saveEnterpriseDraft(configuration, "draft");
      // window.location.origin is what makes these correct per environment
      // with no config needed - localhost in dev, the staging host on
      // staging, the production host in production. Same convention as
      // createPlanCheckoutSession() in lib/billing.ts.
      const origin = window.location.origin;
      const successUrl = `${origin}/enterprise/checkout/success/`;
      const cancelUrl = `${origin}/enterprise/checkout/cancel/`;
      // Omit remoteDraftId entirely on the first submit - the backend 404s
      // if given a draft_id it's never seen, rather than adopting it as a
      // new draft. Once we have one, keep reusing it so later submits
      // update the same backend draft instead of creating a new one each time.
      const result = await submitEnterpriseConfiguration(
        configuration,
        current.remoteDraftId ?? undefined,
        successUrl,
        cancelUrl,
      );
      if (!result.ok) {
        setCheckoutError(result.message);
        return;
      }
      setRemoteDraftId(result.draftId);
      // Show the backend's authoritative invoice first - only the admin
      // pressing "Proceed to checkout" in that modal sends them to Stripe.
      setInvoicePreview(result.invoice);
      setPendingCheckoutUrl(result.checkoutUrl);
    } finally {
      setIsCheckingOut(false);
    }
  }

  function handleCloseInvoicePreview() {
    setInvoicePreview(null);
    setPendingCheckoutUrl(null);
  }

  function handleProceedToCheckout() {
    if (!pendingCheckoutUrl) return;
    setIsRedirecting(true);
    // External Stripe URL, not an in-app route - window.location is correct
    // here rather than router.push().
    window.location.assign(pendingCheckoutUrl);
  }

  const selectedInterval =
    catalog.billingIntervals.find(
      (option) => option.value === configuration.billing_interval,
    ) ?? catalog.billingIntervals[0];

  // Plain labels only - no prices attached. This is "here's what you've
  // configured," not a priced line-item breakdown; the dollar figure lives
  // solely in the one Estimated total below.
  const selectionSummary = useMemo(() => {
    const findLabel = <T extends string>(
      options: PricedOption<T>[],
      value: T,
    ) => options.find((option) => option.value === value)?.label;

    const labels = [
      findLabel(
        catalog.limits.maxGroups,
        String(configuration.limits.max_groups),
      ),
      findLabel(
        catalog.limits.maxMembersPerGroup,
        String(configuration.limits.max_members_per_group),
      ),
      findLabel(
        catalog.limits.maxAdminsPerGroup,
        String(configuration.limits.max_admins_per_group),
      ),
      findLabel(
        catalog.limits.storageGb,
        String(configuration.limits.storage_gb),
      ),
      ...catalog.features
        .filter((feature) => configuration.features[feature.key])
        .map((feature) => feature.label),
      findLabel(
        catalog.creditPackages,
        String(configuration.credits.monthly_messages),
      ),
    ];

    const analyticsLabel =
      configuration.features.analytics !== "none"
        ? findLabel(catalog.analytics, configuration.features.analytics)
        : undefined;
    if (analyticsLabel) labels.push(`${analyticsLabel} analytics`);

    return labels.filter((label): label is string => Boolean(label));
  }, [configuration, catalog]);

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
                organization needs. The total shown is an estimate - once you
                continue, we calculate your exact price and send a Stripe
                invoice to complete checkout.
              </p>
            </div>
            <Link
              href="/contact/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Talk to sales instead
            </Link>
          </header>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
            <div className="space-y-5">
              <SectionCard
                title="Billing interval"
                description="Longer commitments include a discount, applied when your exact price is calculated."
              >
                <RadioGroup
                  name="billing-interval"
                  orientation="horizontal"
                  value={configuration.billing_interval}
                  onChange={(value) =>
                    setBillingInterval(value as BillingIntervalCode)
                  }
                  options={catalog.billingIntervals.map((option) => ({
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
                    <p
                      id="max-groups"
                      className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Maximum groups
                    </p>
                    <OptionGroup
                      legendId="max-groups"
                      options={catalog.limits.maxGroups}
                      value={String(configuration.limits.max_groups)}
                      onChange={(value) => updateLimit("max_groups", value)}
                    />
                  </div>
                  <div>
                    <p
                      id="max-members"
                      className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Maximum members per group
                    </p>
                    <OptionGroup
                      legendId="max-members"
                      options={catalog.limits.maxMembersPerGroup}
                      value={String(configuration.limits.max_members_per_group)}
                      onChange={(value) =>
                        updateLimit("max_members_per_group", value)
                      }
                    />
                  </div>
                  <div>
                    <p
                      id="max-admins"
                      className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Maximum admins per group
                    </p>
                    <OptionGroup
                      legendId="max-admins"
                      options={catalog.limits.maxAdminsPerGroup}
                      value={String(configuration.limits.max_admins_per_group)}
                      onChange={(value) =>
                        updateLimit("max_admins_per_group", value)
                      }
                    />
                  </div>
                  <div>
                    <p
                      id="storage"
                      className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Storage
                    </p>
                    <OptionGroup
                      legendId="storage"
                      options={catalog.limits.storageGb}
                      value={String(configuration.limits.storage_gb)}
                      onChange={(value) => updateLimit("storage_gb", value)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Features"
                description="Enable only what your team needs."
              >
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {catalog.features.map((feature) => (
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
                      <Switch
                        id={`feature-${feature.key}`}
                        checked={configuration.features[feature.key]}
                        onCheckedChange={(checked) =>
                          toggleFeature(feature.key, checked)
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <p
                    id="analytics"
                    className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Analytics
                  </p>
                  <OptionGroup
                    legendId="analytics"
                    options={catalog.analytics}
                    value={configuration.features.analytics}
                    onChange={setAnalytics}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Monthly messaging credits"
                description="Pick the recurring credit package for your Enterprise subscription."
              >
                <OptionGroup
                  legendId="credits"
                  options={catalog.creditPackages}
                  value={String(configuration.credits.monthly_messages)}
                  onChange={setCredits}
                />
              </SectionCard>
            </div>

            <div className="lg:sticky lg:top-6">
              <section className="rounded-3xl border border-sky-300 bg-white p-5 shadow-[0_12px_32px_rgba(14,165,233,0.18)] dark:border-sky-700 dark:bg-slate-900 sm:p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Your selections
                </h2>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                  <li className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                    />
                    <span>{selectedInterval.label} billing</span>
                  </li>
                  {selectionSummary.map((label) => (
                    <li key={label} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                      />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>

                <h2 className="mt-5 border-t border-slate-200 pt-4 text-lg font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                  Estimated total
                </h2>
                {catalogNotice && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    {catalogNotice}
                  </p>
                )}

                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {selectedInterval.label}
                  </span>
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                    {formatCents(estimate.periodTotalCents)}
                  </span>
                </div>
                {selectedInterval.months > 1 && (
                  <p className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
                    ~{formatCents(estimate.monthlyEquivalentCents)}/mo
                    equivalent
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  This is an estimate, not a fixed price for any scope or
                  feature above. Your exact price is calculated by Loopd&apos;n
                  when you continue, and billed through Stripe.
                </p>

                {checkoutError && (
                  <Alert variant="error" className="mt-4">
                    {checkoutError}
                  </Alert>
                )}

                <div className="mt-5 space-y-2">
                  {isAuthenticated ? (
                    <Button
                      fullWidth
                      onClick={() => void handleContinueToCheckout()}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut ? "Preparing checkout..." : "Continue"}
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
                  Your configuration is saved automatically and will be here
                  when you come back.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <InvoicePreviewModal
        isOpen={Boolean(invoicePreview)}
        invoice={invoicePreview}
        isRedirecting={isRedirecting}
        onClose={handleCloseInvoicePreview}
        onProceedToCheckout={handleProceedToCheckout}
      />
    </div>
  );
}
