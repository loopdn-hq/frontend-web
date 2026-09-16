import { authorizedRequest } from "@/lib/chat/conversations";
import {
  DEFAULT_CATALOG,
  type AnalyticsTier,
  type BillingIntervalCode,
  type EnterpriseCatalog,
  type EnterpriseConfiguration,
  type PricedOption,
} from "./catalog";

// Talks to the backend endpoints in the "9. Enterprise" Postman collection
// (GET /enterprise/pricing/, the /enterprise/drafts/ family, GET
// /enterprise/billing/, GET /enterprise/credits/). Every call still fails
// gracefully - a 404 (route not deployed to this environment) or a network
// error both resolve the same friendly way, so pointing NEXT_PUBLIC_API_BASE_URL
// at a backend that hasn't shipped one of these yet degrades instead of
// throwing.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type ApiObject = Record<string, unknown>;

function isObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

const NOT_LIVE_MESSAGE =
  "Enterprise checkout isn't available right now. We've saved your configuration and a Loopd'n specialist will follow up to finalize billing.";

// ---- Pricing catalog --------------------------------------------------

function normalizePricedOptions<T extends string>(
  value: unknown,
): PricedOption<T>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item) => ({
      value: asText(item.value) as T,
      label: asText(item.label),
      priceCents: asNumber(item.price_cents),
    }))
    .filter((option) => option.value && option.label);
}

function normalizeCatalog(value: unknown): EnterpriseCatalog | null {
  if (!isObject(value)) return null;
  const limits = isObject(value.limits) ? value.limits : {};

  return {
    catalogVersion:
      typeof value.catalog_version === "number" ? value.catalog_version : null,
    currency: asText(value.currency, "usd"),
    baseFeeCents: asNumber(value.base_fee_cents),
    limits: {
      maxGroups: normalizePricedOptions(limits.max_groups),
      maxMembersPerGroup: normalizePricedOptions(limits.max_members_per_group),
      maxAdminsPerGroup: normalizePricedOptions(limits.max_admins_per_group),
      storageGb: normalizePricedOptions(limits.storage_gb),
    },
    features: Array.isArray(value.features)
      ? value.features.filter(isObject).map((item) => ({
          key: asText(item.key) as EnterpriseCatalog["features"][number]["key"],
          label: asText(item.label),
          description: asText(item.description),
          priceCents: asNumber(item.price_cents),
        }))
      : [],
    analytics: normalizePricedOptions(value.analytics),
    creditPackages: normalizePricedOptions(value.credit_packages),
    billingIntervals: Array.isArray(value.billing_intervals)
      ? value.billing_intervals.filter(isObject).map((item) => ({
          value: asText(item.value) as BillingIntervalCode,
          label: asText(item.label),
          months: asNumber(item.months, 1),
          discountPercent: asNumber(item.discount_percent),
          description: asText(item.description),
        }))
      : [],
  };
}

export type EnterprisePricingCatalogResult =
  { ok: true; catalog: EnterpriseCatalog } | { ok: false; message: string };

/**
 * The live, database-driven catalog. Falls back to DEFAULT_CATALOG (this
 * package's own PLACEHOLDER data) on any failure, so a backend that isn't
 * deployed yet - or a flaky network - degrades to an estimate instead of
 * leaving the builder with nothing to render.
 */
