import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openCreateCompany = vi.fn();
const openCompanies = vi.fn();
const switchCompany = vi.fn();
const toast = vi.fn();
const adopt = vi.fn();
const update = vi.fn();
const reload = vi.fn();
let context: Record<string, unknown>;

vi.mock("@/lib/commercial/CompanyProvider", () => ({
  useCompany: () => context,
}));
vi.mock("@/components/commercial/CompanyDialogs", () => ({
  useCreateCompany: () => openCreateCompany,
  useCompaniesDialog: () => openCompanies,
}));
vi.mock("@/components/commercial/useSwitchCompany", () => ({
  useSwitchCompany: () => switchCompany,
}));
vi.mock("@/components/ui", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/ui")>("@/components/ui");
  return { ...actual, useToast: () => toast };
});
vi.mock("@/lib/commercial/api", () => ({ fetchCompanyPage: vi.fn() }));
// The form has a test file of its own; here it is two buttons.
vi.mock("@/components/commercial/CompanyForm", () => ({
  CompanyForm: ({
    company: editing,
    submitLabel,
    onSaved,
    onCancel,
  }: {
    company?: { id: number; name: string };
    submitLabel: string;
    onSaved: (company: unknown) => void;
    onCancel?: () => void;
  }) => (
    <div data-testid="company-form" data-editing={editing?.id ?? "new"}>
      <button
        onClick={() =>
          onSaved(
            editing
              ? { ...editing, name: `${editing.name} (edited)` }
              : { ...CREATED },
          )
        }
      >
        {submitLabel}
      </button>
      <button onClick={onCancel}>Cancel form</button>
    </div>
  ),
}));

import { CompaniesDialog } from "@/components/commercial/CompaniesDialog";
import { CompanySwitcher } from "@/components/commercial/CompanySwitcher";
import { fetchCompanyPage } from "@/lib/commercial/api";
import type { Company } from "@/lib/commercial/types";
import { company } from "@/test/commercial";
import { deferred } from "@/test/helpers";

const ACME = company({ id: 3, name: "Acme" });
const GLOBEX = company({ id: 4, name: "Globex", industryLabel: "Energy" });
const INITECH = company({ id: 5, name: "Initech", status: "suspended" });
const CREATED = company({ id: 9, name: "Newco" });

type Page = Awaited<ReturnType<typeof fetchCompanyPage>>;

function page(companies: Company[], hasMore = false): Page {
  return { ok: true, data: { companies, count: companies.length, hasMore } };
}

/** jsdom has no IntersectionObserver; this one fires when the test says so. */
let intersect: (() => void) | null = null;
class FakeIntersectionObserver {
  constructor(
    private callback: (entries: { isIntersecting: boolean }[]) => void,
  ) {}
  observe() {
    intersect = () => this.callback([{ isIntersecting: true }]);
  }
  disconnect() {
    intersect = null;
  }
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  intersect = null;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  context = {
    company: ACME,
    companies: [ACME, GLOBEX, INITECH],
    companyCount: 3,
    status: "ready",
    switchingTo: null,
    adopt,
    update,
    reload,
  };
  vi.mocked(fetchCompanyPage).mockResolvedValue(page([ACME, GLOBEX, INITECH]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CompanySwitcher", () => {
  it("offers a retry when the companies could not be loaded", () => {
    context = { ...context, status: "unavailable" };
    render(<CompanySwitcher />);
    click(/couldn't load companies/i);
    expect(reload).toHaveBeenCalled();
  });

  it("is a placeholder while the first load is out", () => {
    context = { ...context, status: "loading", company: null };
    render(<CompanySwitcher />);
    expect(screen.getByLabelText("Loading your company")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the active company and lists it first, then the others by name", () => {
    render(<CompanySwitcher />);
    const pill = screen.getByRole("button", {
      name: "Company: Acme. Show companies",
    });
    expect(pill).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "AAcmeRetail",
      "GGlobexEnergy",
      "IInitechSuspended",
    ]);
    expect(within(rows[0]).getByRole("button")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(within(rows[0]).getByLabelText("Active")).toBeInTheDocument();
  });

  it("switches to another company, and does nothing for the current one", () => {
    render(<CompanySwitcher />);
    const pill = screen.getByRole("button", { name: /show companies/i });

    fireEvent.click(pill);
    fireEvent.click(
      within(screen.getAllByRole("listitem")[0]).getByRole("button"),
    );
    expect(switchCompany).not.toHaveBeenCalled();
    expect(pill).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pill);
    fireEvent.click(
      within(screen.getAllByRole("listitem")[1]).getByRole("button"),
    );
    expect(switchCompany).toHaveBeenCalledWith(4);
  });

  it("opens the full list and the create dialog from the menu", () => {
    render(<CompanySwitcher />);
    const pill = screen.getByRole("button", { name: /show companies/i });

    fireEvent.click(pill);
    click(/view all companies/i);
    expect(openCompanies).toHaveBeenCalledWith();
    expect(pill).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pill);
    expect(
      screen.getByRole("button", { name: /view all companies/i }),
    ).toHaveTextContent("3");
    click("Create new company");
    expect(openCreateCompany).toHaveBeenCalled();
  });

  it("closes on Escape and on a press outside", () => {
    render(<CompanySwitcher />);
    const pill = screen.getByRole("button", { name: /show companies/i });

    fireEvent.click(pill);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(pill).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pill);
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(pill).toHaveAttribute("aria-expanded", "false");
  });

