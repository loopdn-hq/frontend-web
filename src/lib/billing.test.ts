import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import {
  comparePlansByPrice,
  createBillingPortalLink,
  createCreditCheckoutSession,
  createPlanCheckoutSession,
  fetchBillingAnalytics,
  fetchBillingPlans,
  fetchBillingSummary,
  fetchCreditPackages,
} from "@/lib/billing";
import { authorizedRequest } from "@/lib/chat/conversations";
import { brokenResponse, jsonResponse } from "@/test/helpers";

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

/** The failures every read shares: a refusal, a non-envelope, a dead network. */
async function expectReadFailures(
  call: () => Promise<{ ok: boolean; message?: string }>,
) {
  respond(500, { message: "Billing is down." });
  expect(await call()).toEqual({ ok: false, message: "Billing is down." });

  respond(400, { data: { plan_code: ["Unknown plan."] } });
  expect(await call()).toEqual({ ok: false, message: "Unknown plan." });

  respond(400, { data: { detail: "Card declined.", extra: 1 } });
  expect(await call()).toEqual({ ok: false, message: "Card declined." });

  vi.mocked(authorizedRequest).mockRejectedValue(new Error("Signed out."));
  expect(await call()).toEqual({ ok: false, message: "Signed out." });

  vi.mocked(authorizedRequest).mockRejectedValue("x");
  expect(await call()).toEqual({
    ok: false,
    message: "Network error. Please try again.",
  });
}

