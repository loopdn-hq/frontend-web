// Enterprise Plan Builder pricing catalog.
//
// Per the Loopd'n Enterprise Plan Builder PRD, pricing must ultimately be
// database-driven and revalidated by the backend - the frontend estimate is
// UX only, never the trusted price. That backend catalog API doesn't exist
// yet, so this file is the local stand-in: every *_CENTS value below is a
// PLACEHOLDER pending real numbers from product/finance. Swap them here and
// the whole builder (estimate, summary, breakdown) picks them up - nothing
// else needs to change.
//
// Structure mirrors the PRD's configuration JSON (section 5) so this catalog
// can be replaced by a `GET /enterprise/pricing/`-style response later
// without reshaping the builder UI.

export type BillingIntervalCode = "monthly" | "quarterly" | "annual";
export type AnalyticsTier = "none" | "basic" | "advanced";

export type EnterpriseLimits = {
  max_groups: number;
  max_members_per_group: number;
  max_admins_per_group: number;
  storage_gb: number;
};

export type EnterpriseFeatureKey =
  | "extended_message_history"
  | "search"
  | "advanced_notifications"
  | "moderation_tools";

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

/** PLACEHOLDER - recurring monthly base fee before limits/features/credits. */
export const BASE_FEE_CENTS = 19_900;

// ---- Limits -----------------------------------------------------------

export const MAX_GROUPS_OPTIONS: PricedOption<string>[] = [
  { value: "50", label: "50 groups", priceCents: 0 },
  { value: "100", label: "100 groups", priceCents: 9_900 },
  { value: "300", label: "300 groups", priceCents: 29_900 },
  { value: "500", label: "500 groups", priceCents: 49_900 },
];

export const MAX_MEMBERS_PER_GROUP_OPTIONS: PricedOption<string>[] = [
  { value: "100", label: "100 members / group", priceCents: 0 },
  { value: "250", label: "250 members / group", priceCents: 7_900 },
  { value: "500", label: "500 members / group", priceCents: 19_900 },
  { value: "1000", label: "1,000 members / group", priceCents: 34_900 },
];

export const MAX_ADMINS_PER_GROUP_OPTIONS: PricedOption<string>[] = [
  { value: "20", label: "20 admins / group", priceCents: 0 },
  { value: "50", label: "50 admins / group", priceCents: 5_900 },
  { value: "100", label: "100 admins / group", priceCents: 12_900 },
];

export const STORAGE_GB_OPTIONS: PricedOption<string>[] = [
  { value: "10", label: "10 GB storage", priceCents: 0 },
  { value: "25", label: "25 GB storage", priceCents: 4_900 },
  { value: "50", label: "50 GB storage", priceCents: 9_900 },
  { value: "100", label: "100 GB storage", priceCents: 17_900 },
];

// ---- Toggleable features ---------------------------------------------
//
// These same four features ship bundled into Premium/Business; Enterprise
// unbundles them so a customer starting from the base fee only pays for what
// they turn on.

export const FEATURE_TOGGLES: {
  key: EnterpriseFeatureKey;
  label: string;
  description: string;
  priceCents: number;
}[] = [
  {
    key: "extended_message_history",
    label: "Extended message history",
    description:
      "Keep full message history beyond the standard retention window.",
    priceCents: 2_900,
  },
  {
    key: "search",
    label: "Search",
    description: "Full-text search across messages, files, and members.",
    priceCents: 2_900,
  },
  {
    key: "advanced_notifications",
    label: "Advanced notifications",
    description: "Custom notification rules, digests, and escalation routing.",
    priceCents: 3_900,
  },
  {
    key: "moderation_tools",
    label: "Moderation tools",
    description: "Content filters, admin review queues, and audit trails.",
    priceCents: 5_900,
  },
];

export const ANALYTICS_OPTIONS: PricedOption<AnalyticsTier>[] = [
  { value: "none", label: "None", priceCents: 0 },
  { value: "basic", label: "Basic", priceCents: 4_900 },
  { value: "advanced", label: "Advanced", priceCents: 14_900 },
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

export const BILLING_INTERVAL_OPTIONS: {
  value: BillingIntervalCode;
  label: string;
  months: number;
  /** PLACEHOLDER discount applied to the period subtotal. */
  discountPercent: number;
  description: string;
}[] = [
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
    storage_gb: 10,
  },
  features: {
    extended_message_history: false,
    search: false,
    advanced_notifications: false,
    moderation_tools: false,
    analytics: "none",
  },
  credits: {
    monthly_messages: 10_000,
  },
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
 */
export function calculateEnterprisePrice(
  configuration: EnterpriseConfiguration,
): EnterprisePriceEstimate {
  const lines: EnterprisePriceLine[] = [
    { label: "Enterprise base fee", amountCents: BASE_FEE_CENTS },
  ];

  const groups = findOption(
    MAX_GROUPS_OPTIONS,
    String(configuration.limits.max_groups),
  );
  if (groups)
    lines.push({ label: groups.label, amountCents: groups.priceCents });

  const members = findOption(
    MAX_MEMBERS_PER_GROUP_OPTIONS,
    String(configuration.limits.max_members_per_group),
  );
  if (members) {
    lines.push({ label: members.label, amountCents: members.priceCents });
  }

  const admins = findOption(
    MAX_ADMINS_PER_GROUP_OPTIONS,
    String(configuration.limits.max_admins_per_group),
  );
  if (admins)
    lines.push({ label: admins.label, amountCents: admins.priceCents });

  const storage = findOption(
    STORAGE_GB_OPTIONS,
    String(configuration.limits.storage_gb),
  );
  if (storage) {
    lines.push({ label: storage.label, amountCents: storage.priceCents });
  }

  for (const feature of FEATURE_TOGGLES) {
    if (configuration.features[feature.key]) {
      lines.push({ label: feature.label, amountCents: feature.priceCents });
    }
  }

  const analytics = findOption(
    ANALYTICS_OPTIONS,
    configuration.features.analytics,
  );
  if (analytics && analytics.priceCents > 0) {
    lines.push({
      label: `${analytics.label} analytics`,
      amountCents: analytics.priceCents,
    });
  }

  const credits = findOption(
    CREDIT_PACKAGE_OPTIONS,
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
    BILLING_INTERVAL_OPTIONS.find(
      (option) => option.value === configuration.billing_interval,
    ) ?? BILLING_INTERVAL_OPTIONS[0];

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
