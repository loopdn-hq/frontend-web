import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import {
  addCreative,
  cancelCampaign,
  createCampaign,
  createCompany,
  deleteCampaign,
  deleteCreative,
  estimateReach,
  fetchActiveCompany,
  fetchCampaign,
  fetchCampaignPage,
  fetchCampaignReport,
  fetchCategories,
  fetchCompanyPage,
  fetchCompanyReport,
  fetchIndustries,
  fetchLeads,
  fetchMarkets,
  fetchPricing,
  fetchTransactions,
  increaseBudget,
  pauseCampaign,
  resumeCampaign,
  saveAudience,
  startCheckout,
  submitCampaign,
  switchActiveCompany,
  updateCampaign,
  updateCompany,
  updateCreative,
  withdrawCampaign,
} from "@/lib/commercial/api";
import { jsonResponse } from "@/test/helpers";

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function lastRequest() {
  const [path, init] = vi.mocked(authorizedRequest).mock.calls.at(-1)!;
  const request = (init ?? {}) as RequestInit;
  return {
    path: path as string,
    method: request.method,
    headers: request.headers,
    raw: request.body,
    body:
      typeof request.body === "string" ? JSON.parse(request.body) : undefined,
  };
}

const COMPANY = {
  id: 3,
  name: "Acme",
  industry: "retail",
  industry_label: "Retail",
  country: "US",
  currency: "USD",
  currency_locked: true,
  contact_email: "ads@acme.example",
  contact_phone: "+15550001111",
  website: "https://acme.example",
  address: "1 Main St",
  description: "Things.",
  logo_url: "https://cdn/logo.png",
  status: "active",
  balance_cents: 12000,
  reserved_cents: 5000,
  created_at: "2026-09-01T00:00:00Z",
};

