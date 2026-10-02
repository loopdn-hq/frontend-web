// The commercial area's calls to /api/v1/commercial/.
//
// Never "ads" or "advert" in a path: ad blockers drop requests that contain
// either, which would break this dashboard for exactly the people most likely
// to run one. That is why a company is /companies/, never /advertisers/.
//
// Companies and the active company (slice 0 of backend/docs/campaigns_final_plan.md),
// and building and submitting a campaign (slice 1). Every call resolves to
// { ok: false } on any failure rather than throwing, so a page shows LoadFailed
// or the server's sentence rather than a blank screen.
//
// `authorizedRequest` lives in lib/chat for historical reasons; it is the
// app's one authenticated fetch (bearer token, refresh on 401) and is the only
// thing this area takes from lib/chat.

import { authorizedRequest } from "@/lib/chat/conversations";
import type {
  Audience,
  Company,
  CompanyInput,
  CompanyStatus,
  Campaign,
  CampaignChanges,
  CampaignDetail,
  CampaignEvent,
  CampaignObjective,
  CampaignPacing,
  CampaignStatus,
  CompanyResult,
  Creative,
  Pricing,
  Transaction,
  TransactionKind,
  CreativeCtaKind,
  CreativeInput,
  CreativeStatus,
  GroupCategory,
  Industry,
  Markets,
  ReachEstimate,
  ReachRange,
} from "./types";

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

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * A list endpoint's rows. DRF's PageNumberPagination is on by default, so a
 * list arrives as `{ count, next, previous, results }`; a bare array is
 * accepted too, for a viewset that turns pagination off.
 */
function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isObject(data) && Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * A refused form's errors, one sentence per field: DRF sends
 * `{ "contact_email": ["Enter a valid email address."] }` under `data`.
 */
function fieldErrorsOf(data: unknown): Record<string, string> | undefined {
  if (!isObject(data)) return undefined;
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(data)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") errors[field] = first;
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}

/**
 * One request, unwrapped from the {code, message, data} envelope.
 *
 * The server's `message` is shown as-is on failure: EnvelopeJSONRenderer
 * already turns a validation error into a sentence.
 */
async function request(
  path: string,
  init: RequestInit = {},
  fallback: string,
): Promise<CompanyResult<unknown>> {
  try {
    const response = await authorizedRequest(`/commercial${path}`, init);
    // A delete answers 204, with nothing to read.
    if (response.status === 204) return { ok: true, data: null };
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isObject(payload)) {
      const message = isObject(payload) ? asText(payload.message) : "";
      return {
        ok: false,
        message: message || fallback,
        fieldErrors: isObject(payload)
          ? fieldErrorsOf(payload.data)
          : undefined,
      };
    }

    return { ok: true, data: payload.data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : fallback,
    };
  }
}

function jsonBody(body: ApiObject): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---- Normalizers ------------------------------------------------------

function normalizeCompany(row: unknown): Company | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    name: asText(row.name),
    industry: asText(row.industry),
    industryLabel: asText(row.industry_label),
    country: asText(row.country),
    currency: asText(row.currency, "USD"),
    currencyLocked: row.currency_locked === true,
    contactEmail: asText(row.contact_email),
    contactPhone: asText(row.contact_phone),
    website: asText(row.website),
    address: asText(row.address),
    description: asText(row.description),
    logoUrl: asNullableText(row.logo_url),
    status: asText(row.status, "active") as CompanyStatus,
    balanceCents: asNumber(row.balance_cents),
    reservedCents: asNumber(row.reserved_cents),
    createdAt: asNullableText(row.created_at),
  };
}

function normalizeIndustry(row: unknown): Industry | null {
  if (!isObject(row) || typeof row.slug !== "string") return null;
  return { slug: row.slug, label: asText(row.label, row.slug) };
}

