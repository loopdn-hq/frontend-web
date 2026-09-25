"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronRight,
  Crown,
  Disc,
  HardDrive,
  Layers,
  Phone,
  Rocket,
  ScreenShare,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  comparePlansByPrice,
  createPlanCheckoutSession,
  fetchBillingSummary,
} from "@/lib/billing";
import { useAuth } from "@/lib/auth/client";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteTopNav } from "@/components/site/SiteTopNav";
import { PlanComparison } from "@/components/site/PlanComparison";

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
  /** One flag for audio AND video - the backend does not split them. */
  has_calls: boolean;
  /** Null means unlimited. */
  max_call_participants: number | null;
  has_screen_share: boolean;
  has_call_recording: boolean;
  /** Null means kept until somebody deletes it. */
  call_recording_retention_days: number | null;
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
    // Mirrors the backend seed (billing 0006_seed_call_limits): calling is on
    // for every plan, four to a call here; screen share and recording are
    // what the paid tiers add.
    has_calls: true,
    max_call_participants: 4,
    has_screen_share: false,
    has_call_recording: false,
    call_recording_retention_days: null,
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
    has_calls: true,
    max_call_participants: null,
    has_screen_share: true,
    has_call_recording: true,
    call_recording_retention_days: null,
    features: [
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
      "Custom retention policies",
      "Dedicated account manager",
      "Service Level Agreement (SLA)",
      "Custom volume pricing",
      "Audit logs",
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
    return "For small groups getting started with Loopd'n.";
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

/**
 * Calling, as rows for the card's existing limits list.
 *
 * Words rather than ticks and crosses, in the same shape as the other limits:
 * "Not included" is a thing a pricing page has to be able to SAY, and a row
 * that says it survives colour blindness, a screenshot and a screen reader,
 * none of which a red cross does on its own.
 *
 * Audio and video are one row because they are one flag on the server -
 * there is no plan where a visitor gets one and not the other. Screen sharing
 * is its own row: it rides `has_calls` in the token but is gated separately by
 * plan, so it is the one calling capability a paid tier actually adds.
 */
function callingLimits(plan: ApiPlan): Array<{ label: string; value: string }> {
  if (!plan.has_calls) {
    return [
      { label: "Voice & video calls", value: "Not included" },
      { label: "Screen sharing", value: "Not included" },
      { label: "Call recording", value: "Not included" },
    ];
  }

  return [
    { label: "Voice & video calls", value: "Included" },
    {
      label: "Call participants",
      value:
        plan.max_call_participants === null
          ? "Unlimited"
          : `Up to ${plan.max_call_participants}`,
    },
    {
      label: "Screen sharing",
      value: plan.has_screen_share ? "Included" : "Not included",
    },
    {
      label: "Call recording",
      value: !plan.has_call_recording
        ? "Not included"
        : plan.call_recording_retention_days === null
          ? "Kept until deleted"
          : `Kept ${plan.call_recording_retention_days} days`,
    },
  ];
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
      ...callingLimits(plan),
    ],
    features: plan.features,
  };
}

/**
 * Plans cheapest first, sorted while they are still the API shape - that is
 * where the price is still a NUMBER. The view model carries `price` only as
 * the string it is displayed as, and the sort this replaces compared those:
 * "$100.00/mo" sorts before "$20.00/mo" as text, so the dearest plan led the
 * page. It also ranked by a fixed list of plan codes, which put any plan the
 * list had not been taught about after Enterprise.
 *
 * comparePlansByPrice is the same ordering the signed-in plan lists use.
 */
function sortApiPlans(plans: ApiPlan[]): ApiPlan[] {
  return [...plans].sort((a, b) =>
    comparePlansByPrice(
      {
        monthlyPriceCents: a.monthly_price_cents,
        isCustomPricing: a.is_custom_pricing,
        name: a.name,
      },
      {
        monthlyPriceCents: b.monthly_price_cents,
        isCustomPricing: b.is_custom_pricing,
        name: b.name,
      },
    ),
  );
}

function prependDefaultPlans(plans: ApiPlan[]): ApiPlan[] {
  const codes = new Set(plans.map((plan) => plan.code.toLowerCase()));
  const defaultsToPrepend = DEFAULT_API_PLANS.filter(
    (plan) => !codes.has(plan.code),
  );

  return [...defaultsToPrepend, ...plans];
}

/**
 * The badge on each card. Keyed by plan code with a fallback, so a plan the
 * catalogue has not been taught about still gets a mark rather than a hole -
 * the same reason the ordering no longer depends on a list of known codes.
 */
const PLAN_BADGES: Record<string, { Icon: LucideIcon; className: string }> = {
  free: { Icon: Sparkles, className: "bg-emerald-500" },
  premium: { Icon: Crown, className: "bg-sky-500" },
  business: { Icon: Building2, className: "bg-violet-500" },
  enterprise: { Icon: Rocket, className: "bg-amber-500" },
};

