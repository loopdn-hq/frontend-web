// Enterprise Plan Builder pricing catalog.
//
// Per the Loopd'n Enterprise Plan Builder PRD, pricing must be database-driven
// and revalidated by the backend - the frontend estimate is UX only, never the
// trusted price.
//
// `GET /enterprise/pricing/` IS live and is what the builder actually prices
// against (see lib/enterprise/api.ts, fetchEnterprisePricingCatalog). What is
// left here is the FALLBACK: DEFAULT_CATALOG, used for a hydration-safe first
// paint and if that fetch fails. Its numbers mirror the backend's own seeded
// placeholders line for line, so the two cannot disagree while both are
// waiting on real figures from product/finance.
//
// Structure mirrors the PRD's configuration JSON (section 5).

export type BillingIntervalCode = "monthly" | "quarterly" | "annual";
export type AnalyticsTier = "none" | "basic" | "advanced";

export type EnterpriseLimits = {
  max_groups: number;
  max_members_per_group: number;
  max_admins_per_group: number;
  storage_gb: number;
};

/**
 * Every key `POST /enterprise/drafts/` requires - all of them, on every save.
 * Mirrors enterprise/services.py FEATURE_KEYS; a missing one is a 400 with
 * field errors, not a silently defaulted false.
 */
export type EnterpriseFeatureKey =
  | "extended_message_history"
  | "search"
  | "advanced_notifications"
  | "moderation_tools"
  | "calls"
  | "call_recording";

export type EnterpriseFeatures = Record<EnterpriseFeatureKey, boolean> & {
  analytics: AnalyticsTier;
};

export type EnterpriseCredits = {
  monthly_messages: number;
};

/** Matches the PRD's "Configuration JSON" (section 5) - a selection payload, not a trusted price payload. */
export type EnterpriseConfiguration = {
  type: "plan";
  code: "enterprise";
  billing_interval: BillingIntervalCode;
  limits: EnterpriseLimits;
  features: EnterpriseFeatures;
  credits: EnterpriseCredits;
};

export type PricedOption<T extends string> = {
  value: T;
  label: string;
  /** Additive monthly price impact, in cents. 0 means included at no extra charge. */
  priceCents: number;
};

// ---- Base fee -------------------------------------------------------------
//
// Calibrated against the real self-service ladder (Premium $9.99/mo: 25
// groups / 250 members / 5 admins / 10 GB; Business $29.99/mo: 100 groups /
// 50 members / 10 admins, unlimited-tier storage) so Enterprise reads as a
// credible step above Business rather than an arbitrary number. Still a
// PLACEHOLDER pending finalized Enterprise pricing from product/finance.

// 2026-09: dropped ~70% (kept at roughly 30% of the original placeholder)
// per product feedback that the scope/feature numbers read too high - only
// the credit packages below were left untouched.
/** PLACEHOLDER - recurring monthly base fee before limits/features/credits. */
export const BASE_FEE_CENTS = 6_000;

// ---- Limits -----------------------------------------------------------

export const MAX_GROUPS_OPTIONS: PricedOption<string>[] = [
  { value: "50", label: "50 groups", priceCents: 0 },
  { value: "100", label: "100 groups", priceCents: 3_000 },
  { value: "300", label: "300 groups", priceCents: 9_000 },
  { value: "500", label: "500 groups", priceCents: 15_000 },
];

export const MAX_MEMBERS_PER_GROUP_OPTIONS: PricedOption<string>[] = [
  { value: "100", label: "100 members / group", priceCents: 0 },
  { value: "250", label: "250 members / group", priceCents: 2_400 },
  { value: "500", label: "500 members / group", priceCents: 6_000 },
  { value: "1000", label: "1,000 members / group", priceCents: 10_500 },
];

export const MAX_ADMINS_PER_GROUP_OPTIONS: PricedOption<string>[] = [
  { value: "20", label: "20 admins / group", priceCents: 0 },
  { value: "50", label: "50 admins / group", priceCents: 1_800 },
  { value: "100", label: "100 admins / group", priceCents: 3_900 },
];

export const STORAGE_GB_OPTIONS: PricedOption<string>[] = [
  { value: "50", label: "50 GB storage", priceCents: 0 },
  { value: "100", label: "100 GB storage", priceCents: 1_500 },
  { value: "500", label: "500 GB storage", priceCents: 4_500 },
  { value: "1000", label: "1,000 GB storage", priceCents: 7_500 },
];

// ---- Toggleable features ---------------------------------------------
//
// These features ship bundled into Premium/Business; Enterprise unbundles them
// so a customer starting from the base fee only pays for what they turn on.

export type FeatureToggleOption = {
  key: EnterpriseFeatureKey;
  label: string;
  description: string;
  priceCents: number;
};