function normalizeMarkets(data: unknown): Markets {
  const countries =
    isObject(data) && Array.isArray(data.countries) ? data.countries : [];
  const currencies =
    isObject(data) && Array.isArray(data.currencies) ? data.currencies : [];
  return {
    countries: countries.filter(isObject).map((row) => ({
      code: asText(row.code),
      name: asText(row.name, asText(row.code)),
      defaultCurrency: asText(row.default_currency),
      regions: (Array.isArray(row.regions) ? row.regions : [])
        .filter(isObject)
        .map((region) => ({
          code: asText(region.code),
          name: asText(region.name, asText(region.code)),
        })),
    })),
    currencies: currencies.filter(isObject).map((row) => ({
      code: asText(row.code),
      name: asText(row.name, asText(row.code)),
      minTopUpCents: asNumber(row.min_top_up_cents),
    })),
  };
}

function normalizeCampaign(row: unknown): Campaign | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    companyId: asNumber(row.company),
    name: asText(row.name),
    objective: asText(row.objective, "website") as CampaignObjective,
    placement: "chat",
    status: asText(row.status, "draft") as CampaignStatus,
    pacing: asText(row.pacing, "standard") as CampaignPacing,
    totalBudgetCents: asNullableNumber(row.total_budget_cents),
    dailyBudgetCents: asNullableNumber(row.daily_budget_cents),
    currency: asText(row.currency, "USD"),
    country: asText(row.country),
    cpmCents: asNullableNumber(row.cpm_cents),
    reservedCents: asNumber(row.reserved_cents),
    spentCents: asNumber(row.spent_cents),
    startsAt: asNullableText(row.starts_at),
    endsAt: asNullableText(row.ends_at),
    createdAt: asNullableText(row.created_at),
  };
}

function normalizeAudience(row: unknown): Audience | null {
  if (!isObject(row)) return null;
  const texts = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return {
    categories: texts(row.categories),
    regions: texts(row.regions),
    minGroupSize: asNullableNumber(row.min_group_size),
    maxGroupSize: asNullableNumber(row.max_group_size),
  };
}

function normalizeCreative(row: unknown): Creative | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    campaignId: asNumber(row.campaign),
    headline: asText(row.headline),
    body: asText(row.body),
    imageUrl: asNullableText(row.image_url),
    ctaLabel: asText(row.cta_label),
    ctaKind: asText(row.cta_kind, "link") as CreativeCtaKind,
    ctaTarget: asText(row.cta_target),
    status: asText(row.status, "draft") as CreativeStatus,
    reviewNotes: asText(row.review_notes),
  };
}

function normalizeEvent(row: unknown): CampaignEvent | null {
  if (!isObject(row) || typeof row.kind !== "string") return null;
  return {
    kind: row.kind,
    label: asText(row.kind_label, row.kind),
    by: asNullableText(row.by),
    note: asText(row.note),
    createdAt: asNullableText(row.created_at),
  };
}

function normalizeCampaignDetail(row: unknown): CampaignDetail | null {
  const campaign = normalizeCampaign(row);
  if (!campaign || !isObject(row)) return null;
  return {
    ...campaign,
    audience: normalizeAudience(row.targeting),
    creatives: (Array.isArray(row.creatives) ? row.creatives : [])
      .map(normalizeCreative)
      .filter(isPresent),
    events: (Array.isArray(row.events) ? row.events : [])
      .map(normalizeEvent)
      .filter(isPresent),
    deletable: row.deletable === true,
  };
}

function normalizeTransaction(row: unknown): Transaction | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    kind: asText(row.kind, "adjustment") as TransactionKind,
    label: asText(row.kind_label, asText(row.kind)),
    campaignId: asNullableNumber(row.campaign),
    campaignName: asNullableText(row.campaign_name),
    availableChangeCents: asNumber(row.amount_cents),
    availableAfterCents: asNumber(row.balance_after_cents),
    reservedChangeCents: asNumber(row.reserved_change_cents),
    reservedAfterCents: asNumber(row.reserved_after_cents),
    description: asText(row.description),
    createdAt: asNullableText(row.created_at),
  };
}