const CAMPAIGN = {
  id: 12,
  company: 3,
  name: "Autumn sale",
  objective: "lead",
  status: "running",
  pacing: "accelerated",
  total_budget_cents: 50000,
  daily_budget_cents: null,
  currency: "USD",
  country: "US",
  cpm_cents: 800,
  reserved_cents: 50000,
  spent_cents: 1200,
  starts_at: "2026-10-10T00:00:00Z",
  ends_at: null,
  created_at: "2026-10-01T00:00:00Z",
  targeting: {
    categories: ["sports", 4],
    regions: ["US-CA"],
    min_group_size: 10,
    max_group_size: null,
  },
  creatives: [
    {
      id: 1,
      campaign: 12,
      headline: "Half off",
      body: "This week.",
      image_url: null,
      cta_label: "Shop",
      cta_kind: "form",
      cta_target: "",
      status: "approved",
      review_notes: "",
    },
    { headline: "no id" },
  ],
  events: [{ kind: "submitted", by: "sam" }, { note: "no kind" }],
  deletable: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("companies", () => {
  it("lists a page of companies", async () => {
    respond(200, {
      data: { count: 12, next: "page2", results: [COMPANY, { id: "x" }] },
    });
    const result = await fetchCompanyPage({ search: " acme ", page: 2 });

    expect(lastRequest().path).toBe("/commercial/companies/?page=2&search=acme");
    expect(result).toEqual({
      ok: true,
      data: {
        count: 12,
        hasMore: true,
        companies: [
          {
            id: 3,
            name: "Acme",
            industry: "retail",
            industryLabel: "Retail",
            country: "US",
            currency: "USD",
            currencyLocked: true,
            contactEmail: "ads@acme.example",
            contactPhone: "+15550001111",
            website: "https://acme.example",
            address: "1 Main St",
            description: "Things.",
            logoUrl: "https://cdn/logo.png",
            status: "active",
            balanceCents: 12000,
            reservedCents: 5000,
            createdAt: "2026-09-01T00:00:00Z",
          },
        ],
      },
    });
  });

  it("counts a bare list by its length", async () => {
    respond(200, { data: [{ id: 1 }] });
    const result = await fetchCompanyPage();
    expect(lastRequest().path).toBe("/commercial/companies/?page=1");
    expect(result.ok && result.data).toMatchObject({ count: 1, hasMore: false });
    expect(result.ok && result.data.companies[0]).toMatchObject({
      currency: "USD",
      status: "active",
      currencyLocked: false,
      logoUrl: null,
    });

    respond(500, {});
    expect(await fetchCompanyPage()).toMatchObject({
      ok: false,
      message: "Couldn't load your companies.",
    });
  });

  it("creates a company as JSON, under the API's field names", async () => {
    respond(201, { data: COMPANY });
    const result = await createCompany({
      name: "Acme",
      industry: "retail",
      country: "US",
      currency: "USD",
      contactEmail: "ads@acme.example",
      contactPhone: "+15550001111",
      website: "https://acme.example",
      address: "1 Main St",
      description: "Things.",
    } as never);

    expect(result.ok && result.data.id).toBe(3);
    expect(lastRequest()).toMatchObject({
      path: "/commercial/companies/",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        name: "Acme",
        industry: "retail",
        country: "US",
        currency: "USD",
        contact_email: "ads@acme.example",
        contact_phone: "+15550001111",
        website: "https://acme.example",
        address: "1 Main St",
        description: "Things.",
      },
    });
  });

  it("sends a logo as a form upload, and its removal as null", async () => {
    respond(200, { data: COMPANY });
    const logo = new File(["png"], "logo.png", { type: "image/png" });
    await updateCompany(3, { name: "Acme Ltd", logo } as never);

    const upload = lastRequest();
    expect(upload.path).toBe("/commercial/companies/3/");
    expect(upload.method).toBe("PATCH");
    expect(upload.headers).toBeUndefined();
    expect(upload.raw).toBeInstanceOf(FormData);
    expect((upload.raw as FormData).get("name")).toBe("Acme Ltd");
    expect((upload.raw as FormData).get("logo")).toBeInstanceOf(File);

    await updateCompany(3, { logo: null } as never);
    expect(lastRequest().body).toEqual({ logo: null });
  });

  it("refuses an answer that is not a company", async () => {
    respond(200, { data: { name: "no id" } });
    expect(await updateCompany(3, {})).toEqual({
      ok: false,
      message: "Unexpected response from the server.",
    });
    respond(400, { message: "Name taken.", data: { name: ["Taken."] } });
    expect(await createCompany({} as never)).toEqual({
      ok: false,
      message: "Name taken.",
      fieldErrors: { name: "Taken." },
    });
  });

  it("reads the active company, which may be none", async () => {
    respond(200, { data: null });
    expect(await fetchActiveCompany()).toEqual({ ok: true, data: null });

    respond(200, { data: COMPANY });
    const result = await fetchActiveCompany();
    expect(result.ok && result.data?.name).toBe("Acme");
    expect(lastRequest().path).toBe("/commercial/active-company/");

    respond(500, {});
    expect(await fetchActiveCompany()).toMatchObject({
      ok: false,
      message: "Couldn't load your company.",
    });
  });

  it("switches the active company", async () => {
    respond(200, { data: COMPANY });
    expect((await switchActiveCompany(3)).ok).toBe(true);
    expect(lastRequest()).toMatchObject({
      path: "/commercial/active-company/",
      method: "PUT",
      body: { company: 3 },
    });
  });
});

