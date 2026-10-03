// The admin site's calls to /api/v1/admin/. Every one is behind
// `platform.access` and its area's own feature on the server; nothing here
// is the check. The request itself is lib/api/envelope.ts, shared with the
// commercial area.

import {
  apiRequest,
  asNullableNumber,
  asNullableText,
  asNumber,
  asText,
  isObject,
  isPresent,
  jsonBody,
  pageInfo,
  rowsOf,
  type ApiObject,
  type ApiResult,
} from "@/lib/api/envelope";
import type {
  CampaignStatus,
  Finding,
  GroupMatch,
  Rejection,
  ReviewAudience,
  ReviewCampaign,
  ReviewCompany,
  ReviewCreative,
  ReviewEvent,
  ReviewQueueItem,
} from "./types";

/** A call under /api/v1/admin/. */
function request(
  path: string,
  init: RequestInit = {},
  fallback: string,
): Promise<ApiResult<unknown>> {
  return apiRequest(`/admin${path}`, init, fallback);
}

function list<T>(value: unknown, normalize: (row: unknown) => T | null): T[] {
  return (Array.isArray(value) ? value : []).map(normalize).filter(isPresent);
}

// ---- Normalizers ------------------------------------------------------

function normalizeQueueItem(row: unknown): ReviewQueueItem | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    name: asText(row.name),
    objectiveLabel: asText(row.objective_label),
    status: asText(row.status, "pending_review") as CampaignStatus,
    statusLabel: asText(row.status_label),
    companyName: isObject(row.company)
      ? asText(row.company.name)
      : asText(row.company_name),
    totalBudgetCents: asNullableNumber(row.total_budget_cents),
    currency: asText(row.currency, "USD"),
    submittedAt: asNullableText(row.submitted_at),
    creativeCount: Array.isArray(row.creatives)
      ? row.creatives.length
      : asNumber(row.creative_count),
  };
}

function normalizeCompany(row: unknown): ReviewCompany {
  const company = isObject(row) ? row : {};
  return {
    id: asNumber(company.id),
    name: asText(company.name),
    status: asText(company.status),
    industryLabel: asText(company.industry_label),
    country: asText(company.country),
    countryName: asText(company.country_name, asText(company.country)),
    website: asText(company.website),
    contactEmail: asText(company.contact_email),
    owner: asText(company.owner),
  };
}

function normalizeAudience(row: unknown): ReviewAudience | null {
  if (!isObject(row)) return null;
  return {
    categories: list(row.categories, (item) =>
      isObject(item)
        ? { slug: asText(item.slug), label: asText(item.label) }
        : null,
    ),
    regions: list(row.regions, (item) =>
      isObject(item)
        ? { code: asText(item.code), name: asText(item.name) }
        : null,
    ),
    minGroupSize: asNullableNumber(row.min_group_size),
    maxGroupSize: asNullableNumber(row.max_group_size),
  };
}

function normalizeCreative(row: unknown): ReviewCreative | null {
  if (!isObject(row) || typeof row.id !== "number") return null;
  return {
    id: row.id,
    headline: asText(row.headline),
    body: asText(row.body),
    imageUrl: asNullableText(row.image_url),
    ctaLabel: asText(row.cta_label),
    ctaKind: asText(row.cta_kind, "link") as ReviewCreative["ctaKind"],
    ctaTarget: asText(row.cta_target),
    status: asText(row.status),
    reviewNotes: asText(row.review_notes),
  };
}

function normalizeEvent(row: unknown): ReviewEvent | null {
  if (!isObject(row) || typeof row.kind !== "string") return null;
  return {
    kind: row.kind,
    label: asText(row.kind_label, row.kind),
    by: asNullableText(row.by),
    note: asText(row.note),
    createdAt: asNullableText(row.created_at),
  };
}

function normalizeFinding(row: unknown): Finding | null {
  if (!isObject(row)) return null;
  return {
    code: asText(row.code),
    severity: row.severity === "blocker" ? "blocker" : "warning",
    message: asText(row.message),
    creativeId: asNullableNumber(row.creative_id),
  };
}

