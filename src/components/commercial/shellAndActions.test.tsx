import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
const toast = vi.fn();
const reload = vi.fn();
let pathname = "/";
let session: string | null = "sam";
let activeCompany: unknown;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/auth/client", () => ({
  logout: vi.fn(async () => {}),
  useAuth: () => ({ session, isLoaded: true }),
}));
vi.mock("@/lib/commercial/CompanyProvider", () => ({
  useCompany: () => ({ company: activeCompany, reload }),
}));
vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui");
  return { ...actual, useToast: () => toast };
});
vi.mock("@/components/commercial/CompanySwitcher", () => ({
  CompanySwitcher: () => <div data-testid="company-switcher" />,
}));
vi.mock("@/lib/commercial/api", () => ({
  cancelCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  increaseBudget: vi.fn(),
  pauseCampaign: vi.fn(),
  resumeCampaign: vi.fn(),
  withdrawCampaign: vi.fn(),
}));

import {
  AddBudgetButton,
  CancelCampaignButton,
  DeleteDraftButton,
  PauseResumeButton,
  WithdrawButton,
} from "@/components/commercial/CampaignActions";
import { CommercialShell } from "@/components/commercial/CommercialShell";
import { logout } from "@/lib/auth/client";
import {
  cancelCampaign,
  deleteCampaign,
  increaseBudget,
  pauseCampaign,
  resumeCampaign,
  withdrawCampaign,
} from "@/lib/commercial/api";
import type { CampaignDetail } from "@/lib/commercial/types";
import { campaign, company } from "@/test/commercial";
import { deferred, stubLocation } from "@/test/helpers";

