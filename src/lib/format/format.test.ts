import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatBudget, formatDay, formatMoment } from "@/lib/admin/format";
import { formatCallDuration, useElapsedSeconds } from "@/lib/calls/format";
import { formatCents } from "@/lib/format/money";
import { cn } from "@/lib/ui/cn";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatCents", () => {
  it("prints minor units in the currency it is given", () => {
    expect(formatCents(123456, "usd")).toBe("$1,234.56");
    expect(formatCents(0, "USD")).toBe("$0.00");
    expect(formatCents(999, "eur")).toBe("€9.99");
  });
});

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

describe("formatCallDuration", () => {
  it("prints minutes and seconds, and hours once there are any", () => {
    expect(formatCallDuration(75)).toBe("1:15");
    expect(formatCallDuration(3725)).toBe("1:02:05");
    expect(formatCallDuration(5.9)).toBe("0:05");
  });

  it("never goes below zero", () => {
    expect(formatCallDuration(-4)).toBe("0:00");
  });
});

describe("useElapsedSeconds", () => {
  it("counts up from the start, once a second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:10Z"));
    const { result } = renderHook(() =>
      useElapsedSeconds("2026-10-05T12:00:00Z"),
    );
    expect(result.current).toBe(10);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(13);
  });

  it("is null with no start, or one it cannot read", () => {
    expect(renderHook(() => useElapsedSeconds(null)).result.current).toBeNull();
    expect(
      renderHook(() => useElapsedSeconds("whenever")).result.current,
    ).toBeNull();
  });

  it("does not run backwards when the start is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const { result, unmount } = renderHook(() =>
      useElapsedSeconds("2026-10-05T12:00:05Z"),
    );
    expect(result.current).toBe(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("cn", () => {
  it("joins class names, dropping the falsy and resolving Tailwind conflicts", () => {
    expect(cn("px-2", false, undefined, "px-4", { hidden: true })).toBe(
      "px-4 hidden",
    );
  });
});