export const FEATURE_TOGGLES: FeatureToggleOption[] = [
  {
    key: "extended_message_history",
    label: "Extended message history",
    description:
      "Keep full message history beyond the standard retention window.",
    priceCents: 900,
  },
  {
    key: "search",
    label: "Search",
    description: "Full-text search across messages, files, and members.",
    priceCents: 900,
  },
  {
    key: "advanced_notifications",
    label: "Advanced notifications",
    description: "Custom notification rules, digests, and escalation routing.",
    priceCents: 1_200,
  },
  {
    key: "moderation_tools",
    label: "Moderation tools",
    description: "Content filters, admin review queues, and audit trails.",
    priceCents: 1_800,
  },
  // ONE line for calling, covering audio and video together: billing.Plan
  // has a single `has_calls` flag that grants both, so there is nothing a
  // custom plan could buy separately. Screen sharing rides the same flag and
  // is likewise not priced on its own.
  {
    key: "calls",
    label: "Calls",
    description: "Voice and video calls, one-to-one and in groups, on LiveKit.",
    priceCents: 2_500,
  },
  // Flat, not tiered: retention comes with the add-on (90 days today, set by
  // the backend), so there are no retention lengths to choose between.
  {
    key: "call_recording",
    label: "Call recording",
    description: "Record calls to a private, downloadable file. Kept 90 days.",
    priceCents: 2_000,
  },
];

export const ANALYTICS_OPTIONS: PricedOption<AnalyticsTier>[] = [
  { value: "none", label: "None", priceCents: 0 },
  { value: "basic", label: "Basic", priceCents: 1_500 },
  { value: "advanced", label: "Advanced", priceCents: 4_500 },
];

// ---- Credits ------------------------------------------------------------

export const CREDIT_PACKAGE_OPTIONS: PricedOption<string>[] = [
  { value: "10000", label: "10,000 messages / mo", priceCents: 4_900 },
  { value: "30000", label: "30,000 messages / mo", priceCents: 12_900 },
  { value: "50000", label: "50,000 messages / mo", priceCents: 19_900 },
  { value: "100000", label: "100,000 messages / mo", priceCents: 34_900 },
  { value: "500000", label: "500,000 messages / mo", priceCents: 149_900 },
];

// ---- Billing interval -----------------------------------------------

export type BillingIntervalOption = {
  value: BillingIntervalCode;
  label: string;
  months: number;
  /** PLACEHOLDER discount applied to the period subtotal. */
  discountPercent: number;
  description: string;
};

export const BILLING_INTERVAL_OPTIONS: BillingIntervalOption[] = [
  {
    value: "monthly",
    label: "Monthly",
    months: 1,
    discountPercent: 0,
    description: "Billed every month.",
  },
  {
    value: "quarterly",
    label: "Quarterly",
    months: 3,
    discountPercent: 5,
    description: "Billed every 3 months. Save 5%.",
  },
  {
    value: "annual",
    label: "Annual",
    months: 12,
    discountPercent: 15,
    description: "Billed once a year. Save 15%.",
  },
];

export const DEFAULT_CONFIGURATION: EnterpriseConfiguration = {
  type: "plan",
  code: "enterprise",
  billing_interval: "monthly",
  limits: {
    max_groups: 100,
    max_members_per_group: 250,
    max_admins_per_group: 20,
    storage_gb: 50,
  },
  features: {
    extended_message_history: false,
    search: false,
    advanced_notifications: false,
    moderation_tools: false,
    calls: false,
    call_recording: false,
    analytics: "none",
  },
  credits: {
    monthly_messages: 10_000,
  },
};

/**
 * Everything calculateEnterprisePrice() and the builder's option lists need,
 * bundled so the live `GET /enterprise/pricing/` response and this file's own
 * static PLACEHOLDER data are interchangeable - the builder page starts from
 * DEFAULT_CATALOG (below) for a hydration-safe first paint, then swaps in the
 * live catalog once fetched. See lib/enterprise/api.ts's
 * fetchEnterprisePricingCatalog() for the normalization from the wire shape.
 */
export type EnterpriseCatalog = {
  catalogVersion: number | null;
  currency: string;
  baseFeeCents: number;
  limits: {
    maxGroups: PricedOption<string>[];
    maxMembersPerGroup: PricedOption<string>[];
    maxAdminsPerGroup: PricedOption<string>[];
    storageGb: PricedOption<string>[];
  };
  features: FeatureToggleOption[];
  analytics: PricedOption<AnalyticsTier>[];
  creditPackages: PricedOption<string>[];
  billingIntervals: BillingIntervalOption[];
};