const PREMIUM = {
  id: 2,
  code: "premium",
  name: "Premium",
  price_display: "$9.99/mo",
  monthly_price_cents: 999,
  max_groups: 25,
  max_members_per_group: 100,
  max_admins_per_group: 5,
  storage_gb: 20,
  has_whatsapp: true,
  has_telegram: false,
  has_calls: true,
  max_call_participants: 12,
  has_screen_share: true,
  has_call_recording: false,
  call_recording_retention_days: null,
  features: ["Search", 7, "Calls"],
  is_custom_pricing: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("comparePlansByPrice", () => {
  const plan = (name: string, cents: number | null, custom = false) => ({
    name,
    monthlyPriceCents: cents,
    isCustomPricing: custom,
  });

  it("orders cheapest first, with custom pricing last", () => {
    const sorted = [
      plan("Enterprise", null, true),
      plan("Premium", 999),
      plan("Free", 0),
      plan("Quote", null),
      plan("Starter", 499),
    ]
      .sort(comparePlansByPrice)
      .map((item) => item.name);
    expect(sorted).toEqual([
      "Free",
      "Starter",
      "Premium",
      "Enterprise",
      "Quote",
    ]);
  });

  it("breaks a tie on price by name", () => {
    expect(comparePlansByPrice(plan("B", 500), plan("A", 500))).toBeGreaterThan(
      0,
    );
    expect(comparePlansByPrice(plan("A", 500), plan("B", 500))).toBeLessThan(0);
    // A plan flagged custom sorts as custom even with a price attached.
    expect(
      comparePlansByPrice(plan("Custom", 100, true), plan("Paid", 99999)),
    ).toBe(1);
  });
});

describe("fetchBillingPlans", () => {
  it("adds the built-in Free and Enterprise plans around what the server sells", async () => {
    respond(200, { data: [PREMIUM, "junk"] });
    const result = await fetchBillingPlans();
    expect(lastRequest().path).toBe("/billing/plans/");
    expect(result.ok && result.data.map((plan) => plan.code)).toEqual([
      "free",
      "premium",
      "enterprise",
    ]);
    expect(result.ok && result.data[1]).toEqual({
      id: "2",
      code: "premium",
      name: "Premium",
      priceDisplay: "$9.99/mo",
      monthlyPriceCents: 999,
      maxGroups: 25,
      maxMembersPerGroup: 100,
      maxAdminsPerGroup: 5,
      storageGb: 20,
      hasWhatsApp: true,
      hasTelegram: false,
      hasCalls: true,
      maxCallParticipants: 12,
      hasScreenShare: true,
      hasCallRecording: false,
      callRecordingRetentionDays: null,
      features: ["Search", "Calls"],
      isCustomPricing: false,
    });
  });

  it("uses the server's own Free plan when it sends one", async () => {
    respond(200, {
      data: [{ code: "FREE", name: "Free forever", monthly_price_cents: 0 }],
    });
    const result = await fetchBillingPlans();
    expect(result.ok && result.data.map((plan) => plan.name)).toEqual([
      "Free forever",
      "Enterprise",
    ]);
  });

  it("reads a plan under its older field names", async () => {
    respond(200, {
      data: [
        {
          plan_code: "team",
          title: "Team",
          whatsapp_enabled: true,
          telegram_enabled: true,
        },
        {},
      ],
    });
    const result = await fetchBillingPlans();
    const team = result.ok && result.data.find((plan) => plan.code === "team");
    expect(team).toMatchObject({
      id: "team",
      name: "Team",
      priceDisplay: "Custom",
      hasWhatsApp: true,
      hasTelegram: true,
      features: [],
    });
    const nameless = result.ok && result.data.find((plan) => plan.code === "");
    expect(nameless).toMatchObject({ id: "Plan", name: "Plan" });
  });

  it("falls back to the built-in plans for an answer that is not a list", async () => {
    respond(200, { data: null });
    const result = await fetchBillingPlans();
    expect(result.ok && result.data.map((plan) => plan.code)).toEqual([
      "free",
      "enterprise",
    ]);
  });

  it("reports a failure", async () => {
    respond(200, "not an envelope");
    expect(await fetchBillingPlans()).toEqual({
      ok: false,
      message: "Invalid billing response.",
    });
    respond(500, {});
    expect(await fetchBillingPlans()).toEqual({
      ok: false,
      message: "Billing request failed.",
    });
    await expectReadFailures(fetchBillingPlans);
  });
});

describe("fetchCreditPackages", () => {
  it("reads the packages on sale, dropping any without both amounts", async () => {
    respond(200, {
      data: [
        { id: 3, name: "Starter", price_cents: 500, credit_cents: 500 },
        { price_cents: 1000, credit_cents: 1100 },
        { id: 5, name: "Broken", price_cents: 1000 },
        null,
      ],
    });
    expect(await fetchCreditPackages()).toEqual({
      ok: true,
      data: [
        { id: "3", name: "Starter", priceCents: 500, creditCents: 500 },
        { id: "", name: "Credit package", priceCents: 1000, creditCents: 1100 },
      ],
    });
    expect(lastRequest().path).toBe("/billing/credit-packages/");
  });

  it("is empty for an answer that is not a list, and reports a failure", async () => {
    respond(200, { data: {} });
    expect(await fetchCreditPackages()).toEqual({ ok: true, data: [] });
    await expectReadFailures(fetchCreditPackages);
  });
});

describe("fetchBillingSummary", () => {
  it("reads the subscription, wallet and enterprise credits", async () => {
    respond(200, {
      data: {
        subscription: {
          plan: PREMIUM,
          status: "past_due",
          current_period_end: "2026-11-01T00:00:00Z",
          cancel_at_period_end: true,
        },
        wallet: {
          balance_cents: 1250,
          auto_recharge_enabled: true,
          auto_recharge_package: { name: "Starter" },
        },
        enterprise_credits: {
          contract_number: "ENT-0001",
          status: "active",
          balance: 9400.7,
          monthly_allowance: 10000,
        },
      },
    });
    const result = await fetchBillingSummary();
    expect(lastRequest().path).toBe("/billing/summary/");
    expect(result.ok && result.data).toMatchObject({
      subscription: {
        plan: { code: "premium", maxGroups: 25 },
        status: "past_due",
        currentPeriodEnd: "2026-11-01T00:00:00Z",
        cancelAtPeriodEnd: true,
      },
      wallet: {
        balanceCents: 1250,
        autoRechargeEnabled: true,
        autoRechargePackage: "Starter",
      },
      enterpriseCredits: {
        contractNumber: "ENT-0001",
        status: "active",
        balance: 9400,
        monthlyAllowance: 10000,
      },
    });
  });

  it("builds the plan from its code when the plan itself is missing", async () => {
    respond(200, {
      data: {
        subscription: { plan_code: "free", renews_at: "2026-11-01T00:00:00Z" },
        wallet: { auto_recharge_package: {} },
      },
    });
    const result = await fetchBillingSummary();
    expect(result.ok && result.data).toEqual({
      subscription: {
        plan: expect.objectContaining({
          id: "free",
          code: "free",
          name: "Free",
          // Limits the summary omits come from the built-in Free plan.
          maxGroups: 3,
          maxMembersPerGroup: 20,
          maxAdminsPerGroup: 1,
          storageGb: 1,
        }),
        status: "active",
        currentPeriodEnd: "2026-11-01T00:00:00Z",
        cancelAtPeriodEnd: false,
      },
      wallet: {
        balanceCents: 0,
        autoRechargeEnabled: false,
        autoRechargePackage: null,
      },
      enterpriseCredits: null,
    });
  });

  it("leaves a plan it has no defaults for as it came", async () => {
    respond(200, {
      data: {
        subscription: { plan_code: "team", plan_name: "Team" },
        wallet: {},
      },
    });
    const result = await fetchBillingSummary();
    expect(result.ok && result.data.subscription).toMatchObject({
      plan: { code: "team", name: "Team", maxGroups: null },
      currentPeriodEnd: null,
    });
  });

  it("refuses a summary missing either half", async () => {
    for (const data of [null, { wallet: {} }, { subscription: {} }]) {
      respond(200, { data });
      expect(await fetchBillingSummary()).toEqual({
        ok: false,
        message: "Invalid billing summary shape.",
      });
    }
    await expectReadFailures(fetchBillingSummary);
  });
});

describe("fetchBillingAnalytics", () => {
  const planInfo = {
    code: "premium",
    name: "Premium",
    monthly_price_cents: 999,
    is_custom_pricing: false,
    features: ["Search", 3],
  };
  const wallet = {
    balance_cents: 1250,
    usage_last_30_days: {
      purchased_cents: 500,
      used_cents: 320,
      net_change_cents: 180,
      purchase_transactions: 1,
      usage_transactions: 14,
    },
  };

  it("reads both tiers and the suggestions", async () => {
    respond(200, {
      data: {
        access: {
          has_basic_analytics: true,
          has_advanced_analytics: true,
          current_plan_code: "premium",
          matched_feature: "advanced",
        },
        basic: {
          window_days: 30,
          plan_info: planInfo,
          wallet,
          conversation_counts: { total: 12, group: 9, direct: 3 },
          message_activity: {
            sent_last_30_days: 140,
            received_last_30_days: 610,
          },
        },
        advanced: {
          plan_info: planInfo,
          wallet,
          group_admin_stats: {
            admin_groups: 4,
            member_groups: 5,
            broadcast_groups: 1,
          },
          group_size: {
            average_active_members: 18.5,
            largest_group_active_members: 64,
          },
        },
        suggestions: [
          {
            code: "upgrade",
            title: "Upgrade",
            detail: "You are near your limit.",
          },
          { code: "bare" },
          "junk",
        ],
      },
    });

    const result = await fetchBillingAnalytics();
    expect(lastRequest().path).toBe("/api/v1/billing/analytics/");
    expect(result).toEqual({
      ok: true,
      data: {
        access: {
          hasBasicAnalytics: true,
          hasAdvancedAnalytics: true,
          currentPlanCode: "premium",
          matchedFeature: "advanced",
        },
        basic: {
          windowDays: 30,
          planInfo: {
            code: "premium",
            name: "Premium",
            monthlyPriceCents: 999,
            isCustomPricing: false,
            features: ["Search"],
          },
          wallet: {
            balanceCents: 1250,
            usageLast30Days: {
              purchasedCents: 500,
              usedCents: 320,
              netChangeCents: 180,
              purchaseTransactions: 1,
              usageTransactions: 14,
            },
          },
          conversationCounts: { total: 12, group: 9, direct: 3 },
          messageActivity: { sentLast30Days: 140, receivedLast30Days: 610 },
        },
        advanced: {
          planInfo: expect.objectContaining({ code: "premium" }),
          wallet: expect.objectContaining({ balanceCents: 1250 }),
          groupAdminStats: {
            adminGroups: 4,
            memberGroups: 5,
            broadcastGroups: 1,
          },
          groupSize: {
            averageActiveMembers: 18.5,
            largestGroupActiveMembers: 64,
          },
        },
        suggestions: [
          {
            code: "upgrade",
            title: "Upgrade",
            detail: "You are near your limit.",
          },
          { code: "bare", title: "Suggestion", detail: "" },
        ],
      },
    });
  });

  it("reads zeros for tiers that arrive empty, and nothing for tiers that do not", async () => {
    respond(200, {
      data: { access: { matched_feature: "basic" }, basic: {}, advanced: {} },
    });
    const sparse = await fetchBillingAnalytics();
    expect(sparse.ok && sparse.data).toMatchObject({
      access: { matchedFeature: "basic", hasBasicAnalytics: false },
      basic: {
        windowDays: 30,
        planInfo: { code: "", name: "", features: [] },
        wallet: { balanceCents: 0, usageLast30Days: { usedCents: 0 } },
        conversationCounts: { total: 0, group: 0, direct: 0 },
        messageActivity: { sentLast30Days: 0, receivedLast30Days: 0 },
      },
      advanced: {
        groupAdminStats: {
          adminGroups: 0,
          memberGroups: 0,
          broadcastGroups: 0,
        },
        groupSize: { averageActiveMembers: 0, largestGroupActiveMembers: 0 },
      },
    });

    respond(200, {
      data: {
        advanced: {
          plan_info: {},
          wallet: { balance_cents: -5 },
          group_size: { average_active_members: "many" },
        },
      },
    });
    const none = await fetchBillingAnalytics();
    expect(none.ok && none.data).toMatchObject({
      access: {
        hasBasicAnalytics: false,
        hasAdvancedAnalytics: false,
        currentPlanCode: "",
        matchedFeature: "none",
      },
      basic: null,
      advanced: {
        planInfo: { name: "Plan" },
        wallet: { balanceCents: 0 },
        groupSize: { averageActiveMembers: 0 },
      },
      suggestions: [],
    });
  });

  it("tries the unprefixed route when the first is not found", async () => {
    vi.mocked(authorizedRequest)
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(200, { data: {} }));
    expect((await fetchBillingAnalytics()).ok).toBe(true);
    expect(
      vi.mocked(authorizedRequest).mock.calls.map((call) => call[0]),
    ).toEqual(["/api/v1/billing/analytics/", "/billing/analytics/"]);
  });

  it("stops at the first route for any other refusal", async () => {
    respond(403, { message: "Upgrade to see analytics." });
    expect(await fetchBillingAnalytics()).toEqual({
      ok: false,
      message: "Upgrade to see analytics.",
    });
    expect(authorizedRequest).toHaveBeenCalledTimes(1);
  });

  it("reports the last failure when neither route answers", async () => {
    respond(404, {});
    expect(await fetchBillingAnalytics()).toEqual({
      ok: false,
      message: "Billing analytics request failed.",
    });

    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    expect(await fetchBillingAnalytics()).toEqual({
      ok: false,
      message: "offline",
    });
    vi.mocked(authorizedRequest).mockRejectedValue("x");
    expect(await fetchBillingAnalytics()).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });

  it("refuses an answer of the wrong shape", async () => {
    vi.mocked(authorizedRequest).mockResolvedValue(brokenResponse(200));
    expect(await fetchBillingAnalytics()).toEqual({
      ok: false,
      message: "Invalid billing analytics response.",
    });
    respond(200, { data: null });
    expect(await fetchBillingAnalytics()).toEqual({
      ok: false,
      message: "Invalid billing analytics shape.",
    });
  });
});

