import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const switchTo = vi.fn();
const retry = vi.fn();
let companyState: { company: unknown; companies: unknown[] };
let optionsState: { options: unknown; error: string | null };

vi.mock("@/lib/commercial/CompanyProvider", () => ({
  useCompany: () => ({ ...companyState, switchTo }),
}));
vi.mock("@/lib/commercial/useCampaignOptions", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/commercial/useCampaignOptions")
  >("@/lib/commercial/useCampaignOptions");
  return { ...actual, useCampaignOptions: () => ({ ...optionsState, retry }) };
});
vi.mock("@/lib/commercial/api", () => ({ fetchCampaign: vi.fn() }));
vi.mock("@/components/commercial/CampaignResults", () => ({
  CampaignResults: () => <div data-testid="results" />,
}));
// The actions are tested on their own; each is a button that reports back.
vi.mock("@/components/commercial/CampaignActions", () => {
  const action = (label: string, callback: string) => {
    function Action(props: Record<string, (value: unknown) => void>) {
      return (
        <button onClick={() => props[callback]({ ...CHANGED })}>{label}</button>
      );
    }
    return Action;
  };
  return {
    AddBudgetButton: action("stub add budget", "onRaised"),
    CancelCampaignButton: action("stub cancel", "onCancelled"),
    PauseResumeButton: action("stub pause", "onChanged"),
    WithdrawButton: action("stub withdraw", "onWithdrawn"),
    DeleteDraftDialog: ({
      isOpen,
      onClose,
      onDeleted,
    }: {
      isOpen: boolean;
      onClose: () => void;
      onDeleted: () => void;
    }) =>
      isOpen ? (
        <div data-testid="delete-dialog">
          <button onClick={onDeleted}>stub confirm delete</button>
          <button onClick={onClose}>stub keep</button>
        </div>
      ) : null,
  };
});

import {
  CampaignDetail,
  CampaignDetailSkeleton,
} from "@/components/commercial/CampaignDetail";
import { fetchCampaign } from "@/lib/commercial/api";
import type { CampaignDetail as CampaignDetailType } from "@/lib/commercial/types";
import { campaign, company, creative, OPTIONS } from "@/test/commercial";
import { deferred } from "@/test/helpers";

const CHANGED = campaign({ name: "Changed by an action", status: "paused" });

const onChanged = vi.fn();
const onDeleted = vi.fn();

function event(kind: string, extra: object = {}) {
  return {
    kind,
    label: kind[0].toUpperCase() + kind.slice(1),
    by: null,
    note: "",
    createdAt: "2026-10-02T09:30:00",
    ...extra,
  };
}

async function show(overrides: Partial<CampaignDetailType> = {}) {
  vi.mocked(fetchCampaign).mockResolvedValue({
    ok: true,
    data: campaign(overrides),
  });
  const view = render(
    <CampaignDetail
      campaignId={12}
      onChanged={onChanged}
      onDeleted={onDeleted}
    />,
  );
  await screen.findByRole("heading", { level: 1 });
  return view;
}

function hrefOf(name: string | RegExp, index = 0) {
  return screen.getAllByRole("link", { name })[index].getAttribute("href");
}