function normalizeRange(value: unknown): ReachRange {
  const row = isObject(value) ? value : {};
  return { low: asNumber(row.low), high: asNullableNumber(row.high) };
}

function normalizeEstimate(data: unknown): ReachEstimate {
  const row = isObject(data) ? data : {};
  if (row.available !== true) {
    return {
      available: false,
      reason: asText(row.reason, "Audience is too small."),
    };
  }
  return {
    available: true,
    groups: normalizeRange(row.groups),
    members: normalizeRange(row.members),
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

// ---- Companies ------------------------------------------------------

/** One page of the person's companies, by name. */
export type CompanyPage = {
  companies: Company[];
  /** How many there are in all - matching the search, if there is one. */
  count: number;
  hasMore: boolean;
};

/**
 * The companies the signed-in person manages, ten a page, by name. `search`
 * narrows by name. The Companies dialog scrolls through the pages; the
 * dropdown only needs the first.
 */
export async function fetchCompanyPage({
  search = "",
  page = 1,
}: { search?: string; page?: number } = {}): Promise<
  CompanyResult<CompanyPage>
> {
  const query = new URLSearchParams({ page: String(page) });
  if (search.trim()) query.set("search", search.trim());

  const result = await request(
    `/companies/?${query}`,
    {},
    "Couldn't load your companies.",
  );
  if (!result.ok) return result;

  const companies = rowsOf(result.data).map(normalizeCompany).filter(isPresent);
  const data = isObject(result.data) ? result.data : {};
  return {
    ok: true,
    data: {
      companies,
      count: asNumber(data.count, companies.length),
      hasMore: typeof data.next === "string" && data.next !== "",
    },
  };
}

/**
 * The fields as the API names them. Multipart when there is a logo to
 * upload, because a file cannot travel in JSON; JSON otherwise, which is also
 * the only way to send `logo: null` and remove one.
 */
function companyBody(input: Partial<CompanyInput>): RequestInit {
  const fields: ApiObject = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.industry !== undefined) fields.industry = input.industry;
  if (input.country !== undefined) fields.country = input.country;
  if (input.currency !== undefined) fields.currency = input.currency;
  if (input.contactEmail !== undefined) {
    fields.contact_email = input.contactEmail;
  }
  if (input.website !== undefined) fields.website = input.website;
  if (input.contactPhone !== undefined) {
    fields.contact_phone = input.contactPhone;
  }
  if (input.address !== undefined) fields.address = input.address;
  if (input.description !== undefined) fields.description = input.description;

  if (input.logo instanceof File) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, String(value));
    }
    form.append("logo", input.logo);
    return { body: form };
  }

  if (input.logo === null) fields.logo = null;
  return jsonBody(fields);
}

function companyFrom(result: CompanyResult<unknown>): CompanyResult<Company> {
  if (!result.ok) return result;
  const company = normalizeCompany(result.data);
  return company
    ? { ok: true, data: company }
    : { ok: false, message: "Unexpected response from the server." };
}

/**
 * "Set up your company". The server makes the caller its owner and makes it
 * their active company, so there is nothing to switch to afterwards.
 */
export async function createCompany(
  input: CompanyInput,
): Promise<CompanyResult<Company>> {
  return companyFrom(
    await request(
      "/companies/",
      { method: "POST", ...companyBody(input) },
      "Couldn't create your company.",
    ),
  );
}

/** Only the fields given are sent. */
export async function updateCompany(
  companyId: number,
  input: Partial<CompanyInput>,
): Promise<CompanyResult<Company>> {
  return companyFrom(
    await request(
      `/companies/${companyId}/`,
      { method: "PATCH", ...companyBody(input) },
      "Couldn't save your company.",
    ),
  );
}

/**
 * The company the dashboard opens on, as the server remembers it for this
 * person - or null when they have none yet, and should set one up.
 */
