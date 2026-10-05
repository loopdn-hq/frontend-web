import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
const toast = vi.fn();
const reload = vi.fn();
const update = vi.fn();
let search = "";
let companyState: { company: unknown; status: string };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/auth/client", () => ({
  useAuth: () => ({ session: "sam", isLoaded: true }),
}));
vi.mock("@/lib/commercial/CompanyProvider", () => ({
  useCompany: () => ({ ...companyState, reload, update }),
}));
vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui");
  return { ...actual, useToast: () => toast };
});
vi.mock("@/lib/commercial/api", () => ({
  fetchCampaignPage: vi.fn(),
  fetchCompanyReport: vi.fn(),
  fetchLeads: vi.fn(),
  fetchTransactions: vi.fn(),
}));
// Everything below is tested where it lives; a page only has to mount it.
vi.mock("@/components/commercial/CommercialFrame", () => ({
  CommercialFrame: ({ children }: { children: ReactNode }) => (
    <div data-testid="frame">{children}</div>
  ),
}));
vi.mock("@/components/commercial/CommercialDashboard", () => ({
  CommercialDashboard: ({ children }: { children: ReactNode }) => (
    <div data-testid="dashboard">{children}</div>
  ),
}));
vi.mock("@/components/commercial/CompanyNotice", () => ({
  CompanyNotice: () => <div data-testid="company-notice" />,
}));
vi.mock("@/components/commercial/CompanyForm", () => ({
  CompanyForm: ({
    company: editing,
    submitLabel,
    onSaved,
  }: {
    company: { name: string };
    submitLabel: string;
    onSaved: (company: unknown) => void;
  }) => (
    <button onClick={() => onSaved({ ...editing, name: "Acme Ltd" })}>{submitLabel}</button>
  ),
}));
vi.mock("@/components/commercial/AddFundsDialog", () => ({
  AddFundsDialog: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="add-funds">
        <button onClick={onClose}>Close add funds</button>
      </div>
    ) : null,
}));
vi.mock("@/components/commercial/builder/CampaignBuilder", () => ({
  BuilderSkeleton: () => <div data-testid="builder-skeleton" />,
  CampaignBuilder: ({
    campaignId,
    step,
    company: forCompany,
  }: {
    campaignId: number | null;
    step: string;
    company: { name: string };
  }) => (
    <div
      data-testid="builder"
      data-campaign={campaignId ?? "new"}
      data-step={step}
      data-company={forCompany.name}
    />
  ),
}));
vi.mock("@/components/commercial/CampaignDetail", () => ({
  CampaignDetailSkeleton: () => <div data-testid="detail-skeleton" />,
  CampaignDetail: ({
    campaignId,
    onChanged,
    onDeleted,
  }: {
    campaignId: number;
    onChanged: (campaign: unknown) => void;
    onDeleted: () => void;
  }) => (
    <div data-testid="detail" data-campaign={campaignId}>
      <button
        onClick={() => onChanged({ ...ROW(campaignId), name: "Renamed", status: "paused" })}
      >
        stub change
      </button>
      <button onClick={onDeleted}>stub delete</button>
    </div>
  ),
}));

import CommercialAccountPage from "@/app/(commercial)/account/page";
import CommercialBalancePage from "@/app/(commercial)/balance/page";
import CommercialCampaignRedirectPage from "@/app/(commercial)/campaign/page";
import CommercialNewCampaignPage from "@/app/(commercial)/campaigns/new/page";
import CommercialCampaignsPage from "@/app/(commercial)/campaigns/page";
import CommercialCompanyPage from "@/app/(commercial)/company/page";
import CommercialLayout from "@/app/(commercial)/layout";
import CommercialLeadsPage from "@/app/(commercial)/leads/page";
import CommercialReportsPage from "@/app/(commercial)/reports/page";
import {
  fetchCampaignPage,
  fetchCompanyReport,
  fetchLeads,
  fetchTransactions,
} from "@/lib/commercial/api";
import type {
  Campaign,
  CompanyReport,
  Lead,
  Transaction,
} from "@/lib/commercial/types";
import { campaign, company } from "@/test/commercial";
import { deferred } from "@/test/helpers";

