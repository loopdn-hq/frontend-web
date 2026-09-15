"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPlanCheckoutSession, fetchBillingSummary } from "@/lib/billing";
import { useAuth } from "@/lib/auth/client";

type Plan = {
  code: string;
  name: string;
  price: string;
  summary: string;
  limits: Array<{ label: string; value: string }>;
  features: string[];
  highlighted?: boolean;
};

type ApiPlan = {
  code: string;
  name: string;
  monthly_price_cents: number | null;
  price_display: string;
  max_groups: number | null;
  max_members_per_group: number | null;
  max_admins_per_group: number | null;
  storage_gb: number | null;
  has_whatsapp: boolean;
  has_telegram: boolean;
  features: string[];
  is_custom_pricing: boolean;
};

type PlansApiResponse = {
  code?: number;
  message?: string;
  data?: ApiPlan[];
};

const DEFAULT_API_PLANS: ApiPlan[] = [
  {
    code: "free",
    name: "Free",
    monthly_price_cents: 0,
    price_display: "$0.00/mo",
    max_groups: 3,
    max_members_per_group: 20,
    max_admins_per_group: 1,
    storage_gb: 1,
    has_whatsapp: false,
    has_telegram: false,
    features: [
      "Web messaging",
      "Basic message history",
      "Reactions",
      "Reply, edit and delete",
      "Join links/codes",
      "Basic notifications",
      "SMS requires PAYG credits or sponsored campaign funding",
    ],
    is_custom_pricing: false,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    monthly_price_cents: null,
    price_display: "Custom",
    max_groups: null,
    max_members_per_group: null,
    max_admins_per_group: null,
    storage_gb: null,
    has_whatsapp: true,
    has_telegram: true,
    features: [
      "Workspaces",
      "SSO",
      "API access",
      "Audit logs",
      "Custom retention policies",
      "Dedicated account manager",
      "SLA",
      "Custom volume pricing",
      "Postpaid communication billing option",
    ],
    is_custom_pricing: true,
  },
];

// const fallbackPlans: Plan[] = [
//   {
//     code: "free",
//     name: "Free",
//     price: "$0.00/mo",
//     summary: "For small groups getting started with Loopdn.",
//     limits: [
//       { label: "Max groups", value: "3" },
//       { label: "Members per group", value: "20" },
//       { label: "Admins per group", value: "1" },
//       { label: "Storage", value: "1 GB" },
//     ],
//     features: [
//       "Web + SMS group messaging",
//       "Join by open link, invite, or approval",
//       "Core moderation controls",
//     ],
//   },
//   {
//     code: "premium",
//     name: "Premium",
//     price: "$9.99/mo",
//     summary: "For active teams and communities with growth needs.",
//     highlighted: true,
//     limits: [
//       { label: "Max groups", value: "25" },
//       { label: "Members per group", value: "250" },
//       { label: "Admins per group", value: "5" },
//       { label: "Storage", value: "10 GB" },
//     ],
//     features: [
//       "Everything in Free",
//       "WhatsApp and Telegram connectors",
//       "Priority support",
//     ],
//   },
//   {
//     code: "business",
//     name: "Business",
//     price: "$29.99/mo",
//     summary: "For operations-heavy organizations running many groups.",
//     limits: [
//       { label: "Max groups", value: "100" },
//       { label: "Members per group", value: "1000" },
//       { label: "Admins per group", value: "10+" },
//       { label: "Storage", value: "50 GB" },
//     ],
//     features: [
//       "Everything in Premium",
//       "Stronger admin delegation",
//       "Faster support response",
//     ],
//   },
//   {
//     code: "enterprise",
//     name: "Enterprise",
//     price: "Custom",
//     summary: "For large organizations requiring custom contracts and limits.",
//     limits: [
//       { label: "Max groups", value: "Custom" },
//       { label: "Members per group", value: "Custom" },
//       { label: "Admins per group", value: "Custom" },
//       { label: "Storage", value: "Custom" },
//     ],
//     features: [
//       "Custom rollout and support model",
//       "Custom security and compliance terms",
//       "Dedicated success channel",
//     ],
//   },
// ];

