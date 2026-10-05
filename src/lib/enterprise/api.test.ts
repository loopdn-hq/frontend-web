import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import { setHttp } from "@/lib/config/http";
import {
  attachEnterpriseDraft,
  DEFAULT_CATALOG,
  fetchEnterpriseBillingStatus,
  fetchEnterpriseCredits,
  fetchEnterprisePricingCatalog,
  getEnterpriseDraft,
  saveEnterpriseDraftRemote,
  submitEnterpriseConfiguration,
} from "@/lib/enterprise/api";
import { DEFAULT_CONFIGURATION } from "@/lib/enterprise/catalog";
import { brokenResponse, jsonResponse } from "@/test/helpers";

const http = vi.fn();

function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue(jsonResponse(status, body));
}

function requests() {
  return vi.mocked(authorizedRequest).mock.calls.map(([path, init]) => ({
    path: path as string,
    method: (init as RequestInit | undefined)?.method,
    body: JSON.parse(
      ((init as RequestInit | undefined)?.body as string) ?? "null",
    ),
  }));
}

const NOT_LIVE = {
  ok: false,
  notLive: true,
  message: expect.stringContaining("Enterprise checkout isn't available"),
};

const DRAFT = {
  draft_id: "remote_1",
  catalog_version: 4,
  currency: "usd",
  configuration: DEFAULT_CONFIGURATION,
  pricing: {
    billing_interval: "annual",
    period_months: 12,
    monthly_subtotal_cents: 16300,
    period_subtotal_cents: 195600,
    discount_percent: 15,
    discount_cents: 29340,
    period_total_cents: 166260,
  },
  status: "draft",
  expires_at: "2026-11-05T00:00:00Z",
};

const INVOICE = {
  currency: "usd",
  billing_interval: "annual",
  line_items: [
    { description: "Enterprise base fee", amount_cents: 72000 },
    { amount_cents: 5 },
    "junk",
  ],
  subtotal_cents: 195600,
  discount_cents: 29340,
  total_cents: 166260,
  stripe_invoice_id: "in_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  setHttp(http as never);
});

afterEach(() => {
  setHttp((...args) => globalThis.fetch(...args));
});