describe("reference lists", () => {
  it("reads the industries, labelled by slug when there is no label", async () => {
    respond(200, {
      data: [{ slug: "retail", label: "Retail" }, { slug: "food" }, { label: "x" }],
    });
    expect(await fetchIndustries()).toEqual({
      ok: true,
      data: [
        { slug: "retail", label: "Retail" },
        { slug: "food", label: "food" },
      ],
    });
    respond(500, {});
    expect(await fetchIndustries()).toMatchObject({
      message: "Couldn't load the list of industries.",
    });
  });

  it("reads the markets: countries with regions, and currencies", async () => {
    respond(200, {
      data: {
        countries: [
          {
            code: "US",
            name: "United States",
            default_currency: "USD",
            regions: [{ code: "US-CA", name: "California" }, { code: "US-NY" }, 3],
          },
          { code: "PH" },
          "junk",
        ],
        currencies: [
          { code: "USD", name: "US dollar", min_top_up_cents: 1000 },
          { code: "PHP" },
        ],
      },
    });
    expect(await fetchMarkets()).toEqual({
      ok: true,
      data: {
        countries: [
          {
            code: "US",
            name: "United States",
            defaultCurrency: "USD",
            regions: [
              { code: "US-CA", name: "California" },
              { code: "US-NY", name: "US-NY" },
            ],
          },
          { code: "PH", name: "PH", defaultCurrency: "", regions: [] },
        ],
        currencies: [
          { code: "USD", name: "US dollar", minTopUpCents: 1000 },
          { code: "PHP", name: "PHP", minTopUpCents: 0 },
        ],
      },
    });

    respond(200, { data: null });
    expect(await fetchMarkets()).toEqual({
      ok: true,
      data: { countries: [], currencies: [] },
    });
    respond(500, {});
    expect((await fetchMarkets()).ok).toBe(false);
  });

  it("reads the group categories, dropping any without a slug", async () => {
    respond(200, {
      data: { results: [{ slug: "sports", label: "Sports" }, { slug: "arts" }, {}] },
    });
    expect(await fetchCategories()).toEqual({
      ok: true,
      data: [
        { slug: "sports", label: "Sports" },
        { slug: "arts", label: "arts" },
      ],
    });
    respond(500, {});
    expect((await fetchCategories()).ok).toBe(false);
  });
});

