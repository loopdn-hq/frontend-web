import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/conversations", () => ({
  authorizedRequest: vi.fn(),
}));

import { authorizedRequest } from "@/lib/chat/conversations";
import {
  buildTransactionsQuery,
  customRangeErrors,
  fetchBillingTransactions,
  formatTransactionAmount,
  receiptHref,
  todayIsoDate,
  type TransactionFilters,
} from "@/lib/billingTransactions";

const TODAY = "2026-10-05";

function filters(overrides: Partial<TransactionFilters> = {}) {
  return {
    range: "30d",
    startDate: "",
    endDate: "",
    kind: "all",
    ...overrides,
  } satisfies TransactionFilters;
}

/** The envelope every endpoint answers with (loopd/renderers.py). */
function respond(status: number, body: unknown) {
  vi.mocked(authorizedRequest).mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildTransactionsQuery", () => {
  it("sends each preset as its range and nothing about dates", () => {
    for (const range of ["7d", "15d", "30d"] as const) {
      expect(buildTransactionsQuery(filters({ range }), 1, TODAY)).toBe(
        `range=${range}&page=1`,
      );
    }
  });

  it("drops dates left over from a custom range once a preset is chosen", () => {
    const query = buildTransactionsQuery(
      filters({ range: "7d", startDate: "2026-09-01", endDate: "2026-09-10" }),
      1,
      TODAY,
    );
    expect(query).toBe("range=7d&page=1");
  });

  it("sends both dates for a custom range, and a single day is a range", () => {
    expect(
      buildTransactionsQuery(
        filters({
          range: "custom",
          startDate: "2026-09-01",
          endDate: "2026-09-10",
        }),
        1,
        TODAY,
      ),
    ).toBe("range=custom&start_date=2026-09-01&end_date=2026-09-10&page=1");

    expect(
      buildTransactionsQuery(
        filters({ range: "custom", startDate: TODAY, endDate: TODAY }),
        1,
        TODAY,
      ),
    ).toBe(`range=custom&start_date=${TODAY}&end_date=${TODAY}&page=1`);
  });

  it("sends nothing while a custom range is missing a date", () => {
    for (const dates of [
      { startDate: "", endDate: "" },
      { startDate: "2026-09-01", endDate: "" },
      { startDate: "", endDate: "2026-09-10" },
    ]) {
      expect(
        buildTransactionsQuery(
          filters({ range: "custom", ...dates }),
          1,
          TODAY,
        ),
      ).toBeNull();
    }
  });

  it("sends nothing for a reversed or future custom range", () => {
    expect(
      buildTransactionsQuery(
        filters({
          range: "custom",
          startDate: "2026-09-10",
          endDate: "2026-09-01",
        }),
        1,
        TODAY,
      ),
    ).toBeNull();
    expect(
      buildTransactionsQuery(
        filters({
          range: "custom",
          startDate: "2026-10-01",
          endDate: "2026-10-06",
        }),
        1,
        TODAY,
      ),
    ).toBeNull();
  });

  it("sends kind for each type and leaves it out for All", () => {
    for (const kind of [
      "plan_subscription",
      "enterprise_plan",
      "credit_purchase",
    ] as const) {
      expect(buildTransactionsQuery(filters({ kind }), 1, TODAY)).toBe(
        `range=30d&kind=${kind}&page=1`,
      );
    }
    expect(buildTransactionsQuery(filters(), 1, TODAY)).not.toContain("kind");
  });

  it("carries the page number", () => {
    expect(buildTransactionsQuery(filters({ range: "15d" }), 3, TODAY)).toBe(
      "range=15d&page=3",
    );
  });
});

describe("customRangeErrors", () => {
  it("says nothing about a preset, or about a date not chosen yet", () => {
    expect(customRangeErrors(filters(), TODAY)).toEqual({});
    expect(
      customRangeErrors(
        filters({ range: "custom", startDate: "2026-09-01" }),
        TODAY,
      ),
    ).toEqual({});
  });

  it("puts a reversed range on the end date, the API's own key for it", () => {
    const errors = customRangeErrors(
      filters({
        range: "custom",
        startDate: "2026-09-10",
        endDate: "2026-09-01",
      }),
      TODAY,
    );
    expect(Object.keys(errors)).toEqual(["end_date"]);
  });

  it("refuses a future date on whichever control holds it", () => {
    const errors = customRangeErrors(
      filters({
        range: "custom",
        startDate: "2026-10-06",
        endDate: "2026-10-07",
      }),
      TODAY,
    );
    expect(errors.start_date).toMatch(/future/);
    expect(errors.end_date).toMatch(/future/);
  });
});

