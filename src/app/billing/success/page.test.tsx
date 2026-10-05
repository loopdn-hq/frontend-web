import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = "flow=plan&plan=premium";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/auth/client", () => ({
  getAccessToken: vi.fn(() => "token"),
}));
// Only the request is faked; the query it is given stays the real one.
vi.mock("@/lib/billingTransactions", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billingTransactions")
  >("@/lib/billingTransactions");
  return { ...actual, fetchBillingTransactions: vi.fn() };
});

import BillingSuccessPage from "@/app/billing/success/page";
import { getAccessToken } from "@/lib/auth/client";
import {
  fetchBillingTransactions,
  type BillingTransaction,
} from "@/lib/billingTransactions";

const NOW = new Date("2026-10-05T12:00:00Z");

function row(overrides: Partial<BillingTransaction> = {}): BillingTransaction {
  return {
    id: 17,
    kind: "plan_subscription",
    kindLabel: "Plan subscription",
    amountCents: 999,
    currency: "usd",
    description: "Premium plan",
    receiptUrl: "https://invoice.stripe.com/i/abc",
    paidAt: "2026-10-05T11:59:30Z",
    ...overrides,
  };
}

function given(transactions: BillingTransaction[]) {
  vi.mocked(fetchBillingTransactions).mockResolvedValue({
    ok: true,
    data: { transactions, count: transactions.length, hasMore: false },
  });
}

/** Let time pass, and let whatever it woke up finish. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function queries() {
  return vi.mocked(fetchBillingTransactions).mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  search = "flow=plan&plan=premium";
  vi.mocked(getAccessToken).mockReturnValue("token");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BillingSuccessPage", () => {
  it("shows the receipt for the payment just made", async () => {
    given([row()]);
    render(<BillingSuccessPage />);
    await advance(0);

    expect(queries()).toEqual(["range=7d&kind=plan_subscription&page=1"]);
    expect(screen.getByText("Premium plan")).toBeInTheDocument();
    expect(screen.getByText("Plan subscription")).toBeInTheDocument();
    expect(screen.getByText(/9[.,]99/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view stripe receipt/i });
    expect(link).toHaveAttribute("href", "https://invoice.stripe.com/i/abc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("asks for a credit purchase after a credit checkout", async () => {
    search = "flow=credits&package=3";
    given([row({ kind: "credit_purchase" })]);
    render(<BillingSuccessPage />);
    await advance(0);
    expect(queries()).toEqual(["range=7d&kind=credit_purchase&page=1"]);
  });

  it("counts down ten seconds, then goes to the chats", async () => {
    given([row()]);
    render(<BillingSuccessPage />);
    await advance(0);

    expect(screen.getByText(/taking you to your chats in/i)).toHaveTextContent(
      "10 seconds",
    );
    await advance(9_000);
    expect(screen.getByText(/taking you to your chats in/i)).toHaveTextContent(
      "1 second.",
    );
    expect(replace).not.toHaveBeenCalled();

    await advance(1_000);
    expect(replace).toHaveBeenCalledWith("/chats/");
  });

  it("stays put when asked to", async () => {
    given([row()]);
    render(<BillingSuccessPage />);
    await advance(3_000);

    await act(async () => {
      screen.getByRole("button", { name: /stay on this page/i }).click();
    });
    await advance(30_000);

    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/taking you to your chats in/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Premium plan")).toBeInTheDocument();
  });

  it("waits for the webhook, and does not start counting until the receipt is in", async () => {
    given([]);
    render(<BillingSuccessPage />);
    await advance(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your receipt",
    );
    expect(
      screen.queryByText(/taking you to your chats in/i),
    ).not.toBeInTheDocument();

    given([row()]);
    await advance(2_000);
    expect(screen.getByText("Premium plan")).toBeInTheDocument();
    expect(queries()).toHaveLength(2);
    expect(screen.getByText(/taking you to your chats in/i)).toHaveTextContent(
      "10 seconds",
    );
  });

  it("never passes off an older payment as this one", async () => {
    given([row({ description: "Last month", paidAt: "2026-09-05T12:00:00Z" })]);
    render(<BillingSuccessPage />);
    await advance(10_000);

    expect(screen.queryByText("Last month")).not.toBeInTheDocument();
    expect(screen.getByText(/receipt isn.t ready yet/i)).toBeInTheDocument();
    expect(queries()).toHaveLength(4);
    // Still on its way to the chats, just without a receipt to show.
    await advance(10_000);
    expect(replace).toHaveBeenCalledWith("/chats/");
  });

  it("does not redirect a browser that is not signed in", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    vi.mocked(fetchBillingTransactions).mockResolvedValue({
      ok: false,
      message: "You must be signed in to manage loops.",
    });
    render(<BillingSuccessPage />);
    await advance(30_000);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Payment Successful")).toBeInTheDocument();
    // Outside Next's build the Link drops the trailing slash; either is home.
    expect(
      screen.getByRole("link", { name: "Go to Chats" }).getAttribute("href"),
    ).toMatch(/^\/chats\/?$/);
  });
});