describe("fetchEnterprisePricingCatalog", () => {
  it("reads the catalogue the server prices from", async () => {
    http.mockResolvedValue(
      jsonResponse(200, {
        data: {
          catalog_version: 4,
          currency: "usd",
          base_fee_cents: 6000,
          limits: {
            max_groups: [
              { value: "50", label: "50 groups", price_cents: 0 },
              { value: "", label: "no value" },
              "junk",
            ],
            max_members_per_group: [{ value: "100", label: "100 members" }],
          },
          features: [
            {
              key: "search",
              label: "Search",
              description: "Find.",
              price_cents: 900,
            },
            7,
          ],
          analytics: [{ value: "basic", label: "Basic", price_cents: 1500 }],
          credit_packages: [
            { value: "10000", label: "10k", price_cents: 4900 },
          ],
          billing_intervals: [
            {
              value: "annual",
              label: "Annual",
              months: 12,
              discount_percent: 15,
              description: "Save 15%.",
            },
            { value: "monthly", label: "Monthly" },
          ],
        },
      }),
    );

    const result = await fetchEnterprisePricingCatalog();
    expect(http).toHaveBeenCalledWith("/enterprise/pricing/");
    expect(result).toEqual({
      ok: true,
      catalog: {
        catalogVersion: 4,
        currency: "usd",
        baseFeeCents: 6000,
        limits: {
          maxGroups: [{ value: "50", label: "50 groups", priceCents: 0 }],
          maxMembersPerGroup: [
            { value: "100", label: "100 members", priceCents: 0 },
          ],
          maxAdminsPerGroup: [],
          storageGb: [],
        },
        features: [
          {
            key: "search",
            label: "Search",
            description: "Find.",
            priceCents: 900,
          },
        ],
        analytics: [{ value: "basic", label: "Basic", priceCents: 1500 }],
        creditPackages: [{ value: "10000", label: "10k", priceCents: 4900 }],
        billingIntervals: [
          {
            value: "annual",
            label: "Annual",
            months: 12,
            discountPercent: 15,
            description: "Save 15%.",
          },
          {
            value: "monthly",
            label: "Monthly",
            months: 1,
            discountPercent: 0,
            description: "",
          },
        ],
      },
    });
  });

  it("reads an empty catalogue without failing", async () => {
    http.mockResolvedValue(jsonResponse(200, { data: {} }));
    const result = await fetchEnterprisePricingCatalog();
    expect(result.ok && result.catalog).toMatchObject({
      catalogVersion: null,
      currency: "usd",
      features: [],
      billingIntervals: [],
    });
  });

  it("explains every way it can fail", async () => {
    http.mockResolvedValue(jsonResponse(200, { data: null }));
    expect(await fetchEnterprisePricingCatalog()).toEqual({
      ok: false,
      message: "Invalid pricing catalog response.",
    });

    http.mockResolvedValue(jsonResponse(503, { message: "Pricing is down." }));
    expect(await fetchEnterprisePricingCatalog()).toEqual({
      ok: false,
      message: "Pricing is down.",
    });

    http.mockResolvedValue(brokenResponse(200));
    expect(await fetchEnterprisePricingCatalog()).toEqual({
      ok: false,
      message: "Unable to load Enterprise pricing.",
    });

    http.mockRejectedValue(new Error("offline"));
    expect(await fetchEnterprisePricingCatalog()).toEqual({
      ok: false,
      message: "offline",
    });
    http.mockRejectedValue("x");
    expect(await fetchEnterprisePricingCatalog()).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });

  it("re-exports the built-in catalogue for when the server's is unavailable", () => {
    expect(DEFAULT_CATALOG.baseFeeCents).toBe(6000);
  });
});

