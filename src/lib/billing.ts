import { authorizedRequest } from "@/lib/chat/conversations";

type ApiObject = Record<string, unknown>;

export type BillingPlan = {
  id: string;
  code: string;
  name: string;
  priceDisplay: string;
  monthlyPriceCents: number | null;
  maxGroups: number | null;
  maxMembersPerGroup: number | null;
  maxAdminsPerGroup: number | null;
  storageGb: number | null;
  hasWhatsApp: boolean;
  hasTelegram: boolean;
  /** Audio AND video together - the backend has one flag, not two. */
  hasCalls: boolean;
  /** Null means unlimited. */
  maxCallParticipants: number | null;
  /** Rides `hasCalls` on the server; not sold separately. */
  hasScreenShare: boolean;
  hasCallRecording: boolean;
  /** Null means kept until somebody deletes it. */
  callRecordingRetentionDays: number | null;
  features: string[];
  isCustomPricing: boolean;
};

export type CreditPackage = {
  id: string;
  name: string;
  priceCents: number;
  creditCents: number;
};

/**
 * The Enterprise messaging-credit balance - a separate pool from `wallet`
 * below. `wallet` is the PAYG Communication Wallet (SMS/voice, spent as you
 * go, any plan); this is the fixed monthly allowance a Communication Credit
 * package grants an Enterprise contract, reset each billing period. Only
 * present once an Enterprise contract exists - null otherwise.
 */
export type EnterpriseCreditsSummary = {
  contractNumber: string;
  status: string;
  balance: number;
  monthlyAllowance: number;
};

