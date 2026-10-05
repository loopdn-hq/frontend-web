import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the request is faked. The query building stays real, so what these
// cases assert is the query the endpoint would actually have been sent.
vi.mock("@/lib/billingTransactions", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billingTransactions")
  >("@/lib/billingTransactions");
  return { ...actual, fetchBillingTransactions: vi.fn() };
});

import { TransactionHistory } from "@/components/settings/TransactionHistory";
import {
  fetchBillingTransactions,
  type BillingTransaction,
  type BillingTransactionPage,
} from "@/lib/billingTransactions";

type FetchResult = Awaited<ReturnType<typeof fetchBillingTransactions>>;

function row(overrides: Partial<BillingTransaction> = {}): BillingTransaction {
  return {
    id: 17,
    kind: "plan_subscription",
    kindLabel: "Plan subscription",
    amountCents: 999,
    currency: "usd",
    description: "Premium plan",
    stripeReference: "in_1Q",
    receiptUrl: "https://invoice.stripe.com/i/abc",
    paidAt: "2026-10-01T14:03:22-05:00",
    ...overrides,
  };
}

function page(
  transactions: BillingTransaction[],
  overrides: Partial<BillingTransactionPage> = {},
): FetchResult {
  return {
    ok: true,
    data: {
      transactions,
      count: transactions.length,
      hasMore: false,
      ...overrides,
    },
  };
}

function given(result: FetchResult) {
  vi.mocked(fetchBillingTransactions).mockResolvedValue(result);
}

/** A request that stays out until the test answers it. */
function deferred() {
  let resolve!: (result: FetchResult) => void;
  const promise = new Promise<FetchResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function queries() {
  return vi.mocked(fetchBillingTransactions).mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  given(page([]));
});

