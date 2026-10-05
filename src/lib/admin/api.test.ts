import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  approveCampaign,
  checkGroupMatch,
  fetchReviewCampaign,
  fetchReviewQueue,
  rejectCampaign,
} from "@/lib/admin/api";
import { authorizedRequest } from "@/lib/chat/conversations";
import { jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [path, init] = vi.mocked(authorizedRequest).mock.calls.at(-1)!;
  const request = (init ?? {}) as RequestInit;
  return {
    path,
    method: request.method,
    body: JSON.parse((request.body as string) ?? "null"),
  };
}

const CAMPAIGN = {
  id: 12,
  name: "Autumn sale",
  objective_label: "Website visits",
  status: "pending_review",
  status_label: "Pending review",
  company: {
    id: 3,
    name: "Acme",
    status: "active",
    industry_label: "Retail",
    country: "US",
    country_name: "United States",
    website: "https://acme.example",
    contact_email: "ads@acme.example",
    owner: "sam",
  },
  total_budget_cents: 50000,
  daily_budget_cents: 5000,
  cpm_cents: 800,
  reserved_cents: 50000,
  currency: "USD",
  submitted_at: "2026-10-01T10:00:00Z",
  starts_at: "2026-10-10T00:00:00Z",
  ends_at: null,
  targeting: {
    categories: [{ slug: "sports", label: "Sports" }, "junk"],
    regions: [{ code: "US-CA", name: "California" }, 4],
    min_group_size: 10,
    max_group_size: null,
  },
  creatives: [
    {
      id: 1,
      headline: "Half off",
      body: "This week.",
      image_url: "https://cdn/a.png",
      cta_label: "Shop",
      cta_kind: "link",
      cta_target: "https://acme.example",
      status: "pending_review",
      review_notes: "",
    },
    { headline: "no id" },
  ],
  events: [
    {
      kind: "submitted",
      kind_label: "Submitted",
      by: "sam",
      note: "",
      created_at: "2026-10-01T10:00:00Z",
    },
    { kind: "edited" },
    { note: "no kind" },
  ],
  findings: [
    {
      code: "link_dead",
      severity: "blocker",
      message: "Dead link.",
      creative_id: 1,
    },
    { code: "short", severity: "odd", message: "Short." },
    "junk",
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchReviewQueue", () => {
  it("asks for what is waiting, first page, by default", async () => {
    respond(200, {
      data: {
        count: 31,
        next: "https://api/admin/campaigns/?page=2",
        results: [CAMPAIGN, { id: "x" }],
      },
    });
    const result = await fetchReviewQueue();

    expect(lastRequest().path).toBe(
      "/admin/campaigns/?status=pending_review&page=1",
    );
    expect(result).toEqual({
      ok: true,
      data: {
        count: 31,
        hasMore: true,
        items: [
          {
            id: 12,
            name: "Autumn sale",
            objectiveLabel: "Website visits",
            status: "pending_review",
            statusLabel: "Pending review",
            companyName: "Acme",
            totalBudgetCents: 50000,
            currency: "USD",
            submittedAt: "2026-10-01T10:00:00Z",
            creativeCount: 2,
          },
        ],
      },
    });
  });

  it("sends the status, page and a trimmed search", async () => {
    respond(200, { data: [] });
    await fetchReviewQueue({ status: "all", search: "  acme ", page: 3 });
    expect(lastRequest().path).toBe(
      "/admin/campaigns/?status=all&page=3&search=acme",
    );
  });

  it("reads a row from the flat list shape too", async () => {
    respond(200, {
      data: [{ id: 5, company_name: "Globex", creative_count: 4 }],
    });
    const result = await fetchReviewQueue();
    expect(result.ok && result.data.items[0]).toEqual({
      id: 5,
      name: "",
      objectiveLabel: "",
      status: "pending_review",
      statusLabel: "",
      companyName: "Globex",
      totalBudgetCents: null,
      currency: "USD",
      submittedAt: null,
      creativeCount: 4,
    });
    expect(result.ok && result.data.count).toBe(1);
    expect(result.ok && result.data.hasMore).toBe(false);
  });

  it("passes a failed load through", async () => {
    respond(403, { message: "Admins only." });
    expect(await fetchReviewQueue()).toMatchObject({
      ok: false,
      message: "Admins only.",
    });
    respond(500, {});
    expect(await fetchReviewQueue()).toMatchObject({
      ok: false,
      message: "Couldn't load the review queue.",
    });
  });
});