describe("campaigns", () => {
  it("lists a company's campaigns with the filters given", async () => {
    respond(200, { data: { count: 9, next: "", results: [CAMPAIGN, null] } });
    const result = await fetchCampaignPage({
      companyId: 3,
      page: 2,
      status: "running",
      search: " sale ",
    });
    expect(lastRequest().path).toBe(
      "/commercial/campaigns/?company=3&page=2&status=running&search=sale",
    );
    expect(result.ok && result.data).toMatchObject({ count: 9, hasMore: false });
    expect(result.ok && result.data.campaigns[0]).toEqual({
      id: 12,
      companyId: 3,
      name: "Autumn sale",
      objective: "lead",
      placement: "chat",
      status: "running",
      pacing: "accelerated",
      totalBudgetCents: 50000,
      dailyBudgetCents: null,
      currency: "USD",
      country: "US",
      cpmCents: 800,
      reservedCents: 50000,
      spentCents: 1200,
      startsAt: "2026-10-10T00:00:00Z",
      endsAt: null,
      createdAt: "2026-10-01T00:00:00Z",
    });

    respond(200, { data: [{ id: 1 }] });
    const bare = await fetchCampaignPage({ companyId: 3 });
    expect(lastRequest().path).toBe("/commercial/campaigns/?company=3&page=1");
    expect(bare.ok && bare.data.campaigns[0]).toMatchObject({
      objective: "website",
      status: "draft",
      pacing: "standard",
    });
    respond(500, {});
    expect((await fetchCampaignPage({ companyId: 3 })).ok).toBe(false);
  });

  it("reads one campaign with its audience, creatives and history", async () => {
    respond(200, { data: CAMPAIGN });
    const result = await fetchCampaign(12);
    expect(lastRequest().path).toBe("/commercial/campaigns/12/");
    expect(result.ok && result.data).toMatchObject({
      id: 12,
      deletable: true,
      audience: {
        categories: ["sports"],
        regions: ["US-CA"],
        minGroupSize: 10,
        maxGroupSize: null,
      },
      creatives: [
        {
          id: 1,
          campaignId: 12,
          headline: "Half off",
          imageUrl: null,
          ctaKind: "form",
          status: "approved",
        },
      ],
      events: [
        { kind: "submitted", label: "submitted", by: "sam", note: "", createdAt: null },
      ],
    });
  });

  it("reads a campaign with nothing attached yet", async () => {
    respond(200, { data: { id: 5, targeting: { categories: "all" } } });
    const result = await fetchCampaign(5);
    expect(result.ok && result.data).toMatchObject({
      audience: { categories: [], regions: [] },
      creatives: [],
      events: [],
      deletable: false,
    });

    respond(200, { data: { id: 5 } });
    const bare = await fetchCampaign(5);
    expect(bare.ok && bare.data.audience).toBeNull();

    respond(200, { data: [] });
    expect(await fetchCampaign(5)).toEqual({
      ok: false,
      message: "Unexpected response from the server.",
    });
  });

  it("starts a campaign", async () => {
    respond(201, { data: CAMPAIGN });
    await createCampaign({ companyId: 3, objective: "lead", name: "Autumn sale" });
    expect(lastRequest()).toMatchObject({
      path: "/commercial/campaigns/",
      method: "POST",
      body: { company: 3, objective: "lead", name: "Autumn sale" },
    });
  });

  it("patches only the fields that changed", async () => {
    respond(200, { data: CAMPAIGN });
    await updateCampaign(12, { name: "Winter sale" });
    expect(lastRequest()).toMatchObject({
      path: "/commercial/campaigns/12/",
      method: "PATCH",
      body: { name: "Winter sale" },
    });

    await updateCampaign(12, {
      objective: "call",
      pacing: "standard",
      totalBudgetCents: 9000,
      dailyBudgetCents: null,
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: null,
    });
    expect(lastRequest().body).toEqual({
      objective: "call",
      pacing: "standard",
      total_budget_cents: 9000,
      daily_budget_cents: null,
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: null,
    });
  });

  it.each([
    ["submit", submitCampaign, "Couldn't submit the campaign."],
    ["withdraw", withdrawCampaign, "Couldn't withdraw the campaign."],
    ["pause", pauseCampaign, "Couldn't pause the campaign."],
    ["resume", resumeCampaign, "Couldn't resume the campaign."],
    ["cancel", cancelCampaign, "Couldn't cancel the campaign."],
  ])("posts to %s, and says what failed", async (route, action, message) => {
    respond(200, { data: CAMPAIGN });
    expect((await action(12)).ok).toBe(true);
    expect(lastRequest()).toMatchObject({
      path: `/commercial/campaigns/12/${route}/`,
      method: "POST",
    });

    respond(400, {});
    expect(await action(12)).toMatchObject({ ok: false, message });
  });

  it("deletes a campaign", async () => {
    respond(204, null);
    expect(await deleteCampaign(12)).toEqual({ ok: true, data: null });
    expect(lastRequest()).toMatchObject({
      path: "/commercial/campaigns/12/",
      method: "DELETE",
    });
    respond(400, { message: "It has already run." });
    expect(await deleteCampaign(12)).toMatchObject({
      ok: false,
      message: "It has already run.",
    });
  });

  it("raises the budget", async () => {
    respond(200, { data: CAMPAIGN });
    await increaseBudget(12, 80000);
    expect(lastRequest()).toMatchObject({
      path: "/commercial/campaigns/12/budget/",
      method: "POST",
      body: { total_budget_cents: 80000 },
    });
  });
});

