import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
const retry = vi.fn();
let optionsState: { options: unknown; error: string | null };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/commercial/api", () => ({ fetchCampaign: vi.fn() }));
vi.mock("@/lib/commercial/useCampaignOptions", () => ({
  useCampaignOptions: () => ({ ...optionsState, retry }),
}));

// Each step has tests of its own. Here a step is its name and the three
// things the builder hands it.
type StepStub = {
  campaign: { id: number; name: string } | null;
  onSaved: (campaign: unknown) => void;
  onCreated?: (campaign: unknown) => void;
  goTo: (step: string) => void;
};
function stub(name: string) {
  return function Step({
    campaign: draft,
    onSaved,
    onCreated,
    goTo,
  }: StepStub) {
    return (
      <div
        data-testid="step"
        data-step={name}
        data-campaign={draft?.id ?? "new"}
      >
        {draft?.name}
        <button onClick={() => goTo("budget")}>go to budget</button>
        <button onClick={() => onSaved({ ...SAVED })}>save</button>
        {onCreated && (
          <button onClick={() => onCreated({ ...CREATED })}>create</button>
        )}
      </div>
    );
  };
}
vi.mock("@/components/commercial/builder/ObjectiveStep", () => ({
  ObjectiveStep: stub("objective"),
}));
vi.mock("@/components/commercial/builder/AudienceStep", () => ({
  AudienceStep: stub("audience"),
}));
vi.mock("@/components/commercial/builder/ReachStep", () => ({
  ReachStep: stub("reach"),
}));
vi.mock("@/components/commercial/builder/BudgetStep", () => ({
  BudgetStep: stub("budget"),
}));
vi.mock("@/components/commercial/builder/CreativesStep", () => ({
  CreativesStep: stub("creatives"),
}));
vi.mock("@/components/commercial/builder/ReviewStep", () => ({
  ReviewStep: stub("review"),
}));

import { CampaignBuilder } from "@/components/commercial/builder/CampaignBuilder";
import type { StepKey } from "@/components/commercial/builder/steps";
import { fetchCampaign } from "@/lib/commercial/api";
import type { CampaignDetail } from "@/lib/commercial/types";
import { campaign, company, OPTIONS } from "@/test/commercial";
import { deferred } from "@/test/helpers";

const SAVED = campaign({ name: "Saved name" });
const CREATED = campaign({ id: 44, name: "Brand new" });

function draftIs(value: CampaignDetail) {
  vi.mocked(fetchCampaign).mockResolvedValue({ ok: true, data: value });
}

function mount(campaignId: number | null, step: StepKey = "objective") {
  return render(
    <CampaignBuilder campaignId={campaignId} step={step} company={company()} />,
  );
}

function shownStep() {
  return screen.getByTestId("step").getAttribute("data-step");
}

function stepButtons() {
  return within(
    screen.getByRole("navigation", { name: "Campaign steps" }),
  ).getAllByRole("button");
}

beforeEach(() => {
  vi.clearAllMocks();
  optionsState = { options: OPTIONS, error: null };
  draftIs(campaign());
});