describe("fetchReviewCampaign", () => {
  it("reads everything a reviewer needs", async () => {
    respond(200, { data: CAMPAIGN });
    const result = await fetchReviewCampaign(12);
    expect(lastRequest().path).toBe("/admin/campaigns/12/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.company).toEqual({
      id: 3,
      name: "Acme",
      status: "active",
      industryLabel: "Retail",
      country: "US",
      countryName: "United States",
      website: "https://acme.example",
      contactEmail: "ads@acme.example",
      owner: "sam",
    });
    expect(result.data.audience).toEqual({
      categories: [{ slug: "sports", label: "Sports" }],
      regions: [{ code: "US-CA", name: "California" }],
      minGroupSize: 10,
      maxGroupSize: null,
    });
    expect(result.data.creatives).toHaveLength(1);
    expect(result.data.creatives[0]).toMatchObject({
      id: 1,
      imageUrl: "https://cdn/a.png",
      ctaKind: "link",
    });
    expect(result.data.events).toEqual([
      {
        kind: "submitted",
        label: "Submitted",
        by: "sam",
        note: "",
        createdAt: "2026-10-01T10:00:00Z",
      },
      { kind: "edited", label: "edited", by: null, note: "", createdAt: null },
    ]);
    expect(result.data.findings).toEqual([
      {
        code: "link_dead",
        severity: "blocker",
        message: "Dead link.",
        creativeId: 1,
      },
      {
        code: "short",
        severity: "warning",
        message: "Short.",
        creativeId: null,
      },
    ]);
    expect(result.data).toMatchObject({
      dailyBudgetCents: 5000,
      cpmCents: 800,
      reservedCents: 50000,
      startsAt: "2026-10-10T00:00:00Z",
      endsAt: null,
    });
  });

  it("fills in a sparse campaign rather than failing", async () => {
    respond(200, { data: { id: 2, company: { country: "PH" } } });
    const result = await fetchReviewCampaign(2);
    expect(result.ok && result.data.company).toMatchObject({
      id: 0,
      country: "PH",
      countryName: "PH",
    });
    expect(result.ok && result.data.audience).toBeNull();
    expect(result.ok && result.data.creatives).toEqual([]);

    respond(200, { data: { id: 2 } });
    const bare = await fetchReviewCampaign(2);
    expect(bare.ok && bare.data.company.name).toBe("");
  });

  it("refuses an answer that is not a campaign", async () => {
    respond(200, { data: { name: "no id" } });
    expect(await fetchReviewCampaign(12)).toEqual({
      ok: false,
      message: "Unexpected response from the server.",
    });
    respond(404, {});
    expect(await fetchReviewCampaign(12)).toMatchObject({
      ok: false,
      message: "Couldn't load this campaign.",
    });
  });
});

describe("deciding a campaign", () => {
  it("approves with a note, empty when none is given", async () => {
    respond(200, { data: CAMPAIGN });
    expect((await approveCampaign(12)).ok).toBe(true);
    expect(lastRequest()).toEqual({
      path: "/admin/campaigns/12/approve/",
      method: "POST",
      body: { note: "" },
    });

    await approveCampaign(12, "Looks good");
    expect(lastRequest().body).toEqual({ note: "Looks good" });
  });

  it("sends a rejection with the reason for each creative", async () => {
    respond(200, { data: CAMPAIGN });
    const rejection = {
      note: "Fix the link.",
      creatives: [{ id: 1, note: "Dead link." }],
    };
    expect((await rejectCampaign(12, rejection as never)).ok).toBe(true);
    expect(lastRequest()).toEqual({
      path: "/admin/campaigns/12/reject/",
      method: "POST",
      body: rejection,
    });
  });

  it("shows why a decision was refused", async () => {
    respond(400, { message: "Already approved." });
    expect(await approveCampaign(12)).toMatchObject({
      ok: false,
      message: "Already approved.",
    });
    respond(400, {});
    expect(
      await rejectCampaign(12, { note: "", creatives: [] } as never),
    ).toMatchObject({ ok: false, message: "Couldn't send the campaign back." });
  });
});

describe("checkGroupMatch", () => {
  it("reads each check for a group against the campaign's audience", async () => {
    respond(200, {
      data: {
        group: { id: 9, name: "Runners", member_count: 42 },
        matches: true,
        checks: [
          {
            code: "size",
            label: "Group size",
            passed: true,
            detail: "42 members",
          },
          { code: "region", label: "Region", passed: "yes" },
          null,
        ],
      },
    });
    expect(await checkGroupMatch(12, 9)).toEqual({
      ok: true,
      data: {
        group: { id: 9, name: "Runners", memberCount: 42 },
        matches: true,
        checks: [
          {
            code: "size",
            label: "Group size",
            passed: true,
            detail: "42 members",
          },
          { code: "region", label: "Region", passed: false, detail: "" },
        ],
      },
    });
    expect(lastRequest().path).toBe("/admin/campaigns/12/match/?group=9");
  });

  it("reads an empty answer as no match, and passes a failure through", async () => {
    respond(200, { data: null });
    expect(await checkGroupMatch(12, 9)).toEqual({
      ok: true,
      data: {
        group: { id: 0, name: "", memberCount: 0 },
        matches: false,
        checks: [],
      },
    });
    respond(404, {});
    expect(await checkGroupMatch(12, 9)).toMatchObject({
      ok: false,
      message: "Couldn't check that group.",
    });
  });
});
