import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing", () => ({ fetchBillingAnalytics: vi.fn() }));
vi.mock("@/components/app/NavDrawerButton", () => ({
  NavDrawerButton: () => null,
}));

import AnalyticsPage from "@/app/(app)/analytics/page";
import { fetchBillingAnalytics, type BillingAnalytics } from "@/lib/billing";
import { deferred } from "@/test/helpers";

type Answer = Awaited<ReturnType<typeof fetchBillingAnalytics>>;

const PLAN = {
  code: "pro",
  name: "Pro",
  monthlyPriceCents: 2900,
  isCustomPricing: false,
  features: [],
};
const WALLET = {
  balanceCents: 12_345,
  usageLast30Days: {
    purchasedCents: 5000,
    usedCents: 1250,
    netChangeCents: 3750,
    purchaseTransactions: 1,
    usageTransactions: 4,
  },
};

function analytics(overrides: Partial<BillingAnalytics> = {}): BillingAnalytics {
  return {
    access: {
      hasBasicAnalytics: true,
      hasAdvancedAnalytics: true,
      currentPlanCode: "pro",
      matchedFeature: "advanced",
    },
    basic: {
      windowDays: 30,
      planInfo: PLAN,
      wallet: WALLET,
      conversationCounts: { total: 9, group: 6, direct: 3 },
      messageActivity: { sentLast30Days: 40, receivedLast30Days: 71 },
    },
    advanced: {
      planInfo: PLAN,
      wallet: WALLET,
      groupAdminStats: { adminGroups: 2, memberGroups: 6, broadcastGroups: 1 },
      groupSize: { averageActiveMembers: 4.25, largestGroupActiveMembers: 18 },
    },
    suggestions: [],
    ...overrides,
  };
}

function answerIs(data: BillingAnalytics) {
  vi.mocked(fetchBillingAnalytics).mockResolvedValue({ ok: true, data });
}

/** A card is its title above its value; a value can read the same as a title. */
function card(title: string) {
  const label = screen
    .getAllByText(title)
    .find((element) => element.nextElementSibling !== null);
  return label?.parentElement as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnalyticsPage", () => {
  it("shows a skeleton until the numbers arrive", async () => {
    const pending = deferred<Answer>();
    vi.mocked(fetchBillingAnalytics).mockReturnValue(pending.promise);
    render(<AnalyticsPage />);
    expect(
      screen.getByRole("heading", { name: "Analytics" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Plan")).not.toBeInTheDocument();

    pending.resolve({ ok: true, data: analytics() });
    expect(await screen.findByText("Plan")).toBeInTheDocument();
  });

  it("says why the numbers could not be loaded", async () => {
    vi.mocked(fetchBillingAnalytics).mockResolvedValue({
      ok: false,
      message: "Unable to load analytics.",
    });
    render(<AnalyticsPage />);
    expect(
      await screen.findByText("Unable to load analytics."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Plan")).not.toBeInTheDocument();
  });

  it("summarises what the plan includes", async () => {
    answerIs(analytics());
    render(<AnalyticsPage />);
    await screen.findByText("Plan");
    expect(card("Plan")).toHaveTextContent("PRO");
    expect(card("Matched access")).toHaveTextContent("Advanced");
    expect(card("Basic")).toHaveTextContent("Enabled");
    expect(card("Advanced")).toHaveTextContent("Enabled");
    expect(
      screen.queryByText(/does not include Basic Analytics/),
    ).not.toBeInTheDocument();
  });

  it("shows the wallet and the conversations for basic analytics", async () => {
    answerIs(
      analytics({
        access: {
          hasBasicAnalytics: true,
          hasAdvancedAnalytics: false,
          currentPlanCode: "starter",
          matchedFeature: "basic",
        },
        advanced: null,
      }),
    );
    render(<AnalyticsPage />);
    expect(
      await screen.findByRole("heading", { name: "Basic Analytics (30 days)" }),
    ).toBeInTheDocument();
    expect(card("Matched access")).toHaveTextContent("Basic");
    expect(card("Advanced")).toHaveTextContent("Off");
    expect(card("Wallet balance")).toHaveTextContent("$123.45");
    expect(card("Purchased")).toHaveTextContent("$50.00");
    expect(card("Used")).toHaveTextContent("$12.50");
    expect(card("Net")).toHaveTextContent("$37.50");
    expect(card("Conversations")).toHaveTextContent("9");
    expect(card("Groups")).toHaveTextContent("6");
    expect(card("Direct")).toHaveTextContent("3");
    expect(card("Sent/Received")).toHaveTextContent("40/71");
    expect(
      screen.queryByRole("heading", { name: "Advanced Analytics" }),
    ).not.toBeInTheDocument();
  });

  it("charts the groups and the wallet for advanced analytics", async () => {
    answerIs(analytics({ basic: null }));
    render(<AnalyticsPage />);
    expect(
      await screen.findByRole("heading", { name: "Advanced Analytics" }),
    ).toBeInTheDocument();
    expect(card("Admin groups")).toHaveTextContent("2");
    expect(card("Groups in total")).toHaveTextContent("6");
    expect(card("Broadcast groups")).toHaveTextContent("1");
    expect(card("Largest active group")).toHaveTextContent("18 members");
    expect(screen.getAllByText("Your groups, by your role").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Your groups, by type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wallet movement").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active members per group").length).toBeGreaterThan(0);
    // The average is shown to one decimal place.
    expect(screen.getAllByText("4.3").length).toBeGreaterThan(0);
  });

  it("never counts more admin or broadcast groups than there are groups", async () => {
    answerIs(
      analytics({
        basic: null,
        advanced: {
          planInfo: PLAN,
          wallet: WALLET,
          groupAdminStats: {
            adminGroups: 5,
            memberGroups: 1,
            broadcastGroups: 5,
          },
          groupSize: {
            averageActiveMembers: 1,
            largestGroupActiveMembers: 1,
          },
        },
      }),
    );
    render(<AnalyticsPage />);
    await screen.findByRole("heading", { name: "Advanced Analytics" });
    expect(card("Largest active group")).toHaveTextContent("1 member");
    expect(
      screen.queryByText("You're not a member of any groups yet."),
    ).not.toBeInTheDocument();
  });

  it("says so when the plan includes no analytics at all", async () => {
    answerIs(
      analytics({
        access: {
          hasBasicAnalytics: false,
          hasAdvancedAnalytics: false,
          currentPlanCode: "",
          matchedFeature: "none",
        },
        basic: null,
        advanced: null,
      }),
    );
    render(<AnalyticsPage />);
    expect(
      await screen.findByText(/does not include Basic Analytics/),
    ).toBeInTheDocument();
    expect(card("Plan")).toHaveTextContent("N/A");
    expect(card("Matched access")).toHaveTextContent("None");
    expect(card("Basic")).toHaveTextContent("Off");
  });

  it("ignores numbers that arrive after the page has gone", async () => {
    const pending = deferred<Answer>();
    vi.mocked(fetchBillingAnalytics).mockReturnValue(pending.promise);
    const { unmount, container } = render(<AnalyticsPage />);
    unmount();
    pending.resolve({ ok: false, message: "late" });
    await pending.promise;
    expect(container).toBeEmptyDOMElement();
  });
});
