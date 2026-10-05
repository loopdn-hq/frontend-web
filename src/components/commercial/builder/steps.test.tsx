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
const router = { push };
const toast = vi.fn();
const reload = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/commercial/CompanyProvider", () => ({
  useCompany: () => ({ reload }),
}));
vi.mock("@/components/ui", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/ui")>("@/components/ui");
  return { ...actual, useToast: () => toast };
});
vi.mock("@/components/commercial/AddFundsDialog", () => ({
  AddFundsDialog: ({
    isOpen,
    suggestedCents,
    returnPath,
    onClose,
  }: {
    isOpen: boolean;
    suggestedCents?: number;
    returnPath: string;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div
        data-testid="add-funds"
        data-suggested={suggestedCents ?? ""}
        data-return={returnPath}
      >
        <button onClick={onClose}>Close add funds</button>
      </div>
    ) : null,
}));
vi.mock("@/lib/commercial/api", () => ({
  addCreative: vi.fn(),
  createCampaign: vi.fn(),
  deleteCreative: vi.fn(),
  estimateReach: vi.fn(),
  fetchPricing: vi.fn(),
  saveAudience: vi.fn(),
  submitCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  updateCreative: vi.fn(),
}));

import { AudienceStep } from "@/components/commercial/builder/AudienceStep";
import { BudgetStep } from "@/components/commercial/builder/BudgetStep";
import { CreativesStep } from "@/components/commercial/builder/CreativesStep";
import { ObjectiveStep } from "@/components/commercial/builder/ObjectiveStep";
import { ReachStep } from "@/components/commercial/builder/ReachStep";
import { ReviewStep } from "@/components/commercial/builder/ReviewStep";
import type { StepProps } from "@/components/commercial/builder/steps";
import {
  addCreative,
  createCampaign,
  deleteCreative,
  estimateReach,
  fetchPricing,
  saveAudience,
  submitCampaign,
  updateCampaign,
  updateCreative,
} from "@/lib/commercial/api";
import type { CampaignDetail } from "@/lib/commercial/types";
import { campaign, company, creative, OPTIONS } from "@/test/commercial";
import { deferred } from "@/test/helpers";

type Saved = { ok: true; data: CampaignDetail };
type Refused = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string>;
};

const goTo = vi.fn();
const onSaved = vi.fn();

