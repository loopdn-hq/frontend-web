import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BASE_FEE_CENTS,
  calculateEnterprisePrice,
  DEFAULT_CATALOG,
  DEFAULT_CONFIGURATION,
  formatCents,
  type EnterpriseConfiguration,
} from "@/lib/enterprise/catalog";
import {
  clearEnterpriseDraft,
  loadEnterpriseDraft,
  saveEnterpriseDraft,
  setRemoteDraftId,
  useEnterpriseDraft,
} from "@/lib/enterprise/draft";

const KEY = "loopdn_enterprise_draft";

function configure(
  change: Partial<EnterpriseConfiguration> = {},
): EnterpriseConfiguration {
  return { ...DEFAULT_CONFIGURATION, ...change };
}

beforeEach(() => {
  localStorage.clear();
  // The module caches by raw string; reading the empty store resets it.
  loadEnterpriseDraft();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("calculateEnterprisePrice", () => {
  it("prices the default configuration line by line", () => {
    const estimate = calculateEnterprisePrice(DEFAULT_CONFIGURATION);
    expect(estimate.lines).toEqual([
      { label: "Enterprise base fee", amountCents: BASE_FEE_CENTS },
      { label: "100 groups", amountCents: 3_000 },
      { label: "250 members / group", amountCents: 2_400 },
      { label: "20 admins / group", amountCents: 0 },
      { label: "50 GB storage", amountCents: 0 },
      { label: "10,000 messages / mo", amountCents: 4_900 },
    ]);
    expect(estimate).toMatchObject({
      monthlySubtotalCents: 16_300,
      billingInterval: "monthly",
      periodMonths: 1,
      discountPercent: 0,
      periodSubtotalCents: 16_300,
      discountCents: 0,
      periodTotalCents: 16_300,
      monthlyEquivalentCents: 16_300,
    });
  });

  it("adds each feature switched on, and a paid analytics tier", () => {
    const estimate = calculateEnterprisePrice(
      configure({
        features: {
          ...DEFAULT_CONFIGURATION.features,
          search: true,
          calls: true,
          analytics: "advanced",
        },
      }),
    );
    expect(estimate.lines.map((line) => line.label)).toEqual(
      expect.arrayContaining(["Search", "Calls", "Advanced analytics"]),
    );
    expect(estimate.monthlySubtotalCents).toBe(16_300 + 900 + 2_500 + 4_500);
  });

  it("discounts a longer billing period, and reports the monthly equivalent", () => {
    const annual = calculateEnterprisePrice(
      configure({ billing_interval: "annual" }),
    );
    expect(annual).toMatchObject({
      periodMonths: 12,
      discountPercent: 15,
      periodSubtotalCents: 195_600,
      discountCents: 29_340,
      periodTotalCents: 166_260,
      monthlyEquivalentCents: 13_855,
    });

    const quarterly = calculateEnterprisePrice(
      configure({ billing_interval: "quarterly" }),
    );
    expect(quarterly.discountCents).toBe(Math.round(16_300 * 3 * 0.05));
  });

  it("leaves out a choice the catalogue no longer sells, and bills monthly for an interval it does not know", () => {
    const estimate = calculateEnterprisePrice(
      configure({
        billing_interval: "weekly" as never,
        limits: {
          max_groups: 7,
          max_members_per_group: 7,
          max_admins_per_group: 7,
          storage_gb: 7,
        },
        credits: { monthly_messages: 7 },
      }),
    );
    expect(estimate.lines).toEqual([
      { label: "Enterprise base fee", amountCents: BASE_FEE_CENTS },
    ]);
    expect(estimate.billingInterval).toBe("monthly");
  });

  it("prices from the catalogue it is given, not the built-in one", () => {
    const estimate = calculateEnterprisePrice(DEFAULT_CONFIGURATION, {
      ...DEFAULT_CATALOG,
      baseFeeCents: 10_000,
      features: [],
      creditPackages: [],
    });
    expect(estimate.lines[0].amountCents).toBe(10_000);
    expect(estimate.monthlySubtotalCents).toBe(15_400);
  });
});

describe("formatCents", () => {
  it("prints whole dollars, and 'Included' for nothing", () => {
    expect(formatCents(0)).toBe("Included");
    expect(formatCents(149_900)).toBe("$1,499");
    expect(formatCents(900)).toBe("$9");
  });
});

describe("the enterprise draft", () => {
  it("is nothing until something is saved", () => {
    expect(loadEnterpriseDraft()).toBeNull();
  });

  it("saves a configuration with an id and timestamps, and reads it back", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const saved = saveEnterpriseDraft(DEFAULT_CONFIGURATION);

    expect(saved).toEqual({
      draftId: expect.stringMatching(/^ent_draft_[0-9a-f]{12}$/),
      remoteDraftId: null,
      configuration: DEFAULT_CONFIGURATION,
      status: "draft",
      createdAt: "2026-10-05T12:00:00.000Z",
      updatedAt: "2026-10-05T12:00:00.000Z",
    });
    expect(loadEnterpriseDraft()).toEqual(saved);
  });

  it("keeps its id and creation time across later saves", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const first = saveEnterpriseDraft(DEFAULT_CONFIGURATION);
    setRemoteDraftId("remote_1");

    vi.setSystemTime(new Date("2026-10-05T13:00:00Z"));
    const second = saveEnterpriseDraft(
      configure({ billing_interval: "annual" }),
      "submitted",
    );

    expect(second).toMatchObject({
      draftId: first.draftId,
      remoteDraftId: "remote_1",
      status: "submitted",
      createdAt: first.createdAt,
      updatedAt: "2026-10-05T13:00:00.000Z",
    });
  });

  it("returns the same object until storage changes", () => {
    saveEnterpriseDraft(DEFAULT_CONFIGURATION);
    expect(loadEnterpriseDraft()).toBe(loadEnterpriseDraft());
  });

  it("fills in a feature added since the draft was saved", () => {
    const { calls, ...olderFeatures } = DEFAULT_CONFIGURATION.features;
    void calls;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        draftId: "ent_draft_old",
        remoteDraftId: null,
        status: "draft",
        configuration: {
          ...DEFAULT_CONFIGURATION,
          features: { ...olderFeatures, search: true },
        },
      }),
    );
    expect(loadEnterpriseDraft()?.configuration.features).toEqual({
      ...DEFAULT_CONFIGURATION.features,
      search: true,
    });
  });

  it("ignores stored nonsense", () => {
    localStorage.setItem(KEY, "{broken");
    expect(loadEnterpriseDraft()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify({ draftId: "x" }));
    expect(loadEnterpriseDraft()).toBeNull();
    localStorage.setItem(KEY, "null");
    expect(loadEnterpriseDraft()).toBeNull();
  });

  it("records the server's id for the draft, when there is a draft", () => {
    setRemoteDraftId("remote_1");
    expect(localStorage.getItem(KEY)).toBeNull();

    saveEnterpriseDraft(DEFAULT_CONFIGURATION);
    setRemoteDraftId("remote_1");
    expect(loadEnterpriseDraft()?.remoteDraftId).toBe("remote_1");
  });

  it("clears", () => {
    saveEnterpriseDraft(DEFAULT_CONFIGURATION);
    clearEnterpriseDraft();
    expect(loadEnterpriseDraft()).toBeNull();
  });

  it("still makes an id where crypto.randomUUID does not exist", () => {
    vi.stubGlobal("crypto", {});
    expect(saveEnterpriseDraft(DEFAULT_CONFIGURATION).draftId).toMatch(
      /^ent_draft_[0-9a-z]+$/,
    );
  });

  it("survives blocked storage without throwing", () => {
    saveEnterpriseDraft(DEFAULT_CONFIGURATION);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveEnterpriseDraft(DEFAULT_CONFIGURATION)).not.toThrow();
    expect(() => setRemoteDraftId("remote_1")).not.toThrow();
    expect(() => clearEnterpriseDraft()).not.toThrow();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadEnterpriseDraft()).toBeNull();
  });
});

describe("useEnterpriseDraft", () => {
  it("follows saves made here and in another tab", () => {
    const { result, unmount } = renderHook(() => useEnterpriseDraft());
    expect(result.current).toBeNull();

    act(() => {
      saveEnterpriseDraft(DEFAULT_CONFIGURATION);
    });
    expect(result.current?.status).toBe("draft");

    act(() => {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(result.current).toBeNull();

    unmount();
    expect(() => saveEnterpriseDraft(DEFAULT_CONFIGURATION)).not.toThrow();
  });
});
