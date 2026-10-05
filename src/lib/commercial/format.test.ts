import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commercial/api", () => ({
  fetchCategories: vi.fn(),
  fetchMarkets: vi.fn(),
}));

import { fetchCategories, fetchMarkets } from "@/lib/commercial/api";
import {
  CAMPAIGN_OBJECTIVE_HINT,
  CAMPAIGN_OBJECTIVE_LABEL,
  CAMPAIGN_PACING_LABEL,
  CAMPAIGN_STATUS_LABEL,
  campaignName,
  COMPANY_STATUS_LABEL,
  CREATIVE_STATUS_LABEL,
  formatBudget,
  formatCents,
  formatClickRate,
  formatDate,
  formatRange,
  RESULT_LABEL,
} from "@/lib/commercial/format";
import {
  countryName,
  regionsOf,
  useCampaignOptions,
  type CampaignOptions,
} from "@/lib/commercial/useCampaignOptions";

const OPTIONS: CampaignOptions = {
  categories: [{ slug: "sports", label: "Sports" }],
  markets: {
    countries: [
      {
        code: "US",
        name: "United States",
        regions: [{ code: "US-CA", name: "California" }],
      },
    ],
  } as CampaignOptions["markets"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchCategories).mockResolvedValue({
    ok: true,
    data: OPTIONS.categories,
  });
  vi.mocked(fetchMarkets).mockResolvedValue({ ok: true, data: OPTIONS.markets });
});

describe("commercial formatting", () => {
  it("prints money, and says when a budget is not set", () => {
    expect(formatCents(1250, "usd")).toBe("$12.50");
    expect(formatBudget(1250, "usd")).toBe("$12.50");
    expect(formatBudget(null, "usd")).toBe("Not set");
  });

  it("names a campaign that has no name yet", () => {
    expect(campaignName({ name: "  Autumn sale " })).toBe("Autumn sale");
    expect(campaignName({ name: "   " })).toBe("Untitled campaign");
  });

  it("prints a reach range, open-ended when there is no upper bound", () => {
    expect(formatRange({ low: 1200, high: 3400 })).toBe("1,200–3,400");
    expect(formatRange({ low: 50000, high: null })).toBe("50,000+");
  });

  it("prints a date, or that there is none", () => {
    expect(formatDate("2026-10-10T12:00:00")).toMatch(/2026/);
    expect(formatDate(null)).toBe("Not scheduled");
    expect(formatDate("whenever")).toBe("Not scheduled");
  });

  it("prints a click rate, with a decimal only when it is small", () => {
    expect(formatClickRate(0, 0)).toBe("-");
    expect(formatClickRate(3, 200)).toBe("1.5%");
    expect(formatClickRate(25, 100)).toBe("25%");
    expect(formatClickRate(1, 3)).toBe("33%");
  });

  it("has a label for every status, objective, pacing and result", () => {
    expect(COMPANY_STATUS_LABEL.suspended).toBe("Suspended");
    expect(CAMPAIGN_STATUS_LABEL.pending_review).toBe("Pending review");
    expect(CREATIVE_STATUS_LABEL.rejected).toBe("Rejected");
    expect(CAMPAIGN_PACING_LABEL.standard).toBe("Spread evenly");
    expect(RESULT_LABEL.joins).toEqual({ many: "Group joins", one: "join" });
    expect(Object.keys(CAMPAIGN_OBJECTIVE_HINT).sort()).toEqual(
      Object.keys(CAMPAIGN_OBJECTIVE_LABEL).sort(),
    );
  });
});

describe("useCampaignOptions", () => {
  it("loads the categories and markets together", async () => {
    const { result } = renderHook(() => useCampaignOptions());
    expect(result.current.options).toBeNull();

    await waitFor(() => expect(result.current.options).toEqual(OPTIONS));
    expect(result.current.error).toBeNull();
  });

  it("reports whichever half failed, and loads again on retry", async () => {
    vi.mocked(fetchCategories).mockResolvedValue({
      ok: false,
      message: "No categories.",
    });
    const { result } = renderHook(() => useCampaignOptions());
    await waitFor(() => expect(result.current.error).toBe("No categories."));

    vi.mocked(fetchCategories).mockResolvedValue({
      ok: true,
      data: OPTIONS.categories,
    });
    vi.mocked(fetchMarkets).mockResolvedValue({
      ok: false,
      message: "No markets.",
    });
    act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.error).toBe("No markets."));

    vi.mocked(fetchMarkets).mockResolvedValue({
      ok: true,
      data: OPTIONS.markets,
    });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.options).toEqual(OPTIONS));
    expect(fetchCategories).toHaveBeenCalledTimes(3);
  });

  it("ignores an answer that lands after unmount", async () => {
    let finish!: (value: { ok: true; data: never[] }) => void;
    vi.mocked(fetchCategories).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
    );
    const { result, unmount } = renderHook(() => useCampaignOptions());
    unmount();
    finish({ ok: true, data: [] });
    await Promise.resolve();
    expect(result.current.options).toBeNull();
  });
});

describe("looking up a market", () => {
  it("finds a country's regions and name, falling back to the code", () => {
    expect(regionsOf(OPTIONS, "US")).toEqual([
      { code: "US-CA", name: "California" },
    ]);
    expect(regionsOf(OPTIONS, "PH")).toEqual([]);
    expect(countryName(OPTIONS, "US")).toBe("United States");
    expect(countryName(OPTIONS, "PH")).toBe("PH");
  });
});