function props(
  overrides: Partial<CampaignDetail> = {},
  extra: Partial<StepProps> = {},
): StepProps {
  return {
    campaign: campaign(overrides),
    company: company(),
    options: OPTIONS,
    onSaved,
    goTo,
    ...extra,
  };
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  vi.mocked(fetchPricing).mockResolvedValue({
    ok: true,
    data: { currency: "USD", cpmCents: 800 },
  });
  URL.createObjectURL = vi.fn(() => "blob:image");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ObjectiveStep", () => {
  const onCreated = vi.fn();

  function mount(existing: CampaignDetail | null = null) {
    return render(
      <ObjectiveStep
        campaign={existing}
        company={company()}
        onCreated={onCreated}
        onSaved={onSaved}
        goTo={goTo}
      />,
    );
  }

  it("offers the objectives on sale, starting from website visits", () => {
    mount();
    expect(
      screen.getByRole("heading", { name: "What is this campaign for?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("radio")
        .map((radio) => (radio as HTMLInputElement).value),
    ).toEqual(["website", "lead", "group_join"]);
    expect(
      screen.getByRole("radio", { name: /website visits/i }),
    ).toBeChecked();
  });

  it("creates a draft from the name and objective", async () => {
    const created = campaign({ id: 44, name: "Lunch deal", objective: "lead" });
    const pending = deferred<Saved>();
    vi.mocked(createCampaign).mockReturnValue(pending.promise);
    mount();
    type("Campaign name", "  Lunch deal ");
    fireEvent.click(screen.getByRole("radio", { name: /leads/i }));
    click("Continue");

    expect(createCampaign).toHaveBeenCalledWith({
      companyId: 3,
      objective: "lead",
      name: "Lunch deal",
    });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    click("Continue");
    expect(createCampaign).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ ok: true, data: created }));
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(goTo).not.toHaveBeenCalled();
  });

  it("moves straight on when nothing was changed", () => {
    mount(campaign());
    click("Save and continue");
    expect(updateCampaign).not.toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith("audience");
  });

  it("saves a change to an existing draft, then moves on", async () => {
    const saved = campaign({ name: "Winter sale" });
    vi.mocked(updateCampaign).mockResolvedValue({ ok: true, data: saved });
    mount(campaign());
    type("Campaign name", "Winter sale");
    click("Save and continue");

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(updateCampaign).toHaveBeenCalledWith(12, {
      name: "Winter sale",
      objective: "website",
    });
    expect(goTo).toHaveBeenCalledWith("audience");
  });

  it("warns when a new objective changes what the creatives' buttons do", () => {
    mount(campaign({ objective: "website" }));
    expect(
      screen.queryByText(/creatives' buttons will need/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /group joins/i }));
    expect(screen.getByText(/will need your group's link/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /leads/i }));
    expect(screen.getByText(/button opens a web address/)).toBeInTheDocument();
  });

  it("does not warn for a draft with no creatives, or an objective with the same button", () => {
    const first = mount(campaign({ creatives: [] }));
    fireEvent.click(screen.getByRole("radio", { name: /group joins/i }));
    expect(
      screen.queryByText(/creatives' buttons will need/),
    ).not.toBeInTheDocument();
    first.unmount();

    // A call or text campaign is not offered here, but may already exist.
    mount(campaign({ objective: "call" }));
    fireEvent.click(screen.getByRole("radio", { name: /website visits/i }));
    expect(screen.getByText(/button opens a web address/)).toBeInTheDocument();
  });

  it("puts the server's errors beside their fields, or above the form", async () => {
    vi.mocked(createCampaign)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: { name: "Too long.", objective: "Not available." },
      } as Refused)
      .mockResolvedValueOnce({
        ok: false,
        message: "This company is suspended.",
      });
    mount();
    click("Continue");
    expect(await screen.findByText("Too long.")).toBeInTheDocument();
    expect(screen.getByText("Not available.")).toBeInTheDocument();

    click("Continue");
    expect(
      await screen.findByText("This company is suspended."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Too long.")).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("AudienceStep", () => {
  it("starts from the saved audience and says how wide it is", () => {
    render(<AudienceStep {...props()} />);
    expect(screen.getByRole("checkbox", { name: "Sports" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Arts" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "California" })).toBeChecked();
    expect(screen.getAllByText("1 chosen.")).toHaveLength(2);
    expect(screen.getByLabelText("At least")).toHaveValue("10");
    expect(screen.getByLabelText("At most")).toHaveValue("");
  });

  it("describes none and all as the same thing: no narrowing", () => {
    render(<AudienceStep {...props({ audience: null })} />);
    expect(
      screen.getByText("None chosen: any kind of group."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("None chosen: anywhere in United States."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Sports" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Arts" }));
    expect(
      screen.getByText("All chosen: the same as any kind of group."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "California" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "New York" }));
    expect(
      screen.getByText(/All chosen: the same as anywhere in United States\./),
    ).toBeInTheDocument();

    click("Clear");
    expect(
      screen.getByText("None chosen: anywhere in United States."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Arts" }));
    expect(screen.getByRole("checkbox", { name: "Arts" })).not.toBeChecked();
  });

  it("saves the audience and moves on to reach", async () => {
    const saved = campaign();
    const pending = deferred<Saved>();
    vi.mocked(saveAudience).mockReturnValue(pending.promise);
    render(<AudienceStep {...props()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Arts" }));
    type("At most", " 200 ");
    click("Save and continue");

    expect(saveAudience).toHaveBeenCalledWith(12, {
      categories: ["sports", "arts"],
      regions: ["US-CA"],
      minGroupSize: 10,
      maxGroupSize: 200,
    });
    click("Save and continue");
    expect(saveAudience).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ ok: true, data: saved }));
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(goTo).toHaveBeenCalledWith("reach");
  });

  it("refuses sizes that are not whole numbers, or are the wrong way round", () => {
    render(<AudienceStep {...props()} />);
    type("At least", "ten");
    type("At most", "0");
    click("Save and continue");
    expect(screen.getAllByText("Enter a whole number.")).toHaveLength(2);

    type("At least", "50");
    type("At most", "20");
    click("Save and continue");
    expect(
      screen.getByText("The largest size can't be below the smallest."),
    ).toBeInTheDocument();
    expect(saveAudience).not.toHaveBeenCalled();
  });

  it("puts the server's errors beside their fields, or above the form", async () => {
    vi.mocked(saveAudience)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: {
          categories: "Unknown category.",
          regions: "Unknown region.",
          min_group_size: "Too small.",
          max_group_size: "Too big.",
        },
      } as Refused)
      .mockResolvedValueOnce({
        ok: false,
        message: "This draft was submitted.",
      });
    render(<AudienceStep {...props()} />);
    click("Save and continue");
    for (const message of [
      "Unknown category.",
      "Unknown region.",
      "Too small.",
      "Too big.",
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
    click("Save and continue");
    expect(
      await screen.findByText("This draft was submitted."),
    ).toBeInTheDocument();
    expect(goTo).not.toHaveBeenCalled();
  });

  it("offers a filter once a country has many regions", () => {
    const regions = Array.from({ length: 25 }, (_, index) => ({
      code: `US-${index}`,
      name: index === 7 ? "Texas" : `Region ${index}`,
    }));
    const options = {
      ...OPTIONS,
      markets: {
        ...OPTIONS.markets,
        countries: [{ ...OPTIONS.markets.countries[0], regions }],
      },
    };
    render(<AudienceStep {...props({ audience: null }, { options })} />);
    const filter = screen.getByLabelText("Find a region");
    fireEvent.change(filter, { target: { value: " tex " } });
    expect(screen.getByRole("checkbox", { name: "Texas" })).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Region 1" }),
    ).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: "zzz" } });
    expect(screen.getByText("No region matches “zzz”.")).toBeInTheDocument();
  });

  it("goes back to the objective", () => {
    render(<AudienceStep {...props()} />);
    click("Back");
    expect(goTo).toHaveBeenCalledWith("objective");
  });
});

describe("ReachStep", () => {
  it("shows ranges, never exact numbers", async () => {
    vi.mocked(estimateReach).mockResolvedValue({
      ok: true,
      data: {
        available: true,
        groups: { low: 20, high: 40 },
        members: { low: 5000, high: null },
      },
    });
    render(<ReachStep {...props()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Estimating reach");
    expect(await screen.findByText("20–40")).toBeInTheDocument();
    expect(screen.getByText("5,000+")).toBeInTheDocument();
    expect(estimateReach).toHaveBeenCalledWith(3, campaign().audience);

    click("Continue");
    expect(goTo).toHaveBeenCalledWith("budget");
    click("Back");
    expect(goTo).toHaveBeenCalledWith("audience");
  });

  it("asks for a wider audience when it is too small to run", async () => {
    vi.mocked(estimateReach).mockResolvedValue({
      ok: true,
      data: { available: false, reason: "Audience is too small." },
    });
    render(<ReachStep {...props()} />);
    expect(
      await screen.findByText(/Audience is too small\./),
    ).toBeInTheDocument();
    click("Widen the audience");
    expect(goTo).toHaveBeenCalledWith("audience");
  });

  it("asks for an audience first when none is chosen", () => {
    render(<ReachStep {...props({ audience: null })} />);
    expect(screen.getByText(/Choose an audience first\./)).toBeInTheDocument();
    expect(estimateReach).not.toHaveBeenCalled();
    click("Choose audience");
    expect(goTo).toHaveBeenCalledWith("audience");
  });

  it("offers a retry when the estimate fails", async () => {
    vi.mocked(estimateReach).mockResolvedValue({
      ok: false,
      message: "Couldn't estimate the reach.",
    });
    render(<ReachStep {...props()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't estimate the reach.",
    );

    vi.mocked(estimateReach).mockResolvedValue({
      ok: true,
      data: {
        available: true,
        groups: { low: 1, high: 2 },
        members: { low: 3, high: 4 },
      },
    });
    click(/try again/i);
    expect(await screen.findByText("1–2")).toBeInTheDocument();
    expect(estimateReach).toHaveBeenCalledTimes(2);
  });

  it("ignores an estimate that arrives after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof estimateReach>>>();
    vi.mocked(estimateReach).mockReturnValue(pending.promise);
    const { unmount } = render(<ReachStep {...props()} />);
    unmount();
    pending.resolve({ ok: true, data: { available: false, reason: "x" } });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("BudgetStep", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 5, 12));
  });

  it("starts from the saved budget and estimates the views it buys", async () => {
    render(<BudgetStep {...props()} />);
    expect(screen.getByLabelText("Total budget")).toHaveValue("500");
    expect(
      await screen.findByText("About 62,500 views at $8.00 per 1,000."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Amounts are in USD, your company's currency."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Daily cap")).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "As soon as it's approved" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "When the budget is spent" }),
    ).toBeChecked();
  });

  it("falls back to a plain hint without a price or an amount", async () => {
    vi.mocked(fetchPricing).mockResolvedValue({ ok: false, message: "x" });
    render(<BudgetStep {...props({ totalBudgetCents: null })} />);
    await waitFor(() => expect(fetchPricing).toHaveBeenCalledWith(3));
    expect(
      screen.getByText("The most this campaign will spend."),
    ).toBeInTheDocument();
  });

  it("needs an end date or a daily cap to spread a budget evenly", () => {
    render(<BudgetStep {...props()} />);
    click("Save and continue");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Spread evenly needs an end date or a daily cap.",
    );
    expect(updateCampaign).not.toHaveBeenCalled();
  });

  it("saves a fast campaign with no cap and no dates", async () => {
    const saved = campaign({ pacing: "accelerated" });
    const pending = deferred<Saved>();
    vi.mocked(updateCampaign).mockReturnValue(pending.promise);
    render(<BudgetStep {...props()} />);
    type("Total budget", "1,500.50");
    fireEvent.click(
      screen.getByRole("radio", { name: /as fast as possible/i }),
    );
    click("Save and continue");

    expect(updateCampaign).toHaveBeenCalledWith(12, {
      totalBudgetCents: 150050,
      dailyBudgetCents: null,
      startsAt: null,
      endsAt: null,
      pacing: "accelerated",
    });
    click("Save and continue");
    expect(updateCampaign).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ ok: true, data: saved }));
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(goTo).toHaveBeenCalledWith("creatives");
  });

  it("saves a capped campaign that runs between two dates", async () => {
    vi.mocked(updateCampaign).mockResolvedValue({ ok: true, data: campaign() });
    render(<BudgetStep {...props()} />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Limit daily spending" }),
    );
    type("Daily cap", "50");
    fireEvent.click(screen.getAllByRole("radio", { name: "On a date" })[0]);
    type("Start date", "2026-10-10");
    fireEvent.click(screen.getAllByRole("radio", { name: "On a date" })[1]);
    // The end cannot be picked before the start.
    expect(screen.getByLabelText("End date")).toHaveAttribute(
      "min",
      "2026-10-10",
    );
    type("End date", "2026-10-20");
    click("Save and continue");

    await waitFor(() => expect(updateCampaign).toHaveBeenCalled());
    const [, changes] = vi.mocked(updateCampaign).mock.calls[0];
    expect(changes).toMatchObject({
      totalBudgetCents: 50000,
      dailyBudgetCents: 5000,
      pacing: "standard",
    });
    expect(new Date(changes.startsAt!).getDate()).toBe(10);
    expect(new Date(changes.endsAt!).getHours()).toBe(23);
  });

  it("names each thing wrong with the amounts and dates", () => {
    render(<BudgetStep {...props()} />);
    type("Total budget", "lots");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Limit daily spending" }),
    );
    fireEvent.click(screen.getAllByRole("radio", { name: "On a date" })[0]);
    fireEvent.click(screen.getAllByRole("radio", { name: "On a date" })[1]);
    click("Save and continue");
    expect(
      screen.getByText("Enter an amount, like 1500 or 1500.50."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter the most to spend in one day."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose a start date.")).toBeInTheDocument();
    expect(screen.getByText("Choose an end date.")).toBeInTheDocument();

    type("Total budget", "100");
    type("Daily cap", "250");
    type("Start date", "2026-10-05");
    type("End date", "2026-10-04");
    click("Save and continue");
    expect(
      screen.getByText("The daily cap can't be more than the total budget."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose a day from tomorrow on."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The campaign must end after it starts."),
    ).toBeInTheDocument();

    type("Total budget", "0");
    type("Daily cap", "0");
    click("Save and continue");
    expect(
      screen.getByText("Enter an amount, like 1500 or 1500.50."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter the most to spend in one day."),
    ).toBeInTheDocument();
    expect(updateCampaign).not.toHaveBeenCalled();
  });

  it("starts from a saved cap and dates", () => {
    render(
      <BudgetStep
        {...props({
          dailyBudgetCents: 2550,
          startsAt: new Date(2026, 9, 10).toISOString(),
          endsAt: new Date(2026, 9, 20).toISOString(),
        })}
      />,
    );
    expect(screen.getByLabelText("Daily cap")).toHaveValue("25.50");
    expect(screen.getByLabelText("Start date")).toHaveValue("2026-10-10");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-10-20");
  });

  it("puts the server's errors beside their fields, or above the form", async () => {
    vi.mocked(updateCampaign)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: {
          total_budget_cents: "Below the minimum budget.",
          daily_budget_cents: "Below the minimum cap.",
          starts_at: "Too soon.",
          ends_at: "Too far out.",
          pacing: "Not allowed for this objective.",
          other: "ignored",
        },
      } as Refused)
      .mockResolvedValueOnce({
        ok: false,
        message: "This draft was submitted.",
      });
    render(
      <BudgetStep
        {...props({
          dailyBudgetCents: 2500,
          startsAt: new Date(2026, 9, 10).toISOString(),
          endsAt: new Date(2026, 9, 20).toISOString(),
        })}
      />,
    );
    click("Save and continue");
    for (const message of [
      "Below the minimum budget.",
      "Below the minimum cap.",
      "Too soon.",
      "Too far out.",
      "Not allowed for this objective.",
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
    click("Save and continue");
    expect(
      await screen.findByText("This draft was submitted."),
    ).toBeInTheDocument();
    click("Back");
    expect(goTo).toHaveBeenCalledWith("reach");
  });
});

describe("CreativesStep", () => {
  function editor() {
    return within(screen.getByRole("dialog"));
  }

  it("says a campaign needs one, and offers to add it", () => {
    render(<CreativesStep {...props({ creatives: [] })} />);
    expect(screen.getByText(/No creatives yet\./)).toBeInTheDocument();
    click("Continue");
    expect(goTo).toHaveBeenCalledWith("review");
    click("Back");
    expect(goTo).toHaveBeenCalledWith("budget");
  });

  it("previews each creative and where its button goes", () => {
    render(
      <CreativesStep
        {...props({
          creatives: [
            creative(),
            creative({ id: 2, headline: "Quote", ctaKind: "lead_form" }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText("Opens https://acme.example/offer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Opens a Loopd'n form")).toBeInTheDocument();
    expect(screen.getAllByText("Sponsored · Acme")).toHaveLength(2);
  });

  it("adds a creative, adding https to a bare address", async () => {
    const added = creative({ id: 2, headline: "New ad" });
    const pending = deferred<Awaited<ReturnType<typeof addCreative>>>();
    vi.mocked(addCreative).mockReturnValue(pending.promise);
    render(<CreativesStep {...props({ creatives: [] })} />);
    click("Add a creative");
    expect(
      screen.getByRole("dialog", { name: "Add a creative" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Button label")).toHaveValue("Learn more");

    type("Headline", " New ad ");
    type("Text", " Come and see. ");
    type("Where it goes", "acme.example/new");
    // The counter is of what is typed, spaces and all; the save trims it.
    expect(editor().getByText("8/80")).toBeInTheDocument();
    click("Add creative");

    expect(addCreative).toHaveBeenCalledWith(12, {
      headline: "New ad",
      body: "Come and see.",
      ctaLabel: "Learn more",
      ctaTarget: "https://acme.example/new",
    });
    click("Add creative");
    expect(addCreative).toHaveBeenCalledTimes(1);
    click("Close modal");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => pending.resolve({ ok: true, data: added }));
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ creatives: [added] }),
    );
    expect(toast).toHaveBeenCalledWith({ title: "Creative added" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names what a creative is missing", () => {
    render(<CreativesStep {...props({ creatives: [] })} />);
    click("Add a creative");
    type("Button label", " ");
    click("Add creative");
    expect(screen.getByText("Write a headline.")).toBeInTheDocument();
    expect(screen.getByText("Write what the ad says.")).toBeInTheDocument();
    expect(screen.getByText("Label the button.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter where the button goes."),
    ).toBeInTheDocument();
    expect(addCreative).not.toHaveBeenCalled();

    click("Cancel");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks a group-join campaign for the group's link", () => {
    render(
      <CreativesStep {...props({ objective: "group_join", creatives: [] })} />,
    );
    click("Add a creative");
    expect(screen.getByLabelText("Button label")).toHaveValue("Join the group");
    expect(
      screen.getByLabelText("Your group's Loopd'n link"),
    ).toBeInTheDocument();
    click("Add creative");
    expect(
      screen.getByText("Paste your group's Loopd'n link."),
    ).toBeInTheDocument();
  });

  it("gives a lead campaign a form instead of an address", async () => {
    vi.mocked(addCreative)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: { cta_kind: "Leads are not on for this company." },
      } as Refused)
      .mockResolvedValueOnce({
        ok: true,
        data: creative({ id: 3, ctaKind: "lead_form" }),
      });
    render(<CreativesStep {...props({ objective: "lead", creatives: [] })} />);
    click("Add a creative");
    expect(screen.getByLabelText("Button label")).toHaveValue("Get a quote");
    expect(screen.queryByLabelText("Where it goes")).not.toBeInTheDocument();
    expect(
      editor().getAllByText("Opens a Loopd'n form").length,
    ).toBeGreaterThan(0);

    type("Headline", "Quote");
    type("Text", "Ask us.");
    click("Add creative");
    expect(
      await screen.findByText("Leads are not on for this company."),
    ).toBeInTheDocument();

    click("Add creative");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(vi.mocked(addCreative).mock.calls[0][1].ctaTarget).toBe("");
  });

  it("edits a creative in place", async () => {
    const edited = creative({ headline: "Half off, today" });
    vi.mocked(updateCreative).mockResolvedValue({ ok: true, data: edited });
    render(
      <CreativesStep
        {...props({
          creatives: [creative(), creative({ id: 2, headline: "Other" })],
        })}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(
      screen.getByRole("dialog", { name: "Edit creative" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Headline")).toHaveValue("Half off");

    type("Headline", "Half off, today");
    click("Save creative");
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          creatives: [edited, expect.objectContaining({ id: 2 })],
        }),
      ),
    );
    expect(updateCreative).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ headline: "Half off, today" }),
    );
    expect(toast).toHaveBeenCalledWith({ title: "Creative saved" });
  });

  it("uploads, replaces and removes a creative's image", async () => {
    vi.mocked(updateCreative).mockResolvedValue({ ok: true, data: creative() });
    render(
      <CreativesStep
        {...props({
          creatives: [creative({ imageUrl: "https://cdn.example/old.png" })],
        })}
      />,
    );
    click("Edit");
    const input = screen
      .getByRole("dialog")
      .querySelector('input[type="file"]') as HTMLInputElement;
    expect(editor().getByText("Change image")).toBeInTheDocument();

    const big = new File(["x"], "big.png");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText("Keep the image under 5MB.")).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [] } });

    const image = new File(["png"], "new.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [image] } });
    expect(
      screen.queryByText("Keep the image under 5MB."),
    ).not.toBeInTheDocument();
    click("Save creative");
    await waitFor(() =>
      expect(updateCreative).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ image }),
      ),
    );

    click("Edit");
    click("Remove image");
    expect(editor().getByText("Upload image")).toBeInTheDocument();
    click("Save creative");
    await waitFor(() =>
      expect(updateCreative).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ image: null }),
      ),
    );
  });

  it("puts a refused creative's errors beside their fields, or above the form", async () => {
    vi.mocked(updateCreative)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: {
          headline: "No capitals, please.",
          body: "Too salesy.",
          cta_label: "Too long.",
          cta_target: "That address is blocked.",
          image: "Too small.",
          other: "ignored",
        },
      } as Refused)
      .mockResolvedValueOnce({
        ok: false,
        message: "This draft was submitted.",
      });
    render(<CreativesStep {...props()} />);
    click("Edit");
    click("Save creative");
    for (const message of [
      "No capitals, please.",
      "Too salesy.",
      "Too long.",
      "That address is blocked.",
      "Too small.",
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
    click("Save creative");
    expect(
      await screen.findByText("This draft was submitted."),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("removes a creative, and says why when it cannot", async () => {
    const pending = deferred<Awaited<ReturnType<typeof deleteCreative>>>();
    vi.mocked(deleteCreative).mockReturnValue(pending.promise);
    render(<CreativesStep {...props()} />);
    click("Remove “Half off”");
    expect(
      screen.getByRole("button", { name: "Remove “Half off”" }),
    ).toBeDisabled();
    await act(async () =>
      pending.resolve({ ok: false, message: "It is in review." }),
    );
    expect(screen.getByText("It is in review.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();

    vi.mocked(deleteCreative).mockResolvedValue({ ok: true, data: null });
    click("Remove “Half off”");
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ creatives: [] }),
      ),
    );
    expect(deleteCreative).toHaveBeenCalledWith(1);
    expect(screen.queryByText("It is in review.")).not.toBeInTheDocument();
  });

  it("stops offering more at five", () => {
    render(
      <CreativesStep
        {...props({
          creatives: [1, 2, 3, 4, 5].map((id) =>
            creative({ id, headline: `Ad ${id}` }),
          ),
        })}
      />,
    );
    expect(
      screen.getByText(/That's the most a campaign can have\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add a creative" }),
    ).not.toBeInTheDocument();
  });
});