function planBadge(code: string) {
  const normalized = code.toLowerCase();
  if (PLAN_BADGES[normalized]) return PLAN_BADGES[normalized];
  if (normalized.startsWith("premium")) return PLAN_BADGES.premium;
  if (normalized.startsWith("business")) return PLAN_BADGES.business;
  return { Icon: Layers, className: "bg-slate-500" };
}

/** The icon beside each limit row, matched on the labels mapApiPlanToUi writes. */
const LIMIT_ICONS: Record<string, LucideIcon> = {
  "Max groups": Layers,
  "Members per group": Users,
  "Admins per group": ShieldCheck,
  Storage: HardDrive,
  "Voice & video calls": Phone,
  "Call participants": Users,
  "Screen sharing": ScreenShare,
  "Call recording": Disc,
};

export default function PricingPage() {
  const router = useRouter();
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

      const mapped = sortApiPlans(prependDefaultPlans(payload.data)).map(
        mapApiPlanToUi,
      );

      if (mapped.length === 0) {
        setPlans([]);
        setPlansError(
          "No pricing list is available yet. Showing fallback plans.",
        );
        return;
      }

      setPlans(mapped);
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
        router.push("/enterprise/builder/");
        return;
      }

      if (!isAuthenticated) {
        router.push("/login/");
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
    [isAuthenticated, router],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#dceeff_0%,#f2f8ff_45%,#f8fbff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_50%_-10%,#123a8a_0%,#0b1c46_38%,#060d24_100%)] dark:text-slate-100">
      <SiteTopNav />

      <main className="px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="flex justify-center">
            <ol className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <li>
                <Link
                  href="/"
                  className="rounded-full px-2 py-0.5 transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none dark:hover:text-sky-300"
                >
                  Home
                </Link>
              </li>
              <ChevronRight
                aria-hidden="true"
                className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
              />
              <li
                aria-current="page"
                className="rounded-full bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
              >
                Pricing
              </li>
            </ol>
          </nav>

          <header className="mt-7 text-center">
            <h1
              id="pricing-title"
              className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl"
            >
              Plans Built for Every Loop
            </h1>
            <p
              id="pricing-subtitle"
              className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300"
            >
              Choose the plan that fits your community. Start with what you need
              and upgrade as your Loopd&apos;n grows.
            </p>
          </header>

          <section
            aria-labelledby="pricing-title"
            aria-describedby="pricing-subtitle"
            className="mt-12 grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            <p className="sr-only" role="status" aria-live="polite">
              {pricingStatusMessage}
            </p>

            {isLoadingPlans &&
              Array.from({ length: 4 }).map((_, index) => (
                <article
                  key={`pricing-skeleton-${index}`}
                  aria-hidden="true"
                  className="h-[420px] animate-pulse rounded-3xl border border-slate-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="h-6 w-24 rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-6 h-8 w-28 rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-5 h-10 w-full rounded-xl bg-slate-200 dark:bg-white/10" />
                  <div className="mt-6 space-y-3">
                    <div className="h-3 w-full rounded bg-slate-200 dark:bg-white/10" />
                    <div className="h-3 w-full rounded bg-slate-200 dark:bg-white/10" />
                    <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                  </div>
                </article>
              ))}

            {!isLoadingPlans && plansError && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-800 sm:col-span-2 xl:col-span-4 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="text-sm font-semibold">Unable to load pricing</p>
                <p className="mt-1 text-xs">
                  {plansError} You can still review our standard plans below.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPlans()}
                    className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                  >
                    Retry loading plans
                  </button>
                  <Link
                    href="/contact/"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Contact Sales
                  </Link>
                </div>
              </div>
            )}

            {!isLoadingPlans && checkoutError && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 sm:col-span-2 xl:col-span-4 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                <p className="text-sm font-semibold">
                  Unable to start checkout
                </p>
                <p className="mt-1 text-xs">{checkoutError}</p>
              </div>
            )}

            {!isLoadingPlans && !hasPlans && !plansError && (
              <div className="rounded-2xl border border-slate-300 bg-white p-6 text-center sm:col-span-2 xl:col-span-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Pricing plans are not available right now.
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Please try again, or contact sales for current plan details.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPlans()}
                    className="rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(14,165,233,0.3)] transition hover:brightness-110"
                  >
                    Retry
                  </button>
                  <Link
                    href="/contact/"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Contact Sales
                  </Link>
                </div>
              </div>
            )}

            {!isLoadingPlans &&
              hasPlans &&
              plans.map((plan) => {
                const normalizedCode = plan.code.toLowerCase();
                const isCurrentPlan =
                  Boolean(effectiveCurrentPlanCode) &&
                  normalizedCode === effectiveCurrentPlanCode;
                const { Icon, className: badgeClassName } = planBadge(
                  plan.code,
                );
                const featured = Boolean(plan.highlighted);

                return (
                  <article
                    key={plan.code}
                    aria-label={`${plan.name} plan`}
                    /* Three surfaces, one of them at a time - written as a
                       single chain rather than appended blocks, because two
                       background utilities on one element are resolved by the
                       order Tailwind emits them, not the order they are
                       written, and "mostly wins" is not a rule to build on.
                       The weighting is deliberate: recommended is loudest
                       (gradient, lift, deep shadow), the plan you are on is
                       second (tint, ring, badge, but flat), everything else is
                       quiet - so the page still points somewhere. */
                    className={`relative flex h-full flex-col rounded-3xl border p-6 transition duration-300 ${
                      featured
                        ? "border-sky-300/70 bg-[linear-gradient(165deg,#22a7ff_0%,#1f7fe6_55%,#1c62c8_100%)] text-white shadow-[0_24px_60px_rgba(31,127,230,0.4)] xl:-translate-y-5"
                        : isCurrentPlan
                          ? "border-emerald-300 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-400/60 backdrop-blur dark:border-emerald-500/40 dark:bg-emerald-500/[0.08]"
                          : "border-slate-200 bg-white/90 shadow-sm backdrop-blur hover:border-sky-300 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-sky-400/40"
                    }`}
                  >
                    {isCurrentPlan && !featured && (
                      <p className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold tracking-wide text-emerald-700 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300">
                        <Check aria-hidden="true" className="h-3 w-3" />
                        Your plan
                      </p>
                    )}

                    {featured && (
                      <p className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-bold tracking-wide text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300">
                        Recommended
                      </p>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-extrabold tracking-tight">
                        {plan.name}
                      </h2>
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                          featured ? "bg-white/20" : badgeClassName
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>

                    <p
                      className={`mt-2 min-h-[2.5rem] text-xs leading-5 ${
                        featured
                          ? "text-sky-50/90"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {plan.summary}
                    </p>

                    <p className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                      {plan.price}
                    </p>

                    <div className="mt-5">
                      {isCurrentPlan ? (
                        <span
                          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold ${
                            featured
                              ? "bg-white/20 text-white"
                              : "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                          }`}
                        >
                          Current Plan
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handlePlanAction(plan.code)}
                          disabled={checkoutPlanCode !== null}
                          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900 ${
                            featured
                              ? "bg-white text-sky-700 shadow-sm hover:bg-sky-50"
                              : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                          }`}
                        >
                          {normalizedCode === "enterprise"
                            ? "Build Your Plan"
                            : checkoutPlanCode === plan.code
                              ? "Redirecting..."
                              : isAuthenticated
                                ? `Choose ${plan.name}`
                                : "Log in to continue"}
                        </button>
                      )}
                    </div>

                    <dl
                      className={`mt-6 space-y-3 border-t pt-5 text-xs ${
                        featured
                          ? "border-white/25"
                          : "border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {plan.limits.map((limit) => {
                        const LimitIcon = LIMIT_ICONS[limit.label] ?? Layers;
                        // "Not included" is drawn back rather than struck
                        // through: the row still has to be readable, it just
                        // must not look like something the plan gives you.
                        const included = limit.value !== "Not included";
                        return (
                          <div
                            key={limit.label}
                            className={`flex items-start gap-2.5 ${
                              included ? "" : "opacity-55"
                            }`}
                          >
                            <LimitIcon
                              aria-hidden="true"
                              className={`mt-px h-4 w-4 shrink-0 ${
                                featured
                                  ? "text-sky-100"
                                  : "text-sky-600 dark:text-sky-400"
                              }`}
                            />
                            <dt className="sr-only">{limit.label}</dt>
                            <dd
                              className={
                                featured
                                  ? "text-sky-50"
                                  : "text-slate-700 dark:text-slate-300"
                              }
                            >
                              <span className="font-semibold">
                                {limit.value}
                              </span>{" "}
                              <span
                                className={
                                  featured
                                    ? "text-sky-100/80"
                                    : "text-slate-500 dark:text-slate-400"
                                }
                              >
                                {limit.label.toLowerCase()}
                              </span>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </article>
                );
              })}
          </section>

          {/* Only once the real plans are in: the comparison is derived from
              their own feature arrays, so it has nothing to say until they
              have loaded. */}
          {!isLoadingPlans && hasPlans && (
            <PlanComparison
              plans={plans}
              currentPlanCode={effectiveCurrentPlanCode}
            />
          )}

          <section
            aria-labelledby="enterprise-section-title"
            className="mt-14 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8 dark:border-white/10 dark:bg-white/[0.045]"
          >
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
              <div>
                <h2
                  id="enterprise-section-title"
                  className="text-2xl font-extrabold tracking-tight"
                >
                  Enterprise Needs A Custom Buildout
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
                  Enterprise includes custom group and member limits,
                  onboarding, support SLAs, and contract terms. Tell us your
                  community size, compliance requirements, and rollout timeline.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/enterprise/builder/"
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.32)] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
                >
                  Build Your Enterprise Plan
                </Link>
                <Link
                  href="/contact/"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Talk to sales instead
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