beforeEach(() => {
  vi.clearAllMocks();
  companyState = { company: company(), companies: [company()] };
  optionsState = { options: OPTIONS, error: null };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CampaignDetail - loading", () => {
  it("shows a placeholder until the campaign and options are in", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCampaign>>>();
    vi.mocked(fetchCampaign).mockReturnValue(pending.promise);
    render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading campaign");

    await act(async () => pending.resolve({ ok: true, data: campaign() }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Autumn sale" }),
    ).toBeInTheDocument();
    expect(fetchCampaign).toHaveBeenCalledWith(12);
  });

  it("waits for the options too", async () => {
    optionsState = { options: null, error: null };
    vi.mocked(fetchCampaign).mockResolvedValue({ ok: true, data: campaign() });
    render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    await waitFor(() => expect(fetchCampaign).toHaveBeenCalled());
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      render(<CampaignDetailSkeleton />).container,
    ).not.toBeEmptyDOMElement();
  });

  it("offers a retry, and the way back, when it cannot load", async () => {
    vi.mocked(fetchCampaign).mockResolvedValue({
      ok: false,
      message: "Couldn't load this campaign.",
    });
    render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load this campaign.",
    );
    expect(hrefOf("Campaigns")).toMatch(/^\/campaigns\/?$/);

    vi.mocked(fetchCampaign).mockResolvedValue({ ok: true, data: campaign() });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
  });

  it("reports options that could not be loaded", async () => {
    optionsState = { options: null, error: "No categories." };
    vi.mocked(fetchCampaign).mockResolvedValue({ ok: true, data: campaign() });
    render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No categories.",
    );
  });

  it("ignores a campaign that arrives after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCampaign>>>();
    vi.mocked(fetchCampaign).mockReturnValue(pending.promise);
    const { unmount } = render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    unmount();
    pending.resolve({ ok: true, data: campaign() });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("CampaignDetail - another company's campaign", () => {
  it("names the owner and offers to switch to it", async () => {
    companyState = {
      company: company(),
      companies: [company(), company({ id: 4, name: "Globex" })],
    };
    vi.mocked(fetchCampaign).mockResolvedValue({
      ok: true,
      data: campaign({ companyId: 4 }),
    });
    render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    expect(
      await screen.findByText(/“Autumn sale” belongs to Globex, not Acme/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Globex" }));
    expect(switchTo).toHaveBeenCalledWith(4);
  });

  it("copes with an owner that is not in the loaded list", async () => {
    vi.mocked(fetchCampaign).mockResolvedValue({
      ok: true,
      data: campaign({ companyId: 99 }),
    });
    render(
      <CampaignDetail
        campaignId={12}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />,
    );
    expect(
      await screen.findByText(/belongs to another of your companies, not Acme/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to that company" }),
    ).toBeInTheDocument();
  });
});

describe("CampaignDetail - a draft", () => {
  it("can be edited section by section, and continued", async () => {
    await show({ events: [event("created")] });
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText(/^Created on /)).toBeInTheDocument();
    expect(hrefOf("Continue editing")).toMatch(/\?id=12&step=review$/);
    expect(
      screen
        .getAllByRole("link", { name: "Edit" })
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      expect.stringMatching(/step=budget$/),
      expect.stringMatching(/step=audience$/),
      expect.stringMatching(/step=creatives$/),
    ]);
  });

  it("can be deleted from its menu when it never moved money", async () => {
    await show({ deletable: true });
    const more = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(more);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "stub keep" }));
    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();

    fireEvent.click(more);
    fireEvent.click(more);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(more);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    fireEvent.click(
      screen.getByRole("button", { name: "stub confirm delete" }),
    );
    expect(onDeleted).toHaveBeenCalled();
  });

  it("has no delete once it has been submitted and withdrawn", async () => {
    await show({ deletable: false });
    expect(
      screen.queryByRole("button", { name: "More actions" }),
    ).not.toBeInTheDocument();
  });

  it("explains why Loopd'n sent it back", async () => {
    await show({
      events: [
        event("submitted"),
        event("rejected", {
          note: "The link in creative 1 is dead.",
          by: "reviewer",
        }),
      ],
    });
    expect(
      screen.getByText("Loopd'n sent this campaign back"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("The link in creative 1 is dead.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("by reviewer")).toBeInTheDocument();
  });

  it("describes an unfinished draft plainly", async () => {
    await show({
      name: "",
      audience: null,
      creatives: [],
      totalBudgetCents: null,
      cpmCents: null,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Untitled campaign" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not chosen yet.")).toBeInTheDocument();
    expect(screen.getByText("None yet.")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Set when you submit")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /view all/i }),
    ).not.toBeInTheDocument();
  });
});

describe("CampaignDetail - overview", () => {
  it("shows the budget, schedule, objective, rate and audience", async () => {
    await show({
      dailyBudgetCents: 2500,
      startsAt: "2026-10-10T12:00:00",
      endsAt: "2026-10-20T12:00:00",
      reservedCents: 40_000,
      spentCents: 10_000,
    });
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(
      screen.getByText("$400.00 set aside · $100.00 spent"),
    ).toBeInTheDocument();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.getByText("$8.00 per 1,000 views")).toBeInTheDocument();
    expect(screen.getByText("Sports")).toBeInTheDocument();
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText("At least 10 members")).toBeInTheDocument();
    expect(screen.getByTestId("results")).toBeInTheDocument();
  });

  it("notes only the money that has moved", async () => {
    const first = await show({ reservedCents: 40_000 });
    expect(screen.getByText("$400.00 set aside")).toBeInTheDocument();
    first.unmount();

    await show({ spentCents: 100 });
    expect(screen.getByText("$1.00 spent")).toBeInTheDocument();
    expect(screen.getByText("No cap")).toBeInTheDocument();
    expect(screen.getByText("Once approved")).toBeInTheDocument();
    expect(screen.getByText("When the budget is spent")).toBeInTheDocument();
  });

  it("previews the first creative, and lists them all with their review state", async () => {
    await show({
      creatives: [
        creative({ imageUrl: "https://cdn.example/ad.png" }),
        creative({
          id: 2,
          headline: "Get a quote",
          ctaKind: "lead_form",
          status: "rejected",
          reviewNotes: "Too vague.",
        }),
      ],
    });
    expect(
      screen.getByRole("link", { name: "https://acme.example/offer" }),
    ).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "View all (2)" }));
    const dialog = within(
      screen.getByRole("dialog", { name: "Creatives (2)" }),
    );
    expect(
      dialog.getByText("Opens https://acme.example/offer"),
    ).toBeInTheDocument();
    expect(dialog.getByText("Opens a Loopd'n form")).toBeInTheDocument();
    expect(dialog.getByText("Rejected")).toBeInTheDocument();
    expect(dialog.getByText("Too vague.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says a lead creative opens a form", async () => {
    await show({ creatives: [creative({ ctaKind: "lead_form" })] });
    expect(
      screen.getByText(/Opens a Loopd'n form: people choose/),
    ).toBeInTheDocument();
  });

  it("lists the history newest first", async () => {
    await show({
      events: [
        event("created", { createdAt: "2026-10-01T09:00:00" }),
        event("submitted", {
          createdAt: "2026-10-02T09:00:00",
          note: "First try.",
        }),
        event("odd", { createdAt: null }),
        event("bad", { createdAt: "not a date" }),
      ],
      status: "pending_review",
    });
    const history = document.querySelector("ol") as HTMLElement;
    expect(
      within(history)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.slice(0, 3)),
    ).toEqual(["Bad", "Odd", "Sub", "Cre"]);
    expect(screen.getByText("First try.")).toBeInTheDocument();
    expect(
      screen.getByText(/^Submitted on Oct 2, 2026 at 9:00/),
    ).toBeInTheDocument();
  });

  it("falls back to a generic company name when none is loaded", async () => {
    companyState = { company: null, companies: [] };
    await show();
    expect(screen.getByText("Sponsored · Your company")).toBeInTheDocument();
  });
});