describe("starting a payment", () => {
  const SUCCESS = "https://loopdn.com/billing/success/";
  const CANCEL = "https://loopdn.com/billing/cancel/";

  it("starts a plan checkout", async () => {
    respond(200, { data: { checkout_url: "https://checkout.stripe.com/c/1" } });
    expect(await createPlanCheckoutSession("premium", SUCCESS, CANCEL)).toEqual(
      {
        ok: true,
        data: { checkoutUrl: "https://checkout.stripe.com/c/1" },
      },
    );
    expect(lastRequest()).toEqual({
      path: "/billing/checkout/plan/",
      method: "POST",
      body: { plan_code: "premium", success_url: SUCCESS, cancel_url: CANCEL },
    });
  });

  it("starts a credit checkout", async () => {
    respond(200, { data: { checkout_url: "https://checkout.stripe.com/c/2" } });
    expect(await createCreditCheckoutSession("3", SUCCESS, CANCEL)).toEqual({
      ok: true,
      data: { checkoutUrl: "https://checkout.stripe.com/c/2" },
    });
    expect(lastRequest()).toEqual({
      path: "/billing/checkout/credits/",
      method: "POST",
      body: { package_id: "3", success_url: SUCCESS, cancel_url: CANCEL },
    });
  });

  it("opens the billing portal", async () => {
    respond(200, { data: { portal_url: "https://billing.stripe.com/p/1" } });
    expect(
      await createBillingPortalLink("https://loopdn.com/settings/"),
    ).toEqual({
      ok: true,
      data: { portalUrl: "https://billing.stripe.com/p/1" },
    });
    expect(lastRequest()).toEqual({
      path: "/billing/portal/",
      method: "POST",
      body: { return_url: "https://loopdn.com/settings/" },
    });
  });

  it.each([
    [
      "plan checkout",
      () => createPlanCheckoutSession("premium", SUCCESS, CANCEL),
      "Unable to start plan checkout.",
      "Invalid checkout response.",
      "Checkout URL is missing.",
    ],
    [
      "credit checkout",
      () => createCreditCheckoutSession("3", SUCCESS, CANCEL),
      "Unable to start credit checkout.",
      "Invalid checkout response.",
      "Checkout URL is missing.",
    ],
    [
      "billing portal",
      () => createBillingPortalLink(SUCCESS),
      "Unable to open billing portal.",
      "Invalid portal response.",
      "Portal URL is missing.",
    ],
  ])(
    "explains a %s that cannot start",
    async (_name, call, refused, invalid, missing) => {
      respond(500, {});
      expect(await call()).toEqual({ ok: false, message: refused });

      respond(200, { data: null });
      expect(await call()).toEqual({ ok: false, message: invalid });

      respond(200, { data: {} });
      expect(await call()).toEqual({ ok: false, message: missing });

      await expectReadFailures(call);
    },
  );
});
