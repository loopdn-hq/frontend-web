import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
let auth: { session: string | null; isLoaded: boolean };
let apiBaseUrl = "https://api.test";

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth/client", () => ({ useAuth: () => auth }));
vi.mock("@/lib/config/env", () => ({
  get API_BASE_URL() {
    return apiBaseUrl;
  },
  PUBLIC_ORIGIN: "",
}));
vi.mock("@/lib/platform", () => ({
  platform: { openExternal: vi.fn(async () => {}) },
}));
vi.mock("@/lib/billing", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/billing")>("@/lib/billing");
  return {
    ...actual,
    createPlanCheckoutSession: vi.fn(),
    fetchBillingSummary: vi.fn(),
  };
});
// The site chrome has its own tests and needs a theme provider this page lacks.
vi.mock("@/components/site/SiteTopNav", () => ({ SiteTopNav: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ SiteFooter: () => null }));

import PricingPage from "@/app/pricing/page";
import { createPlanCheckoutSession, fetchBillingSummary } from "@/lib/billing";
import { platform } from "@/lib/platform";
import { deferred, jsonResponse, stubLocation } from "@/test/helpers";

const fetchMock = vi.fn();

const PREMIUM = {
  code: "premium",
  name: "Premium",
  monthly_price_cents: 999,
  price_display: "$9.99/mo",
  max_groups: 25,
  max_members_per_group: 100,
  max_admins_per_group: 5,
  storage_gb: 20,
  has_whatsapp: true,
  has_telegram: false,
  has_calls: true,
  max_call_participants: 12,
  has_screen_share: true,
  has_call_recording: true,
  call_recording_retention_days: 30,
  features: ["Search", "Ad-free"],
  is_custom_pricing: false,
};

const BUSINESS = {
  ...PREMIUM,
  code: "business_plus",
  name: "Business Plus",
  monthly_price_cents: 4999,
  price_display: "$49.99/mo",
  max_call_participants: null,
  has_screen_share: false,
  call_recording_retention_days: null,
  features: ["Moderation tools"],
};

const STARTER = {
  ...PREMIUM,
  code: "starter",
  name: "Starter",
  monthly_price_cents: 299,
  price_display: "$2.99/mo",
  storage_gb: null,
  has_calls: false,
  features: [],
};

function plansAre(plans: unknown, status = 200) {
  fetchMock.mockResolvedValue(jsonResponse(status, { data: plans }));
}

function currentPlanIs(code: string) {
  vi.mocked(fetchBillingSummary).mockResolvedValue({
    ok: true,
    data: { subscription: { plan: { code } } },
  } as never);
}

function card(name: string) {
  return screen.getByRole("article", { name: `${name} plan` });
}