describe("todayIsoDate", () => {
  it("uses the local calendar and pads the month and day", () => {
    expect(todayIsoDate(new Date(2026, 2, 4, 23, 30))).toBe("2026-03-04");
  });
});

describe("fetchBillingTransactions", () => {
  it("asks the transactions endpoint with the query it was given", async () => {
    respond(200, {
      data: { count: 0, next: null, previous: null, results: [] },
    });
    await fetchBillingTransactions("range=7d&page=1");
    expect(vi.mocked(authorizedRequest).mock.calls.at(-1)?.[0]).toBe(
      "/billing/transactions/?range=7d&page=1",
    );
  });

  it("reads a page: rows in the order sent, the count, and whether more exist", async () => {
    respond(200, {
      code: 0,
      message: "ok",
      data: {
        count: 42,
        next: "https://api.example/api/v1/billing/transactions/?page=2&range=30d",
        previous: null,
        results: [
          {
            id: 17,
            kind: "plan_subscription",
            kind_label: "Plan subscription",
            amount_cents: 999,
            currency: "usd",
            description: "Premium plan",
            stripe_reference: "in_1Q",
            receipt_url: "https://invoice.stripe.com/i/abc",
            paid_at: "2026-10-01T14:03:22-05:00",
          },
          {
            id: 9,
            kind: "credit_purchase",
            kind_label: "Credit purchase",
            amount_cents: 2500,
            currency: "usd",
            description: "",
            stripe_reference: "",
            receipt_url: "",
            paid_at: "2026-09-20T09:00:00-05:00",
          },
        ],
      },
    });

    const result = await fetchBillingTransactions("range=30d&page=1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.count).toBe(42);
    expect(result.data.hasMore).toBe(true);
    expect(result.data.transactions.map((row) => row.id)).toEqual([17, 9]);
    expect(result.data.transactions[0]).toEqual({
      id: 17,
      kind: "plan_subscription",
      kindLabel: "Plan subscription",
      amountCents: 999,
      currency: "usd",
      description: "Premium plan",
      receiptUrl: "https://invoice.stripe.com/i/abc",
      paidAt: "2026-10-01T14:03:22-05:00",
    });
  });

  it("reads an empty last page as empty, with nothing more to load", async () => {
    respond(200, {
      data: { count: 0, next: null, previous: null, results: [] },
    });
    const result = await fetchBillingTransactions("range=7d&page=1");
    expect(result).toEqual({
      ok: true,
      data: { transactions: [], count: 0, hasMore: false },
    });
  });

  it("keys a 400's messages by field, and drops keys with no control", async () => {
    respond(400, {
      code: -1,
      message: "end_date must not be before start_date.",
      data: {
        end_date: ["end_date must not be before start_date."],
        something_else: ["ignored"],
      },
    });
    const result = await fetchBillingTransactions("range=custom&page=1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({
      end_date: "end_date must not be before start_date.",
    });
  });

  it("reports a server failure with no field errors", async () => {
    respond(500, { message: "Something went wrong." });
    const result = await fetchBillingTransactions("range=30d&page=1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe("Something went wrong.");
    expect(result.fieldErrors).toBeUndefined();
  });

  it("survives a network failure without throwing", async () => {
    vi.mocked(authorizedRequest).mockRejectedValue(new Error("offline"));
    const result = await fetchBillingTransactions("range=30d&page=1");
    expect(result.ok).toBe(false);
  });
});

describe("formatTransactionAmount", () => {
  it("formats with the row's lowercase currency code", () => {
    expect(formatTransactionAmount(999, "usd", "en-US")).toBe("$9.99");
    expect(formatTransactionAmount(1050, "eur", "en-US")).toBe("€10.50");
  });

  it("does not divide a currency that has no minor unit", () => {
    expect(formatTransactionAmount(500, "jpy", "en-US")).toBe("¥500");
  });

  it("still shows the number for a code Intl refuses", () => {
    expect(formatTransactionAmount(999, "", "en-US")).toBe("9.99");
  });
});

describe("receiptHref", () => {
  it("is null for an empty receipt and for anything that is not a web address", () => {
    expect(receiptHref("")).toBeNull();
    expect(receiptHref("javascript:alert(1)")).toBeNull();
    expect(receiptHref("https://invoice.stripe.com/i/abc")).toBe(
      "https://invoice.stripe.com/i/abc",
    );
  });
});