describe("remote drafts", () => {
  it("saves a new draft, and updates one it already has an id for", async () => {
    respond(201, { data: DRAFT });
    const result = await saveEnterpriseDraftRemote(DEFAULT_CONFIGURATION);
    expect(result).toEqual({
      ok: true,
      draft: {
        draftId: "remote_1",
        catalogVersion: 4,
        currency: "usd",
        configuration: DEFAULT_CONFIGURATION,
        pricing: {
          billingInterval: "annual",
          periodMonths: 12,
          monthlySubtotalCents: 16300,
          periodSubtotalCents: 195600,
          discountPercent: 15,
          discountCents: 29340,
          periodTotalCents: 166260,
        },
        status: "draft",
        expiresAt: "2026-11-05T00:00:00Z",
      },
    });
    expect(requests()[0]).toEqual({
      path: "/enterprise/drafts/",
      method: "POST",
      body: { configuration: DEFAULT_CONFIGURATION },
    });

    await saveEnterpriseDraftRemote(DEFAULT_CONFIGURATION, "remote_1");
    expect(requests()[1].body).toEqual({
      draft_id: "remote_1",
      configuration: DEFAULT_CONFIGURATION,
    });
  });

  it("fills in a sparse draft, keeping a configuration it cannot normalise", async () => {
    const odd = { limits: null };
    respond(200, { data: { draft_id: "remote_2", configuration: odd } });
    const result = await getEnterpriseDraft("remote 2");
    expect(requests()[0].path).toBe("/enterprise/drafts/remote%202/");
    expect(result).toEqual({
      ok: true,
      draft: {
        draftId: "remote_2",
        catalogVersion: null,
        currency: "usd",
        configuration: odd,
        pricing: {
          billingInterval: "monthly",
          periodMonths: 1,
          monthlySubtotalCents: 0,
          periodSubtotalCents: 0,
          discountPercent: 0,
          discountCents: 0,
          periodTotalCents: 0,
        },
        status: "draft",
        expiresAt: null,
      },
    });
  });

  it("coerces a configuration's features to booleans", async () => {
    respond(200, {
      data: {
        draft_id: "remote_3",
        configuration: {
          limits: { max_groups: 50 },
          features: { search: 1, calls: 0 },
          credits: {},
        },
      },
    });
    const result = await getEnterpriseDraft("remote_3");
    expect(result.ok && result.draft.configuration).toEqual({
      type: "plan",
      code: "enterprise",
      billing_interval: "monthly",
      limits: {
        max_groups: 50,
        max_members_per_group: 0,
        max_admins_per_group: 0,
        storage_gb: 0,
      },
      features: {
        extended_message_history: false,
        search: true,
        advanced_notifications: false,
        moderation_tools: false,
        calls: false,
        call_recording: false,
        analytics: "none",
      },
      credits: { monthly_messages: 0 },
    });
  });

  it("attaches a draft made while signed out to the account", async () => {
    respond(200, { data: DRAFT });
    expect((await attachEnterpriseDraft("remote_1")).ok).toBe(true);
    expect(requests()[0]).toMatchObject({
      path: "/enterprise/drafts/remote_1/attach/",
      method: "POST",
    });
  });

  it("says the backend is not live on a 404 or a dead network", async () => {
    respond(404, {});
    expect(await saveEnterpriseDraftRemote(DEFAULT_CONFIGURATION)).toEqual(
      NOT_LIVE,
    );

    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await saveEnterpriseDraftRemote(DEFAULT_CONFIGURATION)).toEqual(
      NOT_LIVE,
    );
    expect(await getEnterpriseDraft("remote_1")).toEqual(NOT_LIVE);
    expect(await attachEnterpriseDraft("remote_1")).toEqual(NOT_LIVE);
  });

  it("shows the server's reason for a refusal, wherever it put it", async () => {
    respond(400, { message: "That option is no longer sold." });
    expect(await getEnterpriseDraft("remote_1")).toEqual({
      ok: false,
      message: "That option is no longer sold.",
    });

    respond(400, { data: { configuration: ["Pick a storage size."] } });
    expect(await getEnterpriseDraft("remote_1")).toEqual({
      ok: false,
      message: "Pick a storage size.",
    });

    respond(400, { data: { nested: {}, detail: "Draft expired." } });
    expect(await getEnterpriseDraft("remote_1")).toEqual({
      ok: false,
      message: "Draft expired.",
    });

    respond(400, { data: { nested: {} } });
    expect(await getEnterpriseDraft("remote_1")).toEqual({
      ok: false,
      message: "Unable to reach the draft.",
    });

    respond(400, { data: "text" });
    expect(await getEnterpriseDraft("remote_1")).toEqual({
      ok: false,
      message: "Unable to reach the draft.",
    });

    respond(200, { data: { status: "draft" } });
    expect(await getEnterpriseDraft("remote_1")).toEqual({
      ok: false,
      message: "Invalid draft response.",
    });
  });
});