async function loaded() {
  await screen.findByRole("article", { name: "Free plan" });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  auth = { session: null, isLoaded: true };
  apiBaseUrl = "https://api.test";
  plansAre([PREMIUM, BUSINESS, STARTER]);
  vi.mocked(fetchBillingSummary).mockResolvedValue({ ok: false, message: "x" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PricingPage", () => {
  it("shows placeholders while the plans load", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    render(<PricingPage />);

    expect(screen.getByText("Loading latest plan data...")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    pending.resolve(jsonResponse(200, { data: [PREMIUM] }));
    await loaded();
    expect(
      screen.getByText("Showing latest plans from billing API."),
    ).toBeInTheDocument();
  });

  it("lists the plans cheapest first, with Free and Enterprise around the server's", async () => {
    render(<PricingPage />);
    await loaded();

    expect(fetchMock).toHaveBeenCalledWith("https://api.test/billing/plans/");
    expect(
      screen
        .getAllByRole("article")
        .map((article) => article.getAttribute("aria-label")),
    ).toEqual([
      "Free plan",
      "Starter plan",
      "Premium plan",
      "Business Plus plan",
      "Enterprise plan",
    ]);
    expect(within(card("Premium")).getByText("$9.99/mo")).toBeInTheDocument();
    expect(
      within(card("Premium")).getByText("Recommended"),
    ).toBeInTheDocument();
    expect(
      within(card("Free")).queryByText("Recommended"),
    ).not.toBeInTheDocument();
  });

  it("describes each plan's limits and calling in words", async () => {
    render(<PricingPage />);
    await loaded();

    const premium = card("Premium");
    expect(premium).toHaveTextContent("25 max groups");
    expect(premium).toHaveTextContent("100 members per group");
    expect(premium).toHaveTextContent("20 GB storage");
    expect(premium).toHaveTextContent("Up to 12 call participants");
    expect(premium).toHaveTextContent("Kept 30 days call recording");
    expect(premium).toHaveTextContent(
      "For active teams and communities with growth needs.",
    );

    const business = card("Business Plus");
    expect(business).toHaveTextContent("Unlimited call participants");
    expect(business).toHaveTextContent("Not included screen sharing");
    expect(business).toHaveTextContent("Kept until deleted call recording");
    expect(business).toHaveTextContent(
      "For operations-heavy organizations running many groups.",
    );

    const starter = card("Starter");
    expect(starter).toHaveTextContent("Custom storage");
    expect(starter).toHaveTextContent("Not included voice & video calls");
    expect(starter).not.toHaveTextContent("call participants");

    expect(card("Enterprise")).toHaveTextContent("Custom max groups");
    expect(card("Free")).toHaveTextContent(
      "For small groups getting started with Loopd'n.",
    );
  });

  it("uses the server's own Free plan instead of the built-in one", async () => {
    plansAre([
      {
        ...PREMIUM,
        code: "free",
        name: "Free forever",
        monthly_price_cents: 0,
      },
    ]);
    render(<PricingPage />);
    await screen.findByRole("article", { name: "Free forever plan" });
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("compares the plans' features once they are in", async () => {
    render(<PricingPage />);
    await loaded();
    expect(
      screen.getByRole("table", { name: /features included in each/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Search" }),
    ).toBeInTheDocument();
  });

  it("sends a visitor to log in, and anybody to the builder for Enterprise", async () => {
    const user = userEvent.setup();
    render(<PricingPage />);
    await loaded();

    await user.click(
      within(card("Premium")).getByRole("button", {
        name: "Log in to continue",
      }),
    );
    expect(push).toHaveBeenLastCalledWith("/login/");

    await user.click(
      within(card("Enterprise")).getByRole("button", {
        name: "Build Your Plan",
      }),
    );
    expect(push).toHaveBeenLastCalledWith("/enterprise/builder/");
    expect(createPlanCheckoutSession).not.toHaveBeenCalled();
    expect(fetchBillingSummary).not.toHaveBeenCalled();
  });

  it("starts checkout for a signed-in person and hands the page to Stripe", async () => {
    const user = userEvent.setup();
    stubLocation("https://loopdn.com/pricing/");
    vi.stubGlobal("fetch", fetchMock);
    auth = { session: "sam", isLoaded: true };
    const checkout =
      deferred<Awaited<ReturnType<typeof createPlanCheckoutSession>>>();
    vi.mocked(createPlanCheckoutSession).mockReturnValue(checkout.promise);
    render(<PricingPage />);
    await loaded();

    await user.click(
      within(card("Business Plus")).getByRole("button", {
        name: "Choose Business Plus",
      }),
    );
    expect(createPlanCheckoutSession).toHaveBeenCalledWith(
      "business_plus",
      "https://loopdn.com/billing/success/?flow=plan&plan=business_plus",
      "https://loopdn.com/billing/cancel/?flow=plan&plan=business_plus",
    );
    // Every plan's button waits while one checkout is starting.
    expect(
      within(card("Business Plus")).getByRole("button", {
        name: "Redirecting...",
      }),
    ).toBeDisabled();
    expect(
      within(card("Premium")).getByRole("button", { name: "Choose Premium" }),
    ).toBeDisabled();

    checkout.resolve({
      ok: true,
      data: { checkoutUrl: "https://checkout.stripe.com/c/1" },
    });
    await waitFor(() =>
      expect(platform.openExternal).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/1",
      ),
    );
    expect(
      within(card("Premium")).getByRole("button", { name: "Choose Premium" }),
    ).toBeEnabled();
  });

  it("says why checkout could not start, and lets them try again", async () => {
    const user = userEvent.setup();
    auth = { session: "sam", isLoaded: true };
    vi.mocked(createPlanCheckoutSession).mockResolvedValue({
      ok: false,
      message: "Card required.",
    });
    render(<PricingPage />);
    await loaded();

    await user.click(
      within(card("Premium")).getByRole("button", { name: "Choose Premium" }),
    );
    expect(
      await screen.findByText("Unable to start checkout"),
    ).toBeInTheDocument();
    expect(screen.getByText("Card required.")).toBeInTheDocument();
    expect(platform.openExternal).not.toHaveBeenCalled();

    vi.mocked(createPlanCheckoutSession).mockResolvedValue({
      ok: true,
      data: { checkoutUrl: "https://checkout.stripe.com/c/2" },
    });
    await user.click(
      within(card("Premium")).getByRole("button", { name: "Choose Premium" }),
    );
    await waitFor(() => expect(platform.openExternal).toHaveBeenCalled());
    expect(
      screen.queryByText("Unable to start checkout"),
    ).not.toBeInTheDocument();
  });

  it("marks the plan somebody is on, and offers no button for it", async () => {
    auth = { session: "sam", isLoaded: true };
    currentPlanIs("STARTER");
    render(<PricingPage />);
    await loaded();

    const starter = card("Starter");
    await within(starter).findByText("Current Plan");
    expect(within(starter).getByText("Your plan")).toBeInTheDocument();
    expect(within(starter).queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /starter/i }),
    ).toHaveTextContent("Your plan");
  });

  it("shows the recommended plan as current without doubling its badge", async () => {
    auth = { session: "sam", isLoaded: true };
    currentPlanIs("premium");
    render(<PricingPage />);
    await loaded();

    const premium = card("Premium");
    await within(premium).findByText("Current Plan");
    expect(within(premium).getByText("Recommended")).toBeInTheDocument();
    expect(within(premium).queryByText("Your plan")).not.toBeInTheDocument();
  });

  it("does not wait on the session before deciding nobody is signed in", async () => {
    auth = { session: "sam", isLoaded: false };
    render(<PricingPage />);
    await loaded();
    expect(fetchBillingSummary).not.toHaveBeenCalled();
    expect(
      within(card("Premium")).getByRole("button", {
        name: "Log in to continue",
      }),
    ).toBeInTheDocument();
  });

  it("ignores a billing summary that lands after the page has gone", async () => {
    auth = { session: "sam", isLoaded: true };
    const summary = deferred<Awaited<ReturnType<typeof fetchBillingSummary>>>();
    vi.mocked(fetchBillingSummary).mockReturnValue(summary.promise);
    const { unmount } = render(<PricingPage />);
    await loaded();
    unmount();
    summary.resolve({
      ok: true,
      data: { subscription: { plan: { code: "premium" } } },
    } as never);
    await expect(summary.promise).resolves.toBeTruthy();
  });

  it("explains a failed load in the server's words, and retries", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(503, { message: "Billing is down." }),
    );
    render(<PricingPage />);

    expect(
      await screen.findByText("Showing fallback pricing. Billing is down."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Contact Sales" }).getAttribute("href"),
    ).toMatch(/^\/contact\/?$/);

    plansAre([PREMIUM]);
    await user.click(
      screen.getByRole("button", { name: "Retry loading plans" }),
    );
    await loaded();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("has its own words for an answer it cannot read and for a dead network", async () => {
    plansAre("not a list");
    const first = render(<PricingPage />);
    expect(
      await screen.findByText(
        "Showing fallback pricing. Unable to load plans right now.",
      ),
    ).toBeInTheDocument();
    first.unmount();

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    const second = render(<PricingPage />);
    expect(
      await screen.findByText(
        "Showing fallback pricing. Unable to load plans right now.",
      ),
    ).toBeInTheDocument();
    second.unmount();

    fetchMock.mockRejectedValue(new Error("Failed to fetch"));
    const third = render(<PricingPage />);
    expect(
      await screen.findByText("Showing fallback pricing. Failed to fetch"),
    ).toBeInTheDocument();
    third.unmount();

    fetchMock.mockRejectedValue("offline");
    render(<PricingPage />);
    expect(
      await screen.findByText(
        "Showing fallback pricing. Unable to load plans right now.",
      ),
    ).toBeInTheDocument();
  });

  it("says so, without calling anything, when the build has no API to ask", async () => {
    apiBaseUrl = "";
    render(<PricingPage />);
    expect(
      await screen.findByText(
        "Showing fallback pricing. Pricing API URL is not configured.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("always offers the enterprise builder and a way to reach sales", async () => {
    render(<PricingPage />);
    await loaded();
    expect(
      screen
        .getByRole("link", { name: "Build Your Enterprise Plan" })
        .getAttribute("href"),
    ).toMatch(/^\/enterprise\/builder\/?$/);
    expect(
      screen
        .getByRole("link", { name: "Talk to sales instead" })
        .getAttribute("href"),
    ).toMatch(/^\/contact\/?$/);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
