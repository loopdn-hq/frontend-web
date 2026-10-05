import { describe, expect, it } from "vitest";

import { formatBudget, formatDay, formatMoment } from "@/lib/admin/format";

describe("admin formatting", () => {
  it("prints a day, and nothing for nothing or for nonsense", () => {
    expect(formatDay("2026-10-02T12:00:00")).toMatch(/2026/);
    expect(formatDay(null)).toBe("");
    expect(formatDay("not a date")).toBe("");
  });

  it("prints a moment as the day and the time", () => {
    const text = formatMoment("2026-10-02T00:41:00");
    expect(text).toContain(" at ");
    expect(text).toMatch(/41/);
    expect(formatMoment(null)).toBe("");
    expect(formatMoment("not a date")).toBe("");
  });

  it("says when a budget is not set rather than printing zero", () => {
    expect(formatBudget(null, "usd")).toBe("Not set");
    expect(formatBudget(5000, "usd")).toBe("$50.00");
  });
});