function ROW(id: number, overrides: Partial<Campaign> = {}): Campaign {
  return { ...campaign({ id, name: `Campaign ${id}` }), ...overrides };
}

type CampaignPage = Awaited<ReturnType<typeof fetchCampaignPage>>;

function campaignsAre(rows: Campaign[], extra: { count?: number; hasMore?: boolean } = {}) {
  vi.mocked(fetchCampaignPage).mockResolvedValue({
    ok: true,
    data: {
      campaigns: rows,
      count: extra.count ?? rows.length,
      hasMore: extra.hasMore ?? false,
    },
  });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function hrefOf(name: string | RegExp) {
  return screen.getAllByRole("link", { name })[0].getAttribute("href");
}

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  companyState = { company: company(), status: "ready" };
  campaignsAre([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the commercial layout and small pages", () => {
  it("wraps every page in the frame and the dashboard", () => {
    render(
      <CommercialLayout>
        <p>page</p>
      </CommercialLayout>,
    );
    expect(screen.getByTestId("frame")).toContainElement(screen.getByTestId("dashboard"));
    expect(screen.getByTestId("dashboard")).toHaveTextContent("page");
  });

  it("shows the account page with who is signed in", () => {
    render(<CommercialAccountPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText(/username \(sam\) and password/)).toBeInTheDocument();
  });

  it("forwards the old one-campaign address to the workspace", () => {
    search = "id=12";
    const first = render(<CommercialCampaignRedirectPage />);
    expect(replace).toHaveBeenLastCalledWith("/campaigns/?id=12");
    expect(screen.getByTestId("detail-skeleton")).toBeInTheDocument();
    first.unmount();

    for (const query of ["", "id=abc", "id=-3", "id=1.5"]) {
      search = query;
      const view = render(<CommercialCampaignRedirectPage />);
      expect(replace).toHaveBeenLastCalledWith("/campaigns/");
      view.unmount();
    }
  });
});

describe("the new campaign page", () => {
  it("opens the builder on a new campaign", () => {
    render(<CommercialNewCampaignPage />);
    expect(screen.getByRole("heading", { level: 1, name: "New campaign" })).toBeInTheDocument();
    expect(screen.getByTestId("builder")).toHaveAttribute("data-campaign", "new");
    expect(screen.getByTestId("builder")).toHaveAttribute("data-step", "objective");
    expect(screen.getByTestId("builder")).toHaveAttribute("data-company", "Acme");
    expect(hrefOf("Back to campaigns")).toMatch(/^\/campaigns\/?$/);
  });

  it("opens a draft on the step in the address", () => {
    search = "id=12&step=budget";
    render(<CommercialNewCampaignPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Edit campaign" })).toBeInTheDocument();
    expect(screen.getByTestId("builder")).toHaveAttribute("data-campaign", "12");
    expect(screen.getByTestId("builder")).toHaveAttribute("data-step", "budget");
    expect(hrefOf("Back to campaigns")).toMatch(/^\/campaigns\/?\?id=12$/);
  });

  it("ignores a step or an id it does not recognise", () => {
    search = "id=zero&step=payment";
    render(<CommercialNewCampaignPage />);
    expect(screen.getByTestId("builder")).toHaveAttribute("data-campaign", "new");
    expect(screen.getByTestId("builder")).toHaveAttribute("data-step", "objective");
  });

  it("shows only the company notice until there is a company", () => {
    companyState = { company: null, status: "ready" };
    render(<CommercialNewCampaignPage />);
    expect(screen.getByTestId("company-notice")).toBeInTheDocument();
    expect(screen.queryByTestId("builder")).not.toBeInTheDocument();
  });
});

describe("the company page", () => {
  it("edits the active company and says when it is saved", () => {
    render(<CommercialCompanyPage />);
    expect(
      screen.getByText("Acme - what your ads are labelled with"),
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    click("Save changes");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: "Acme Ltd" }));
    expect(toast).toHaveBeenCalledWith({
      title: "Changes saved",
      description: "Acme Ltd's details are up to date.",
    });
  });

  it("warns when the company is suspended", () => {
    companyState = { company: company({ status: "suspended" }), status: "ready" };
    render(<CommercialCompanyPage />);
    expect(screen.getByText(/This company is suspended/)).toBeInTheDocument();
  });

  it("shows a placeholder while loading, and nothing to edit with no company", () => {
    companyState = { company: null, status: "loading" };
    const loading = render(<CommercialCompanyPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your company");
    expect(screen.getByText("What your ads are labelled with")).toBeInTheDocument();
    loading.unmount();

    companyState = { company: null, status: "ready" };
    render(<CommercialCompanyPage />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});

describe("the campaigns page", () => {
  it("asks for a company first", () => {
    companyState = { company: null, status: "ready" };
    render(<CommercialCampaignsPage />);
    expect(screen.getByTestId("company-notice")).toBeInTheDocument();
    expect(fetchCampaignPage).not.toHaveBeenCalled();
  });

  it("lists the company's campaigns", async () => {
    campaignsAre(
      [
        ROW(1, { status: "running", objective: "lead", createdAt: "2026-10-01T12:00:00" }),
        ROW(2, { name: " ", totalBudgetCents: null, createdAt: null }),
        ROW(3, { createdAt: "not a date" }),
      ],
      { count: 3 },
    );
    render(<CommercialCampaignsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading campaigns");

    expect(await screen.findByRole("link", { name: /campaign 1/i })).toBeInTheDocument();
    expect(fetchCampaignPage).toHaveBeenCalledWith({
      companyId: 3,
      status: undefined,
      search: "",
    });
    expect(screen.getByText("Acme · 3 campaigns")).toBeInTheDocument();
    const first = screen.getByRole("link", { name: /campaign 1/i });
    expect(first).toHaveTextContent("Running");
    expect(first).toHaveTextContent("Leads · $500.00");
    expect(first).toHaveTextContent("10/1/26");
    expect(first.getAttribute("href")).toMatch(/^\/campaigns\/?\?id=1$/);
    expect(screen.getByRole("link", { name: /untitled campaign/i })).toHaveTextContent(
      "No budget yet",
    );
    expect(screen.getByText("Pick a campaign")).toBeInTheDocument();
  });

  it("invites a first campaign when the company has none", async () => {
    render(<CommercialCampaignsPage />);
    expect(await screen.findByText("No campaigns for Acme yet.")).toBeInTheDocument();
    expect(screen.getByText("No campaigns for Acme yet")).toBeInTheDocument();
    expect(screen.getByText("Acme · 0 campaigns")).toBeInTheDocument();
  });

  it("counts one campaign in the singular", async () => {
    campaignsAre([ROW(1)]);
    render(<CommercialCampaignsPage />);
    expect(await screen.findByText("Acme · 1 campaign")).toBeInTheDocument();
  });

  it("filters by status at once, and by search after a pause", async () => {
    vi.useFakeTimers();
    campaignsAre([ROW(1)]);
    render(<CommercialCampaignsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    campaignsAre([]);
    fireEvent.change(screen.getByLabelText("Show campaigns"), {
      target: { value: "paused" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchCampaignPage).toHaveBeenLastCalledWith({
      companyId: 3,
      status: "paused",
      search: "",
    });
    expect(screen.getByText("No campaigns match.")).toBeInTheDocument();
    expect(screen.getByText("Acme · 0 matching")).toBeInTheDocument();
    // Filtered to nothing is not the same as having none: no invitation.
    expect(screen.queryByText("No campaigns for Acme yet")).not.toBeInTheDocument();

    const calls = vi.mocked(fetchCampaignPage).mock.calls.length;
    fireEvent.change(screen.getByRole("searchbox", { name: "Search campaigns" }), {
      target: { value: "  sale " },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(fetchCampaignPage).toHaveBeenCalledTimes(calls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchCampaignPage).toHaveBeenLastCalledWith({
      companyId: 3,
      status: "paused",
      search: "sale",
    });
  });

  it("loads more onto the end, without repeating a row", async () => {
    campaignsAre([ROW(1), ROW(2)], { count: 4, hasMore: true });
    render(<CommercialCampaignsPage />);
    await screen.findByRole("link", { name: /campaign 1/i });

    const more = deferred<CampaignPage>();
    vi.mocked(fetchCampaignPage).mockReturnValue(more.promise);
    click("Load more");
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
    expect(fetchCampaignPage).toHaveBeenLastCalledWith({
      companyId: 3,
      page: 2,
      status: undefined,
      search: "",
    });

    await act(async () =>
      more.resolve({
        ok: true,
        data: { campaigns: [ROW(2), ROW(3)], count: 4, hasMore: false },
      }),
    );
    expect(screen.getAllByRole("link", { name: /^campaign \d/i })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("says why more could not be loaded, and clears that on success", async () => {
    campaignsAre([ROW(1)], { hasMore: true });
    render(<CommercialCampaignsPage />);
    await screen.findByRole("link", { name: /campaign 1/i });

    vi.mocked(fetchCampaignPage).mockResolvedValue({ ok: false, message: "Lost connection." });
    click("Load more");
    expect(await screen.findByText("Lost connection.")).toBeInTheDocument();

    campaignsAre([ROW(2)]);
    click("Load more");
    await waitFor(() =>
      expect(screen.queryByText("Lost connection.")).not.toBeInTheDocument(),
    );
  });

  it("offers a retry when the list cannot be loaded", async () => {
    vi.mocked(fetchCampaignPage).mockResolvedValue({
      ok: false,
      message: "Couldn't load your campaigns.",
    });
    render(<CommercialCampaignsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your campaigns.",
    );
    expect(screen.queryByText(/· \d+ campaign/)).not.toBeInTheDocument();

    campaignsAre([ROW(1)]);
    click(/try again/i);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /campaign 1/i })).toBeInTheDocument();
  });

  it("opens the campaign named in the address beside the list", async () => {
    search = "id=2";
    campaignsAre([ROW(1), ROW(2)], { count: 2 });
    render(<CommercialCampaignsPage />);
    expect(screen.getByTestId("detail")).toHaveAttribute("data-campaign", "2");
    expect(await screen.findByRole("link", { name: /campaign 2/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("complementary")).toHaveClass("hidden");
  });

  it("keeps the list in step with a change made in the detail", async () => {
    search = "id=2";
    campaignsAre([ROW(1), ROW(2)], { count: 2 });
    render(<CommercialCampaignsPage />);
    await screen.findByRole("link", { name: /campaign 2/i });

    click("stub change");
    const row = screen.getByRole("link", { name: /renamed/i });
    expect(row).toHaveTextContent("Paused");
    expect(screen.getByRole("link", { name: /campaign 1/i })).toBeInTheDocument();
  });

  it("drops a deleted draft from the list and closes it", async () => {
    search = "id=2";
    campaignsAre([ROW(1), ROW(2)], { count: 2 });
    render(<CommercialCampaignsPage />);
    await screen.findByRole("link", { name: /campaign 2/i });

    click("stub delete");
    expect(screen.queryByRole("link", { name: /campaign 2/i })).not.toBeInTheDocument();
    expect(screen.getByText("Acme · 1 campaign")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/campaigns/", { scroll: false });
  });

  it("ignores a list that arrives after the page has gone", async () => {
    const pending = deferred<CampaignPage>();
    vi.mocked(fetchCampaignPage).mockReturnValue(pending.promise);
    const { unmount } = render(<CommercialCampaignsPage />);
    unmount();
    pending.resolve({ ok: true, data: { campaigns: [], count: 0, hasMore: false } });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("the billing page", () => {
  type Ledger = Awaited<ReturnType<typeof fetchTransactions>>;

  function row(id: number, overrides: Partial<Transaction> = {}): Transaction {
    return {
      id,
      kind: "credit_purchase",
      label: "Top-up",
      campaignId: null,
      campaignName: null,
      availableChangeCents: 5000,
      availableAfterCents: 17_000,
      reservedChangeCents: 0,
      reservedAfterCents: 5000,
      description: "",
      createdAt: "2026-10-02T09:30:00",
      ...overrides,
    };
  }

  function ledgerIs(rows: Transaction[], hasMore = false) {
    vi.mocked(fetchTransactions).mockResolvedValue({
      ok: true,
      data: { transactions: rows, hasMore },
    });
  }

  beforeEach(() => ledgerIs([]));

  it("shows what is available and what is set aside", async () => {
    render(<CommercialBalancePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Billing" })).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading transactions");
    expect(
      await screen.findByText("No money has moved yet. Add funds to start a campaign."),
    ).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchTransactions).toHaveBeenCalledWith(3);
  });

  it("lists the ledger, signed, with a link to the campaign behind a row", async () => {
    ledgerIs([
      row(1),
      row(2, {
        label: "Set aside",
        campaignId: 12,
        campaignName: "Autumn sale",
        availableChangeCents: -50_000,
        availableAfterCents: 0,
        reservedAfterCents: 50_000,
      }),
      row(3, { label: "Adjustment", availableChangeCents: 0, createdAt: null }),
      row(4, { label: "Odd", createdAt: "not a date" }),
    ]);
    render(<CommercialBalancePage />);
    const first = (await screen.findByText("Top-up")).closest("li")!;
    expect(first).toHaveTextContent("+$50.00");
    expect(first).toHaveTextContent("Available $170.00 · Set aside $50.00");
    expect(first).toHaveTextContent("Oct 2, 2026");

    const second = screen.getByRole("link", { name: "Autumn sale" }).closest("li")!;
    expect(second).toHaveTextContent("Set aside · Autumn sale");
    expect(second).toHaveTextContent("−$500.00");
    expect(within(second).getByRole("link", { name: "Autumn sale" }).getAttribute("href")).toMatch(
      /^\/campaigns\/?\?id=12$/,
    );
    expect(screen.getByText("Adjustment").closest("li")).not.toHaveTextContent(/[+−]\$/);
  });

  it("loads more onto the end, without repeating a row", async () => {
    ledgerIs([row(1), row(2, { label: "Second" })], true);
    render(<CommercialBalancePage />);
    await screen.findByText("Second");

    const more = deferred<Ledger>();
    vi.mocked(fetchTransactions).mockReturnValue(more.promise);
    click("Load more");
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
    expect(fetchTransactions).toHaveBeenLastCalledWith(3, 2);

    await act(async () =>
      more.resolve({
        ok: true,
        data: { transactions: [row(2), row(3, { label: "Third" })], hasMore: false },
      }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("offers a retry when the ledger, or more of it, cannot be loaded", async () => {
    vi.mocked(fetchTransactions).mockResolvedValue({
      ok: false,
      message: "Couldn't load your transactions.",
    });
    render(<CommercialBalancePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your transactions.",
    );

    ledgerIs([row(1)], true);
    click(/try again/i);
    await screen.findByText("Top-up");

    vi.mocked(fetchTransactions).mockResolvedValue({ ok: false, message: "Lost connection." });
    click("Load more");
    expect(await screen.findByRole("alert")).toHaveTextContent("Lost connection.");
  });

  it("opens Add funds", async () => {
    render(<CommercialBalancePage />);
    await screen.findByText(/No money has moved yet/);
    click("Add funds");
    expect(screen.getByTestId("add-funds")).toBeInTheDocument();
    click("Close add funds");
    expect(screen.queryByTestId("add-funds")).not.toBeInTheDocument();
  });

  it("keeps checking the balance after a payment, and says when one was cancelled", () => {
    vi.useFakeTimers();
    search = "checkout=success";
    const paid = render(<CommercialBalancePage />);
    expect(screen.getByText(/Payment received\./)).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(reload).toHaveBeenCalledTimes(3);
    paid.unmount();
    expect(vi.getTimerCount()).toBe(0);

    search = "checkout=cancelled";
    render(<CommercialBalancePage />);
    expect(screen.getByText("Payment cancelled. Nothing was charged.")).toBeInTheDocument();
  });

  it("reloads the ledger when the balance changes", async () => {
    const view = render(<CommercialBalancePage />);
    await screen.findByText(/No money has moved yet/);
    expect(fetchTransactions).toHaveBeenCalledTimes(1);

    companyState = { company: company({ balanceCents: 17_000 }), status: "ready" };
    view.rerender(<CommercialBalancePage />);
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(2));
  });

  it("has nothing to show, or to add to, without a company", async () => {
    companyState = { company: null, status: "ready" };
    const pending = deferred<Ledger>();
    vi.mocked(fetchTransactions).mockReturnValue(pending.promise);
    render(<CommercialBalancePage />);
    expect(screen.queryByRole("button", { name: "Add funds" })).not.toBeInTheDocument();
    expect(fetchTransactions).not.toHaveBeenCalled();
  });

  it("ignores a ledger that arrives after the page has gone", async () => {
    const pending = deferred<Ledger>();
    vi.mocked(fetchTransactions).mockReturnValue(pending.promise);
    const { unmount } = render(<CommercialBalancePage />);
    unmount();
    pending.resolve({ ok: true, data: { transactions: [], hasMore: false } });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("the leads page", () => {
  type Page = Awaited<ReturnType<typeof fetchLeads>>;

  function lead(id: number, overrides: Partial<Lead> = {}): Lead {
    return {
      id,
      campaignId: 12,
      campaignName: "Autumn sale",
      name: `Lead ${id}`,
      phone: "+14155552671",
      email: "sam@example.com",
      message: "Call me",
      createdAt: "2026-10-03T09:30:00",
      ...overrides,
    };
  }

  function leadsAre(items: Lead[], extra: { count?: number; hasMore?: boolean } = {}) {
    vi.mocked(fetchLeads).mockResolvedValue({
      ok: true,
      data: {
        items,
        count: extra.count ?? items.length,
        hasMore: extra.hasMore ?? false,
      },
    });
  }

  it("lists each lead with how to reach them and the campaign that brought them", async () => {
    leadsAre([lead(1), lead(2, { phone: "", email: "", message: "", createdAt: null })]);
    render(<CommercialLeadsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading leads");

    expect(await screen.findByText("Lead 1")).toBeInTheDocument();
    expect(screen.getByText("2 leads")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+14155552671" })).toHaveAttribute(
      "href",
      "tel:+14155552671",
    );
    expect(screen.getByRole("link", { name: "sam@example.com" })).toHaveAttribute(
      "href",
      "mailto:sam@example.com",
    );
    expect(screen.getByText("Call me")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Autumn sale" })[0].getAttribute("href")).toMatch(
      /^\/campaigns\/?\?id=12$/,
    );
    expect(screen.getAllByRole("link", { name: /^\+1|@/ })).toHaveLength(2);
    expect(fetchLeads).toHaveBeenCalledWith(3);
  });

  it("explains where leads come from when there are none", async () => {
    leadsAre([]);
    render(<CommercialLeadsPage />);
    expect(await screen.findByText(/No leads yet\./)).toBeInTheDocument();
    expect(screen.getByText("0 leads")).toBeInTheDocument();
  });

  it("counts one lead in the singular, and copes with a date it cannot read", async () => {
    leadsAre([lead(1, { createdAt: "soon" })]);
    render(<CommercialLeadsPage />);
    expect(await screen.findByText("1 lead")).toBeInTheDocument();
  });

  it("loads more onto the end, without repeating a lead", async () => {
    leadsAre([lead(1)], { count: 3, hasMore: true });
    render(<CommercialLeadsPage />);
    await screen.findByText("Lead 1");

    const more = deferred<Page>();
    vi.mocked(fetchLeads).mockReturnValue(more.promise);
    click("Load more");
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
    expect(fetchLeads).toHaveBeenLastCalledWith(3, { page: 2 });

    await act(async () =>
      more.resolve({
        ok: true,
        data: { items: [lead(1), lead(2)], count: 3, hasMore: false },
      }),
    );
    expect(screen.getByText("Lead 2")).toBeInTheDocument();
    expect(screen.getAllByText(/^Lead \d$/)).toHaveLength(2);
  });

  it("offers a retry when the leads, or more of them, cannot be loaded", async () => {
    vi.mocked(fetchLeads).mockResolvedValue({ ok: false, message: "Couldn't load your leads." });
    render(<CommercialLeadsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your leads.");

    leadsAre([lead(1)], { hasMore: true });
    click(/try again/i);
    await screen.findByText("Lead 1");

    vi.mocked(fetchLeads).mockResolvedValue({ ok: false, message: "Lost connection." });
    click("Load more");
    expect(await screen.findByRole("alert")).toHaveTextContent("Lost connection.");
  });

  it("shows only the notice without a company, and ignores a late answer", async () => {
    companyState = { company: null, status: "ready" };
    const none = render(<CommercialLeadsPage />);
    expect(screen.getByTestId("company-notice")).toBeInTheDocument();
    expect(fetchLeads).not.toHaveBeenCalled();
    none.unmount();

    companyState = { company: company(), status: "ready" };
    const pending = deferred<Page>();
    vi.mocked(fetchLeads).mockReturnValue(pending.promise);
    const { unmount } = render(<CommercialLeadsPage />);
    unmount();
    pending.resolve({ ok: true, data: { items: [], count: 0, hasMore: false } });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("the analytics page", () => {
  type Result = Awaited<ReturnType<typeof fetchCompanyReport>>;

  function report(overrides: Partial<CompanyReport> = {}): CompanyReport {
    return {
      currency: "USD",
      reachShownFrom: 50,
      totals: {
        served: 1000,
        viewed: 800,
        clicks: 40,
        spendCents: 640,
        costPer1000ViewsCents: 800,
        costPerClickCents: 16,
      },
      days: [
        {
          day: "2026-10-04",
          served: 1000,
          viewed: 800,
          reach: 600,
          clicks: 40,
          results: 5,
          spendCents: 640,
        },
      ],
      campaigns: [
        {
          id: 12,
          name: "Autumn sale",
          status: "running",
          objective: "lead",
          viewed: 800,
          clicks: 40,
          reach: 600,
          spendCents: 640,
          result: "leads",
          results: 5,
          costPerResultCents: 128,
        },
        {
          id: 13,
          name: "",
          status: "paused",
          objective: "website",
          viewed: 30,
          clicks: 1,
          reach: null,
          spendCents: 24,
          result: "clicks",
          results: 1,
          costPerResultCents: null,
        },
        {
          id: 14,
          name: "Quiet one",
          status: "approved",
          objective: "website",
          viewed: 0,
          clicks: 0,
          reach: null,
          spendCents: 0,
          result: "clicks",
          results: 0,
          costPerResultCents: null,
        },
      ],
      ...overrides,
    };
  }

  it("summarises the company's results and breaks them down by campaign", async () => {
    vi.mocked(fetchCompanyReport).mockResolvedValue({ ok: true, data: report() });
    render(<CommercialReportsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results");

    expect(await screen.findByText("5%")).toBeInTheDocument();
    expect(fetchCompanyReport).toHaveBeenCalledWith(3);
    expect(screen.getAllByText("$6.40").length).toBeGreaterThan(0);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Autumn sale");
    expect(rows[0]).toHaveTextContent("5 leads");
    expect(rows[0]).toHaveTextContent("$1.28 per lead");
    expect(rows[0]).toHaveTextContent("600");
    expect(rows[1]).toHaveTextContent("Untitled campaign");
    expect(rows[1]).toHaveTextContent("Fewer than 50");
    expect(rows[1]).not.toHaveTextContent("per click");
    expect(rows[2].querySelectorAll("td")[5]).toHaveTextContent(/^-$/);
    expect(
      within(rows[0]).getByRole("link", { name: "Autumn sale" }).getAttribute("href"),
    ).toMatch(/^\/campaigns\/?\?id=12$/);
  });

  it("says so when there is nothing to chart or list yet", async () => {
    vi.mocked(fetchCompanyReport).mockResolvedValue({
      ok: true,
      data: report({ days: [], campaigns: [] }),
    });
    render(<CommercialReportsPage />);
    expect(await screen.findByText(/Nothing yet\. Views appear here/)).toBeInTheDocument();
    expect(screen.getByText("No submitted campaigns yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers a retry when the report cannot be loaded", async () => {
    vi.mocked(fetchCompanyReport).mockResolvedValue({
      ok: false,
      message: "Couldn't load the results.",
    });
    render(<CommercialReportsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the results.");

    vi.mocked(fetchCompanyReport).mockResolvedValue({ ok: true, data: report() });
    click(/try again/i);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows only the notice without a company, and ignores a late answer", async () => {
    companyState = { company: null, status: "ready" };
    const none = render(<CommercialReportsPage />);
    expect(fetchCompanyReport).not.toHaveBeenCalled();
    expect(screen.getByTestId("company-notice")).toBeInTheDocument();
    none.unmount();

    companyState = { company: company(), status: "ready" };
    const pending = deferred<Result>();
    vi.mocked(fetchCompanyReport).mockReturnValue(pending.promise);
    const { unmount } = render(<CommercialReportsPage />);
    unmount();
    pending.resolve({ ok: true, data: report() });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