describe("submitEnterpriseConfiguration", () => {
  const SUCCESS = "https://loopdn.com/enterprise/checkout/success/";
  const CANCEL = "https://loopdn.com/enterprise/checkout/cancel/";

  /** Answer the draft save, then the checkout, in that order. */
  function steps(draft: Response, checkout?: Response) {
    const mock = vi.mocked(authorizedRequest).mockResolvedValueOnce(draft);
    if (checkout) mock.mockResolvedValueOnce(checkout);
  }

  function submit(remoteDraftId?: string) {
    return submitEnterpriseConfiguration(
      DEFAULT_CONFIGURATION,
      remoteDraftId,
      SUCCESS,
      CANCEL,
    );
  }

  it("saves the draft, then starts checkout for it", async () => {
    steps(
      jsonResponse(201, { data: DRAFT }),
      jsonResponse(200, {
        data: {
          checkout_url: "https://checkout.stripe.com/c/1",
          invoice: INVOICE,
          contract_id: "ct_1",
          contract_number: "ENT-0001",
        },
      }),
    );

    expect(await submit()).toEqual({
      ok: true,
      draftId: "remote_1",
      checkoutUrl: "https://checkout.stripe.com/c/1",
      invoice: {
        currency: "usd",
        billingInterval: "annual",
        lineItems: [{ description: "Enterprise base fee", amountCents: 72000 }],
        subtotalCents: 195600,
        discountCents: 29340,
        totalCents: 166260,
        stripeInvoiceId: "in_1",
      },
      contractId: "ct_1",
      contractNumber: "ENT-0001",
    });
    expect(requests()).toEqual([
      {
        path: "/enterprise/drafts/",
        method: "POST",
        body: { configuration: DEFAULT_CONFIGURATION },
      },
      {
        path: "/enterprise/drafts/remote_1/checkout/",
        method: "POST",
        body: { success_url: SUCCESS, cancel_url: CANCEL },
      },
    ]);
  });

  it("reuses the draft it was given, even if the save does not echo its id", async () => {
    steps(
      jsonResponse(200, { data: {} }),
      jsonResponse(200, {
        data: { checkout_url: "https://checkout.stripe.com/c/1", invoice: {} },
      }),
    );
    const result = await submit("remote_9");
    expect(requests()[0].body).toMatchObject({ draft_id: "remote_9" });
    expect(requests()[1].path).toBe("/enterprise/drafts/remote_9/checkout/");
    expect(result).toMatchObject({
      ok: true,
      draftId: "remote_9",
      invoice: {
        currency: "usd",
        billingInterval: "monthly",
        lineItems: [],
        stripeInvoiceId: undefined,
      },
    });
  });

  it("stops at the draft when the draft cannot be saved", async () => {
    steps(jsonResponse(404, {}));
    expect(await submit()).toEqual(NOT_LIVE);

    steps(jsonResponse(400, { message: "Pick a storage size." }));
    expect(await submit()).toEqual({
      ok: false,
      message: "Pick a storage size.",
    });

    steps(brokenResponse(500));
    expect(await submit()).toEqual({
      ok: false,
      message: "Unable to save your configuration. Please try again.",
    });

    steps(jsonResponse(200, { data: {} }));
    expect(await submit()).toEqual({
      ok: false,
      message: "Draft id is missing from the response.",
    });
    expect(authorizedRequest).toHaveBeenCalledTimes(4);
  });

  it("explains a checkout that cannot start", async () => {
    const saved = () => jsonResponse(201, { data: DRAFT });

    steps(saved(), jsonResponse(404, {}));
    expect(await submit()).toEqual(NOT_LIVE);

    steps(saved(), jsonResponse(402, { message: "Card required." }));
    expect(await submit()).toEqual({ ok: false, message: "Card required." });

    steps(saved(), brokenResponse(500));
    expect(await submit()).toEqual({
      ok: false,
      message: "Unable to start checkout. Please try again.",
    });

    steps(saved(), jsonResponse(200, { data: { invoice: INVOICE } }));
    expect(await submit()).toEqual({
      ok: false,
      message: "Checkout URL is missing.",
    });

    steps(saved(), jsonResponse(200, { data: { checkout_url: "https://x" } }));
    expect(await submit()).toEqual({
      ok: false,
      message: "Invoice details are missing.",
    });
  });

  it("treats a dead network as not live", async () => {
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await submit()).toEqual(NOT_LIVE);
  });
});