export type BillingSummary = {
  subscription: {
    plan: BillingPlan;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  wallet: {
    balanceCents: number;
    autoRechargeEnabled: boolean;
    autoRechargePackage: string | null;
  };
  enterpriseCredits: EnterpriseCreditsSummary | null;
};

export type BillingAnalyticsPlanInfo = {
  code: string;
  name: string;
  monthlyPriceCents: number | null;
  isCustomPricing: boolean;
  features: string[];
};

export type BillingAnalyticsWalletUsage = {
  purchasedCents: number;
  usedCents: number;
  netChangeCents: number;
  purchaseTransactions: number;
  usageTransactions: number;
};

export type BillingAnalyticsWallet = {
  balanceCents: number;
  usageLast30Days: BillingAnalyticsWalletUsage;
};

export type BillingAnalyticsBasic = {
  windowDays: number;
  planInfo: BillingAnalyticsPlanInfo;
  wallet: BillingAnalyticsWallet;
  conversationCounts: {
    total: number;
    group: number;
    direct: number;
  };
  messageActivity: {
    sentLast30Days: number;
    receivedLast30Days: number;
  };
};

export type BillingAnalyticsAdvanced = {
  planInfo: BillingAnalyticsPlanInfo;
  wallet: BillingAnalyticsWallet;
  groupAdminStats: {
    adminGroups: number;
    memberGroups: number;
    broadcastGroups: number;
  };
  groupSize: {
    averageActiveMembers: number;
    largestGroupActiveMembers: number;
  };
};

export type BillingAnalyticsSuggestion = {
  code: string;
  title: string;
  detail: string;
};

export type BillingAnalytics = {
  access: {
    hasBasicAnalytics: boolean;
    hasAdvancedAnalytics: boolean;
    currentPlanCode: string;
    matchedFeature: "basic" | "advanced" | "none";
  };
  basic: BillingAnalyticsBasic | null;
  advanced: BillingAnalyticsAdvanced | null;
  suggestions: BillingAnalyticsSuggestion[];
};

type EnvelopeResult<T> = { ok: true; data: T } | { ok: false; message: string };

const DEFAULT_BILLING_PLANS: BillingPlan[] = [
  {
    id: "free",
    code: "free",
    name: "Free",
    monthlyPriceCents: 0,
    priceDisplay: "$0.00/mo",
    maxGroups: 3,
    maxMembersPerGroup: 20,
    maxAdminsPerGroup: 1,
    storageGb: 1,
    hasWhatsApp: false,
    hasTelegram: false,
    // Mirrors the backend's own seed (billing 0006_seed_call_limits): calling
    // is on for every plan, capped at four here, and screen share and
    // recording are what the paid tiers add.
    hasCalls: true,
    maxCallParticipants: 4,
    hasScreenShare: false,
    hasCallRecording: false,
    callRecordingRetentionDays: null,
    features: [
      "Web messaging",
      "Basic message history",
      "Reactions",
      "Reply, edit and delete",
      "Join links/codes",
      "Basic notifications",
      "SMS requires PAYG credits or sponsored campaign funding",
    ],
    isCustomPricing: false,
  },
  {
    id: "enterprise",
    code: "enterprise",
    name: "Enterprise",
    monthlyPriceCents: null,
    priceDisplay: "Custom",
    maxGroups: null,
    maxMembersPerGroup: null,
    maxAdminsPerGroup: null,
    storageGb: null,
    hasWhatsApp: true,
    hasTelegram: true,
    hasCalls: true,
    maxCallParticipants: null,
    hasScreenShare: true,
    hasCallRecording: true,
    callRecordingRetentionDays: null,
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
    isCustomPricing: true,
  },
];

function isObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asCount(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

function getErrorMessage(payload: unknown): string | null {
  if (!isObject(payload)) return null;
  if (typeof payload.message === "string") return payload.message;

  const data = payload.data;
  if (!isObject(data)) return null;

  for (const value of Object.values(data)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }

  return null;
}

async function getData(input: string): Promise<EnvelopeResult<unknown>> {
  try {
    const response = await authorizedRequest(input);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(payload) ?? "Billing request failed.",
      };
    }

    if (!isObject(payload)) {
      return { ok: false, message: "Invalid billing response." };
    }

    return { ok: true, data: payload.data };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

function normalizePlan(item: unknown): BillingPlan | null {
  if (!isObject(item)) return null;

  const code = asText(item.code, asText(item.plan_code, ""));
  const name = asText(item.name, asText(item.title, code || "Plan"));

  const features = Array.isArray(item.features)
    ? item.features.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return {
    id: String(item.id ?? (code || name)),
    code,
    name,
    priceDisplay: asText(item.price_display, "Custom"),
    monthlyPriceCents: asNumber(item.monthly_price_cents),
    maxGroups: asNumber(item.max_groups),
    maxMembersPerGroup: asNumber(item.max_members_per_group),
    maxAdminsPerGroup: asNumber(item.max_admins_per_group),
    storageGb: asNumber(item.storage_gb),
    hasWhatsApp: asBoolean(item.has_whatsapp, asBoolean(item.whatsapp_enabled)),
    hasTelegram: asBoolean(item.has_telegram, asBoolean(item.telegram_enabled)),
    // All four default to OFF when the field is absent. The server's own
    // default for has_calls is on, but absent here means an API that did not
    // say - and a pricing page must not promise a capability nobody claimed.
    hasCalls: asBoolean(item.has_calls),
    maxCallParticipants: asNumber(item.max_call_participants),
    hasScreenShare: asBoolean(item.has_screen_share),
    hasCallRecording: asBoolean(item.has_call_recording),
    callRecordingRetentionDays: asNumber(item.call_recording_retention_days),
    features,
    isCustomPricing: asBoolean(item.is_custom_pricing),
  };
}

function normalizeCreditPackage(item: unknown): CreditPackage | null {
  if (!isObject(item)) return null;

  const priceCents = asNumber(item.price_cents);
  const creditCents = asNumber(item.credit_cents);
  if (priceCents === null || creditCents === null) return null;

  return {
    id: String(item.id ?? ""),
    name: asText(item.name, "Credit package"),
    priceCents,
    creditCents,
  };
}

function normalizeAnalyticsPlanInfo(item: unknown): BillingAnalyticsPlanInfo {
  if (!isObject(item)) {
    return {
      code: "",
      name: "",
      monthlyPriceCents: null,
      isCustomPricing: false,
      features: [],
    };
  }

  const features = Array.isArray(item.features)
    ? item.features.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return {
    code: asText(item.code),
    name: asText(item.name, "Plan"),
    monthlyPriceCents: asNumber(item.monthly_price_cents),
    isCustomPricing: asBoolean(item.is_custom_pricing),
    features,
  };
}

function normalizeAnalyticsWallet(item: unknown): BillingAnalyticsWallet {
  const usage =
    isObject(item) && isObject(item.usage_last_30_days)
      ? item.usage_last_30_days
      : null;

  return {
    balanceCents: isObject(item) ? asCount(item.balance_cents) : 0,
    usageLast30Days: {
      purchasedCents: usage ? asCount(usage.purchased_cents) : 0,
      usedCents: usage ? asCount(usage.used_cents) : 0,
      netChangeCents: usage ? asCount(usage.net_change_cents) : 0,
      purchaseTransactions: usage ? asCount(usage.purchase_transactions) : 0,
      usageTransactions: usage ? asCount(usage.usage_transactions) : 0,
    },
  };
}

function normalizeBillingAnalytics(data: unknown): BillingAnalytics | null {
  if (!isObject(data)) return null;

  const access = isObject(data.access) ? data.access : null;
  const matchedFeatureRaw = access ? asText(access.matched_feature) : "";
  const matchedFeature: BillingAnalytics["access"]["matchedFeature"] =
    matchedFeatureRaw === "advanced"
      ? "advanced"
      : matchedFeatureRaw === "basic"
        ? "basic"
        : "none";

  const basicRaw = isObject(data.basic) ? data.basic : null;
  const advancedRaw = isObject(data.advanced) ? data.advanced : null;

  const basic: BillingAnalyticsBasic | null = basicRaw
    ? {
        windowDays: asCount(basicRaw.window_days, 30),
        planInfo: normalizeAnalyticsPlanInfo(basicRaw.plan_info),
        wallet: normalizeAnalyticsWallet(basicRaw.wallet),
        conversationCounts: {
          total: isObject(basicRaw.conversation_counts)
            ? asCount(basicRaw.conversation_counts.total)
            : 0,
          group: isObject(basicRaw.conversation_counts)
            ? asCount(basicRaw.conversation_counts.group)
            : 0,
          direct: isObject(basicRaw.conversation_counts)
            ? asCount(basicRaw.conversation_counts.direct)
            : 0,
        },
        messageActivity: {
          sentLast30Days: isObject(basicRaw.message_activity)
            ? asCount(basicRaw.message_activity.sent_last_30_days)
            : 0,
          receivedLast30Days: isObject(basicRaw.message_activity)
            ? asCount(basicRaw.message_activity.received_last_30_days)
            : 0,
        },
      }
    : null;

  const advanced: BillingAnalyticsAdvanced | null = advancedRaw
    ? {
        planInfo: normalizeAnalyticsPlanInfo(advancedRaw.plan_info),
        wallet: normalizeAnalyticsWallet(advancedRaw.wallet),
        groupAdminStats: {
          adminGroups: isObject(advancedRaw.group_admin_stats)
            ? asCount(advancedRaw.group_admin_stats.admin_groups)
            : 0,
          memberGroups: isObject(advancedRaw.group_admin_stats)
            ? asCount(advancedRaw.group_admin_stats.member_groups)
            : 0,
          broadcastGroups: isObject(advancedRaw.group_admin_stats)
            ? asCount(advancedRaw.group_admin_stats.broadcast_groups)
            : 0,
        },
        groupSize: {
          averageActiveMembers: isObject(advancedRaw.group_size)
            ? (asNumber(advancedRaw.group_size.average_active_members) ?? 0)
            : 0,
          largestGroupActiveMembers: isObject(advancedRaw.group_size)
            ? asCount(advancedRaw.group_size.largest_group_active_members)
            : 0,
        },
      }
    : null;

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter(isObject).map((item) => ({
        code: asText(item.code),
        title: asText(item.title, "Suggestion"),
        detail: asText(item.detail),
      }))
    : [];

  return {
    access: {
      hasBasicAnalytics: access ? asBoolean(access.has_basic_analytics) : false,
      hasAdvancedAnalytics: access
        ? asBoolean(access.has_advanced_analytics)
        : false,
      currentPlanCode: access ? asText(access.current_plan_code) : "",
      matchedFeature,
    },
    basic,
    advanced,
    suggestions,
  };
}

async function getAnalyticsData(): Promise<EnvelopeResult<unknown>> {
  const endpoints = ["/api/v1/billing/analytics/", "/billing/analytics/"];
  let lastError = "Unable to load billing analytics.";

  for (const endpoint of endpoints) {
    try {
      const response = await authorizedRequest(endpoint);
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        if (!isObject(payload)) {
          return { ok: false, message: "Invalid billing analytics response." };
        }
        return { ok: true, data: payload.data };
      }

      lastError =
        getErrorMessage(payload) ?? "Billing analytics request failed.";
      if (response.status !== 404) {
        return { ok: false, message: lastError };
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Network error. Please try again.";
    }
  }

  return { ok: false, message: lastError };
}

function withDefaultPlanLimits(plan: BillingPlan): BillingPlan {
  const defaults = DEFAULT_BILLING_PLANS.find(
    (item) => item.code === plan.code.toLowerCase(),
  );
  if (!defaults) return plan;

  return {
    ...plan,
    maxGroups: plan.maxGroups ?? defaults.maxGroups,
    maxMembersPerGroup: plan.maxMembersPerGroup ?? defaults.maxMembersPerGroup,
    maxAdminsPerGroup: plan.maxAdminsPerGroup ?? defaults.maxAdminsPerGroup,
    storageGb: plan.storageGb ?? defaults.storageGb,
  };
}

function normalizeSummary(data: unknown): BillingSummary | null {
  if (!isObject(data)) return null;
  const subscription = isObject(data.subscription) ? data.subscription : null;
  const wallet = isObject(data.wallet) ? data.wallet : null;
  if (!subscription || !wallet) return null;

  const summaryPlanPayload = isObject(subscription.plan)
    ? subscription.plan
    : null;
  const normalizedSummaryPlan = summaryPlanPayload
    ? normalizePlan(summaryPlanPayload)
    : null;
  // Reached only when the summary carried no plan object - so nothing is known
  // beyond the code, and nothing is claimed.
  const fallbackPlan: BillingPlan = {
    id: asText(subscription.plan_code, "free"),
    code: asText(subscription.plan_code, "free"),
    name: asText(subscription.plan_name, "Free"),
    priceDisplay: "Custom",
    monthlyPriceCents: null,
    maxGroups: null,
    maxMembersPerGroup: null,
    maxAdminsPerGroup: null,
    storageGb: null,
    hasWhatsApp: false,
    hasTelegram: false,
    hasCalls: false,
    maxCallParticipants: null,
    hasScreenShare: false,
    hasCallRecording: false,
    callRecordingRetentionDays: null,
    features: [],
    isCustomPricing: false,
  };

  const enterpriseCreditsPayload = isObject(data.enterprise_credits)
    ? data.enterprise_credits
    : null;

  return {
    subscription: {
      plan: withDefaultPlanLimits(normalizedSummaryPlan ?? fallbackPlan),
      status: asText(subscription.status, "active"),
      currentPeriodEnd:
        asText(subscription.current_period_end) ||
        asText(subscription.renews_at) ||
        null,
      cancelAtPeriodEnd: asBoolean(subscription.cancel_at_period_end),
    },
    wallet: {
      balanceCents: asNumber(wallet.balance_cents) ?? 0,
      autoRechargeEnabled: asBoolean(wallet.auto_recharge_enabled),
      autoRechargePackage: isObject(wallet.auto_recharge_package)
        ? asText(wallet.auto_recharge_package.name) || null
        : null,
    },
    enterpriseCredits: enterpriseCreditsPayload
      ? {
          contractNumber: asText(enterpriseCreditsPayload.contract_number),
          status: asText(enterpriseCreditsPayload.status),
          balance: asCount(enterpriseCreditsPayload.balance),
          monthlyAllowance: asCount(enterpriseCreditsPayload.monthly_allowance),
        }
      : null,
  };
}

function prependDefaultPlans(plans: BillingPlan[]): BillingPlan[] {
  const codes = new Set(plans.map((plan) => plan.code.toLowerCase()));
  const defaultsToPrepend = DEFAULT_BILLING_PLANS.filter(
    (plan) => !codes.has(plan.code),
  );

  return [...defaultsToPrepend, ...plans];
}

/** The fields an ordering needs, so a caller holding the raw API shape can sort too. */
export type PlanPriceOrder = {
  monthlyPriceCents: number | null;
  isCustomPricing: boolean;
  name: string;
};

/**
 * Plans cheapest first, the way a price list is read.
 *
 * By the NUMBER, not by plan code and not by the price as it is displayed.
 * Both of those were being used, and both were wrong: a code ladder puts every
 * plan it has not been taught about in one undifferentiated bucket at the end,
 * and "$100.00/mo" sorts before "$20.00/mo" as text, because "1" is before "2".
 *
 * A custom-priced plan goes last whatever its cents say. "Custom" is not a
 * smaller number than $9 - it is the end of the ladder, the tier you talk to
 * somebody about - and a null price must never read as free. Equal prices fall
 * back to the name, so the order is at least stable between loads.
 */
export function comparePlansByPrice(
  a: PlanPriceOrder,
  b: PlanPriceOrder,
): number {
  const aCustom = a.isCustomPricing || a.monthlyPriceCents === null;
  const bCustom = b.isCustomPricing || b.monthlyPriceCents === null;

  if (aCustom !== bCustom) return aCustom ? 1 : -1;
  if (aCustom && bCustom) return a.name.localeCompare(b.name);

  const difference = (a.monthlyPriceCents ?? 0) - (b.monthlyPriceCents ?? 0);
  return difference !== 0 ? difference : a.name.localeCompare(b.name);
}

export async function fetchBillingPlans(): Promise<
  EnvelopeResult<BillingPlan[]>
> {
  const result = await getData("/billing/plans/");
  if (!result.ok) return result;

  const rows = Array.isArray(result.data) ? result.data : [];
  // Ordered here rather than by each screen that shows a price list. Three of
  // them did it themselves, and the three disagreed - the ladder a person
  // compares plans on should not depend on which screen they opened.
  return {
    ok: true,
    data: prependDefaultPlans(
      rows
        .map(normalizePlan)
        .filter((plan): plan is BillingPlan => plan !== null),
    ).sort(comparePlansByPrice),
  };
}

export async function fetchCreditPackages(): Promise<
  EnvelopeResult<CreditPackage[]>
> {
  const result = await getData("/billing/credit-packages/");
  if (!result.ok) return result;

  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows
      .map(normalizeCreditPackage)
      .filter((row): row is CreditPackage => row !== null),
  };
}

export async function fetchBillingSummary(): Promise<
  EnvelopeResult<BillingSummary>
> {
  const result = await getData("/billing/summary/");
  if (!result.ok) return result;

  const summary = normalizeSummary(result.data);
  if (!summary) return { ok: false, message: "Invalid billing summary shape." };
  return { ok: true, data: summary };
}

export async function fetchBillingAnalytics(): Promise<
  EnvelopeResult<BillingAnalytics>
> {
  const result = await getAnalyticsData();
  if (!result.ok) return result;

  const analytics = normalizeBillingAnalytics(result.data);
  if (!analytics) {
    return { ok: false, message: "Invalid billing analytics shape." };
  }

  return { ok: true, data: analytics };
}

export async function createPlanCheckoutSession(
  planCode: string,
  successUrl: string,
  cancelUrl: string,
): Promise<EnvelopeResult<{ checkoutUrl: string }>> {
  try {
    const response = await authorizedRequest("/billing/checkout/plan/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_code: planCode,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(payload) ?? "Unable to start plan checkout.",
      };
    }

    if (!isObject(payload) || !isObject(payload.data)) {
      return { ok: false, message: "Invalid checkout response." };
    }

    const checkoutUrl = asText(payload.data.checkout_url);
    if (!checkoutUrl) {
      return { ok: false, message: "Checkout URL is missing." };
    }

    return { ok: true, data: { checkoutUrl } };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function createCreditCheckoutSession(
  packageId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<EnvelopeResult<{ checkoutUrl: string }>> {
  try {
    const response = await authorizedRequest("/billing/checkout/credits/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package_id: packageId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(payload) ?? "Unable to start credit checkout.",
      };
    }

    if (!isObject(payload) || !isObject(payload.data)) {
      return { ok: false, message: "Invalid checkout response." };
    }

    const checkoutUrl = asText(payload.data.checkout_url);
    if (!checkoutUrl) {
      return { ok: false, message: "Checkout URL is missing." };
    }

    return { ok: true, data: { checkoutUrl } };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}

export async function createBillingPortalLink(
  returnUrl: string,
): Promise<EnvelopeResult<{ portalUrl: string }>> {
  try {
    const response = await authorizedRequest("/billing/portal/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ return_url: returnUrl }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(payload) ?? "Unable to open billing portal.",
      };
    }

    if (!isObject(payload) || !isObject(payload.data)) {
      return { ok: false, message: "Invalid portal response." };
    }

    const portalUrl = asText(payload.data.portal_url);
    if (!portalUrl) {
      return { ok: false, message: "Portal URL is missing." };
    }

    return { ok: true, data: { portalUrl } };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
    };
  }
}