type Result = { ok: true; data: CampaignDetail } | { ok: false; message: string };

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function inDialog() {
  return within(screen.getByRole("dialog"));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  pathname = "/";
  session = "sam";
  activeCompany = company();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CommercialShell", () => {
  function mount() {
    return render(
      <CommercialShell>
        <p>page content</p>
      </CommercialShell>,
    );
  }

  it("frames a page with the navigation and the company switcher", () => {
    mount();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByTestId("company-switcher")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Commercial" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Loopd'nCommercial",
      "Overview",
      "Campaigns",
      "Leads",
      "Analytics",
      "Billing",
      "Settings",
    ]);
    expect(within(nav).getByText("Advertising")).toBeInTheDocument();
  });

  it.each([
    ["/", "Overview"],
    ["/campaigns/", "Campaigns"],
    ["/campaign/", "Campaigns"],
    ["/campaigns/new/", "Campaigns"],
    ["/leads/", "Leads"],
    ["/reports/", "Analytics"],
    ["/balance/", "Billing"],
    ["/account/", "Settings"],
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
    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("Advertising")).not.toBeInTheDocument();
    // With the label gone, the icon's link is named by its tooltip.
    expect(screen.getByTitle("Overview")).toHaveAttribute("aria-current", "page");
    expect(localStorage.getItem("loopdn_commercial_nav_collapsed")).toBe("1");
    first.unmount();

    mount();
    click("Expand navigation");
    expect(localStorage.getItem("loopdn_commercial_nav_collapsed")).toBe("0");
    expect(screen.getByText("Advertising")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
  });

  it("opens as a drawer on a small screen, and closes on navigating", () => {
    mount();
    const nav = screen.getByRole("navigation", { name: "Commercial" });
    expect(nav).toHaveClass("hidden");

    click("Open navigation");
    expect(nav).toHaveClass("flex");
    expect(nav).not.toHaveClass("hidden");

    // The backdrop and the drawer's own button both close it.
    fireEvent.click(screen.getAllByRole("button", { name: "Close navigation" })[0]);
    expect(nav).toHaveClass("hidden");

    click("Open navigation");
    fireEvent.click(screen.getAllByRole("button", { name: "Close navigation" })[1]);
    expect(nav).toHaveClass("hidden");

    click("Open navigation");
    fireEvent.click(within(nav).getByRole("link", { name: "Leads" }));
    expect(nav).toHaveClass("hidden");
  });

  it("shows who is signed in, and opens the account menu from that row", () => {
    mount();
    const row = screen.getByRole("button", { name: "Account menu" });
    expect(row).toHaveTextContent("S");
    expect(row).toHaveTextContent("sam");
    expect(row).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Account" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "CompanyDetails of the company you're working in",
      "SettingsEmail, password and notifications",
      "HelpGet in touch with support",
      "Log outSign out of your account",
    ]);
  });

  it("goes to the company and settings pages from the menu", () => {
    mount();
    click("Account menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /company/i }));
    expect(push).toHaveBeenCalledWith("/company/");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    click("Account menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
    expect(push).toHaveBeenCalledWith("/account/");
  });

  it("opens a support email, and signs out to the login page", async () => {
    const location = stubLocation("https://commercial.loopdn.com/");
    mount();
    click("Account menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /help/i }));
    expect(location.href).toMatch(/^mailto:support@loopdn\.com/);

    click("Account menu");
    fireEvent.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
  });

  it("falls back to a question mark with no session name", () => {
    session = null;
    mount();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("?");
  });
});

describe("DeleteDraftButton", () => {
  it("asks first, and can be talked out of it", () => {
    const onDeleted = vi.fn();
    render(<DeleteDraftButton campaign={campaign({ name: " " })} onDeleted={onDeleted} />);
    click("Delete");
    expect(screen.getByRole("dialog", { name: "Delete this draft?" })).toHaveTextContent(
      "“Untitled campaign” and its creatives will be gone for good.",
    );
    click("Keep it");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteCampaign).not.toHaveBeenCalled();
  });

  it("deletes the draft and says so", async () => {
    const pending = deferred<Awaited<ReturnType<typeof deleteCampaign>>>();
    vi.mocked(deleteCampaign).mockReturnValue(pending.promise);
    const onDeleted = vi.fn();
    render(<DeleteDraftButton campaign={campaign()} size="md" onDeleted={onDeleted} />);
    click("Delete");
    click("Delete draft");
    expect(inDialog().getByRole("button", { name: "Delete draft" })).toBeDisabled();
    // Nothing closes it while the request is out.
    click("Close modal");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => pending.resolve({ ok: true, data: null }));
    expect(deleteCampaign).toHaveBeenCalledWith(12);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith({ title: "Draft deleted" });
    expect(onDeleted).toHaveBeenCalled();
  });

  it("says why it could not be deleted, and forgets that on closing", async () => {
    vi.mocked(deleteCampaign).mockResolvedValue({
      ok: false,
      message: "It has already been submitted.",
    });
    render(<DeleteDraftButton campaign={campaign()} onDeleted={() => {}} />);
    click("Delete");
    click("Delete draft");
    expect(await screen.findByText("It has already been submitted.")).toBeInTheDocument();

    click("Close modal");
    click("Delete");
    expect(screen.queryByText("It has already been submitted.")).not.toBeInTheDocument();
  });
});

describe("WithdrawButton", () => {
  it("withdraws from review, returning the budget, and reloads the balance", async () => {
    const withdrawn = campaign({ status: "draft" });
    const pending = deferred<Result>();
    vi.mocked(withdrawCampaign).mockReturnValue(pending.promise);
    const onWithdrawn = vi.fn();
    render(
      <WithdrawButton
        campaign={campaign({ status: "pending_review", reservedCents: 50_000 })}
        onWithdrawn={onWithdrawn}
      />,
    );
    click("Withdraw");
    expect(screen.getByRole("dialog", { name: "Withdraw from review?" })).toBeInTheDocument();
    fireEvent.click(inDialog().getByRole("button", { name: "Withdraw" }));
    click("Close modal");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => pending.resolve({ ok: true, data: withdrawn }));
    expect(toast).toHaveBeenCalledWith({
      title: "Withdrawn from review",
      description: "$500.00 is back in your balance. It's a draft again.",
    });
    expect(reload).toHaveBeenCalled();
    expect(onWithdrawn).toHaveBeenCalledWith(withdrawn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has different words when nothing was set aside", async () => {
    vi.mocked(withdrawCampaign).mockResolvedValue({ ok: true, data: campaign() });
    render(
      <WithdrawButton
        campaign={campaign({ status: "pending_review" })}
        size="md"
        onWithdrawn={() => {}}
      />,
    );
    click("Withdraw");
    fireEvent.click(inDialog().getByRole("button", { name: "Withdraw" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "It's a draft again. Submit it when you're ready.",
        }),
      ),
    );
  });

  it("says why it could not be withdrawn, and can be left in review", async () => {
    vi.mocked(withdrawCampaign).mockResolvedValue({
      ok: false,
      message: "It has already been approved.",
    });
    const onWithdrawn = vi.fn();
    render(<WithdrawButton campaign={campaign()} onWithdrawn={onWithdrawn} />);
    click("Withdraw");
    fireEvent.click(inDialog().getByRole("button", { name: "Withdraw" }));
    expect(await screen.findByText("It has already been approved.")).toBeInTheDocument();
    expect(onWithdrawn).not.toHaveBeenCalled();

    click("Leave it in review");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    click("Withdraw");
    expect(screen.queryByText("It has already been approved.")).not.toBeInTheDocument();
    click("Close modal");
  });
});

