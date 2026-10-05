import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
let pathname = "/";
let auth: { session: string | null; isLoaded: boolean };
let features: { features: Set<string>; loading: boolean };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/auth/client", () => ({
  logout: vi.fn(async () => {}),
  setPostAuthRedirect: vi.fn(),
  useAuth: () => auth,
}));
vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac/requirements")>(
    "@/lib/rbac/requirements",
  );
  return { meets: actual.meets, useFeatures: () => features };
});
vi.mock("@/lib/commercial/api", () => ({
  fetchActiveCompany: vi.fn(),
  fetchCampaignReport: vi.fn(),
  fetchCompanyPage: vi.fn(),
  fetchMarkets: vi.fn(),
  startCheckout: vi.fn(),
  switchActiveCompany: vi.fn(),
}));
// Tested on their own; here they only have to be what the providers mount.
vi.mock("@/components/commercial/CommercialShell", () => ({
  CommercialShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));
vi.mock("@/components/commercial/CompaniesDialog", () => ({
  CompaniesDialog: ({
    isOpen,
    initialCompanyId,
    onClose,
  }: {
    isOpen: boolean;
    initialCompanyId?: number;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="companies-dialog" data-company={initialCompanyId ?? ""}>
        <button onClick={onClose}>Close companies</button>
      </div>
    ) : null,
}));
vi.mock("@/components/commercial/CompanyForm", () => ({
  CompanyForm: ({
    submitLabel,
    onSaved,
    onCancel,
  }: {
    submitLabel: string;
    onSaved: (company: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="company-form">
      <button onClick={() => onSaved({ ...NEW_COMPANY })}>{submitLabel}</button>
      <button onClick={onCancel}>Cancel form</button>
    </div>
  ),
}));

import { AddFundsDialog } from "@/components/commercial/AddFundsDialog";
import { AudienceSummary, describeAudience } from "@/components/commercial/AudienceSummary";
import { StepFooter, StepFrame } from "@/components/commercial/builder/StepFrame";
import {
  dateInputValue,
  endOfDay,
  fromCents,
  isStepKey,
  startOfDay,
  STEP_OF_PROBLEM,
  toCents,
  tomorrow,
  withScheme,
} from "@/components/commercial/builder/steps";
import { CampaignResults } from "@/components/commercial/CampaignResults";
import { CommercialDashboard } from "@/components/commercial/CommercialDashboard";
import { CommercialFrame } from "@/components/commercial/CommercialFrame";
import { CommercialOverview } from "@/components/commercial/CommercialOverview";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import {
  CompanyDialogsProvider,
  useCompaniesDialog,
  useCreateCompany,
} from "@/components/commercial/CompanyDialogs";
import { CompanyLogo } from "@/components/commercial/CompanyLogo";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { DailyBars } from "@/components/commercial/DailyBars";
import { NewCampaignLink } from "@/components/commercial/NewCampaignLink";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { ObjectiveIcon } from "@/components/commercial/ObjectiveIcon";
import {
  CampaignStatusBadge,
  CompanyStatusBadge,
  CreativeStatusBadge,
} from "@/components/commercial/StatusBadge";
import {
  belongsToOneCompany,
  useSwitchCompany,
} from "@/components/commercial/useSwitchCompany";
import { ToastProvider } from "@/components/ui";
import { logout, setPostAuthRedirect } from "@/lib/auth/client";
import {
  fetchActiveCompany,
  fetchCampaignReport,
  fetchCompanyPage,
  fetchMarkets,
  startCheckout,
  switchActiveCompany,
} from "@/lib/commercial/api";
import { CompanyProvider, useCompany } from "@/lib/commercial/CompanyProvider";
import type { CampaignReport, Company } from "@/lib/commercial/types";
import { campaign, company, OPTIONS } from "@/test/commercial";
import { deferred, stubLocation } from "@/test/helpers";

const NEW_COMPANY = company({ id: 9, name: "Globex" });

function companiesAre(active: Company | null, list: Company[] = active ? [active] : []) {
  vi.mocked(fetchActiveCompany).mockResolvedValue({ ok: true, data: active });
  vi.mocked(fetchCompanyPage).mockResolvedValue({
    ok: true,
    data: { companies: list, count: list.length, hasMore: false },
  });
}

/** Everything the dashboard's pieces expect above them. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CompanyProvider>
        <CompanyDialogsProvider>{children}</CompanyDialogsProvider>
      </CompanyProvider>
    </ToastProvider>
  );
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/";
  auth = { session: "sam", isLoaded: true };
  features = { features: new Set(["commercial.access"]), loading: false };
  stubLocation("https://commercial.loopdn.com/");
  companiesAre(company());
  vi.mocked(fetchMarkets).mockResolvedValue({ ok: true, data: OPTIONS.markets });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("builder helpers", () => {
  it("reads typed money into cents, refusing anything that is not money", () => {
    expect(toCents("1,000.50")).toBe(100050);
    expect(toCents(" 12 ")).toBe(1200);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("")).toBeNull();
    expect(toCents("12.345")).toBeNaN();
    expect(toCents("abc")).toBeNaN();
  });

  it("prints cents back the way somebody would type them", () => {
    expect(fromCents(100000)).toBe("1000");
    expect(fromCents(100050)).toBe("1000.50");
    expect(fromCents(null)).toBe("");
  });

  it("converts between a date input and the moments it stands for", () => {
    expect(dateInputValue(new Date(2026, 9, 5, 15).toISOString())).toBe("2026-10-05");
    expect(dateInputValue(null)).toBe("");
    expect(dateInputValue("whenever")).toBe("");
    expect(new Date(startOfDay("2026-10-05")).getHours()).toBe(0);
    expect(new Date(endOfDay("2026-10-05")).getHours()).toBe(23);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 12));
    expect(tomorrow()).toBe("2026-11-01");
    vi.useRealTimers();
  });

  it("adds https to a bare address and leaves a scheme alone", () => {
    expect(withScheme(" acme.example ")).toBe("https://acme.example");
    expect(withScheme("http://acme.example")).toBe("http://acme.example");
    expect(withScheme("tel:+15550001111")).toBe("tel:+15550001111");
    expect(withScheme("  ")).toBe("");
  });

  it("knows the steps, and which one each server problem belongs to", () => {
    expect(isStepKey("budget")).toBe(true);
    expect(isStepKey("payment")).toBe(false);
    expect(isStepKey(null)).toBe(false);
    expect(STEP_OF_PROBLEM.daily_budget_cents).toBe("budget");
  });

  it("frames a step with its error, and a footer that waits while busy", () => {
    const onBack = vi.fn();
    const onPrimary = vi.fn();
    const { rerender } = render(
      <StepFrame
        title="Budget"
        description="How much to spend."
        error="Budget is too low."
        footer={<StepFooter onBack={onBack} primaryLabel="Next" onPrimary={onPrimary} />}
      >
        <p>fields</p>
      </StepFrame>,
    );
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByText("Budget is too low.")).toBeInTheDocument();
    click("Back");
    click("Next");
    expect(onBack).toHaveBeenCalled();
    expect(onPrimary).toHaveBeenCalled();

    rerender(
      <StepFrame title="Objective" footer={<StepFooter primaryLabel="Next" onPrimary={onPrimary} busy />}>
        <p>fields</p>
      </StepFrame>,
    );
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("small commercial pieces", () => {
  it("shows a company's logo, or its initial", () => {
    const { container, rerender } = render(
      <CompanyLogo name="Acme" logoUrl="https://cdn.example/acme.png" size={48} />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/acme.png",
    );
    rerender(<CompanyLogo name=" acme" logoUrl={null} className="extra" />);
    expect(container.firstElementChild).toHaveTextContent("A");
    rerender(<CompanyLogo name="" logoUrl={null} />);
    expect(container.firstElementChild).toHaveTextContent("?");
  });

  it("labels each status in words", () => {
    render(
      <>
        <CompanyStatusBadge status="suspended" />
        <CampaignStatusBadge status="pending_review" className="x" />
        <CampaignStatusBadge status="running" />
        <CreativeStatusBadge status="rejected" />
      </>,
    );
    expect(screen.getByText("Suspended")).toHaveClass("bg-amber-100");
    expect(screen.getByText("Pending review")).toHaveClass("x");
    expect(screen.getByText("Running")).toHaveClass("bg-emerald-100");
    expect(screen.getByText("Rejected")).toHaveClass("bg-rose-100");
  });

  it("draws an icon for every objective", () => {
    const { container } = render(
      <>
        {(["website", "lead", "booking", "group_join", "call", "text"] as const).map(
          (objective) => (
            <ObjectiveIcon key={objective} objective={objective} className="h-8" />
          ),
        )}
      </>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(6);
  });

  it("marks what is not built, naming the endpoint it waits on", () => {
    const { rerender } = render(
      <NotBuiltYet title="Performance" endpoint="GET /report/">
        Coming.
      </NotBuiltYet>,
    );
    expect(screen.getByText("Needs GET /report/")).toBeInTheDocument();
    rerender(<NotBuiltYet title="Performance">Coming.</NotBuiltYet>);
    expect(screen.queryByText(/^Needs/)).not.toBeInTheDocument();
    expect(screen.getByText("Not built yet.")).toBeInTheDocument();
  });

  it("links to a new campaign, and heads a page", () => {
    render(
      <CommercialPageHeader
        title="Campaigns"
        description="Everything you are running."
        actions={<NewCampaignLink />}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Campaigns" })).toBeInTheDocument();
    expect(screen.getByText("Everything you are running.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New campaign" }).getAttribute("href"),
    ).toMatch(/^\/campaigns\/new\/?$/);
  });
});

describe("DailyBars", () => {
  const day = (date: string, viewed: number) => ({
    day: date,
    served: viewed,
    viewed,
    reach: null,
    clicks: 0,
    results: 0,
    spendCents: 0,
  });

  it("draws nothing for no days", () => {
    const { container } = render(<DailyBars rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fills the days with no views, so the bars are a calendar", () => {
    const { container } = render(
      <DailyBars rows={[day("2026-10-01", 40), day("2026-10-04", 10)]} days={4} />,
    );
    const bars = [...container.querySelectorAll("[title]")];
    expect(bars.map((bar) => bar.getAttribute("title"))).toEqual([
      "Oct 1: 40 views",
      "Oct 2: 0 views",
      "Oct 3: 0 views",
      "Oct 4: 10 views",
    ]);
    expect((bars[0] as HTMLElement).style.height).toBe("100%");
    expect((bars[1] as HTMLElement).style.height).toBe("2px");
    expect((bars[3] as HTMLElement).style.height).toBe("25%");
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "Views by day: Oct 1 40 views, Oct 4 10 views",
    );
  });

  it("says none yet when nothing was viewed, over fourteen days by default", () => {
    const { container } = render(<DailyBars rows={[day("2026-10-04", 0)]} />);
    expect(container.querySelectorAll("[title]")).toHaveLength(14);
    expect(container.querySelector("figcaption")).toHaveTextContent("none yet");
  });

  it("copes with a day it cannot read", () => {
    const { container } = render(<DailyBars rows={[day("soon", 3)]} />);
    expect(container.querySelector("[title]")).toHaveAttribute("title", "soon: 3 views");
  });
});

describe("AudienceSummary", () => {
  it("describes an audience in the names people chose from", () => {
    expect(
      describeAudience(
        { categories: ["sports", "chess"], regions: ["US-CA", "US-ZZ"], minGroupSize: 10, maxGroupSize: 50 },
        "US",
        OPTIONS,
      ),
    ).toEqual({
      groups: "Sports, chess",
      where: "California, US-ZZ",
      size: "10 to 50 members",
    });
  });

  it("says anywhere, any kind and any size when nothing is narrowed", () => {
    const open = { categories: [], regions: [], minGroupSize: null, maxGroupSize: null };
    expect(describeAudience(open, "US", OPTIONS)).toEqual({
      groups: "Any kind of group",
      where: "Anywhere in United States",
      size: "Any size",
    });
    expect(describeAudience({ ...open, minGroupSize: 5 }, "US", OPTIONS).size).toBe(
      "At least 5 members",
    );
    expect(describeAudience({ ...open, maxGroupSize: 5 }, "US", OPTIONS).size).toBe(
      "Up to 5 members",
    );
  });

  it("renders the three lines, or that nothing is chosen", () => {
    const { rerender } = render(
      <AudienceSummary audience={campaign().audience} country="US" options={OPTIONS} />,
    );
    expect(screen.getByText("Sports")).toBeInTheDocument();
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText("At least 10 members")).toBeInTheDocument();

    rerender(<AudienceSummary audience={null} country="US" options={OPTIONS} />);
    expect(screen.getByText("Not chosen yet.")).toBeInTheDocument();
  });
});

describe("CompanyProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CompanyProvider>{children}</CompanyProvider>
  );

  it("loads the active company and the list, adding the active one if it is not on the first page", async () => {
    companiesAre(company({ id: 3 }), [company({ id: 1, name: "Other" })]);
    const { result } = renderHook(() => useCompany(), { wrapper });
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.company?.id).toBe(3);
    expect(result.current.companies.map((item) => item.id)).toEqual([1, 3]);
    expect(result.current.companyCount).toBe(1);
  });

  it("is ready with no company for an account that has none", async () => {
    companiesAre(null);
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.company).toBeNull();
    expect(result.current.companies).toEqual([]);
  });

  it("is unavailable when either half fails, and can be reloaded", async () => {
    vi.mocked(fetchCompanyPage).mockResolvedValue({ ok: false, message: "down" });
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    companiesAre(company());
    act(() => result.current.reload());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("switches company, replacing its row with what the server sent", async () => {
    companiesAre(company({ id: 3 }), [company({ id: 3 }), company({ id: 4, name: "Globex" })]);
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const pending = deferred<Awaited<ReturnType<typeof switchActiveCompany>>>();
    vi.mocked(switchActiveCompany).mockReturnValue(pending.promise);
    let switched: Promise<Company | null>;
    act(() => {
      switched = result.current.switchTo(4);
    });
    expect(result.current.switchingTo).toBe(4);

    await act(async () =>
      pending.resolve({ ok: true, data: company({ id: 4, name: "Globex Ltd" }) }),
    );
    expect((await switched!)?.name).toBe("Globex Ltd");
    expect(result.current.company?.id).toBe(4);
    expect(result.current.switchingTo).toBeNull();
    expect(result.current.companies.map((item) => item.name)).toEqual([
      "Acme",
      "Globex Ltd",
    ]);
  });

  it("reloads from the server when a switch is refused", async () => {
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    vi.mocked(switchActiveCompany).mockResolvedValue({ ok: false, message: "no" });
    let switched: Company | null | undefined;
    await act(async () => {
      switched = await result.current.switchTo(4);
    });
    expect(switched).toBeNull();
    await waitFor(() => expect(fetchActiveCompany).toHaveBeenCalledTimes(2));
    expect(result.current.company?.id).toBe(3);
  });

  it("adopts a new company as the active one, and updates one in place", async () => {
    companiesAre(null);
    const { result } = renderHook(() => useCompany(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.adopt(NEW_COMPANY));
    expect(result.current.company).toBe(NEW_COMPANY);
    expect(result.current.companyCount).toBe(1);

    act(() => result.current.update({ ...NEW_COMPANY, name: "Globex Ltd" }));
    expect(result.current.company?.name).toBe("Globex Ltd");

    // Updating some other company leaves the active one alone.
    act(() => result.current.update(company({ id: 77, name: "Elsewhere" })));
    expect(result.current.company?.name).toBe("Globex Ltd");
    expect(result.current.companies).toHaveLength(2);
  });

  it("ignores a load that finishes after unmount, and refuses use outside itself", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchActiveCompany>>>();
    vi.mocked(fetchActiveCompany).mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useCompany(), { wrapper });
    unmount();
    pending.resolve({ ok: true, data: company() });
    await pending.promise;
    expect(result.current.status).toBe("loading");

    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCompany())).toThrow(
      "useCompany() must be used under CommercialFrame.",
    );
    vi.restoreAllMocks();
  });
});

describe("useSwitchCompany", () => {
  it("knows which pages belong to one company", () => {
    expect(belongsToOneCompany("/campaign/")).toBe(true);
    expect(belongsToOneCompany("/campaigns/new/")).toBe(true);
    expect(belongsToOneCompany("/campaigns/")).toBe(false);
    expect(belongsToOneCompany("/balance/")).toBe(false);

    stubLocation("https://commercial.loopdn.com/campaigns/?id=12");
    expect(belongsToOneCompany("/campaigns/")).toBe(true);
  });

  it("leaves such a page before switching, and stays put otherwise", async () => {
    vi.mocked(switchActiveCompany).mockResolvedValue({ ok: true, data: NEW_COMPANY });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CompanyProvider>{children}</CompanyProvider>
    );

    pathname = "/balance/";
    const stays = renderHook(() => useSwitchCompany(), { wrapper });
    await act(async () => {
      await stays.result.current(9);
    });
    expect(push).not.toHaveBeenCalled();

    pathname = "/campaign/";
    const leaves = renderHook(() => useSwitchCompany(), { wrapper });
    await act(async () => {
      await leaves.result.current(9);
    });
    expect(push).toHaveBeenCalledWith("/campaigns/");
    expect(switchActiveCompany).toHaveBeenCalledTimes(2);
  });
});

describe("CompanyNotice and the company dialogs", () => {
  function Openers() {
    const create = useCreateCompany();
    const browse = useCompaniesDialog();
    return (
      <>
        <button onClick={create}>open create</button>
        <button onClick={() => browse()}>open companies</button>
        <button onClick={() => browse(4)}>open company 4</button>
      </>
    );
  }

  it("says nothing while loading or once there is a company", async () => {
    render(
      <Providers>
        <CompanyNotice />
      </Providers>,
    );
    expect(screen.queryByText(/set up your company/i)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchActiveCompany).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("invites a first company, and adopts the one created", async () => {
    companiesAre(null);
    render(
      <Providers>
        <CompanyNotice />
      </Providers>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Create company" }));
    expect(screen.getByRole("dialog", { name: "Set up your company" })).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Create company" }).at(-1)!,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Company created");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Globex is now your active company.",
    );
    // With a company, the notice has nothing left to say.
    expect(screen.queryByText(/set up your company/i)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves a one-company page when a new company takes over", async () => {
    pathname = "/campaign/";
    render(
      <Providers>
        <Openers />
      </Providers>,
    );
    await waitFor(() => expect(fetchActiveCompany).toHaveBeenCalled());
    click("open create");
    expect(
      await screen.findByRole("dialog", { name: "Create a company" }),
    ).toHaveTextContent("Nothing is copied from your other companies.");
    click("Create company");
    expect(push).toHaveBeenCalledWith("/campaigns/");
  });

  it("can be cancelled, and opens the list of companies on one of them", async () => {
    render(
      <Providers>
        <Openers />
      </Providers>,
    );
    click("open create");
    click("Cancel form");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    click("open create");
    click("Close");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    click("open companies");
    expect(screen.getByTestId("companies-dialog")).toHaveAttribute("data-company", "");
    click("Close companies");
    expect(screen.queryByTestId("companies-dialog")).not.toBeInTheDocument();
    click("open company 4");
    expect(screen.getByTestId("companies-dialog")).toHaveAttribute("data-company", "4");
  });

  it("offers a retry when the companies could not be loaded", async () => {
    vi.mocked(fetchActiveCompany).mockResolvedValue({ ok: false, message: "down" });
    render(
      <Providers>
        <CompanyNotice />
      </Providers>,
    );
    expect(
      await screen.findByText(/couldn't be loaded right now/),
    ).toBeInTheDocument();
    companiesAre(company());
    click("Try again");
    await waitFor(() =>
      expect(screen.queryByText(/couldn't be loaded/)).not.toBeInTheDocument(),
    );
  });

  it("refuses to open a dialog outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCreateCompany())).toThrow(
      "Company dialogs must be used under CompanyDialogsProvider.",
    );
    vi.restoreAllMocks();
  });
});

describe("CommercialOverview and CommercialDashboard", () => {
  it("summarises the active company", async () => {
    render(
      <Providers>
        <CommercialOverview />
      </Providers>,
    );
    expect(screen.getByText("Your advertising at a glance")).toBeInTheDocument();
    expect(await screen.findByText("How Acme is doing")).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText(/is suspended/)).not.toBeInTheDocument();
  });

  it("warns when the company is suspended", async () => {
    companiesAre(company({ status: "suspended" }));
    render(
      <Providers>
        <CommercialOverview />
      </Providers>,
    );
    expect(await screen.findByText(/This company is suspended/)).toBeInTheDocument();
  });

  it("mounts the page inside the shell", async () => {
    render(
      <ToastProvider>
        <CompanyProvider>
          <CommercialDashboard>
            <p>page</p>
          </CommercialDashboard>
        </CompanyProvider>
      </ToastProvider>,
    );
    expect(screen.getByTestId("shell")).toHaveTextContent("page");
    await waitFor(() => expect(fetchActiveCompany).toHaveBeenCalled());
  });
});

describe("CommercialFrame", () => {
  function Inside() {
    const { status } = useCompany();
    return <p>dashboard {status}</p>;
  }

  it("renders nothing on any other site", () => {
    stubLocation("https://loopdn.com/");
    const { container } = render(
      <CommercialFrame>
        <Inside />
      </CommercialFrame>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to log in, remembering where they were going", () => {
    stubLocation("https://commercial.loopdn.com/campaigns/?id=12");
    auth = { session: null, isLoaded: true };
    const { container } = render(
      <CommercialFrame>
        <Inside />
      </CommercialFrame>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(setPostAuthRedirect).toHaveBeenCalledWith("/campaigns/?id=12");
    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("waits for the session, then for the account's features", () => {
    auth = { session: null, isLoaded: false };
    const { container, rerender } = render(
      <CommercialFrame>
        <Inside />
      </CommercialFrame>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(replace).not.toHaveBeenCalled();

    auth = { session: "sam", isLoaded: true };
    features = { features: new Set(), loading: true };
    rerender(
      <CommercialFrame>
        <Inside />
      </CommercialFrame>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading your dashboard");
  });

  it("mounts the dashboard for a commercial account", async () => {
    render(
      <CommercialFrame>
        <Inside />
      </CommercialFrame>,
    );
    expect(await screen.findByText("dashboard ready")).toBeInTheDocument();
  });

  it("turns a chat account away, offering a commercial one or a way out", async () => {
    features = { features: new Set(), loading: false };
    render(
      <CommercialFrame>
        <Inside />
      </CommercialFrame>,
    );
    expect(
      screen.getByRole("heading", { name: "This isn't a commercial account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("sam")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Loopd'n chat" })).toHaveAttribute(
      "href",
      "https://loopdn.com/chats/",
    );

    click("Create a commercial account");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signup/"));
    click("Sign out");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
    expect(logout).toHaveBeenCalledTimes(2);
  });
});

describe("AddFundsDialog", () => {
  function open(props: Partial<Parameters<typeof AddFundsDialog>[0]> = {}) {
    const onClose = vi.fn();
    render(<AddFundsDialog company={company()} isOpen onClose={onClose} {...props} />);
    return onClose;
  }

  it("starts from the currency's minimum, with a few amounts to pick from", async () => {
    open();
    const amount = screen.getByLabelText("Amount");
    await waitFor(() => expect(amount).toHaveValue("10"));
    expect(screen.getByText("At least $10.00.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Funds are in USD and go to Acme's balance.",
    );

    click("$100.00");
    expect(amount).toHaveValue("100");
    click("$20.00");
    expect(amount).toHaveValue("20");
  });

  it("starts from what the campaign is short by, when that is more", async () => {
    open({ suggestedCents: 4550 });
    await waitFor(() => expect(screen.getByLabelText("Amount")).toHaveValue("45.50"));
  });

  it("refuses an amount that is not money, or is under the minimum", async () => {
    open();
    const amount = screen.getByLabelText("Amount");
    await waitFor(() => expect(amount).toHaveValue("10"));

    fireEvent.change(amount, { target: { value: "ten" } });
    click("Continue to payment");
    expect(screen.getByText("Enter an amount, like 1000 or 1000.50.")).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "" } });
    click("Continue to payment");
    expect(screen.getByText("Enter an amount, like 1000 or 1000.50.")).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "5" } });
    click("Continue to payment");
    expect(screen.getByText("Add at least $10.00.")).toBeInTheDocument();
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("hands the page to Stripe, to come back to the balance", async () => {
    const location = stubLocation("https://commercial.loopdn.com/balance/");
    const pending = deferred<Awaited<ReturnType<typeof startCheckout>>>();
    vi.mocked(startCheckout).mockReturnValue(pending.promise);
    const onClose = open();
    await waitFor(() => expect(screen.getByLabelText("Amount")).toHaveValue("10"));

    click("Continue to payment");
    expect(startCheckout).toHaveBeenCalledWith(3, {
      amountCents: 1000,
      successUrl: "https://commercial.loopdn.com/balance/?checkout=success",
      cancelUrl: "https://commercial.loopdn.com/balance/?checkout=cancelled",
    });
    // Nothing closes it, or sends twice, while the request is out.
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeDisabled();
    click("Close modal");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () =>
      pending.resolve({ ok: true, data: "https://checkout.stripe.com/c/1" }),
    );
    expect(location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/1");
  });

  it("returns to the page it was opened from, keeping that page's query", async () => {
    stubLocation("https://commercial.loopdn.com/campaign/?id=12");
    vi.mocked(startCheckout).mockResolvedValue({ ok: true, data: "https://stripe" });
    open({ returnPath: "/campaign/?id=12" });
    await waitFor(() => expect(screen.getByLabelText("Amount")).toHaveValue("10"));
    click("Continue to payment");
    await waitFor(() => expect(startCheckout).toHaveBeenCalled());
    expect(vi.mocked(startCheckout).mock.calls[0][1].successUrl).toBe(
      "https://commercial.loopdn.com/campaign/?id=12&checkout=success",
    );
  });

  it("says why the payment could not start, and can then be closed", async () => {
    vi.mocked(startCheckout)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: { amount_cents: "That is over the limit." },
      })
      .mockResolvedValueOnce({ ok: false, message: "Stripe is unavailable." });
    const onClose = open();
    await waitFor(() => expect(screen.getByLabelText("Amount")).toHaveValue("10"));

    click("Continue to payment");
    expect(await screen.findByText("That is over the limit.")).toBeInTheDocument();
    click("Continue to payment");
    expect(await screen.findByText("Stripe is unavailable.")).toBeInTheDocument();

    click("Cancel");
    click("Close modal");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("works without a known minimum, and does nothing while closed", async () => {
    vi.mocked(fetchMarkets).mockResolvedValue({ ok: false, message: "down" });
    vi.mocked(startCheckout).mockResolvedValue({ ok: true, data: "https://stripe" });
    const first = render(
      <AddFundsDialog company={company()} isOpen={false} onClose={() => {}} />,
    );
    expect(fetchMarkets).not.toHaveBeenCalled();
    first.unmount();

    open({ company: company({ currency: "EUR" }) });
    await waitFor(() => expect(fetchMarkets).toHaveBeenCalled());
    expect(screen.queryByText(/^At least/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "3" } });
    click("Continue to payment");
    await waitFor(() => expect(startCheckout).toHaveBeenCalled());
  });

  it("keeps an amount already typed when the minimum arrives, for a currency with none", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchMarkets>>>();
    vi.mocked(fetchMarkets).mockReturnValue(pending.promise);
    open({ company: company({ currency: "EUR" }) });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "75" } });
    await act(async () => pending.resolve({ ok: true, data: OPTIONS.markets }));
    expect(screen.getByLabelText("Amount")).toHaveValue("75");
    expect(screen.queryByText(/^At least/)).not.toBeInTheDocument();
  });
});

describe("CampaignResults", () => {
  function report(overrides: Partial<CampaignReport> = {}): CampaignReport {
    return {
      currency: "USD",
      reachShownFrom: 50,
      result: "clicks",
      totals: {
        served: 1000,
        viewed: 800,
        reach: 600,
        clicks: 40,
        results: 40,
        spendCents: 640,
        costPer1000ViewsCents: 800,
        costPerClickCents: 16,
        costPerResultCents: 16,
      },
      days: [],
      ...overrides,
    };
  }

  function resultsAre(value: CampaignReport) {
    vi.mocked(fetchCampaignReport).mockResolvedValue({ ok: true, data: value });
  }

  it("explains that results come once the campaign has run", () => {
    render(<CampaignResults campaign={campaign({ status: "draft" })} />);
    expect(
      screen.getByText("Results will appear here once your campaign starts running."),
    ).toBeInTheDocument();
    expect(fetchCampaignReport).not.toHaveBeenCalled();
  });

  it("shows views, reach, clicks and the click rate for a website campaign", async () => {
    resultsAre(report());
    render(<CampaignResults campaign={campaign({ status: "running" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results");

    expect(await screen.findByText("800")).toBeInTheDocument();
    expect(screen.getByText("600")).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByText("$6.40")).toBeInTheDocument();
    expect(screen.getByText("Cost per click")).toBeInTheDocument();
    expect(screen.getByText("$0.16")).toBeInTheDocument();
    expect(fetchCampaignReport).toHaveBeenCalledWith(12);
  });

  it("counts what the campaign asked for, and hides small reach", async () => {
    resultsAre(
      report({
        result: "leads",
        totals: { ...report().totals, reach: null, results: 7, costPerResultCents: null },
      }),
    );
    render(<CampaignResults campaign={campaign({ status: "ended" })} />);
    expect(await screen.findByText("Fewer than 50")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Cost per lead")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("says there are no views yet, or why results could not be loaded", async () => {
    resultsAre(report({ totals: { ...report().totals, viewed: 0, served: 0 } }));
    const first = render(<CampaignResults campaign={campaign({ status: "paused" })} />);
    expect(await screen.findByText("No views yet.")).toBeInTheDocument();
    first.unmount();

    vi.mocked(fetchCampaignReport).mockResolvedValue({
      ok: false,
      message: "Couldn't load the results.",
    });
    render(<CampaignResults campaign={campaign({ status: "running" })} />);
    expect(await screen.findByText("Results couldn't be loaded.")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load the results.")).toBeInTheDocument();
  });

  it("ignores results that arrive after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCampaignReport>>>();
    vi.mocked(fetchCampaignReport).mockReturnValue(pending.promise);
    const { unmount } = render(
      <CampaignResults campaign={campaign({ status: "running" })} />,
    );
    unmount();
    pending.resolve({ ok: true, data: report() });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