export async function fetchEnterprisePricingCatalog(): Promise<EnterprisePricingCatalogResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/enterprise/pricing/`);
    const payload = await response.json().catch(() => null);

    if (!response.ok || !isObject(payload)) {
      return {
        ok: false,
        message:
          getErrorMessage(payload) ?? "Unable to load Enterprise pricing.",
      };
    }

    const catalog = normalizeCatalog(payload.data);
    if (!catalog) {
      return { ok: false, message: "Invalid pricing catalog response." };
    }

    return { ok: true, catalog };
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

/** DEFAULT_CATALOG re-exported here so callers only need one import for "give me a catalog, live or not". */
export { DEFAULT_CATALOG };

// ---- Drafts -------------------------------------------------------------

export type EnterpriseDraftPricing = {
  billingInterval: BillingIntervalCode;
  periodMonths: number;
  monthlySubtotalCents: number;
  periodSubtotalCents: number;
  discountPercent: number;
  discountCents: number;
  periodTotalCents: number;
};

export type EnterpriseDraftRecord = {
  draftId: string;
  catalogVersion: number | null;
  currency: string;
  configuration: EnterpriseConfiguration;
  pricing: EnterpriseDraftPricing;
  status: string;
  expiresAt: string | null;
};

function normalizeDraftPricing(value: unknown): EnterpriseDraftPricing {
  const source = isObject(value) ? value : {};
  return {
    billingInterval: asText(
      source.billing_interval,
      "monthly",
    ) as BillingIntervalCode,
    periodMonths: asNumber(source.period_months, 1),
    monthlySubtotalCents: asNumber(source.monthly_subtotal_cents),
    periodSubtotalCents: asNumber(source.period_subtotal_cents),
    discountPercent: asNumber(source.discount_percent),
    discountCents: asNumber(source.discount_cents),
    periodTotalCents: asNumber(source.period_total_cents),
  };
}

/** Validates the nested shape rather than trusting a bare cast - this crosses a network boundary either way (a saved draft or a frozen contract's snapshot). */
function normalizeConfiguration(
  value: unknown,
): EnterpriseConfiguration | null {
  if (!isObject(value)) return null;
  const limits = isObject(value.limits) ? value.limits : null;
  const features = isObject(value.features) ? value.features : null;
  const credits = isObject(value.credits) ? value.credits : null;
  if (!limits || !features || !credits) return null;

  return {
    type: "plan",
    code: "enterprise",
    billing_interval: asText(
      value.billing_interval,
      "monthly",
    ) as BillingIntervalCode,
    limits: {
      max_groups: asNumber(limits.max_groups),
      max_members_per_group: asNumber(limits.max_members_per_group),
      max_admins_per_group: asNumber(limits.max_admins_per_group),
      storage_gb: asNumber(limits.storage_gb),
    },
    features: {
      extended_message_history: Boolean(features.extended_message_history),
      search: Boolean(features.search),
      advanced_notifications: Boolean(features.advanced_notifications),
      moderation_tools: Boolean(features.moderation_tools),
      analytics: asText(features.analytics, "none") as AnalyticsTier,
    },
    credits: {
      monthly_messages: asNumber(credits.monthly_messages),
    },
  };
}

function normalizeDraft(value: unknown): EnterpriseDraftRecord | null {
  if (!isObject(value)) return null;
  const draftId = asText(value.draft_id);
  if (!draftId) return null;

  return {
    draftId,
    catalogVersion:
      typeof value.catalog_version === "number" ? value.catalog_version : null,
    currency: asText(value.currency, "usd"),
    configuration:
      normalizeConfiguration(value.configuration) ??
      (value.configuration as EnterpriseConfiguration),
    pricing: normalizeDraftPricing(value.pricing),
    status: asText(value.status, "draft"),
    expiresAt: value.expires_at ? asText(value.expires_at) : null,
  };
}

export type EnterpriseDraftResult =
  | { ok: true; draft: EnterpriseDraftRecord }
  | { ok: false; message: string; notLive?: boolean };

async function parseDraftResponse(
  response: Response,
): Promise<EnterpriseDraftResult> {
  if (response.status === 404) {
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload) || !isObject(payload.data)) {
    return {
      ok: false,
      message: getErrorMessage(payload) ?? "Unable to reach the draft.",
    };
  }

  const draft = normalizeDraft(payload.data);
  if (!draft) return { ok: false, message: "Invalid draft response." };
  return { ok: true, draft };
}

/**
 * Validates `configuration` against the active catalog and calculates its
 * authoritative price. Anonymous-allowed - omit `draftId` to create a new
 * draft, pass one back to update it. Authenticated requests attach the
 * account immediately, so a caller that's already signed in never needs
 * attachEnterpriseDraft() for a draft it just created itself.
 */
export async function saveEnterpriseDraftRemote(
  configuration: EnterpriseConfiguration,
  draftId?: string,
): Promise<EnterpriseDraftResult> {
  try {
    const response = await authorizedRequest("/enterprise/drafts/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        draftId ? { draft_id: draftId, configuration } : { configuration },
      ),
    });
    return await parseDraftResponse(response);
  } catch {
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }
}

/** Owner-scoped read of one draft - by account if signed in, by the anonymous session that created it otherwise. */
export async function getEnterpriseDraft(
  draftId: string,
): Promise<EnterpriseDraftResult> {
  try {
    const response = await authorizedRequest(
      `/enterprise/drafts/${encodeURIComponent(draftId)}/`,
    );
    return await parseDraftResponse(response);
  } catch {
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }
}

/** Links an anonymous draft to the now-signed-in caller's account. Idempotent if it's already theirs; 403 if it's someone else's. */
export async function attachEnterpriseDraft(
  draftId: string,
): Promise<EnterpriseDraftResult> {
  try {
    const response = await authorizedRequest(
      `/enterprise/drafts/${encodeURIComponent(draftId)}/attach/`,
      { method: "POST" },
    );
    return await parseDraftResponse(response);
  } catch {
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }
}

// ---- Checkout -------------------------------------------------------

export type EnterpriseInvoiceLineItem = {
  description: string;
  amountCents: number;
};

/**
 * The backend's authoritative pricing, shaped like the Stripe invoice it's
 * drawn from - this is what replaces the frontend's own estimate once
 * checkout is created, not just another copy of it.
 */
export type EnterpriseInvoicePreview = {
  currency: string;
  billingInterval: BillingIntervalCode;
  lineItems: EnterpriseInvoiceLineItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** Stripe's own invoice id, if the backend created one ahead of checkout. */
  stripeInvoiceId?: string;
};

function normalizeLineItem(value: unknown): EnterpriseInvoiceLineItem | null {
  if (!isObject(value)) return null;
  const description = asText(value.description);
  if (!description) return null;
  return { description, amountCents: asNumber(value.amount_cents) };
}

function normalizeInvoice(value: unknown): EnterpriseInvoicePreview | null {
  if (!isObject(value)) return null;

  const lineItems = Array.isArray(value.line_items)
    ? value.line_items
        .map(normalizeLineItem)
        .filter((item): item is EnterpriseInvoiceLineItem => item !== null)
    : [];

  return {
    currency: asText(value.currency, "usd"),
    billingInterval: asText(
      value.billing_interval,
      "monthly",
    ) as BillingIntervalCode,
    lineItems,
    subtotalCents: asNumber(value.subtotal_cents),
    discountCents: asNumber(value.discount_cents),
    totalCents: asNumber(value.total_cents),
    stripeInvoiceId: value.stripe_invoice_id
      ? asText(value.stripe_invoice_id)
      : undefined,
  };
}

export type EnterpriseCheckoutResult =
  | {
      ok: true;
      /** The backend's own draft id - persist via setRemoteDraftId() so the next submit updates rather than 404s. */
      draftId: string;
      checkoutUrl: string;
      invoice: EnterpriseInvoicePreview;
      contractId: string;
      contractNumber: string;
    }
  | { ok: false; message: string; notLive?: boolean };

/**
 * Sends the configuration to the backend for authoritative pricing (the
 * frontend catalog is an estimate only - see calculateEnterprisePrice), then
 * requests a Stripe Checkout session for the resulting draft. The backend
 * returns both the invoice it calculated (for the user to review) and the
 * Checkout URL to send them to once they confirm - the caller shows the
 * invoice first rather than redirecting immediately.
 *
 * `remoteDraftId` must be omitted on the very first submit for a given draft
 * - `POST /enterprise/drafts/` only UPDATES an existing draft when given an
 * id, and 404s on one it's never seen (it does not adopt a client-chosen id
 * as a new draft). Pass it on every submit after the first, using the
 * `draftId` this function returns, so subsequent submits update that same
 * draft instead of failing.
 *
 * A 409 here means the draft's selections are stale against the current
 * catalog (something it picked is no longer active) - the backend's
 * `message` for that case is written to be shown directly to the user.
 *
 * Requires an authenticated caller; the builder page only offers this once
 * signed in.
 *
 * `successUrl`/`cancelUrl` should be built from `window.location.origin` by
 * the caller (same convention as createPlanCheckoutSession() in lib/billing.ts)
 * - that's what makes them correct per environment with no config needed:
 * origin is already localhost in dev, the staging host on staging, and the
 * production host in production.
 */
export async function submitEnterpriseConfiguration(
  configuration: EnterpriseConfiguration,
  remoteDraftId: string | undefined,
  successUrl: string,
  cancelUrl: string,
): Promise<EnterpriseCheckoutResult> {
  try {
    const draftResponse = await authorizedRequest("/enterprise/drafts/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        remoteDraftId
          ? { draft_id: remoteDraftId, configuration }
          : { configuration },
      ),
    });

    if (draftResponse.status === 404) {
      return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
    }

    const draftPayload = await draftResponse.json().catch(() => null);
    if (
      !draftResponse.ok ||
      !isObject(draftPayload) ||
      !isObject(draftPayload.data)
    ) {
      return {
        ok: false,
        message:
          getErrorMessage(draftPayload) ??
          "Unable to save your configuration. Please try again.",
      };
    }

    const savedDraftId = asText(
      draftPayload.data.draft_id,
      remoteDraftId ?? "",
    );
    if (!savedDraftId) {
      return { ok: false, message: "Draft id is missing from the response." };
    }

    const checkoutResponse = await authorizedRequest(
      `/enterprise/drafts/${encodeURIComponent(savedDraftId)}/checkout/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      },
    );

    if (checkoutResponse.status === 404) {
      return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
    }

    const checkoutPayload = await checkoutResponse.json().catch(() => null);
    if (
      !checkoutResponse.ok ||
      !isObject(checkoutPayload) ||
      !isObject(checkoutPayload.data)
    ) {
      return {
        ok: false,
        message:
          getErrorMessage(checkoutPayload) ??
          "Unable to start checkout. Please try again.",
      };
    }

    const checkoutUrl = asText(checkoutPayload.data.checkout_url);
    if (!checkoutUrl) {
      return { ok: false, message: "Checkout URL is missing." };
    }

    const invoice = normalizeInvoice(checkoutPayload.data.invoice);
    if (!invoice) {
      return { ok: false, message: "Invoice details are missing." };
    }

    return {
      ok: true,
      draftId: savedDraftId,
      checkoutUrl,
      invoice,
      contractId: asText(checkoutPayload.data.contract_id),
      contractNumber: asText(checkoutPayload.data.contract_number),
    };
  } catch {
    // Covers the backend being entirely unreachable for this route family -
    // same user-facing outcome as a 404, so it gets the same message.
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }
}