function planSummaryFromCode(code: string): string {
  const normalizedCode = code.toLowerCase();
  if (normalizedCode === "free") {
    return "For small groups getting started with Loopdn.";
  }
  if (normalizedCode.startsWith("premium")) {
    return "For active teams and communities with growth needs.";
  }
  if (normalizedCode.startsWith("business")) {
    return "For operations-heavy organizations running many groups.";
  }
  if (normalizedCode === "enterprise") {
    return "For large organizations requiring custom contracts and limits.";
  }
  return "For large organizations requiring custom contracts and limits.";
}

function normalizePlanValue(value: number | null, unit?: string): string {
  if (value === null) return "Custom";
  return unit ? `${value} ${unit}` : String(value);
}

function mapApiPlanToUi(plan: ApiPlan): Plan {
  const normalizedCode = plan.code.toLowerCase();
  return {
    code: plan.code,
    name: plan.name,
    price: plan.price_display,
    summary: planSummaryFromCode(plan.code),
    highlighted: normalizedCode.startsWith("premium"),
    limits: [
      { label: "Max groups", value: normalizePlanValue(plan.max_groups) },
      {
        label: "Members per group",
        value: normalizePlanValue(plan.max_members_per_group),
      },
      {
        label: "Admins per group",
        value: normalizePlanValue(plan.max_admins_per_group),
      },
      {
        label: "Storage",
        value:
          plan.storage_gb === null
            ? "Custom"
            : normalizePlanValue(plan.storage_gb, "GB"),
      },
    ],
    features: plan.features,
  };
}

function sortPlans(plans: Plan[]): Plan[] {
  const rank: Record<string, number> = {
    free: 0,
    premium: 1,
    business: 2,
    enterprise: 3,
  };

  return [...plans].sort((a, b) => {
    const aCode = a.code.toLowerCase();
    const bCode = b.code.toLowerCase();

    if (aCode === "enterprise" && bCode !== "enterprise") return 1;
    if (bCode === "enterprise" && aCode !== "enterprise") return -1;

    const aRank =
      aCode.startsWith("premium") || aCode.startsWith("business")
        ? 1
        : (rank[aCode] ?? 50);
    const bRank =
      bCode.startsWith("premium") || bCode.startsWith("business")
        ? 1
        : (rank[bCode] ?? 50);

    if (aRank !== bRank) return aRank - bRank;

    const aPrice = typeof a.price === "string" ? a.price : "";
    const bPrice = typeof b.price === "string" ? b.price : "";
    return aPrice.localeCompare(bPrice);
  });
}

function prependDefaultPlans(plans: ApiPlan[]): ApiPlan[] {
  const codes = new Set(plans.map((plan) => plan.code.toLowerCase()));
  const defaultsToPrepend = DEFAULT_API_PLANS.filter(
    (plan) => !codes.has(plan.code),
  );

  return [...defaultsToPrepend, ...plans];
}

