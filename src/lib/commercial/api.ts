// The commercial area's calls to /api/v1/promote/.
//
// The pages are /commercial/ but the API is the backend's, and it is /promote/:
// "promote", never "ads" or "advert", because ad blockers drop request paths
// that contain either - which would break this dashboard for exactly the
// people most likely to run one. Neither side may ever use those words in a
// path.
//
// THE BACKEND ROUTES DO NOT EXIST YET (ads/viewsets/ is empty). The paths
// below are the contract proposed in docs/commercial-dashboard.md. Every call
// resolves to { ok: false } on a 404 or a network error rather than throwing,
// so the dashboard shows LoadFailed until the API ships instead of a blank page.
//
// `authorizedRequest` lives in lib/chat for historical reasons; it is the
// app's one authenticated fetch (bearer token, refresh on 401) and is the only
// thing this area takes from lib/chat.

import { authorizedRequest } from "@/lib/chat/conversations";
import type {
  Company,
  CompanyStatus,
  Campaign,
  CampaignObjective,
  CampaignPacing,
  CampaignStatus,
  CompanyResult,
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
    const response = await authorizedRequest(`/promote${path}`, init);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isObject(payload)) {
      const message = isObject(payload) ? asText(payload.message) : "";
      return { ok: false, message: message || fallback };
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
    website: asText(row.website),
    contactEmail: asText(row.contact_email),
    status: asText(row.status, "pending") as CompanyStatus,
    balanceCents: asNumber(row.balance_cents),
    createdAt: asNullableText(row.created_at),
  };
}

function normalizeCampaign(row: unknown): Campaign | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    companyId: asNumber(row.advertiser),
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

/** Every company the signed-in person owns. Usually one. */
export async function fetchCompanies(): Promise<CompanyResult<Company[]>> {
  const result = await request(
    "/advertisers/",
    {},
    "Couldn't load your company.",
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: rowsOf(result.data).map(normalizeCompany).filter(isPresent),
  };
}

export async function createCompany(input: {
  name: string;
  website: string;
  contactEmail: string;
}): Promise<CompanyResult<Company>> {
  const result = await request(
    "/advertisers/",
    {
      method: "POST",
      ...jsonBody({
        name: input.name,
        website: input.website,
        contact_email: input.contactEmail,
      }),
    },
    "Couldn't create your company.",
  );
  if (!result.ok) return result;
  const company = normalizeCompany(result.data);
  return company
    ? { ok: true, data: company }
    : { ok: false, message: "Unexpected response from the server." };
}

// ---- Campaigns --------------------------------------------------------

export async function fetchCampaigns(
  companyId: number,
): Promise<CompanyResult<Campaign[]>> {
  const result = await request(
    `/campaigns/?advertiser=${companyId}`,
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