export async function fetchActiveCompany(): Promise<
  CompanyResult<Company | null>
> {
  const result = await request(
    "/active-company/",
    {},
    "Couldn't load your company.",
  );
  if (!result.ok) return result;
  if (result.data === null) return { ok: true, data: null };
  return companyFrom(result);
}

/**
 * Switch to another of their companies. The server checks it is theirs: a
 * company they cannot manage is a 404, and nothing is stored.
 */
export async function switchActiveCompany(
  companyId: number,
): Promise<CompanyResult<Company>> {
  return companyFrom(
    await request(
      "/active-company/",
      { method: "PUT", ...jsonBody({ company: companyId }) },
      "Couldn't switch company.",
    ),
  );
}

export async function fetchIndustries(): Promise<CompanyResult<Industry[]>> {
  const result = await request(
    "/industries/",
    {},
    "Couldn't load the list of industries.",
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: rowsOf(result.data).map(normalizeIndustry).filter(isPresent),
  };
}

export async function fetchMarkets(): Promise<CompanyResult<Markets>> {
  const result = await request(
    "/markets/",
    {},
    "Couldn't load the list of countries.",
  );
  if (!result.ok) return result;
  return { ok: true, data: normalizeMarkets(result.data) };
}

// ---- Campaigns --------------------------------------------------------

/** One page of a company's campaigns, newest first. */
export type CampaignPage = {
  campaigns: Campaign[];
  count: number;
  hasMore: boolean;
};

/**
 * A company's campaigns, twenty a page, newest first. The company is always
 * named: the server never falls back to the active company to decide whose
 * to return. `status` narrows to one status, `search` by name.
 */
export async function fetchCampaignPage({
  companyId,
  page = 1,
  status,
  search = "",
}: {
  companyId: number;
  page?: number;
  status?: CampaignStatus;
  search?: string;
}): Promise<CompanyResult<CampaignPage>> {
  const query = new URLSearchParams({
    company: String(companyId),
    page: String(page),
  });
  if (status) query.set("status", status);
  if (search.trim()) query.set("search", search.trim());
  const result = await request(
    `/campaigns/?${query}`,
    {},
    "Couldn't load your campaigns.",
  );
  if (!result.ok) return result;

  const campaigns = rowsOf(result.data)
    .map(normalizeCampaign)
    .filter(isPresent);
  const data = isObject(result.data) ? result.data : {};
  return {
    ok: true,
    data: {
      campaigns,
      count: asNumber(data.count, campaigns.length),
      hasMore: typeof data.next === "string" && data.next !== "",
    },
  };
}

function campaignFrom(
  result: CompanyResult<unknown>,
): CompanyResult<CampaignDetail> {
  if (!result.ok) return result;
  const campaign = normalizeCampaignDetail(result.data);
  return campaign
    ? { ok: true, data: campaign }
    : { ok: false, message: "Unexpected response from the server." };
}

/** One campaign, with its audience, creatives and history. */
export async function fetchCampaign(
  campaignId: number,
): Promise<CompanyResult<CampaignDetail>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/`,
      {},
      "Couldn't load this campaign.",
    ),
  );
}

/** The builder's first step: starts a draft for the named company. */
export async function createCampaign(input: {
  companyId: number;
  objective: CampaignObjective;
  name: string;
}): Promise<CompanyResult<CampaignDetail>> {
  return campaignFrom(
    await request(
      "/campaigns/",
      {
        method: "POST",
        ...jsonBody({
          company: input.companyId,
          objective: input.objective,
          name: input.name,
        }),
      },
      "Couldn't start the campaign.",
    ),
  );
}

/** Save one builder step of a draft. Only the fields given are sent. */
export async function updateCampaign(
  campaignId: number,
  changes: CampaignChanges,
): Promise<CompanyResult<CampaignDetail>> {
  const fields: ApiObject = {};
  if (changes.name !== undefined) fields.name = changes.name;
  if (changes.objective !== undefined) fields.objective = changes.objective;
  if (changes.pacing !== undefined) fields.pacing = changes.pacing;
  if (changes.totalBudgetCents !== undefined) {
    fields.total_budget_cents = changes.totalBudgetCents;
  }
  if (changes.dailyBudgetCents !== undefined) {
    fields.daily_budget_cents = changes.dailyBudgetCents;
  }
  if (changes.startsAt !== undefined) fields.starts_at = changes.startsAt;
  if (changes.endsAt !== undefined) fields.ends_at = changes.endsAt;

  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/`,
      { method: "PATCH", ...jsonBody(fields) },
      "Couldn't save the campaign.",
    ),
  );
}