describe("AddBudgetButton", () => {
  function open(overrides: Partial<CampaignDetail> = {}) {
    const onRaised = vi.fn();
    render(<AddBudgetButton campaign={campaign(overrides)} onRaised={onRaised} />);
    click("Add budget");
    return onRaised;
  }

  it("shows the current total and what is available", () => {
    open();
    expect(screen.getByRole("dialog", { name: "Add budget" })).toHaveTextContent(
      "The total is $500.00 now.",
    );
    expect(screen.getByText("Available: $120.00")).toBeInTheDocument();
    expect(screen.getByLabelText("New total budget")).toHaveAttribute(
      "placeholder",
      "1500",
    );
  });

  it("only accepts a total above the current one", () => {
    open();
    for (const value of ["", "abc", "500", "100"]) {
      fireEvent.change(screen.getByLabelText("New total budget"), {
        target: { value },
      });
      click("Raise budget");
      expect(screen.getByText("Enter a new total above $500.00.")).toBeInTheDocument();
    }
    expect(increaseBudget).not.toHaveBeenCalled();
  });

  it("raises the budget and says how much more is set aside", async () => {
    const raised = campaign({ totalBudgetCents: 80_000 });
    const pending = deferred<Result>();
    vi.mocked(increaseBudget).mockReturnValue(pending.promise);
    const onRaised = open();
    fireEvent.change(screen.getByLabelText("New total budget"), {
      target: { value: "800" },
    });
    click("Raise budget");
    expect(increaseBudget).toHaveBeenCalledWith(12, 80_000);
    click("Close modal");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => pending.resolve({ ok: true, data: raised }));
    expect(toast).toHaveBeenCalledWith({
      title: "Budget raised",
      description: "$300.00 more is set aside for this campaign.",
    });
    expect(reload).toHaveBeenCalled();
    expect(onRaised).toHaveBeenCalledWith(raised);
  });

  it("explains a refusal with the most specific reason it has", async () => {
    vi.mocked(increaseBudget)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: { funds: "You need $300.00 more in your balance." },
      } as never)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: { total_budget_cents: "That is over the campaign limit." },
      } as never)
      .mockResolvedValueOnce({ ok: false, message: "The campaign has ended." });
    open();
    fireEvent.change(screen.getByLabelText("New total budget"), {
      target: { value: "800" },
    });

    click("Raise budget");
    expect(
      await screen.findByText("You need $300.00 more in your balance."),
    ).toBeInTheDocument();
    click("Raise budget");
    expect(await screen.findByText("That is over the campaign limit.")).toBeInTheDocument();
    click("Raise budget");
    expect(await screen.findByText("The campaign has ended.")).toBeInTheDocument();

    click("Cancel");
    click("Add budget");
    expect(screen.getByLabelText("New total budget")).toHaveValue("");
    expect(screen.queryByText("The campaign has ended.")).not.toBeInTheDocument();
    click("Close modal");
  });

  it("copes with no budget set yet and no company loaded", () => {
    activeCompany = null;
    open({ totalBudgetCents: null });
    expect(screen.getByRole("dialog")).toHaveTextContent("The total is $0.00 now.");
    expect(screen.queryByText(/^Available:/)).not.toBeInTheDocument();
  });
});