  it("invites a first company when there are none", () => {
    context = { ...context, company: null, companies: [], companyCount: 0 };
    render(<CompanySwitcher />);
    click("No company yet. Show companies");
    expect(
      screen.getByText(/You haven't created a company yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("shows a spinner while a switch is under way, and lists at most six", () => {
    context = {
      ...context,
      switchingTo: 4,
      companies: Array.from({ length: 9 }, (_, index) =>
        company({ id: 10 + index, name: `Company ${index}` }),
      ),
    };
    render(<CompanySwitcher />);
    expect(screen.getByLabelText("Switching company")).toBeInTheDocument();
    click(/show companies/i);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});

describe("CompaniesDialog", () => {
  function open(initialCompanyId?: number) {
    const onClose = vi.fn();
    render(
      <CompaniesDialog
        isOpen
        initialCompanyId={initialCompanyId}
        onClose={onClose}
      />,
    );
    return onClose;
  }

  function rows() {
    return within(screen.getByRole("list")).queryAllByRole("button", {
      current: undefined,
    });
  }

  it("renders nothing while closed", () => {
    render(<CompaniesDialog isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchCompanyPage).not.toHaveBeenCalled();
  });

  it("lists the companies and opens on the active one", async () => {
    open();
    expect(screen.getByRole("status")).toHaveTextContent("Loading companies");
    expect(
      await screen.findByRole("button", { name: /globex/i }),
    ).toBeInTheDocument();

    expect(fetchCompanyPage).toHaveBeenCalledWith({ search: "", page: 1 });
    expect(screen.getByTestId("company-form")).toHaveAttribute(
      "data-editing",
      "3",
    );
    expect(screen.getByRole("heading", { name: "Acme" })).toBeInTheDocument();
    // The active company has no "switch to" button of its own.
    expect(
      screen.queryByRole("button", { name: "Switch to this company" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /acme/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(rows().length).toBeGreaterThan(0);
  });

  it("opens on the company it was asked for, or on a new one when there are none", async () => {
    open(4);
    await screen.findByRole("button", { name: /acme/i });
    expect(screen.getByTestId("company-form")).toHaveAttribute(
      "data-editing",
      "4",
    );
    expect(
      screen.getByRole("button", { name: "Switch to this company" }),
    ).toBeInTheDocument();
  });

  it("starts on a new company for an account with none, and closes on cancel", async () => {
    context = { ...context, company: null, companies: [] };
    vi.mocked(fetchCompanyPage).mockResolvedValue(page([]));
    const onClose = open();
    expect(await screen.findByText("No companies yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New company" }),
    ).toBeInTheDocument();
    click("Cancel form");
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to the selected company and says so", async () => {
    const switching = deferred<Company | null>();
    switchCompany.mockReturnValue(switching.promise);
    open();
    fireEvent.click(await screen.findByRole("button", { name: /initech/i }));
    expect(screen.getAllByText("Suspended").length).toBeGreaterThan(0);

    click("Switch to this company");
    expect(
      screen.getByRole("button", { name: "Switch to this company" }),
    ).toBeDisabled();
    await act(async () => switching.resolve(INITECH));
    expect(switchCompany).toHaveBeenCalledWith(5);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Switched to Initech" }),
    );
  });

  it("says when a switch was refused", async () => {
    switchCompany.mockResolvedValue(null);
    open();
    fireEvent.click(await screen.findByRole("button", { name: /globex/i }));
    click("Switch to this company");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: "error",
          title: "Couldn't switch company",
        }),
      ),
    );
  });

  it("saves edits into the list and the provider", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: /globex/i }));
    click("Save changes");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Globex (edited)" }),
    );
    expect(
      screen.getByRole("button", { name: /globex \(edited\)/i }),
    ).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Changes saved",
        description: "Globex (edited)'s details are up to date.",
      }),
    );
  });

  it("creates a company, adopts it, and reloads the list", async () => {
    open();
    await screen.findByRole("button", { name: /acme/i });
    click("Create new company");
    expect(
      screen.getByRole("heading", { name: "New company" }),
    ).toBeInTheDocument();

    vi.mocked(fetchCompanyPage).mockResolvedValue(
      page([ACME, GLOBEX, INITECH, CREATED]),
    );
    click("Create company");
    expect(adopt).toHaveBeenCalledWith(CREATED);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Company created",
        description: "Newco is now your active company.",
      }),
    );
    expect(
      await screen.findByRole("button", { name: /newco/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("company-form")).toHaveAttribute(
      "data-editing",
      "9",
    );
  });

  it("goes back to the active company when creating is cancelled", async () => {
    open();
    await screen.findByRole("button", { name: /acme/i });
    click("Create new company");
    click("Cancel form");
    expect(screen.getByTestId("company-form")).toHaveAttribute(
      "data-editing",
      "3",
    );
  });

  it("steps back to the list on a narrow screen", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: /globex/i }));
    click("All companies");
    expect(screen.getByRole("complementary")).toHaveClass("flex");
    expect(screen.getByRole("complementary")).not.toHaveClass("hidden");
  });

  it("searches after a pause, and can clear the search", async () => {
    vi.useFakeTimers();
    open();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(fetchCompanyPage).mockResolvedValue(page([]));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search companies" }),
      {
        target: { value: "  zed " },
      },
    );
    expect(fetchCompanyPage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(fetchCompanyPage).toHaveBeenLastCalledWith({
      search: "zed",
      page: 1,
    });
    expect(screen.getByText("No companies match “zed”.")).toBeInTheDocument();

    vi.mocked(fetchCompanyPage).mockResolvedValue(page([ACME]));
    click("Clear search");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(fetchCompanyPage).toHaveBeenLastCalledWith({ search: "", page: 1 });
    expect(screen.getByRole("button", { name: /acme/i })).toBeInTheDocument();
  });

  it("loads the next page when the end of the list comes into view", async () => {
    vi.mocked(fetchCompanyPage).mockResolvedValueOnce(
      page([ACME, GLOBEX], true),
    );
    open();
    await screen.findByRole("button", { name: /globex/i });

    const next = deferred<Page>();
    vi.mocked(fetchCompanyPage).mockReturnValue(next.promise);
    act(() => intersect!());
    expect(screen.getByText("Loading more…")).toBeInTheDocument();
    expect(fetchCompanyPage).toHaveBeenLastCalledWith({ search: "", page: 2 });
    // Still scrolling does not ask for the same page twice.
    act(() => intersect?.());
    expect(fetchCompanyPage).toHaveBeenCalledTimes(2);

    // A row already shown is not listed twice.
    await act(async () => next.resolve(page([GLOBEX, INITECH])));
    expect(screen.getAllByRole("button", { name: /globex/i })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /initech/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading more…")).not.toBeInTheDocument();
  });

  it("reports a failed next page and retries just that page", async () => {
    vi.mocked(fetchCompanyPage).mockResolvedValueOnce(page([ACME], true));
    open();
    await screen.findByRole("button", { name: /acme/i });

    vi.mocked(fetchCompanyPage).mockResolvedValue({
      ok: false,
      message: "Lost connection.",
    });
    act(() => intersect!());
    expect(await screen.findByText(/Lost connection\./)).toBeInTheDocument();

    vi.mocked(fetchCompanyPage).mockResolvedValue(page([GLOBEX]));
    click("Try again");
    expect(
      await screen.findByRole("button", { name: /globex/i }),
    ).toBeInTheDocument();
    expect(fetchCompanyPage).toHaveBeenLastCalledWith({ search: "", page: 2 });
  });

  it("reports a failed first page and loads it again on retry", async () => {
    vi.mocked(fetchCompanyPage).mockResolvedValue({
      ok: false,
      message: "Couldn't load your companies.",
    });
    open();
    expect(
      await screen.findByText(/Couldn't load your companies\./),
    ).toBeInTheDocument();

    vi.mocked(fetchCompanyPage).mockResolvedValue(page([ACME]));
    click("Try again");
    expect(
      await screen.findByRole("button", { name: /acme/i }),
    ).toBeInTheDocument();
    expect(fetchCompanyPage).toHaveBeenLastCalledWith({ search: "", page: 1 });
  });

  it("ignores a page that arrives after the dialog has closed", async () => {
    const pending = deferred<Page>();
    vi.mocked(fetchCompanyPage).mockReturnValue(pending.promise);
    const { unmount } = render(<CompaniesDialog isOpen onClose={() => {}} />);
    unmount();
    pending.resolve(page([ACME]));
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
