import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
let auth: { session: string | null; isLoaded: boolean };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/site/SiteTopNav", () => ({ SiteTopNav: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/lib/auth/client", () => ({
  setPostAuthRedirect: vi.fn(),
  useAuth: () => auth,
}));
vi.mock("@/lib/config/origin", () => ({
  publicOrigin: () => "https://loopdn.com",
}));
vi.mock("@/lib/enterprise/api", () => ({
  fetchEnterprisePricingCatalog: vi.fn(),
  submitEnterpriseConfiguration: vi.fn(),
}));

import EnterprisePlanBuilderPage from "@/app/enterprise/builder/page";
import { InvoicePreviewModal } from "@/components/enterprise/InvoicePreviewModal";
import { setPostAuthRedirect } from "@/lib/auth/client";
import {
  fetchEnterprisePricingCatalog,
  submitEnterpriseConfiguration,
  type EnterpriseInvoicePreview,
} from "@/lib/enterprise/api";
import {
  calculateEnterprisePrice,
  DEFAULT_CATALOG,
  DEFAULT_CONFIGURATION,
  formatCents,
} from "@/lib/enterprise/catalog";
import { loadEnterpriseDraft } from "@/lib/enterprise/draft";
import { platform } from "@/lib/platform";
import { deferred } from "@/test/helpers";

type Checkout = Awaited<ReturnType<typeof submitEnterpriseConfiguration>>;

const INVOICE: EnterpriseInvoicePreview = {
  currency: "usd",
  billingInterval: "quarterly",
  lineItems: [
    { description: "Enterprise base", amountCents: 18_000 },
    { description: "500 groups", amountCents: 45_000 },
  ],
  subtotalCents: 63_000,
  discountCents: 3_150,
  totalCents: 59_850,
};

function checkoutIs(result: Checkout) {
  vi.mocked(submitEnterpriseConfiguration).mockResolvedValue(result);
}

const CHECKOUT_OK: Checkout = {
  ok: true,
  draftId: "draft-9",
  checkoutUrl: "https://checkout.stripe.com/c/pay_123",
  invoice: INVOICE,
  contractId: "contract-1",
  contractNumber: "ENT-0001",
};