describe("audience", () => {
  const audience = {
    categories: ["sports"],
    regions: ["US-CA"],
    minGroupSize: 10,
    maxGroupSize: null,
  };

  it("saves a campaign's audience", async () => {
    respond(200, { data: CAMPAIGN });
    await saveAudience(12, audience);
    expect(lastRequest()).toMatchObject({
      path: "/commercial/campaigns/12/targeting/",
      method: "PUT",
      body: {
        categories: ["sports"],
        regions: ["US-CA"],
        min_group_size: 10,
        max_group_size: null,
      },
    });
  });

  it("estimates reach, or says why it cannot", async () => {
    respond(200, {
      data: {
        available: true,
        groups: { low: 20, high: 40 },
        members: { low: 5000 },
      },
    });
    expect(await estimateReach(3, audience)).toEqual({
      ok: true,
      data: {
        available: true,
        groups: { low: 20, high: 40 },
        members: { low: 5000, high: null },
      },
    });
    expect(lastRequest().body).toMatchObject({ company: 3, categories: ["sports"] });

    respond(200, { data: { available: false, reason: "Pick a region." } });
    expect(await estimateReach(3, audience)).toEqual({
      ok: true,
      data: { available: false, reason: "Pick a region." },
    });

    respond(200, { data: null });
    expect(await estimateReach(3, audience)).toEqual({
      ok: true,
      data: { available: false, reason: "Audience is too small." },
    });

    respond(200, { data: { available: true } });
    expect(await estimateReach(3, audience)).toEqual({
      ok: true,
      data: {
        available: true,
        groups: { low: 0, high: null },
        members: { low: 0, high: null },
      },
    });

    respond(500, {});
    expect((await estimateReach(3, audience)).ok).toBe(false);
  });
});

describe("creatives", () => {
  const input = {
    headline: "Half off",
    body: "This week.",
    ctaLabel: "Shop",
    ctaTarget: "https://acme.example",
  };

  it("adds a creative as JSON", async () => {
    respond(201, { data: CAMPAIGN.creatives[0] });
    const result = await addCreative(12, input as never);
    expect(result.ok && result.data.id).toBe(1);
    expect(lastRequest()).toMatchObject({
      path: "/commercial/campaigns/12/creatives/",
      method: "POST",
      body: {
        headline: "Half off",
        body: "This week.",
        cta_label: "Shop",
        cta_target: "https://acme.example",
      },
    });
  });

  it("uploads an image as a form, and removes one with null", async () => {
    respond(200, { data: CAMPAIGN.creatives[0] });
    const image = new File(["png"], "ad.png", { type: "image/png" });
    await updateCreative(1, { headline: "New", image } as never);

    const upload = lastRequest();
    expect(upload.path).toBe("/commercial/creatives/1/");
    expect(upload.method).toBe("PATCH");
    expect((upload.raw as FormData).get("headline")).toBe("New");
    expect((upload.raw as FormData).get("image")).toBeInstanceOf(File);

    await updateCreative(1, { image: null } as never);
    expect(lastRequest().body).toEqual({ image: null });
  });

  it("refuses an answer that is not a creative, and deletes one", async () => {
    respond(200, { data: {} });
    expect(await updateCreative(1, {})).toEqual({
      ok: false,
      message: "Unexpected response from the server.",
    });
    respond(400, {});
    expect(await addCreative(12, input as never)).toMatchObject({
      message: "Couldn't add the creative.",
    });

    respond(204, null);
    expect(await deleteCreative(1)).toEqual({ ok: true, data: null });
    expect(lastRequest().method).toBe("DELETE");
    respond(400, {});
    expect(await deleteCreative(1)).toMatchObject({
      message: "Couldn't remove the creative.",
    });
  });
});