export const DEFAULT_CATALOG: EnterpriseCatalog = {
  catalogVersion: null,
  currency: "usd",
  baseFeeCents: BASE_FEE_CENTS,
  limits: {
    maxGroups: MAX_GROUPS_OPTIONS,
    maxMembersPerGroup: MAX_MEMBERS_PER_GROUP_OPTIONS,
    maxAdminsPerGroup: MAX_ADMINS_PER_GROUP_OPTIONS,
    storageGb: STORAGE_GB_OPTIONS,
  },
  features: FEATURE_TOGGLES,
  analytics: ANALYTICS_OPTIONS,
  creditPackages: CREDIT_PACKAGE_OPTIONS,
  billingIntervals: BILLING_INTERVAL_OPTIONS,
};

function findOption<T extends string>(
  options: PricedOption<T>[],
  value: T,
): PricedOption<T> | undefined {
  return options.find((option) => option.value === value);
}

export type EnterprisePriceLine = {
  label: string;
  amountCents: number;
};

export type EnterprisePriceEstimate = {
  /** Sum of base fee + limits + features + credits, before interval discount. */
  monthlySubtotalCents: number;
  lines: EnterprisePriceLine[];
  billingInterval: BillingIntervalCode;
  periodMonths: number;
  discountPercent: number;
  /** monthlySubtotalCents * periodMonths, before discount. */
  periodSubtotalCents: number;
  discountCents: number;
  /** The amount actually charged per billing period. */
  periodTotalCents: number;
  /** periodTotalCents / periodMonths, for an apples-to-apples monthly comparison. */
  monthlyEquivalentCents: number;
};

/**
 * Client-side estimate only. The PRD is explicit that the backend recalculates
 * this from the database before anything is billed, and the client must never
 * be trusted to submit an arbitrary total - this function exists purely so
 * the builder UI has a live number to show while configuring.
 *
 * Takes a catalog rather than reading the module-level consts directly, so
 * the builder can pass the live `GET /enterprise/pricing/` catalog once it's
 * loaded (falling back to DEFAULT_CATALOG - this file's own PLACEHOLDER data
 * - until then or if that fetch fails).
 */
export function calculateEnterprisePrice(
  configuration: EnterpriseConfiguration,
  catalog: EnterpriseCatalog = DEFAULT_CATALOG,
): EnterprisePriceEstimate {
  const lines: EnterprisePriceLine[] = [
    { label: "Enterprise base fee", amountCents: catalog.baseFeeCents },
  ];

  const groups = findOption(
    catalog.limits.maxGroups,
    String(configuration.limits.max_groups),
  );
  if (groups)
    lines.push({ label: groups.label, amountCents: groups.priceCents });

  const members = findOption(
    catalog.limits.maxMembersPerGroup,
    String(configuration.limits.max_members_per_group),
  );
  if (members) {
    lines.push({ label: members.label, amountCents: members.priceCents });
  }

  const admins = findOption(
    catalog.limits.maxAdminsPerGroup,
    String(configuration.limits.max_admins_per_group),
  );
  if (admins)
    lines.push({ label: admins.label, amountCents: admins.priceCents });

  const storage = findOption(
    catalog.limits.storageGb,
    String(configuration.limits.storage_gb),
  );
  if (storage) {
    lines.push({ label: storage.label, amountCents: storage.priceCents });
  }

  for (const feature of catalog.features) {
    if (configuration.features[feature.key]) {
      lines.push({ label: feature.label, amountCents: feature.priceCents });
    }
  }

  const analytics = findOption(
    catalog.analytics,
    configuration.features.analytics,
  );
  if (analytics && analytics.priceCents > 0) {
    lines.push({
      label: `${analytics.label} analytics`,
      amountCents: analytics.priceCents,
    });
  }

  const credits = findOption(
    catalog.creditPackages,
    String(configuration.credits.monthly_messages),
  );
  if (credits) {
    lines.push({ label: credits.label, amountCents: credits.priceCents });
  }

  const monthlySubtotalCents = lines.reduce(
    (sum, line) => sum + line.amountCents,
    0,
  );

  const interval =
    catalog.billingIntervals.find(
      (option) => option.value === configuration.billing_interval,
    ) ?? catalog.billingIntervals[0];

  const periodSubtotalCents = monthlySubtotalCents * interval.months;
  const discountCents = Math.round(
    (periodSubtotalCents * interval.discountPercent) / 100,
  );
  const periodTotalCents = periodSubtotalCents - discountCents;

  return {
    monthlySubtotalCents,
    lines,
    billingInterval: interval.value,
    periodMonths: interval.months,
    discountPercent: interval.discountPercent,
    periodSubtotalCents,
    discountCents,
    periodTotalCents,
    monthlyEquivalentCents: Math.round(periodTotalCents / interval.months),
  };
}

export function formatCents(cents: number): string {
  if (cents === 0) return "Included";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
