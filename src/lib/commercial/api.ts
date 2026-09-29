// The commercial area's calls to /api/v1/commercial/.
//
// Never "ads" or "advert" in a path: ad blockers drop requests that contain
// either, which would break this dashboard for exactly the people most likely
// to run one. That is why a company is /companies/, never /advertisers/.
//
// Companies, the active company, industries and markets are live (slice 0 of
// backend/docs/campaigns_final_plan.md). The campaign routes are not built
// yet; their calls resolve to { ok: false } on the 404, like every call here on
// any failure, so a page shows LoadFailed rather than a blank screen.
//
// `authorizedRequest` lives in lib/chat for historical reasons; it is the
// app's one authenticated fetch (bearer token, refresh on 401) and is the only
// thing this area takes from lib/chat.

import { authorizedRequest } from "@/lib/chat/conversations";
import type {
  Company,
  CompanyInput,
  CompanyStatus,
  Campaign,
  CampaignObjective,
  CampaignPacing,
  CampaignStatus,
  CompanyResult,
  Industry,
  Markets,
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
    })),
    currencies: currencies.filter(isObject).map((row) => ({
      code: asText(row.code),
      name: asText(row.name, asText(row.code)),
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
    status: asText(row.status, "draft") as CampaignStatus,
    pacing: asText(row.pacing, "standard") as CampaignPacing,
    totalBudgetCents: asNumber(row.total_budget_cents),
    dailyBudgetCents: asNullableNumber(row.daily_budget_cents),
    startsAt: asNullableText(row.starts_at),
    endsAt: asNullableText(row.ends_at),
    createdAt: asNullableText(row.created_at),
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

export async function fetchCampaigns(
  companyId: number,
): Promise<CompanyResult<Campaign[]>> {
  const result = await request(
    `/campaigns/?company=${companyId}`,
    {},
    "Couldn't load your campaigns.",
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: rowsOf(result.data).map(normalizeCampaign).filter(isPresent),
  };
}

export async function fetchCampaign(
  campaignId: number,
): Promise<CompanyResult<Campaign>> {
  const result = await request(
    `/campaigns/${campaignId}/`,
    {},
    "Couldn't load this campaign.",
  );
  if (!result.ok) return result;
  const campaign = normalizeCampaign(result.data);
  return campaign
    ? { ok: true, data: campaign }
    : { ok: false, message: "Unexpected response from the server." };
}