describe("money", () => {
  it("reads the price for a company, or that there is none", async () => {
    respond(200, { data: { currency: "USD", cpm_cents: 800 } });
    expect(await fetchPricing(3)).toEqual({
      ok: true,
      data: { currency: "USD", cpmCents: 800 },
    });
    expect(lastRequest().path).toBe("/commercial/pricing/?company=3");

    respond(200, { data: null });
    expect(await fetchPricing(3)).toEqual({ ok: true, data: null });
    respond(500, {});
    expect((await fetchPricing(3)).ok).toBe(false);
  });

  it("starts a checkout and returns where to send the person", async () => {
    respond(200, { data: { checkout_url: "https://checkout.stripe.com/c/1" } });
    expect(
      await startCheckout(3, {
        amountCents: 5000,
        successUrl: "https://commercial.loopdn.com/balance/?paid=1",
        cancelUrl: "https://commercial.loopdn.com/balance/",
      }),
    ).toEqual({ ok: true, data: "https://checkout.stripe.com/c/1" });
    expect(lastRequest()).toMatchObject({
      path: "/commercial/companies/3/checkout/",
      method: "POST",
      body: {
        amount_cents: 5000,
        success_url: "https://commercial.loopdn.com/balance/?paid=1",
        cancel_url: "https://commercial.loopdn.com/balance/",
      },
    });

    const input = { amountCents: 1, successUrl: "a", cancelUrl: "b" };
    respond(200, { data: {} });
    expect(await startCheckout(3, input)).toEqual({
      ok: false,
      message: "Unexpected response from the server.",
    });
    respond(200, { data: null });
    expect((await startCheckout(3, input)).ok).toBe(false);
    respond(400, { message: "Below the minimum top-up." });
    expect(await startCheckout(3, input)).toMatchObject({
      message: "Below the minimum top-up.",
    });
  });

  it("reads the ledger a page at a time", async () => {
    respond(200, {
      data: {
        next: "page2",
        results: [
          {
            id: 9,
            kind: "top_up",
            kind_label: "Top-up",
            campaign: 12,
            campaign_name: "Autumn sale",
            amount_cents: 5000,
            balance_after_cents: 17000,
            reserved_change_cents: 0,
            reserved_after_cents: 5000,
            description: "Card payment",
            created_at: "2026-10-02T00:00:00Z",
          },
          { id: 10, kind: "spend" },
          { id: 11 },
          "junk",
        ],
      },
    });
    const result = await fetchTransactions(3, 2);
    expect(lastRequest().path).toBe(
      "/commercial/companies/3/transactions/?page=2",
    );
    expect(result.ok && result.data.hasMore).toBe(true);
    expect(result.ok && result.data.transactions).toEqual([
      {
        id: 9,
        kind: "top_up",
        label: "Top-up",
        campaignId: 12,
        campaignName: "Autumn sale",
        availableChangeCents: 5000,
        availableAfterCents: 17000,
        reservedChangeCents: 0,
        reservedAfterCents: 5000,
        description: "Card payment",
        createdAt: "2026-10-02T00:00:00Z",
      },
      expect.objectContaining({ id: 10, kind: "spend", label: "spend" }),
      expect.objectContaining({ id: 11, kind: "adjustment", label: "" }),
    ]);

    respond(200, { data: [] });
    const first = await fetchTransactions(3);
    expect(lastRequest().path).toMatch(/page=1$/);
    expect(first).toEqual({
      ok: true,
      data: { transactions: [], hasMore: false },
    });
    respond(500, {});
    expect((await fetchTransactions(3)).ok).toBe(false);
  });
});