describe("ReviewStep", () => {
  it("lays the whole campaign out, each part with a way back to it", async () => {
    render(<ReviewStep {...props()} />);
    expect(screen.getByText("Autumn sale")).toBeInTheDocument();
    expect(screen.getByText("Website visits")).toBeInTheDocument();
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText("No cap")).toBeInTheDocument();
    expect(screen.getByText("As soon as it's approved")).toBeInTheDocument();
    expect(screen.getByText("When the budget is spent")).toBeInTheDocument();
    expect(screen.getByText("Spread evenly")).toBeInTheDocument();
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
    expect(
      await screen.findByText("$8.00 per 1,000 views · about 62,500 views"),
    ).toBeInTheDocument();
    expect(screen.getByText("Half off")).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();

    const edits = screen.getAllByRole("button", { name: "Edit" });
    edits.forEach((button) => fireEvent.click(button));
    expect(goTo.mock.calls.map((call) => call[0])).toEqual([
      "objective",
      "audience",
      "budget",
      "creatives",
    ]);
    click("Back");
    expect(goTo).toHaveBeenLastCalledWith("creatives");
  });

  it("shows a schedule, a cap, and a price with no budget to divide", async () => {
    render(
      <ReviewStep
        {...props({
          totalBudgetCents: null,
          dailyBudgetCents: 2500,
          startsAt: new Date(2026, 9, 10).toISOString(),
          endsAt: new Date(2026, 9, 20).toISOString(),
          creatives: [],
          name: "",
        })}
      />,
    );
    expect(screen.getByText("Untitled campaign")).toBeInTheDocument();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.getByText("None yet.")).toBeInTheDocument();
    expect(
      await screen.findByText("$8.00 per 1,000 views"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You need/)).not.toBeInTheDocument();
  });

  it("says how much more is needed, and opens Add funds with that amount", () => {
    render(
      <ReviewStep
        {...props({}, { company: company({ balanceCents: 12_000 }) })}
      />,
    );
    expect(screen.getByText(/You need \$380\.00 more/)).toBeInTheDocument();
    click("Add funds");
    const dialog = screen.getByTestId("add-funds");
    expect(dialog).toHaveAttribute("data-suggested", "38000");
    expect(dialog).toHaveAttribute(
      "data-return",
      "/campaigns/new/?id=12&step=review",
    );
    click("Close add funds");
    expect(screen.queryByTestId("add-funds")).not.toBeInTheDocument();
  });

  it("submits for review and opens the campaign", async () => {
    const pending = deferred<Saved>();
    vi.mocked(submitCampaign).mockReturnValue(pending.promise);
    render(
      <ReviewStep
        {...props({}, { company: company({ balanceCents: 90_000 }) })}
      />,
    );
    expect(screen.queryByText(/You need/)).not.toBeInTheDocument();
    click("Submit for review");
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    click("Submit for review");
    expect(submitCampaign).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ ok: true, data: campaign() }));
    expect(toast).toHaveBeenCalledWith({
      title: "Submitted for review",
      description: "$500.00 is set aside from your balance.",
    });
    expect(push).toHaveBeenCalledWith("/campaigns/?id=12");
  });

  it("lists what stands in the way, each with a link to its step", async () => {
    vi.mocked(submitCampaign).mockResolvedValue({
      ok: false,
      message: "Refused.",
      fieldErrors: {
        name: "Give the campaign a name.",
        creatives: "Add at least one creative.",
        funds: "Your balance is $120.00.",
        mystery: "Something else.",
      },
    } as Refused);
    render(
      <ReviewStep
        {...props({}, { company: company({ balanceCents: 90_000 }) })}
      />,
    );
    click("Submit for review");

    expect(
      await screen.findByText("Before it can be submitted:"),
    ).toBeInTheDocument();
    click("Go to objective");
    expect(goTo).toHaveBeenCalledWith("objective");
    click("Go to creatives");
    expect(goTo).toHaveBeenCalledWith("creatives");
    expect(screen.getByText("Something else.")).toBeInTheDocument();

    click("Add funds");
    expect(screen.getByTestId("add-funds")).toHaveAttribute(
      "data-suggested",
      "",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a refusal with no fields as one message, replacing the list", async () => {
    vi.mocked(submitCampaign)
      .mockResolvedValueOnce({
        ok: false,
        message: "Refused.",
        fieldErrors: { name: "Give the campaign a name." },
      } as Refused)
      .mockResolvedValueOnce({
        ok: false,
        message: "This company is suspended.",
      });
    render(<ReviewStep {...props({ totalBudgetCents: null })} />);
    click("Submit for review");
    await screen.findByText("Before it can be submitted:");

    click("Submit for review");
    expect(
      await screen.findByText("This company is suspended."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Before it can be submitted:"),
    ).not.toBeInTheDocument();
  });

  it("keeps checking the balance after returning from a payment", () => {
    vi.useFakeTimers();
    search = "checkout=success";
    const { unmount } = render(<ReviewStep {...props()} />);
    expect(screen.getByText(/Payment received\./)).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(reload).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(reload).toHaveBeenCalledTimes(3);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a price that arrives after it has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchPricing>>>();
    vi.mocked(fetchPricing).mockReturnValue(pending.promise);
    const { unmount } = render(<ReviewStep {...props()} />);
    unmount();
    pending.resolve({ ok: true, data: { currency: "USD", cpmCents: 800 } });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