// ---- Billing status & credits -----------------------------------------

export type EnterpriseBillingContract = {
  contractNumber: string;
  billingInterval: BillingIntervalCode;
  status: string;
  /**
   * The frozen limits/features/credits this contract entitles the account
   * to - null if the backend response doesn't include it yet. This is what
   * actually needs to be applied app-wide (group/member/admin limits,
   * enabled features); `pricing` below is billing detail, not entitlement.
   */
  configuration: EnterpriseConfiguration | null;
  pricing: {
    currency: string;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    lineItems: EnterpriseInvoiceLineItem[];
  };
  stripeStatus: string;
};

export type EnterpriseBillingStatusResult =
  | { ok: true; contract: EnterpriseBillingContract | null }
  | { ok: false; message: string; notLive?: boolean };

/** The caller's current Enterprise contract, if any - `contract` is null rather than a 404 when they've never checked one out. */
export async function fetchEnterpriseBillingStatus(): Promise<EnterpriseBillingStatusResult> {
  try {
    const response = await authorizedRequest("/enterprise/billing/");

    if (response.status === 404) {
      return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !isObject(payload) || !isObject(payload.data)) {
      return {
        ok: false,
        message: getErrorMessage(payload) ?? "Unable to load billing status.",
      };
    }

    const contractValue = payload.data.contract;
    if (!isObject(contractValue)) return { ok: true, contract: null };

    const pricing = isObject(contractValue.pricing)
      ? contractValue.pricing
      : {};
    const lineItems = Array.isArray(pricing.line_items)
      ? pricing.line_items
          .map(normalizeLineItem)
          .filter((item): item is EnterpriseInvoiceLineItem => item !== null)
      : [];

    return {
      ok: true,
      contract: {
        contractNumber: asText(contractValue.contract_number),
        billingInterval: asText(
          contractValue.billing_interval,
          "monthly",
        ) as BillingIntervalCode,
        status: asText(contractValue.status),
        // Accepts either field name since this isn't confirmed in the
        // documented contract yet - see the note on EnterpriseBillingContract.
        configuration:
          normalizeConfiguration(contractValue.configuration) ??
          normalizeConfiguration(contractValue.configuration_snapshot),
        pricing: {
          currency: asText(pricing.currency, "usd"),
          subtotalCents: asNumber(pricing.subtotal_cents),
          discountCents: asNumber(pricing.discount_cents),
          totalCents: asNumber(pricing.total_cents),
          lineItems,
        },
        stripeStatus: asText(contractValue.stripe_status),
      },
    };
  } catch {
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }
}