describe("TransactionHistory", () => {
  it("asks for the last 7 days of every kind on arrival", async () => {
    render(<TransactionHistory />);
    await waitFor(() => expect(queries()).toEqual(["range=7d&page=1"]));
    expect(screen.getByLabelText("Period")).toHaveValue("7d");
    expect(screen.getByLabelText("Payment type")).toHaveValue("all");
  });

  it("shows the loading treatment while the request is out, filters still usable", async () => {
    const pending = deferred();
    vi.mocked(fetchBillingTransactions).mockReturnValue(pending.promise);
    render(<TransactionHistory />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading transactions",
    );
    expect(screen.getByLabelText("Period")).toBeEnabled();
    expect(screen.getByLabelText("Payment type")).toBeEnabled();

    pending.resolve(page([row()]));
    expect(await screen.findByText("Premium plan")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says the period is empty rather than drawing an empty table", async () => {
    render(<TransactionHistory />);
    expect(
      await screen.findByText("No transactions in this period."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Amount")).not.toBeInTheDocument();
  });

  it("shows a failure with a retry, and the retry asks again", async () => {
    const user = userEvent.setup();
    given({ ok: false, message: "Something went wrong." });
    render(<TransactionHistory />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
    // A failure is not an empty period.
    expect(
      screen.queryByText("No transactions in this period."),
    ).not.toBeInTheDocument();

    given(page([row()]));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Premium plan")).toBeInTheDocument();
    expect(queries()).toEqual(["range=7d&page=1", "range=7d&page=1"]);
  });

  it("puts a 400's message beside the control it is about", async () => {
    given({
      ok: false,
      message: "Invalid kind.",
      fieldErrors: { kind: "Select a valid payment type." },
    });
    render(<TransactionHistory />);

    const message = await screen.findByText("Select a valid payment type.");
    // Field renders the message inside the same wrapper as its control.
    expect(message.parentElement).toContainElement(
      screen.getByLabelText("Payment type"),
    );
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it("sends the chosen preset and type, and renders the rows that come back", async () => {
    const user = userEvent.setup();
    render(<TransactionHistory />);
    await screen.findByText("No transactions in this period.");

    given(page([row({ id: 3, description: "Purchased Starter Package" })]));
    await user.selectOptions(screen.getByLabelText("Period"), "15d");
    expect(
      await screen.findByText("Purchased Starter Package"),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Payment type"),
      "credit_purchase",
    );
    await waitFor(() =>
      expect(queries().at(-1)).toBe("range=15d&kind=credit_purchase&page=1"),
    );
    expect(queries()).toContain("range=15d&page=1");
  });

  it("does not ask for a custom range until both dates are in", async () => {
    const user = userEvent.setup();
    render(<TransactionHistory />);
    await screen.findByText("No transactions in this period.");
    vi.mocked(fetchBillingTransactions).mockClear();

    await user.selectOptions(screen.getByLabelText("Period"), "custom");
    expect(
      screen.getByText(/choose a start and an end date/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2020-03-01" },
    });
    expect(fetchBillingTransactions).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2020-03-10" },
    });
    await waitFor(() =>
      expect(queries()).toEqual([
        "range=custom&start_date=2020-03-01&end_date=2020-03-10&page=1",
      ]),
    );
  });

  it("refuses a reversed custom range without sending it", async () => {
    const user = userEvent.setup();
    render(<TransactionHistory />);
    await screen.findByText("No transactions in this period.");
    vi.mocked(fetchBillingTransactions).mockClear();

    await user.selectOptions(screen.getByLabelText("Period"), "custom");
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2020-03-10" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2020-03-01" },
    });

    expect(
      screen.getByText("The end date can't be before the start date."),
    ).toBeInTheDocument();
    expect(fetchBillingTransactions).not.toHaveBeenCalled();
  });

  it("keeps the dates from running backwards or into the future", async () => {
    const user = userEvent.setup();
    render(<TransactionHistory />);
    await user.selectOptions(screen.getByLabelText("Period"), "custom");

    const start = screen.getByLabelText("Start date");
    const end = screen.getByLabelText("End date");
    expect(start).toHaveAttribute("max");
    expect(end).toHaveAttribute("max", start.getAttribute("max"));

    fireEvent.change(start, { target: { value: "2020-03-10" } });
    expect(end).toHaveAttribute("min", "2020-03-10");
  });

  it("shows the receipt link only when there is a receipt", async () => {
    given(
      page([
        row({ id: 1, description: "With receipt" }),
        row({ id: 2, description: "Without receipt", receiptUrl: "" }),
      ]),
    );
    render(<TransactionHistory />);
    await screen.findByText("With receipt");

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "https://invoice.stripe.com/i/abc",
    );
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the kind label as sent and the amount in the row's currency", async () => {
    given(page([row({ kindLabel: "Enterprise plan", currency: "eur" })]));
    render(<TransactionHistory />);
    expect(
      await screen.findByText(/€\s?9[.,]99|9[.,]99\s?€/),
    ).toBeInTheDocument();
    // The filter has an option of the same name, so look inside the row.
    expect(screen.getByRole("listitem")).toHaveTextContent("Enterprise plan");
  });

  it("loads the next page onto the end, and starts over when a filter changes", async () => {
    const user = userEvent.setup();
    given(
      page([row({ id: 1, description: "First" })], {
        count: 2,
        hasMore: true,
      }),
    );
    render(<TransactionHistory />);
    await screen.findByText("First");
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();

    given(page([row({ id: 2, description: "Second" })], { count: 2 }));
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Second");
    expect(queries().at(-1)).toBe("range=7d&page=2");
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Second"),
    ]);
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Period"), "15d");
    await waitFor(() => expect(queries().at(-1)).toBe("range=15d&page=1"));
  });

  it("never lets an older answer replace a newer one", async () => {
    const user = userEvent.setup();
    const slow = deferred();
    const fast = deferred();
    vi.mocked(fetchBillingTransactions).mockImplementation((query) =>
      query.includes("range=7d") ? slow.promise : fast.promise,
    );
    render(<TransactionHistory />);

    await user.selectOptions(screen.getByLabelText("Period"), "30d");
    fast.resolve(page([row({ id: 2, description: "Thirty day row" })]));
    await screen.findByText("Thirty day row");

    // The first request, for a filter nobody is looking at, lands last.
    slow.resolve(page([row({ id: 1, description: "Seven day row" })]));
    await Promise.resolve();
    await waitFor(() =>
      expect(screen.getByText("Thirty day row")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Seven day row")).not.toBeInTheDocument();
  });
});