describe("reports", () => {
  const day = {
    day: "2026-10-04",
    served: 1000,
    viewed: 800,
    reach: 600,
    clicks: 40,
    results: 5,
    spend_cents: 640,
  };
  const totals = {
    served: 1000,
    viewed: 800,
    reach: null,
    clicks: 40,
    results: 5,
    spend_cents: 640,
    cost_per_1000_views_cents: 800,
    cost_per_click_cents: 16,
    cost_per_result_cents: 128,
  };

  it("reads a campaign's report", async () => {
    respond(200, {
      data: {
        currency: "USD",
        reach_shown_from: 50,
        result: "leads",
        totals,
        days: [day, "junk"],
      },
    });
    expect(await fetchCampaignReport(12)).toEqual({
      ok: true,
      data: {
        currency: "USD",
        reachShownFrom: 50,
        result: "leads",
        totals: {
          served: 1000,
          viewed: 800,
          reach: null,
          clicks: 40,
          results: 5,
          spendCents: 640,
          costPer1000ViewsCents: 800,
          costPerClickCents: 16,
          costPerResultCents: 128,
        },
        days: [
          {
            day: "2026-10-04",
            served: 1000,
            viewed: 800,
            reach: 600,
            clicks: 40,
            results: 5,
            spendCents: 640,
          },
        ],
      },
    });
    expect(lastRequest().path).toBe("/commercial/campaigns/12/report/");
  });

  it("reads an empty report as zeros, counting clicks", async () => {
    respond(200, { data: null });
    const result = await fetchCampaignReport(12);
    expect(result.ok && result.data).toMatchObject({
      currency: "",
      result: "clicks",
      days: [],
      totals: { served: 0, costPerResultCents: null },
    });
    respond(500, {});
    expect(await fetchCampaignReport(12)).toMatchObject({
      message: "Couldn't load the results.",
    });
  });

  it("reads a company's report, with a row per campaign", async () => {
    respond(200, {
      data: {
        currency: "USD",
        reach_shown_from: 50,
        totals,
        days: [day],
        campaigns: [
          {
            id: 12,
            name: "Autumn sale",
            status: "paused",
            objective: "call",
            viewed: 800,
            clicks: 40,
            reach: 600,
            spend_cents: 640,
            result: "calls",
            results: 5,
            cost_per_result_cents: 128,
          },
          { id: 13, result: "sorcery" },
          { name: "no id" },
        ],
      },
    });
    const result = await fetchCompanyReport(3);
    expect(lastRequest().path).toBe("/commercial/companies/3/report/");
    expect(result.ok && result.data.totals).toEqual({
      served: 1000,
      viewed: 800,
      clicks: 40,
      spendCents: 640,
      costPer1000ViewsCents: 800,
      costPerClickCents: 16,
    });
    expect(result.ok && result.data.campaigns).toEqual([
      {
        id: 12,
        name: "Autumn sale",
        status: "paused",
        objective: "call",
        viewed: 800,
        clicks: 40,
        reach: 600,
        spendCents: 640,
        result: "calls",
        results: 5,
        costPerResultCents: 128,
      },
      expect.objectContaining({
        id: 13,
        status: "running",
        objective: "website",
        result: "clicks",
        reach: null,
      }),
    ]);

    respond(200, { data: {} });
    const empty = await fetchCompanyReport(3);
    expect(empty.ok && empty.data).toMatchObject({ days: [], campaigns: [] });
    respond(500, {});
    expect((await fetchCompanyReport(3)).ok).toBe(false);
  });
});

describe("leads", () => {
  it("lists a company's leads, optionally for one campaign", async () => {
    respond(200, {
      data: {
        count: 30,
        next: "page2",
        results: [
          {
            id: 4,
            campaign: 12,
            campaign_name: "Autumn sale",
            name: "Sam",
            phone: "+1555",
            email: "sam@example.com",
            message: "Call me",
            created_at: "2026-10-03T00:00:00Z",
          },
          { name: "no id" },
        ],
      },
    });
    expect(await fetchLeads(3, { page: 2, campaignId: 12 })).toEqual({
      ok: true,
      data: {
        count: 30,
        hasMore: true,
        items: [
          {
            id: 4,
            campaignId: 12,
            campaignName: "Autumn sale",
            name: "Sam",
            phone: "+1555",
            email: "sam@example.com",
            message: "Call me",
            createdAt: "2026-10-03T00:00:00Z",
          },
        ],
      },
    });
    expect(lastRequest().path).toBe(
      "/commercial/companies/3/leads/?page=2&campaign=12",
    );

    respond(200, { data: [] });
    await fetchLeads(3);
    expect(lastRequest().path).toBe("/commercial/companies/3/leads/?page=1");
    respond(500, {});
    expect(await fetchLeads(3)).toMatchObject({
      message: "Couldn't load your leads.",
    });
  });
});