/** Delete a draft. One that has ever moved money cannot be. */
export async function deleteCampaign(
  campaignId: number,
): Promise<CompanyResult<null>> {
  const result = await request(
    `/campaigns/${campaignId}/`,
    { method: "DELETE" },
    "Couldn't delete the campaign.",
  );
  return result.ok ? { ok: true, data: null } : result;
}

function audienceBody(audience: Audience): ApiObject {
  return {
    categories: audience.categories,
    regions: audience.regions,
    min_group_size: audience.minGroupSize,
    max_group_size: audience.maxGroupSize,
  };
}

/** Save the audience step. Saving it, even as "any", marks the step done. */
export async function saveAudience(
  campaignId: number,
  audience: Audience,
): Promise<CompanyResult<CampaignDetail>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/targeting/`,
      { method: "PUT", ...jsonBody(audienceBody(audience)) },
      "Couldn't save the audience.",
    ),
  );
}

/** Ranges, or "too small" - never a count, never a group. */
export async function estimateReach(
  companyId: number,
  audience: Audience,
): Promise<CompanyResult<ReachEstimate>> {
  const result = await request(
    "/reach-estimate/",
    {
      method: "POST",
      ...jsonBody({ company: companyId, ...audienceBody(audience) }),
    },
    "Couldn't estimate the reach.",
  );
  if (!result.ok) return result;
  return { ok: true, data: normalizeEstimate(result.data) };
}

/** The group categories an audience can choose from, in the plan's order. */
export async function fetchCategories(): Promise<
  CompanyResult<GroupCategory[]>
> {
  const result = await request(
    "/categories/",
    {},
    "Couldn't load the group categories.",
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: rowsOf(result.data)
      .filter(isObject)
      .map((row) => ({
        slug: asText(row.slug),
        label: asText(row.label, asText(row.slug)),
      }))
      .filter((category) => category.slug !== ""),
  };
}

/** Multipart when there is an image to upload; JSON otherwise, as for a logo. */
function creativeBody(input: Partial<CreativeInput>): RequestInit {
  const fields: ApiObject = {};
  if (input.headline !== undefined) fields.headline = input.headline;
  if (input.body !== undefined) fields.body = input.body;
  if (input.ctaLabel !== undefined) fields.cta_label = input.ctaLabel;
  if (input.ctaTarget !== undefined) fields.cta_target = input.ctaTarget;

  if (input.image instanceof File) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, String(value));
    }
    form.append("image", input.image);
    return { body: form };
  }

  if (input.image === null) fields.image = null;
  return jsonBody(fields);
}

function creativeFrom(result: CompanyResult<unknown>): CompanyResult<Creative> {
  if (!result.ok) return result;
  const creative = normalizeCreative(result.data);
  return creative
    ? { ok: true, data: creative }
    : { ok: false, message: "Unexpected response from the server." };
}

/** Add a whole creative; the button kind follows the campaign's objective. */
export async function addCreative(
  campaignId: number,
  input: CreativeInput,
): Promise<CompanyResult<Creative>> {
  return creativeFrom(
    await request(
      `/campaigns/${campaignId}/creatives/`,
      { method: "POST", ...creativeBody(input) },
      "Couldn't add the creative.",
    ),
  );
}

export async function updateCreative(
  creativeId: number,
  input: Partial<CreativeInput>,
): Promise<CompanyResult<Creative>> {
  return creativeFrom(
    await request(
      `/creatives/${creativeId}/`,
      { method: "PATCH", ...creativeBody(input) },
      "Couldn't save the creative.",
    ),
  );
}

export async function deleteCreative(
  creativeId: number,
): Promise<CompanyResult<null>> {
  const result = await request(
    `/creatives/${creativeId}/`,
    { method: "DELETE" },
    "Couldn't remove the creative.",
  );
  return result.ok ? { ok: true, data: null } : result;
}

/**
 * Send a draft to review. When something is missing the server names every
 * piece in `fieldErrors`, keyed by step: `name`, `audience`,
 * `total_budget_cents`, `creatives` and so on.
 */
export async function submitCampaign(
  campaignId: number,
): Promise<CompanyResult<CampaignDetail>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/submit/`,
      { method: "POST" },
      "Couldn't submit the campaign.",
    ),
  );
}