describe("fetchEnterpriseBillingStatus", () => {
  it("reads the contract and what it costs", async () => {
    respond(200, {
      data: {
        contract: {
          contract_number: "ENT-0001",
          billing_interval: "annual",
          status: "active",
          configuration: DEFAULT_CONFIGURATION,
          pricing: {
            currency: "usd",
            subtotal_cents: 195600,
            discount_cents: 29340,
            total_cents: 166260,
            line_items: INVOICE.line_items,
          },
          stripe_status: "paid",
        },
      },
    });
    expect(await fetchEnterpriseBillingStatus()).toEqual({
      ok: true,
      contract: {
        contractNumber: "ENT-0001",
        billingInterval: "annual",
        status: "active",
        configuration: DEFAULT_CONFIGURATION,
        pricing: {
          currency: "usd",
          subtotalCents: 195600,
          discountCents: 29340,
          totalCents: 166260,
          lineItems: [
            { description: "Enterprise base fee", amountCents: 72000 },
          ],
        },
        stripeStatus: "paid",
      },
    });
    expect(requests()[0].path).toBe("/enterprise/billing/");
  });

  it("falls back to the configuration snapshot, and to nothing", async () => {
    respond(200, {
      data: { contract: { configuration_snapshot: DEFAULT_CONFIGURATION } },
    });
    const snapshot = await fetchEnterpriseBillingStatus();
    expect(snapshot.ok && snapshot.contract).toMatchObject({
      billingInterval: "monthly",
      configuration: DEFAULT_CONFIGURATION,
      pricing: { currency: "usd", lineItems: [] },
    });

    respond(200, { data: { contract: {} } });
    const bare = await fetchEnterpriseBillingStatus();
    expect(bare.ok && bare.contract?.configuration).toBeNull();
  });

  it("is no contract when the account has none", async () => {
    respond(200, { data: { contract: null } });
    expect(await fetchEnterpriseBillingStatus()).toEqual({
      ok: true,
      contract: null,
    });
  });

  it("reports the ways it can fail", async () => {
    respond(404, {});
    expect(await fetchEnterpriseBillingStatus()).toEqual(NOT_LIVE);
    respond(500, {});
    expect(await fetchEnterpriseBillingStatus()).toEqual({
      ok: false,
      message: "Unable to load billing status.",
    });
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await fetchEnterpriseBillingStatus()).toEqual(NOT_LIVE);
  });
});

describe("fetchEnterpriseCredits", () => {
  it("reads the balance and the ledger", async () => {
    respond(200, {
      data: {
        balance: 9400,
        ledger: {
          next: "https://api/enterprise/credits/?page=2",
          results: [
            {
              id: "tx_1",
              transaction_type: "debit",
              amount: -600,
              balance_after: 9400,
              reference_type: "message",
              reference_id: "m_1",
              created_at: "2026-10-04T00:00:00Z",
            },
            "junk",
          ],
        },
      },
    });
    expect(await fetchEnterpriseCredits()).toEqual({
      ok: true,
      credits: {
        balance: 9400,
        nextPage: "https://api/enterprise/credits/?page=2",
        ledger: [
          {
            id: "tx_1",
            transactionType: "debit",
            amount: -600,
            balanceAfter: 9400,
            referenceType: "message",
            referenceId: "m_1",
            createdAt: "2026-10-04T00:00:00Z",
          },
        ],
      },
    });
    expect(requests()[0].path).toBe("/enterprise/credits/");
  });

  it("reads an account with no ledger yet", async () => {
    respond(200, { data: {} });
    expect(await fetchEnterpriseCredits()).toEqual({
      ok: true,
      credits: { balance: 0, ledger: [], nextPage: null },
    });
  });

  it("reports the ways it can fail", async () => {
    respond(404, {});
    expect(await fetchEnterpriseCredits()).toEqual(NOT_LIVE);
    respond(500, { message: "Credits are down." });
    expect(await fetchEnterpriseCredits()).toEqual({
      ok: false,
      message: "Credits are down.",
    });
    respond(500, null);
    expect(await fetchEnterpriseCredits()).toEqual({
      ok: false,
      message: "Unable to load credit balance.",
    });
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await fetchEnterpriseCredits()).toEqual(NOT_LIVE);
  });
});
