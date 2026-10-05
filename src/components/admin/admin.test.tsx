import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
const toast = vi.fn();
let pathname = "/admin/";
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
  const actual = await vi.importActual<
    typeof import("@/lib/rbac/requirements")
  >("@/lib/rbac/requirements");
  return { meets: actual.meets, useFeatures: () => features };
});
vi.mock("@/components/ui", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/ui")>("@/components/ui");
  return { ...actual, useToast: () => toast };
});
vi.mock("@/lib/admin/api", () => ({
  approveCampaign: vi.fn(),
  checkGroupMatch: vi.fn(),
  fetchReviewCampaign: vi.fn(),
  rejectCampaign: vi.fn(),
}));

import AdminLayout from "@/app/(admin)/admin/layout";
import AdminOverviewPage from "@/app/(admin)/admin/page";
import { AdminFrame, useAdminFeatures } from "@/components/admin/AdminFrame";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { GroupMatchCheck } from "@/components/admin/review/GroupMatchCheck";
import { RejectDialog } from "@/components/admin/review/RejectDialog";
import {
  ReviewDetail,
  ReviewDetailSkeleton,
} from "@/components/admin/review/ReviewDetail";
import { STATUS_TONE } from "@/components/admin/review/statusTone";
import {
  approveCampaign,
  checkGroupMatch,
  fetchReviewCampaign,
  rejectCampaign,
} from "@/lib/admin/api";
import type { ReviewCampaign } from "@/lib/admin/types";
import { logout, setPostAuthRedirect } from "@/lib/auth/client";
import { deferred, stubLocation } from "@/test/helpers";

const ALL = new Set([
  "platform.access",
  "platform.campaign.review",
  "platform.permissions.view",
]);