describe("CampaignBuilder", () => {
  it("starts a new campaign on the objective, with the later steps locked", () => {
    mount(null, "budget");
    expect(shownStep()).toBe("objective");
    expect(screen.getByTestId("step")).toHaveAttribute("data-campaign", "new");
    expect(fetchCampaign).not.toHaveBeenCalled();
    for (const button of stepButtons()) expect(button).toBeDisabled();
    expect(stepButtons().map((button) => button.textContent)).toEqual([
      "1Objective",
      "2Audience",
      "3Reach",
      "4Budget",
      "5Creatives",
      "6Review",
    ]);
  });

  it("moves to the audience, in the address, once the draft is created", () => {
    mount(null);
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    expect(replace).toHaveBeenCalledWith("/campaigns/new/?id=44&step=audience");
  });

  it("shows a placeholder until the draft and the options are both in", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCampaign>>>();
    vi.mocked(fetchCampaign).mockReturnValue(pending.promise);
    mount(12, "audience");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the campaign builder",
    );

    await act(async () => pending.resolve({ ok: true, data: campaign() }));
    expect(shownStep()).toBe("audience");
    expect(fetchCampaign).toHaveBeenCalledWith(12);
  });

  it("waits for the options even for a new campaign", () => {
    optionsState = { options: null, error: null };
    mount(null);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the campaign builder",
    );
  });

  it.each([
    "objective",
    "audience",
    "reach",
    "budget",
    "creatives",
    "review",
  ] as const)("shows the %s step for a loaded draft", async (step) => {
    mount(12, step);
    await waitFor(() => expect(shownStep()).toBe(step));
    expect(screen.getByTestId("step")).toHaveAttribute("data-campaign", "12");
    const current = stepButtons().find(
      (button) => button.getAttribute("aria-current") === "step",
    );
    expect(current).toBeDisabled();
  });

  it("ticks off the steps that are filled in", async () => {
    mount(12, "review");
    await screen.findByTestId("step");
    // Name, audience (and so reach), budget and one creative are all in.
    expect(screen.getAllByLabelText("done")).toHaveLength(5);
  });

  it("leaves unfinished steps numbered", async () => {
    draftIs(
      campaign({
        name: " ",
        audience: null,
        totalBudgetCents: null,
        creatives: [],
      }),
    );
    mount(12, "review");
    await screen.findByTestId("step");
    expect(screen.queryByLabelText("done")).not.toBeInTheDocument();
  });

  it("moves between steps through the address, from the stepper or a step", async () => {
    mount(12, "audience");
    await screen.findByTestId("step");

    fireEvent.click(stepButtons()[4]);
    expect(push).toHaveBeenCalledWith("/campaigns/new/?id=12&step=creatives");

    fireEvent.click(screen.getByRole("button", { name: "go to budget" }));
    expect(push).toHaveBeenCalledWith("/campaigns/new/?id=12&step=budget");
  });

  it("keeps what a step saved without loading the draft again", async () => {
    mount(12, "audience");
    await screen.findByTestId("step");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByTestId("step")).toHaveTextContent("Saved name");
    expect(fetchCampaign).toHaveBeenCalledTimes(1);
  });

  it("will not edit another company's draft", async () => {
    draftIs(campaign({ companyId: 99 }));
    mount(12, "audience");
    expect(
      await screen.findByText(
        /This draft belongs to another of your companies\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("link", { name: "See Acme's campaigns" })
        .getAttribute("href"),
    ).toMatch(/^\/campaigns\/?$/);
    expect(screen.queryByTestId("step")).not.toBeInTheDocument();
  });

  it("will not edit a campaign that is no longer a draft", async () => {
    draftIs(campaign({ status: "pending_review" }));
    const first = mount(12, "audience");
    expect(
      await screen.findByText(/waiting for review, so it can't be changed/),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("link", { name: "Open the campaign" })
        .getAttribute("href"),
    ).toMatch(/^\/campaigns\/?\?id=12$/);
    first.unmount();

    draftIs(campaign({ status: "running" }));
    mount(12, "audience");
    expect(
      await screen.findByText(/has been submitted and can't be changed here/),
    ).toBeInTheDocument();
  });

  it("offers a retry when the draft cannot be loaded", async () => {
    vi.mocked(fetchCampaign).mockResolvedValue({
      ok: false,
      message: "Couldn't load this campaign.",
    });
    mount(12, "audience");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load this campaign");
    expect(alert).toHaveTextContent("Couldn't load this campaign.");

    draftIs(campaign());
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
    await waitFor(() => expect(shownStep()).toBe("audience"));
    expect(fetchCampaign).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the options cannot be loaded", () => {
    optionsState = { options: null, error: "No categories." };
    mount(null);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the campaign builder");
    expect(alert).toHaveTextContent("No categories.");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });

  it("loads the other draft when the address changes to it", async () => {
    const view = mount(12, "audience");
    await screen.findByTestId("step");

    draftIs(campaign({ id: 20, name: "Another draft" }));
    view.rerender(
      <CampaignBuilder campaignId={20} step="audience" company={company()} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("Another draft")).toBeInTheDocument();
    expect(fetchCampaign).toHaveBeenLastCalledWith(20);
  });

  it("ignores a draft that arrives after the builder has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchCampaign>>>();
    vi.mocked(fetchCampaign).mockReturnValue(pending.promise);
    const { unmount } = mount(12, "audience");
    unmount();
    pending.resolve({ ok: true, data: campaign() });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