/** Take a campaign back from review, to change it. */
export async function withdrawCampaign(
  campaignId: number,
): Promise<CompanyResult<CampaignDetail>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/withdraw/`,
      { method: "POST" },
      "Couldn't withdraw the campaign.",
    ),
  );
}

// ---- Money -----------------------------------------------------------

/**
 * The price per 1,000 views now, for the company's currency - for the
 * builder's "about N views". Null when Loopd'n doesn't sell in it yet. A
 * campaign's own price is fixed when it is submitted.
 */
export async function fetchPricing(
  companyId: number,
): Promise<CompanyResult<Pricing | null>> {
  const result = await request(
    `/pricing/?company=${companyId}`,
    {},
    "Couldn't load the price.",
  );
  if (!result.ok) return result;
  if (!isObject(result.data)) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      currency: asText(result.data.currency),
      cpmCents: asNumber(result.data.cpm_cents),
    },
  };
}

/**
 * Start a Stripe Checkout that adds `amountCents` to the company's balance.
 * Resolves to the page to send the person to. The balance moves only once
 * Stripe confirms the payment, never on the way back.
 */
export async function startCheckout(
  companyId: number,
  input: { amountCents: number; successUrl: string; cancelUrl: string },
): Promise<CompanyResult<string>> {
  const result = await request(
    `/companies/${companyId}/checkout/`,
    {
      method: "POST",
      ...jsonBody({
        amount_cents: input.amountCents,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
    },
    "Couldn't start the payment.",
  );
  if (!result.ok) return result;
  const url = isObject(result.data) ? asText(result.data.checkout_url) : "";
  return url
    ? { ok: true, data: url }
    : { ok: false, message: "Unexpected response from the server." };
}

export type TransactionPage = {
  transactions: Transaction[];
  hasMore: boolean;
};

/** The company's ledger, twenty a page, newest first. */
export async function fetchTransactions(
  companyId: number,
  page = 1,
): Promise<CompanyResult<TransactionPage>> {
  const result = await request(
    `/companies/${companyId}/transactions/?page=${page}`,
    {},
    "Couldn't load your transactions.",
  );
  if (!result.ok) return result;
  const data = isObject(result.data) ? result.data : {};
  return {
    ok: true,
    data: {
      transactions: rowsOf(result.data)
        .map(normalizeTransaction)
        .filter(isPresent),
      hasMore: typeof data.next === "string" && data.next !== "",
    },
  };
}

/** Raise a running or paused campaign's total budget; only ever up. */
export async function increaseBudget(
  campaignId: number,
  totalBudgetCents: number,
): Promise<CompanyResult<CampaignDetail>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/budget/`,
      {
        method: "POST",
        ...jsonBody({ total_budget_cents: totalBudgetCents }),
      },
      "Couldn't raise the budget.",
    ),
  );
}