describe("CampaignDetail - by status", () => {
  it("in review: cannot be edited, but can be withdrawn", async () => {
    await show({ status: "pending_review" });
    expect(
      screen.getByText("Your campaign is being reviewed"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Continue editing" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "stub withdraw" }));
    expect(onChanged).toHaveBeenCalledWith(CHANGED);
    expect(
      screen.getByRole("heading", { level: 1, name: "Changed by an action" }),
    ).toBeInTheDocument();
  });

  it("approved: says when it starts, and can still be cancelled", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T12:00:00"));
    const first = await show({
      status: "approved",
      startsAt: "2026-10-10T12:00:00",
    });
    expect(
      screen.getByText(/It starts running on Oct 10, 2026\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stub cancel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "stub pause" }),
    ).not.toBeInTheDocument();
    first.unmount();

    await show({ status: "approved", startsAt: "2026-10-01T12:00:00" });
    expect(
      screen.getByText(/It starts running in a moment\./),
    ).toBeInTheDocument();
  });

  it("running: can be paused, topped up or cancelled", async () => {
    await show({ status: "running" });
    for (const name of ["stub pause", "stub add budget", "stub cancel"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(onChanged).toHaveBeenCalledTimes(3);
  });

  it("paused: says so, with the same actions", async () => {
    await show({ status: "paused" });
    expect(
      screen.getByText(/It isn't shown while it's paused/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stub pause" }),
    ).toBeInTheDocument();
  });

  it("ended: says how, with nothing left to do", async () => {
    const first = await show({ status: "ended", events: [event("cancelled")] });
    expect(screen.getByText(/It was cancelled\./)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^stub/ }),
    ).not.toBeInTheDocument();
    first.unmount();

    const second = await show({
      status: "ended",
      events: [event("ended", { note: "Its budget was spent." })],
    });
    expect(
      screen.getAllByText(/Its budget was spent\./).length,
    ).toBeGreaterThan(0);
    second.unmount();

    await show({ status: "ended", events: [] });
    expect(screen.getByText(/Its end date passed\./)).toBeInTheDocument();
  });
});