export default function PricingPage() {
  const { session, isLoaded } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [checkoutPlanCode, setCheckoutPlanCode] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const isAuthenticated = isLoaded && Boolean(session);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    fetchBillingSummary().then((result) => {
      if (cancelled || !result.ok) return;
      setCurrentPlanCode(result.data.subscription.plan.code.toLowerCase());
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const effectiveCurrentPlanCode = isAuthenticated ? currentPlanCode : null;

  const loadPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    setPlansError(null);

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    if (!baseUrl) {
      setPlans([]);
      setPlansError("Pricing API URL is not configured.");
      setIsLoadingPlans(false);
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/billing/plans/`);
      const payload = (await response
        .json()
        .catch(() => null)) as PlansApiResponse | null;

      if (!response.ok || !payload || !Array.isArray(payload.data)) {
        const message =
          payload && typeof payload.message === "string"
            ? payload.message
            : "Unable to load plans right now.";
        throw new Error(message);
      }

      const mapped = prependDefaultPlans(payload.data).map(mapApiPlanToUi);

      if (mapped.length === 0) {
        setPlans([]);
        setPlansError(
          "No pricing list is available yet. Showing fallback plans.",
        );
        return;
      }

      setPlans(sortPlans(mapped));
      setPlansError(null);
    } catch (error: unknown) {
      setPlans([]);
      setPlansError(
        error instanceof Error
          ? error.message
          : "Unable to load plans right now.",
      );
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlans();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPlans]);

  const pricingStatusMessage = useMemo(() => {
    if (isLoadingPlans) return "Loading latest plan data...";
    if (plansError) return `Showing fallback pricing. ${plansError}`;
    return "Showing latest plans from billing API.";
  }, [isLoadingPlans, plansError]);

  const hasPlans = plans.length > 0;

  const handlePlanAction = useCallback(
    async (planCode: string) => {
      const normalizedCode = planCode.toLowerCase();
      if (normalizedCode === "enterprise") {
        window.location.assign("/contact/");
        return;
      }

      if (!isAuthenticated) {
        window.location.assign("/login/");
        return;
      }

      setCheckoutError(null);
      setCheckoutPlanCode(planCode);
      try {
        const origin = window.location.origin;
        const successUrl = `${origin}/billing/success/?flow=plan&plan=${encodeURIComponent(planCode)}`;
        const cancelUrl = `${origin}/billing/cancel/?flow=plan&plan=${encodeURIComponent(planCode)}`;
        const result = await createPlanCheckoutSession(
          planCode,
          successUrl,
          cancelUrl,
        );
        if (!result.ok) {
          setCheckoutError(result.message);
          return;
        }

        window.location.assign(result.data.checkoutUrl);
      } finally {
        setCheckoutPlanCode(null);
      }
    },
    [isAuthenticated],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#d7efff_0%,#f0f8ff_45%,#f8fbff_100%)] px-6 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_15%,#0f172a_0%,#0b1220_45%,#060b17_100%)] dark:text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase dark:text-sky-300">
              Pricing
            </p>
            <h1
              id="pricing-title"
              className="mt-2 text-4xl font-black tracking-tight sm:text-5xl"
            >
              Plans Built For Every Loop
            </h1>
            <p
              id="pricing-subtitle"
              className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base"
            >
              Choose a plan based on how many groups you run and how large your
              communities are. Limits are enforced to keep plans predictable,
              and you can upgrade anytime.
            </p>
          </div>
          <nav aria-label="Pricing actions" className="flex gap-2">
            <Link
              href="/contact/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
            >
              Contact Sales
            </Link>
            <Link
              href="/signup/"
              className="rounded-xl bg-[linear-gradient(130deg,#0ea5e9_0%,#2563eb_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(14,165,233,0.3)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
            >
              Start Free
            </Link>
          </nav>
        </header>

        <section
          aria-labelledby="pricing-title"
          aria-describedby="pricing-subtitle"
          className="grid gap-5 lg:grid-cols-4"
        >
          <p className="sr-only" role="status" aria-live="polite">
            {pricingStatusMessage}
          </p>
          {isLoadingPlans &&
            Array.from({ length: 4 }).map((_, index) => (
              <article
                key={`pricing-skeleton-${index}`}
                aria-hidden="true"
                className="h-[440px] animate-pulse rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="h-7 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-9 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-4 h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-6 space-y-2">
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </article>
            ))}

          {!isLoadingPlans && plansError && (
            <div className="lg:col-span-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="text-sm font-semibold">Unable to load pricing</p>
              <p className="mt-1 text-xs">
                {plansError} You can still review our standard plans below.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadPlans()}
                  className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                >
                  Retry loading plans
                </button>
                <Link
                  href="/contact/"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          )}

          {!isLoadingPlans && checkoutError && (
            <div className="lg:col-span-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              <p className="text-sm font-semibold">Unable to start checkout</p>
              <p className="mt-1 text-xs">{checkoutError}</p>
            </div>
          )}

          {!isLoadingPlans && !hasPlans && !plansError && (
            <div className="lg:col-span-4 rounded-2xl border border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Pricing plans are not available right now.
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Please try again, or contact sales for current plan details.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPlans()}
                  className="rounded-xl bg-[linear-gradient(130deg,#0ea5e9_0%,#2563eb_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(14,165,233,0.3)] transition hover:brightness-110"
                >
                  Retry
                </button>
                <Link
                  href="/contact/"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          )}

          {!isLoadingPlans &&
            hasPlans &&
            plans.map((plan) =>
              (() => {
                const normalizedCode = plan.code.toLowerCase();
                const isCurrentPlan =
                  Boolean(effectiveCurrentPlanCode) &&
                  normalizedCode === effectiveCurrentPlanCode;

                return (
                  <article
                    key={plan.code}
                    aria-label={`${plan.name} plan`}
                    className={`group relative flex h-full flex-col rounded-3xl border p-5 shadow-sm backdrop-blur-sm transition-transform duration-300 ease-out hover:scale-[1.02] hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] ${
                      isCurrentPlan
                        ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/15"
                        : ""
                    } ${
                      plan.highlighted
                        ? "border-sky-300 bg-white shadow-[0_12px_32px_rgba(14,165,233,0.18)] dark:border-sky-700 dark:bg-slate-900 dark:shadow-[0_12px_32px_rgba(2,132,199,0.28)]"
                        : "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90"
                    }`}
                  >
                    {plan.highlighted && (
                      <p
                        aria-label="Most popular plan"
                        className="mb-3 inline-flex  absolute -top-2 right-3 rounded-full bg-sky-100 px-3 py-1 text-2xs font-bold tracking-wide text-sky-800 uppercase dark:bg-sky-950/50 border dark:text-sky-300"
                      >
                        Most Popular
                      </p>
                    )}

                    {isCurrentPlan && (
                      <p className="mb-3 inline-flex absolute -top-2 left-3 rounded-full border bg-emerald-100 px-3 py-1 text-2xs font-bold tracking-wide text-emerald-800 uppercase dark:bg-emerald-950/50 dark:text-emerald-300">
                        Current Plan
                      </p>
                    )}

                    <h2 className="text-2xl font-extrabold">{plan.name}</h2>
                    <p className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                      {plan.price}
                    </p>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      {plan.summary}
                    </p>

                    <dl className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/80">
                      {plan.limits.map((limit) => (
                        <div
                          key={limit.label}
                          className="flex items-center justify-between gap-3"
                        >
                          <dt className="text-slate-600 dark:text-slate-300">
                            {limit.label}
                          </dt>
                          <dd className="font-semibold text-slate-900 dark:text-slate-100">
                            {limit.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <ul
                      aria-label={`${plan.name} features`}
                      className="mt-4 space-y-2 text-sm text-slate-800 dark:text-slate-200"
                    >
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-[2px] h-2 w-2 shrink-0 rounded-full bg-sky-500"
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-5">
                      {isCurrentPlan ? (
                        <span className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          Current Plan
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handlePlanAction(plan.code)}
                          disabled={checkoutPlanCode !== null}
                          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition duration-300 hover:bg-slate-50 group-hover:scale-[1.05] group-focus-within:scale-[1.05] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
                        >
                          {plan.code.toLowerCase() === "enterprise"
                            ? "Contact Sales"
                            : checkoutPlanCode === plan.code
                              ? "Redirecting..."
                              : isAuthenticated
                                ? `Choose ${plan.name}`
                                : "Log in to continue"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })(),
            )}
        </section>

        <section
          aria-labelledby="enterprise-section-title"
          className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
            <div>
              <h2
                id="enterprise-section-title"
                className="text-2xl font-extrabold tracking-tight"
              >
                Enterprise Needs A Custom Buildout
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base">
                Enterprise includes custom group and member limits, onboarding,
                support SLAs, and contract terms. Tell us your community size,
                compliance requirements, and rollout timeline.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/contact/"
                className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#0284c7_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,116,144,0.32)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                Request Enterprise Quote
              </Link>
              <Link
                href="/login/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
