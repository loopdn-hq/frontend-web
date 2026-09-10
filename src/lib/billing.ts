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
  features: string[];
  isCustomPricing: boolean;
};

export type CreditPackage = {
  id: string;
  name: string;
  priceCents: number;
  creditCents: number;
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
    features: [],
    isCustomPricing: false,
  };

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
  };
}

function prependDefaultPlans(plans: BillingPlan[]): BillingPlan[] {
  const codes = new Set(plans.map((plan) => plan.code.toLowerCase()));
  const defaultsToPrepend = DEFAULT_BILLING_PLANS.filter(
    (plan) => !codes.has(plan.code),
  );

  return [...defaultsToPrepend, ...plans];
}

export async function fetchBillingPlans(): Promise<
  EnvelopeResult<BillingPlan[]>
> {
  const result = await getData("/billing/plans/");
  if (!result.ok) return result;

  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: prependDefaultPlans(
      rows
        .map(normalizePlan)
        .filter((plan): plan is BillingPlan => plan !== null),
    ),
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