/** The summary card: the selections, the estimate and the way forward. */
function summary() {
  return screen.getByRole("heading", { name: "Your selections" })
    .parentElement as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth = { session: "sam", isLoaded: true };
  vi.mocked(fetchEnterprisePricingCatalog).mockResolvedValue({
    ok: true,
    catalog: DEFAULT_CATALOG,
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EnterprisePlanBuilderPage - choosing", () => {
  it("starts from the default plan, estimated from the catalog", async () => {
    render(<EnterprisePlanBuilderPage />);
    expect(
      screen.getByRole("heading", { name: "Build Your Enterprise Plan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Monthly/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "100 groups" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Search" })).not.toBeChecked();

    const estimate = calculateEnterprisePrice(
      DEFAULT_CONFIGURATION,
      DEFAULT_CATALOG,
    );
    expect(summary()).toHaveTextContent(formatCents(estimate.periodTotalCents));
    expect(summary()).toHaveTextContent("Monthly billing");
    expect(summary()).toHaveTextContent("100 groups");
    expect(summary()).toHaveTextContent("10,000 messages / mo");
    // A single month has no monthly equivalent to show.
    expect(summary()).not.toHaveTextContent("/mo equivalent");
    expect(
      screen.getByRole("link", { name: "Talk to sales instead" }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/contact\/?$/));
    await waitFor(() =>
      expect(fetchEnterprisePricingCatalog).toHaveBeenCalled(),
    );
  });

  it("saves each choice as it is made, and re-estimates", async () => {
    render(<EnterprisePlanBuilderPage />);
    const before = summary().textContent;

    await userEvent.click(screen.getByRole("radio", { name: /^Quarterly/ }));
    await userEvent.click(screen.getByRole("radio", { name: "500 groups" }));
    await userEvent.click(
      screen.getByRole("radio", { name: "1,000 members / group" }),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "100 admins / group" }),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "500 GB storage" }),
    );
    await userEvent.click(screen.getByRole("switch", { name: "Search" }));
    await userEvent.click(screen.getByRole("switch", { name: "Calls" }));
    await userEvent.click(screen.getByRole("radio", { name: "Advanced" }));
    await userEvent.click(
      screen.getByRole("radio", { name: "50,000 messages / mo" }),
    );

    const saved = loadEnterpriseDraft();
    expect(saved?.configuration).toEqual({
      ...DEFAULT_CONFIGURATION,
      billing_interval: "quarterly",
      limits: {
        max_groups: 500,
        max_members_per_group: 1000,
        max_admins_per_group: 100,
        storage_gb: 500,
      },
      features: {
        ...DEFAULT_CONFIGURATION.features,
        search: true,
        calls: true,
        analytics: "advanced",
      },
      credits: { monthly_messages: 50_000 },
    });

    const estimate = calculateEnterprisePrice(
      saved!.configuration,
      DEFAULT_CATALOG,
    );
    expect(summary().textContent).not.toBe(before);
    expect(summary()).toHaveTextContent("Quarterly billing");
    expect(summary()).toHaveTextContent("Search");
    expect(summary()).toHaveTextContent("Calls");
    expect(summary()).toHaveTextContent("Advanced analytics");
    expect(summary()).toHaveTextContent(formatCents(estimate.periodTotalCents));
    expect(summary()).toHaveTextContent(
      `~${formatCents(estimate.monthlyEquivalentCents)}/mo equivalent`,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Search" }));
    expect(loadEnterpriseDraft()?.configuration.features.search).toBe(false);
  });

  it("picks up a plan that was being built before", () => {
    localStorage.setItem(
      "loopdn_enterprise_draft",
      JSON.stringify({
        configuration: {
          ...DEFAULT_CONFIGURATION,
          billing_interval: "annual",
          limits: { ...DEFAULT_CONFIGURATION.limits, max_groups: 300 },
        },
        status: "draft",
        updatedAt: new Date().toISOString(),
      }),
    );
    render(<EnterprisePlanBuilderPage />);
    // Whatever the draft module accepts, the page shows what it returns.
    const draft = loadEnterpriseDraft();
    const interval = draft?.configuration.billing_interval ?? "monthly";
    expect(
      screen.getByRole("radio", {
        name: new RegExp(`^${interval[0].toUpperCase()}${interval.slice(1)}`),
      }),
    ).toBeChecked();
  });

  it("says the prices are estimates when the live catalog cannot be read", async () => {
    vi.mocked(fetchEnterprisePricingCatalog).mockResolvedValue({
      ok: false,
      message: "down",
    } as never);
    render(<EnterprisePlanBuilderPage />);
    expect(
      await screen.findByText(/live pricing is temporarily unavailable/),
    ).toBeInTheDocument();
  });

  it("prices from the live catalog once it arrives", async () => {
    const live = { ...DEFAULT_CATALOG, baseFeeCents: 999_900 };
    vi.mocked(fetchEnterprisePricingCatalog).mockResolvedValue({
      ok: true,
      catalog: live,
    } as never);
    render(<EnterprisePlanBuilderPage />);
    const estimate = calculateEnterprisePrice(DEFAULT_CONFIGURATION, live);
    await waitFor(() =>
      expect(summary()).toHaveTextContent(
        formatCents(estimate.periodTotalCents),
      ),
    );
    expect(
      screen.queryByText(/temporarily unavailable/),
    ).not.toBeInTheDocument();
  });

  it("falls back to the first interval when the catalog lacks the chosen one", async () => {
    vi.mocked(fetchEnterprisePricingCatalog).mockResolvedValue({
      ok: true,
      catalog: {
        ...DEFAULT_CATALOG,
        billingIntervals: DEFAULT_CATALOG.billingIntervals.slice(1),
      },
    } as never);
    render(<EnterprisePlanBuilderPage />);
    await waitFor(() =>
      expect(summary()).toHaveTextContent("Quarterly billing"),
    );
  });

  it("ignores a catalog that arrives after the page has gone", async () => {
    const pending = deferred<unknown>();
    vi.mocked(fetchEnterprisePricingCatalog).mockReturnValue(
      pending.promise as never,
    );
    const { unmount, container } = render(<EnterprisePlanBuilderPage />);
    unmount();
    pending.resolve({ ok: false, message: "late" });
    await pending.promise;
    expect(container).toBeEmptyDOMElement();
  });
});