function review(overrides: Partial<ReviewCampaign> = {}): ReviewCampaign {
  return {
    id: 12,
    name: "Autumn sale",
    objectiveLabel: "Website visits",
    status: "pending_review",
    statusLabel: "Pending review",
    companyName: "Acme",
    totalBudgetCents: 50_000,
    currency: "USD",
    submittedAt: "2026-10-01T10:00:00",
    creativeCount: 2,
    dailyBudgetCents: null,
    cpmCents: 800,
    reservedCents: 50_000,
    startsAt: null,
    endsAt: null,
    company: {
      id: 3,
      name: "Acme",
      status: "active",
      industryLabel: "Retail",
      country: "US",
      countryName: "United States",
      website: "https://acme.example",
      contactEmail: "ads@acme.example",
      owner: "sam",
    },
    audience: {
      categories: [{ slug: "sports", label: "Sports" }],
      regions: [{ code: "US-CA", name: "California" }],
      minGroupSize: 10,
      maxGroupSize: 200,
    },
    creatives: [
      {
        id: 1,
        headline: "Half off",
        body: "This week.",
        imageUrl: null,
        ctaLabel: "Shop",
        ctaKind: "link",
        ctaTarget: "https://acme.example/offer",
        status: "pending_review",
        reviewNotes: "",
      },
      {
        id: 2,
        headline: "Get a quote",
        body: "Ask us.",
        imageUrl: null,
        ctaLabel: "Quote",
        ctaKind: "lead_form",
        ctaTarget: "",
        status: "rejected",
        reviewNotes: "Too vague last time.",
      },
    ],
    events: [
      {
        kind: "created",
        label: "Created",
        by: null,
        note: "",
        createdAt: "2026-09-30T09:00:00",
      },
      {
        kind: "submitted",
        label: "Submitted",
        by: "sam",
        note: "Second try.",
        createdAt: "2026-10-01T10:00:00",
      },
    ],
    findings: [],
    ...overrides,
  };
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  pathname = "/admin/";
  auth = { session: "sam", isLoaded: true };
  features = { features: new Set(ALL), loading: false };
  stubLocation("https://admin.loopdn.com/admin/");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AdminFrame", () => {
  function Inside() {
    const context = useAdminFeatures();
    return (
      <p>
        admin {context.loading ? "loading" : "ready"} {context.features.size}
      </p>
    );
  }

  function mount() {
    return render(
      <AdminFrame>
        <Inside />
      </AdminFrame>,
    );
  }

  it("renders nothing on any other site", () => {
    stubLocation("https://loopdn.com/admin/");
    expect(mount().container).toBeEmptyDOMElement();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to log in, remembering where they were going", () => {
    stubLocation("https://admin.loopdn.com/admin/campaigns/?id=12");
    auth = { session: null, isLoaded: true };
    expect(mount().container).toBeEmptyDOMElement();
    expect(setPostAuthRedirect).toHaveBeenCalledWith("/admin/campaigns/?id=12");
    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("waits for the session, then for the account's features", () => {
    auth = { session: null, isLoaded: false };
    const view = mount();
    expect(view.container).toBeEmptyDOMElement();
    expect(replace).not.toHaveBeenCalled();

    auth = { session: "sam", isLoaded: true };
    features = { features: new Set(), loading: true };
    view.rerender(
      <AdminFrame>
        <Inside />
      </AdminFrame>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the admin site",
    );
  });

  it("hands its features to the pages below it", () => {
    mount();
    expect(screen.getByText("admin ready 3")).toBeInTheDocument();
  });

  it("turns away an account without the admin role", async () => {
    features = { features: new Set(["commercial.access"]), loading: false };
    mount();
    expect(
      screen.getByRole("heading", { name: "This isn't an admin account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("sam")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Loopd'n chat" }),
    ).toHaveAttribute("href", "https://loopdn.com/chats/");

    click("Sign out");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
    expect(logout).toHaveBeenCalled();
  });

  it("defaults to loading for a page rendered outside the frame", () => {
    render(<Inside />);
    expect(screen.getByText("admin loading 0")).toBeInTheDocument();
  });
});

describe("AdminShell", () => {
  function mount() {
    return render(
      <AdminFrame>
        <AdminShell>
          <AdminPageHeader title="Overview" description="Tools." />
        </AdminShell>
      </AdminFrame>,
    );
  }

  function navLinks() {
    return within(screen.getByRole("navigation", { name: "Admin" }))
      .getAllByRole("link")
      .map((link) => link.textContent);
  }

  it("lists the tools this account may use", () => {
    mount();
    expect(navLinks()).toEqual([
      "Loopd'nAdmin",
      "Overview",
      "Campaign review",
      "Permissions",
    ]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tools.")).toBeInTheDocument();
  });

  it("leaves out a tool, and its section, the account may not use", () => {
    features = {
      features: new Set(["platform.access", "platform.permissions.view"]),
      loading: false,
    };
    mount();
    expect(navLinks()).toEqual(["Loopd'nAdmin", "Overview", "Permissions"]);
    expect(screen.queryByText("Advertising")).not.toBeInTheDocument();
    expect(screen.getByText("Access")).toBeInTheDocument();
  });

  it.each([
    ["/admin", "Overview"],
    ["/admin/", "Overview"],
    ["/admin/campaigns/", "Campaign review"],
    ["/admin/permissions/", "Permissions"],
  ])("marks %s as the %s page", (path, label) => {
    pathname = path;
    mount();
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("collapses to icons and remembers that", () => {
    const first = mount();
    click("Collapse navigation");
    expect(
      screen.getByRole("button", { name: "Expand navigation" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Advertising")).not.toBeInTheDocument();
    expect(screen.getByTitle("Campaign review")).toBeInTheDocument();
    expect(localStorage.getItem("loopdn_admin_nav_collapsed")).toBe("1");
    first.unmount();

    mount();
    click("Expand navigation");
    expect(localStorage.getItem("loopdn_admin_nav_collapsed")).toBe("0");
  });

  it("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    click("Collapse navigation");
    expect(
      screen.getByRole("button", { name: "Expand navigation" }),
    ).toBeInTheDocument();
  });

  it("opens as a drawer on a small screen, and closes on navigating", () => {
    mount();
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(nav).toHaveClass("hidden");

    click("Open navigation");
    expect(nav).toHaveClass("flex");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Close navigation" })[0],
    );
    expect(nav).toHaveClass("hidden");

    click("Open navigation");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Close navigation" })[1],
    );
    expect(nav).toHaveClass("hidden");

    click("Open navigation");
    fireEvent.click(within(nav).getByRole("link", { name: "Permissions" }));
    expect(nav).toHaveClass("hidden");
  });

  it("opens the chat app in a new tab, and signs out, from the account menu", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    mount();
    const row = screen.getByRole("button", { name: "Account menu" });
    expect(row).toHaveTextContent("sam");

    fireEvent.click(row);
    fireEvent.click(
      screen.getByRole("menuitem", { name: /open loopd'n chat/i }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://loopdn.com/chats/",
      "_blank",
      "noopener",
    );

    fireEvent.click(row);
    fireEvent.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
  });

  it("heads a page without a description too", () => {
    render(<AdminPageHeader title="Permissions" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Permissions",
    );
  });
});

describe("the admin layout and overview", () => {
  it("frames every admin page", () => {
    render(
      <AdminLayout>
        <p>admin page</p>
      </AdminLayout>,
    );
    expect(
      screen.getByRole("navigation", { name: "Admin" }),
    ).toBeInTheDocument();
    expect(screen.getByText("admin page")).toBeInTheDocument();
  });

  it("links to each tool the account may use", () => {
    render(
      <AdminFrame>
        <AdminOverviewPage />
      </AdminFrame>,
    );
    expect(
      screen
        .getByRole("link", { name: /campaign review/i })
        .getAttribute("href"),
    ).toMatch(/^\/admin\/campaigns\/?$/);
    expect(
      screen.getByRole("link", { name: /permissions/i }).getAttribute("href"),
    ).toMatch(/^\/admin\/permissions\/?$/);
  });

  it("shows no tool the account may not use", () => {
    features = { features: new Set(["platform.access"]), loading: false };
    render(
      <AdminFrame>
        <AdminOverviewPage />
      </AdminFrame>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("GroupMatchCheck", () => {
  function check(value: string) {
    fireEvent.change(screen.getByLabelText(/does a group match/i), {
      target: { value },
    });
    click("Check");
  }

  it("asks for a real group number", () => {
    render(<GroupMatchCheck campaignId={12} />);
    for (const value of ["", "abc", "0", "-4", "1.5"]) {
      check(value);
      expect(
        screen.getByText("Enter the group's number, e.g. 42."),
      ).toBeInTheDocument();
    }
    expect(checkGroupMatch).not.toHaveBeenCalled();
  });

  it("shows each rule the group passes or fails", async () => {
    const pending = deferred<Awaited<ReturnType<typeof checkGroupMatch>>>();
    vi.mocked(checkGroupMatch).mockReturnValue(pending.promise);
    render(<GroupMatchCheck campaignId={12} />);
    check(" 42 ");
    expect(checkGroupMatch).toHaveBeenCalledWith(12, 42);
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();

    await act(async () =>
      pending.resolve({
        ok: true,
        data: {
          group: { id: 42, name: "Runners", memberCount: 30 },
          matches: false,
          checks: [
            {
              code: "size",
              label: "Group size",
              passed: true,
              detail: "30 members",
            },
            {
              code: "region",
              label: "Region",
              passed: false,
              detail: "In New York",
            },
          ],
        },
      }),
    );
    expect(screen.getByText("Runners")).toBeInTheDocument();
    expect(screen.getByText("#42 · 30 active members")).toBeInTheDocument();
    expect(screen.getByText("Doesn't match")).toBeInTheDocument();
    expect(screen.getByLabelText("Passes")).toBeInTheDocument();
    expect(screen.getByLabelText("Fails")).toBeInTheDocument();
    expect(screen.getByText("In New York")).toBeInTheDocument();
  });

  it("names a group with no name by its number, and clears a result on failure", async () => {
    vi.mocked(checkGroupMatch).mockResolvedValue({
      ok: true,
      data: {
        group: { id: 7, name: "", memberCount: 4 },
        matches: true,
        checks: [],
      },
    });
    render(<GroupMatchCheck campaignId={12} />);
    check("7");
    expect(await screen.findByText("Group 7")).toBeInTheDocument();
    expect(screen.getByText("Matches")).toBeInTheDocument();

    vi.mocked(checkGroupMatch).mockResolvedValue({
      ok: false,
      message: "No group with that number.",
    });
    check("8");
    expect(
      await screen.findByText("No group with that number."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Group 7")).not.toBeInTheDocument();

    check("x");
    expect(
      screen.getByText("Enter the group's number, e.g. 42."),
    ).toBeInTheDocument();
  });
});

describe("RejectDialog", () => {
  function open(onRejected = vi.fn(), onClose = vi.fn()) {
    render(
      <RejectDialog
        campaign={review()}
        isOpen
        onClose={onClose}
        onRejected={onRejected}
      />,
    );
    return { onRejected, onClose };
  }

  it("says where the campaign goes back to", () => {
    open();
    expect(
      screen.getByRole("dialog", { name: "Send back to the company" }),
    ).toHaveTextContent('"Autumn sale" returns to Acme as a draft');
  });

  it("needs a reason, and a note for each creative marked", () => {
    open();
    click("Send back");
    expect(
      screen.getByText("Say why, so the company knows what to fix."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Why"), {
      target: { value: "Fix the link." },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Half off" }));
    click("Send back");
    expect(
      screen.getByText("Add a note to each creative you marked, or unmark it."),
    ).toBeInTheDocument();
    expect(rejectCampaign).not.toHaveBeenCalled();
  });

  it("sends the reason and the notes for the creatives marked", async () => {
    const rejected = review({ status: "draft", statusLabel: "Draft" });
    const pending = deferred<Awaited<ReturnType<typeof rejectCampaign>>>();
    vi.mocked(rejectCampaign).mockReturnValue(pending.promise);
    const { onRejected, onClose } = open();

    fireEvent.change(screen.getByLabelText("Why"), {
      target: { value: "  Fix the link. " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Half off" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Get a quote" }));
    // Unmarking takes the creative back out of the rejection.
    fireEvent.click(screen.getByRole("checkbox", { name: "Get a quote" }));
    fireEvent.change(screen.getByLabelText('What to change in "Half off"'), {
      target: { value: " The link is dead. " },
    });
    click("Send back");

    expect(rejectCampaign).toHaveBeenCalledWith(12, {
      note: "Fix the link.",
      creatives: [{ id: 1, note: "The link is dead." }],
    });
    click("Send back");
    click("Close modal");
    expect(rejectCampaign).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => pending.resolve({ ok: true, data: rejected }));
    expect(onRejected).toHaveBeenCalledWith(rejected);
  });

  it("says why it could not be sent back, and can be cancelled", async () => {
    vi.mocked(rejectCampaign).mockResolvedValue({
      ok: false,
      message: "It has already been approved.",
    });
    const { onRejected, onClose } = open();
    fireEvent.change(screen.getByLabelText("Why"), {
      target: { value: "No." },
    });
    click("Send back");
    expect(
      await screen.findByText("It has already been approved."),
    ).toBeInTheDocument();
    expect(onRejected).not.toHaveBeenCalled();

    click("Cancel");
    click("Close modal");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("offers no creatives to mark when the campaign has none", () => {
    render(
      <RejectDialog
        campaign={review({ creatives: [] })}
        isOpen
        onClose={() => {}}
        onRejected={() => {}}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("ReviewDetail", () => {
  const onDecided = vi.fn();

  async function show(overrides: Partial<ReviewCampaign> = {}) {
    vi.mocked(fetchReviewCampaign).mockResolvedValue({
      ok: true,
      data: review(overrides),
    });
    const view = render(<ReviewDetail campaignId={12} onDecided={onDecided} />);
    await screen.findByRole("heading", { level: 1 });
    return view;
  }

  it("shows a placeholder, then everything a reviewer needs", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchReviewCampaign>>>();
    vi.mocked(fetchReviewCampaign).mockReturnValue(pending.promise);
    render(<ReviewDetail campaignId={12} onDecided={onDecided} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading campaign");
    expect(
      render(<ReviewDetailSkeleton />).container,
    ).not.toBeEmptyDOMElement();

    await act(async () => pending.resolve({ ok: true, data: review() }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Autumn sale" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme · Website visits")).toBeInTheDocument();
    expect(
      screen.getByText(/^Submitted Oct 1, 2026 at 10:00/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The automatic checks found nothing."),
    ).toBeInTheDocument();
    expect(screen.getByText("$8.00 per 1,000 views")).toBeInTheDocument();
    expect(screen.getByText("No cap")).toBeInTheDocument();
    expect(screen.getByText("As soon as it's approved")).toBeInTheDocument();
    expect(screen.getByText("When the budget is spent")).toBeInTheDocument();
    expect(screen.getByText("Retail · United States")).toBeInTheDocument();
    expect(screen.getByText("Sports")).toBeInTheDocument();
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText("10 to 200 members")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Creatives (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Button opens Loopd'n's lead form"),
    ).toBeInTheDocument();
    expect(screen.getByText("Too vague last time.")).toBeInTheDocument();
    expect(screen.getByText("Second try.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://acme.example/offer" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByRole("link", { name: "Review queue" }).getAttribute("href"),
    ).toMatch(/^\/admin\/campaigns\/?$/);
  });

  it("describes a sparse campaign plainly", async () => {
    await show({
      name: "",
      submittedAt: null,
      dailyBudgetCents: 2500,
      cpmCents: null,
      totalBudgetCents: null,
      startsAt: "2026-10-10T12:00:00",
      endsAt: "2026-10-20T12:00:00",
      audience: null,
      creatives: [],
      company: {
        ...review().company,
        website: "",
        contactEmail: "",
        status: "suspended",
      },
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Untitled campaign" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Not fixed")).toBeInTheDocument();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.getByText("Oct 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("Not chosen.")).toBeInTheDocument();
    expect(screen.getByText("This company is suspended.")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText(/^Submitted /)).not.toBeInTheDocument();
  });

  it.each([
    [{ minGroupSize: 10, maxGroupSize: null }, "At least 10 members"],
    [{ minGroupSize: null, maxGroupSize: 50 }, "Up to 50 members"],
    [{ minGroupSize: null, maxGroupSize: null }, "Any size"],
  ])("describes a group size of %j", async (size, text) => {
    await show({ audience: { categories: [], regions: [], ...size } });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText("Any kind of group")).toBeInTheDocument();
    expect(screen.getByText("Anywhere in United States")).toBeInTheDocument();
  });

  it("lists the automatic findings, the ones about creatives beside them", async () => {
    await show({
      findings: [
        {
          code: "budget_low",
          severity: "warning",
          message: "Budget is small.",
          creativeId: null,
        },
        {
          code: "link_dead",
          severity: "blocker",
          message: "Dead link.",
          creativeId: 1,
        },
      ],
    });
    expect(
      screen.getByRole("heading", { name: "Automatic checks" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Budget is small.")).toBeInTheDocument();
    expect(
      screen.getByText("1 about the creatives - shown with each one below."),
    ).toBeInTheDocument();
    expect(screen.getByText("Dead link.").closest("p")).toHaveTextContent(
      "Blocker:",
    );
    expect(screen.getByText("Budget is small.").closest("p")).toHaveTextContent(
      "Check:",
    );
  });

  it("will not approve past a blocker", async () => {
    await show({
      findings: [
        {
          code: "link_dead",
          severity: "blocker",
          message: "Dead link.",
          creativeId: null,
        },
      ],
    });
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute(
      "title",
      "Fix the blockers below before approving",
    );
    expect(screen.getByRole("button", { name: "Send back" })).toBeEnabled();
  });

  it("approves with an optional note, and tells the queue", async () => {
    const approved = review({ status: "approved", statusLabel: "Approved" });
    const pending = deferred<Awaited<ReturnType<typeof approveCampaign>>>();
    vi.mocked(approveCampaign).mockReturnValue(pending.promise);
    await show({
      findings: [
        {
          code: "budget_low",
          severity: "warning",
          message: "Budget is small.",
          creativeId: null,
        },
      ],
    });

    click("Approve");
    const dialog = within(
      screen.getByRole("dialog", { name: "Approve this campaign?" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "The automatic checks raised 1 point to look at.",
    );
    fireEvent.change(dialog.getByRole("textbox"), {
      target: { value: " Looks good. " },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Approve" }));
    expect(approveCampaign).toHaveBeenCalledWith(12, "Looks good.");
    fireEvent.click(dialog.getByRole("button", { name: "Approve" }));
    click("Close modal");
    expect(approveCampaign).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => pending.resolve({ ok: true, data: approved }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith({ title: "Campaign approved" });
    expect(onDecided).toHaveBeenCalledWith(approved);
    // Decided, so there is nothing left to decide.
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("counts several findings in the plural, and none not at all", async () => {
    const first = await show({
      findings: [
        { code: "a", severity: "warning", message: "One.", creativeId: null },
        { code: "b", severity: "warning", message: "Two.", creativeId: null },
      ],
    });
    click("Approve");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "raised 2 points to look at.",
    );
    first.unmount();

    await show();
    click("Approve");
    expect(screen.getByRole("dialog")).not.toHaveTextContent(
      "automatic checks raised",
    );
  });

  it("says why it could not be approved, and can be cancelled", async () => {
    vi.mocked(approveCampaign).mockResolvedValue({
      ok: false,
      message: "The company's balance is too low.",
    });
    await show();
    click("Approve");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Approve",
      }),
    );
    expect(
      await screen.findByText("The company's balance is too low."),
    ).toBeInTheDocument();
    click("Cancel");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDecided).not.toHaveBeenCalled();
  });

  it("sends a campaign back and tells the queue", async () => {
    const rejected = review({ status: "draft", statusLabel: "Draft" });
    vi.mocked(rejectCampaign).mockResolvedValue({ ok: true, data: rejected });
    await show();
    click("Send back");
    const dialog = within(
      screen.getByRole("dialog", { name: "Send back to the company" }),
    );
    fireEvent.change(dialog.getByLabelText("Why"), {
      target: { value: "Fix it." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Send back" }));

    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(rejected));
    expect(toast).toHaveBeenCalledWith({ title: "Sent back to the company" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers no decision for a campaign that is not waiting", async () => {
    await show({ status: "running", statusLabel: "Running" });
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send back" }),
    ).not.toBeInTheDocument();
    expect(STATUS_TONE.running).toBe("success");
  });

  it("offers a retry when it cannot be loaded", async () => {
    vi.mocked(fetchReviewCampaign).mockResolvedValue({
      ok: false,
      message: "Couldn't load this campaign.",
    });
    render(<ReviewDetail campaignId={12} onDecided={onDecided} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load this campaign.",
    );

    vi.mocked(fetchReviewCampaign).mockResolvedValue({
      ok: true,
      data: review(),
    });
    click(/try again/i);
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
  });

  it("ignores a campaign that arrives after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchReviewCampaign>>>();
    vi.mocked(fetchReviewCampaign).mockReturnValue(pending.promise);
    const { unmount } = render(
      <ReviewDetail campaignId={12} onDecided={onDecided} />,
    );
    unmount();
    pending.resolve({ ok: true, data: review() });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