describe("PauseResumeButton", () => {
  it("pauses a running campaign", async () => {
    const paused = campaign({ status: "paused" });
    const pending = deferred<Result>();
    vi.mocked(pauseCampaign).mockReturnValue(pending.promise);
    const onChanged = vi.fn();
    render(
      <PauseResumeButton campaign={campaign({ status: "running" })} onChanged={onChanged} />,
    );
    click("Pause");
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();

    await act(async () => pending.resolve({ ok: true, data: paused }));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Campaign paused" }),
    );
    expect(onChanged).toHaveBeenCalledWith(paused);
    expect(resumeCampaign).not.toHaveBeenCalled();
  });

  it("resumes a paused one", async () => {
    vi.mocked(resumeCampaign).mockResolvedValue({
      ok: true,
      data: campaign({ status: "running" }),
    });
    render(
      <PauseResumeButton campaign={campaign({ status: "paused" })} onChanged={() => {}} />,
    );
    click("Resume");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: "Campaign resumed",
        description: "It's running again.",
      }),
    );
  });

  it("says which of the two it could not do", async () => {
    vi.mocked(pauseCampaign).mockResolvedValue({ ok: false, message: "Try again." });
    vi.mocked(resumeCampaign).mockResolvedValue({ ok: false, message: "Out of budget." });
    const onChanged = vi.fn();
    const first = render(
      <PauseResumeButton campaign={campaign({ status: "running" })} onChanged={onChanged} />,
    );
    click("Pause");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: "Couldn't pause it",
        description: "Try again.",
        tone: "error",
      }),
    );
    first.unmount();

    render(
      <PauseResumeButton campaign={campaign({ status: "paused" })} onChanged={onChanged} />,
    );
    click("Resume");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't resume it" }),
      ),
    );
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("CancelCampaignButton", () => {
  it("says what comes back, cancels, and reloads the balance", async () => {
    const ended = campaign({ status: "ended" });
    const pending = deferred<Result>();
    vi.mocked(cancelCampaign).mockReturnValue(pending.promise);
    const onCancelled = vi.fn();
    render(
      <CancelCampaignButton
        campaign={campaign({ status: "running", reservedCents: 12_345 })}
        onCancelled={onCancelled}
      />,
    );
    click("Cancel campaign");
    expect(screen.getByRole("dialog", { name: "Cancel this campaign?" })).toHaveTextContent(
      "The $123.45 it hasn't spent goes back to your balance.",
    );
    fireEvent.click(inDialog().getByRole("button", { name: "Cancel campaign" }));
    click("Close modal");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => pending.resolve({ ok: true, data: ended }));
    expect(toast).toHaveBeenCalledWith({
      title: "Campaign cancelled",
      description: "$123.45 is back in your balance.",
    });
    expect(reload).toHaveBeenCalled();
    expect(onCancelled).toHaveBeenCalledWith(ended);
  });

  it("has plainer words when nothing is left to return", async () => {
    vi.mocked(cancelCampaign).mockResolvedValue({ ok: true, data: campaign() });
    render(<CancelCampaignButton campaign={campaign()} onCancelled={() => {}} />);
    click("Cancel campaign");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "It stops for good and won't be shown again.",
    );
    expect(screen.getByRole("dialog")).not.toHaveTextContent("goes back to your balance");
    fireEvent.click(inDialog().getByRole("button", { name: "Cancel campaign" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "It won't be shown again." }),
      ),
    );
  });

  it("says why it could not be cancelled, and can be kept", async () => {
    vi.mocked(cancelCampaign).mockResolvedValue({
      ok: false,
      message: "It has already ended.",
    });
    render(<CancelCampaignButton campaign={campaign()} onCancelled={() => {}} />);
    click("Cancel campaign");
    fireEvent.click(inDialog().getByRole("button", { name: "Cancel campaign" }));
    expect(await screen.findByText("It has already ended.")).toBeInTheDocument();

    click("Keep it");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    click("Cancel campaign");
    expect(screen.queryByText("It has already ended.")).not.toBeInTheDocument();
    click("Close modal");
  });
});