function normalizeCampaign(row: unknown): ReviewCampaign | null {
  const item = normalizeQueueItem(row);
  if (!item || !isObject(row)) return null;
  return {
    ...item,
    dailyBudgetCents: asNullableNumber(row.daily_budget_cents),
    cpmCents: asNullableNumber(row.cpm_cents),
    reservedCents: asNumber(row.reserved_cents),
    startsAt: asNullableText(row.starts_at),
    endsAt: asNullableText(row.ends_at),
    company: normalizeCompany(row.company),
    audience: normalizeAudience(row.targeting),
    creatives: list(row.creatives, normalizeCreative),
    events: list(row.events, normalizeEvent),
    findings: list(row.findings, normalizeFinding),
  };
}

function campaignFrom(result: ApiResult<unknown>): ApiResult<ReviewCampaign> {
  if (!result.ok) return result;
  const campaign = normalizeCampaign(result.data);
  return campaign
    ? { ok: true, data: campaign }
    : { ok: false, message: "Unexpected response from the server." };
}

// ---- Campaign review ---------------------------------------------------

export type ReviewQueuePage = {
  items: ReviewQueueItem[];
  count: number;
  hasMore: boolean;
};

/**
 * The review queue, twenty a page: waiting for review, oldest first, unless
 * `status` asks for another (or "all"). `search` matches a campaign's or its
 * company's name.
 */
export async function fetchReviewQueue({
  status = "pending_review",
  search = "",
  page = 1,
}: {
  status?: CampaignStatus | "all";
  search?: string;
  page?: number;
} = {}): Promise<ApiResult<ReviewQueuePage>> {
  const query = new URLSearchParams({ status, page: String(page) });
  if (search.trim()) query.set("search", search.trim());
  const result = await request(
    `/campaigns/?${query}`,
    {},
    "Couldn't load the review queue.",
  );
  if (!result.ok) return result;
  const items = rowsOf(result.data).map(normalizeQueueItem).filter(isPresent);
  return {
    ok: true,
    data: { items, ...pageInfo(result.data, items.length) },
  };
}

/** One campaign, with its company, the automatic checks and its history. */
export async function fetchReviewCampaign(
  campaignId: number,
): Promise<ApiResult<ReviewCampaign>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/`,
      {},
      "Couldn't load this campaign.",
    ),
  );
}

/** Approve it. Refused (409) while the automatic checks find a blocker. */
export async function approveCampaign(
  campaignId: number,
  note = "",
): Promise<ApiResult<ReviewCampaign>> {
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/approve/`,
      { method: "POST", ...jsonBody({ note }) },
      "Couldn't approve the campaign.",
    ),
  );
}

/** Send it back to the company: why, and which creatives were the problem. */
export async function rejectCampaign(
  campaignId: number,
  rejection: Rejection,
): Promise<ApiResult<ReviewCampaign>> {
  const body: ApiObject = {
    note: rejection.note,
    creatives: rejection.creatives,
  };
  return campaignFrom(
    await request(
      `/campaigns/${campaignId}/reject/`,
      { method: "POST", ...jsonBody(body) },
      "Couldn't send the campaign back.",
    ),
  );
}

/**
 * Does group `groupId` match this campaign's audience, and if not, why not -
 * each rule named. For "why isn't my ad showing there"; never shown to a
 * company.
 */
export async function checkGroupMatch(
  campaignId: number,
  groupId: number,
): Promise<ApiResult<GroupMatch>> {
  const result = await request(
    `/campaigns/${campaignId}/match/?group=${groupId}`,
    {},
    "Couldn't check that group.",
  );
  if (!result.ok) return result;
  const data = isObject(result.data) ? result.data : {};
  const group = isObject(data.group) ? data.group : {};
  return {
    ok: true,
    data: {
      group: {
        id: asNumber(group.id),
        name: asText(group.name),
        memberCount: asNumber(group.member_count),
      },
      matches: data.matches === true,
      checks: list(data.checks, (row) =>
        isObject(row)
          ? {
              code: asText(row.code),
              label: asText(row.label),
              passed: row.passed === true,
              detail: asText(row.detail),
            }
          : null,
      ),
    },
  };
}