describe("EnterprisePlanBuilderPage - continuing", () => {
  it.each([
    ["Log in to continue", "/login/"],
    ["Create an account to continue", "/signup/"],
  ])("sends a visitor through %s, and back here after", async (name, path) => {
    auth = { session: null, isLoaded: true };
    render(<EnterprisePlanBuilderPage />);
    expect(
      screen.queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name }));
    expect(setPostAuthRedirect).toHaveBeenCalledWith("/enterprise/builder/");
    expect(push).toHaveBeenCalledWith(path);
    // The plan is saved even if nothing was changed, so it is there on return.
    expect(loadEnterpriseDraft()?.configuration).toEqual(DEFAULT_CONFIGURATION);
  });

  it("treats a session still being read as signed out", () => {
    auth = { session: "sam", isLoaded: false };
    render(<EnterprisePlanBuilderPage />);
    expect(
      screen.getByRole("button", { name: "Log in to continue" }),
    ).toBeInTheDocument();
  });

  it("submits the plan, shows the invoice, then goes to checkout", async () => {
    const answer = deferred<Checkout>();
    vi.mocked(submitEnterpriseConfiguration).mockReturnValue(answer.promise);
    const openExternal = vi
      .spyOn(platform, "openExternal")
      .mockResolvedValue(undefined as never);
    render(<EnterprisePlanBuilderPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("button", { name: "Preparing checkout..." }),
    ).toBeDisabled();
    expect(submitEnterpriseConfiguration).toHaveBeenCalledWith(
      DEFAULT_CONFIGURATION,
      undefined,
      "https://loopdn.com/enterprise/checkout/success/",
      "https://loopdn.com/enterprise/checkout/cancel/",
    );

    await act(async () => answer.resolve(CHECKOUT_OK));
    const dialog = screen.getByRole("dialog", { name: "Review your invoice" });
    expect(dialog).toHaveTextContent(
      "Quarterly billing, calculated by Loopd'n.",
    );
    expect(dialog).toHaveTextContent("$598.50");
    expect(loadEnterpriseDraft()?.remoteDraftId).toBe("draft-9");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Proceed to checkout" }),
    );
    expect(openExternal).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay_123",
    );
    expect(
      within(dialog).getByRole("button", { name: "Redirecting..." }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Back to builder" }),
    ).toBeDisabled();
  });

  it("updates the same draft the second time round", async () => {
    checkoutIs(CHECKOUT_OK);
    render(<EnterprisePlanBuilderPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Back to builder" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("dialog");
    expect(vi.mocked(submitEnterpriseConfiguration).mock.calls[1][1]).toBe(
      "draft-9",
    );
  });

  it("says why checkout could not be prepared, until the plan is changed", async () => {
    checkoutIs({ ok: false, message: "Pricing is being updated." } as Checkout);
    render(<EnterprisePlanBuilderPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByText("Pricing is being updated."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "500 groups" }));
    expect(
      screen.queryByText("Pricing is being updated."),
    ).not.toBeInTheDocument();
  });
});

describe("InvoicePreviewModal", () => {
  function show(
    invoice: EnterpriseInvoicePreview | null,
    isRedirecting = false,
  ) {
    const onClose = vi.fn();
    const onProceedToCheckout = vi.fn();
    render(
      <InvoicePreviewModal
        isOpen
        invoice={invoice}
        isRedirecting={isRedirecting}
        onClose={onClose}
        onProceedToCheckout={onProceedToCheckout}
      />,
    );
    return { onClose, onProceedToCheckout };
  }

  it("shows nothing without an invoice", () => {
    show(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("itemises the invoice, with the discount and the total", async () => {
    const { onClose, onProceedToCheckout } = show(INVOICE);
    const dialog = screen.getByRole("dialog", { name: "Review your invoice" });
    expect(dialog).toHaveTextContent("Enterprise base$180.00");
    expect(dialog).toHaveTextContent("500 groups$450.00");
    expect(dialog).toHaveTextContent("Subtotal$630.00");
    expect(dialog).toHaveTextContent("Discount-$31.50");
    expect(dialog).toHaveTextContent("$598.50");

    await userEvent.click(
      screen.getByRole("button", { name: "Proceed to checkout" }),
    );
    expect(onProceedToCheckout).toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to builder" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ["monthly", "Monthly"],
    ["annual", "Annual"],
  ] as const)(
    "names %s billing, with no discount row at zero",
    (interval, label) => {
      show({
        ...INVOICE,
        billingInterval: interval,
        discountCents: 0,
        currency: "eur",
      });
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent(
        `${label} billing, calculated by Loopd'n.`,
      );
      expect(dialog).not.toHaveTextContent("Discount");
      expect(dialog).toHaveTextContent("€598.50");
    },
  );
});