export type EnterpriseCreditLedgerEntry = {
  id: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type EnterpriseCreditsSummary = {
  balance: number;
  ledger: EnterpriseCreditLedgerEntry[];
  nextPage: string | null;
};

export type EnterpriseCreditsResult =
  | { ok: true; credits: EnterpriseCreditsSummary }
  | { ok: false; message: string; notLive?: boolean };

/** Current credit balance and its ledger. A caller with no Enterprise contract yet gets a zero balance and empty ledger, not a 404. */
export async function fetchEnterpriseCredits(): Promise<EnterpriseCreditsResult> {
  try {
    const response = await authorizedRequest("/enterprise/credits/");

    if (response.status === 404) {
      return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !isObject(payload) || !isObject(payload.data)) {
      return {
        ok: false,
        message: getErrorMessage(payload) ?? "Unable to load credit balance.",
      };
    }

    const ledgerValue = isObject(payload.data.ledger)
      ? payload.data.ledger
      : {};
    const results = Array.isArray(ledgerValue.results)
      ? ledgerValue.results
      : [];

    return {
      ok: true,
      credits: {
        balance: asNumber(payload.data.balance),
        ledger: results.filter(isObject).map((entry) => ({
          id: asText(entry.id),
          transactionType: asText(entry.transaction_type),
          amount: asNumber(entry.amount),
          balanceAfter: asNumber(entry.balance_after),
          referenceType: asText(entry.reference_type),
          referenceId: asText(entry.reference_id),
          createdAt: asText(entry.created_at),
        })),
        nextPage: ledgerValue.next ? asText(ledgerValue.next) : null,
      },
    };
  } catch {
    return { ok: false, message: NOT_LIVE_MESSAGE, notLive: true };
  }
}
