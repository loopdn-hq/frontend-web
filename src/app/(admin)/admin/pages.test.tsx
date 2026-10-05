import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let search = "";
let features: { features: Set<string>; loading: boolean };

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/components/admin/AdminFrame", () => ({
  useAdminFeatures: () => features,
}));
vi.mock("@/lib/admin/api", () => ({ fetchReviewQueue: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  fetchPermissionsMatrix: vi.fn(),
  setGrant: vi.fn(),
}));
// The detail pane has tests of its own; here it reports a decision.
vi.mock("@/components/admin/review/ReviewDetail", () => ({
  ReviewDetailSkeleton: () => <div data-testid="detail-skeleton" />,
  ReviewDetail: ({
    campaignId,
    onDecided,
  }: {
    campaignId: number;
    onDecided: (campaign: unknown) => void;
  }) => (
    <div data-testid="detail" data-campaign={campaignId}>
      <button
        onClick={() =>
          onDecided({ id: campaignId, status: "approved", statusLabel: "Approved" })
        }
      >
        stub approve
      </button>
    </div>
  ),
}));

import AdminCampaignReviewPage from "@/app/(admin)/admin/campaigns/page";
import PermissionsPage from "@/app/(admin)/admin/permissions/page";
import { fetchReviewQueue } from "@/lib/admin/api";
import type { ReviewQueueItem } from "@/lib/admin/types";
import {
  fetchPermissionsMatrix,
  setGrant,
  type PermissionsMatrix,
} from "@/lib/rbac";
import { deferred } from "@/test/helpers";

type Queue = Awaited<ReturnType<typeof fetchReviewQueue>>;

function item(id: number, overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id,
    name: `Campaign ${id}`,
    objectiveLabel: "Website visits",
    status: "pending_review",
    statusLabel: "Pending review",
    companyName: "Acme",
    totalBudgetCents: 50_000,
    currency: "USD",
    submittedAt: "2026-10-01T10:00:00",
    creativeCount: 1,
    ...overrides,
  };
}

function queueIs(items: ReviewQueueItem[], extra: { count?: number; hasMore?: boolean } = {}) {
  vi.mocked(fetchReviewQueue).mockResolvedValue({
    ok: true,
    data: {
      items,
      count: extra.count ?? items.length,
      hasMore: extra.hasMore ?? false,
    },
  });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  features = { features: new Set(["platform.permissions.edit"]), loading: false };
  queueIs([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the campaign review queue", () => {
  it("opens on what is waiting", async () => {
    queueIs([
      item(1),
      item(2, { name: "", totalBudgetCents: null, submittedAt: null }),
    ]);
    render(<AdminCampaignReviewPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the queue");
    expect(screen.getByText("Campaigns companies have submitted")).toBeInTheDocument();

    const first = await screen.findByRole("link", { name: /campaign 1/i });
    expect(fetchReviewQueue).toHaveBeenCalledWith({ status: "pending_review", search: "" });
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
    expect(first).toHaveTextContent("Acme · Website visits");
    expect(first).toHaveTextContent("$500.00 · submitted Oct 1, 2026");
    expect(first.getAttribute("href")).toMatch(/^\/admin\/campaigns\/?\?id=1$/);

    const second = screen.getByRole("link", { name: /untitled campaign/i });
    expect(second).toHaveTextContent("Not set");
    expect(second).not.toHaveTextContent("submitted");
    expect(screen.getByText("Pick a campaign")).toBeInTheDocument();
  });

  it("says when nothing is waiting", async () => {
    render(<AdminCampaignReviewPage />);
    expect(await screen.findByText("Nothing waiting for review.")).toBeInTheDocument();
    expect(screen.getByText("Nothing waiting for review")).toBeInTheDocument();
    expect(screen.getByText("0 waiting")).toBeInTheDocument();
  });

  it("shows another status, counted as campaigns", async () => {
    render(<AdminCampaignReviewPage />);
    await screen.findByText("Nothing waiting for review.");

    queueIs([item(3, { status: "running", statusLabel: "Running" })]);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "running" } });
    expect(await screen.findByText("1 campaign")).toBeInTheDocument();
    expect(fetchReviewQueue).toHaveBeenLastCalledWith({ status: "running", search: "" });

    queueIs([]);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "all" } });
    expect(await screen.findByText("No campaigns match.")).toBeInTheDocument();
    expect(screen.getByText("0 campaigns")).toBeInTheDocument();
    expect(screen.getByText("Pick a campaign")).toBeInTheDocument();
  });

  it("searches after a pause", async () => {
    vi.useFakeTimers();
    render(<AdminCampaignReviewPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    const calls = vi.mocked(fetchReviewQueue).mock.calls.length;

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search by campaign or company" }),
      { target: { value: "  acme " } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(fetchReviewQueue).toHaveBeenCalledTimes(calls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchReviewQueue).toHaveBeenLastCalledWith({
      status: "pending_review",
      search: "acme",
    });
    // A search over the waiting ones is counted as a search, not as the queue.
    expect(screen.getByText("0 campaigns")).toBeInTheDocument();
    expect(screen.getByText("No campaigns match.")).toBeInTheDocument();
  });

  it("loads more onto the end, without repeating a row", async () => {
    queueIs([item(1)], { count: 3, hasMore: true });
    render(<AdminCampaignReviewPage />);
    await screen.findByRole("link", { name: /campaign 1/i });

    const more = deferred<Queue>();
    vi.mocked(fetchReviewQueue).mockReturnValue(more.promise);
    click("Load more");
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
    expect(fetchReviewQueue).toHaveBeenLastCalledWith({
      status: "pending_review",
      search: "",
      page: 2,
    });

    await act(async () =>
      more.resolve({ ok: true, data: { items: [item(1), item(2)], count: 3, hasMore: false } }),
    );
    expect(screen.getAllByRole("link", { name: /^campaign \d/i })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("offers a retry when the queue, or more of it, cannot be loaded", async () => {
    vi.mocked(fetchReviewQueue).mockResolvedValue({
      ok: false,
      message: "Couldn't load the review queue.",
    });
    render(<AdminCampaignReviewPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the review queue.",
    );
    expect(screen.getByText("Campaigns companies have submitted")).toBeInTheDocument();

    queueIs([item(1)], { hasMore: true });
    click(/try again/i);
    await screen.findByRole("link", { name: /campaign 1/i });

    vi.mocked(fetchReviewQueue).mockResolvedValue({ ok: false, message: "Lost connection." });
    click("Load more");
    expect(await screen.findByRole("alert")).toHaveTextContent("Lost connection.");
  });

  it("opens the campaign named in the address beside the queue", async () => {
    search = "id=2";
    queueIs([item(1), item(2)]);
    render(<AdminCampaignReviewPage />);
    expect(screen.getByTestId("detail")).toHaveAttribute("data-campaign", "2");
    expect(await screen.findByRole("link", { name: /campaign 2/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("complementary")).toHaveClass("hidden");
  });

  it("takes a decided campaign out of the waiting queue", async () => {
    search = "id=2";
    queueIs([item(1), item(2)]);
    render(<AdminCampaignReviewPage />);
    await screen.findByRole("link", { name: /campaign 2/i });

    click("stub approve");
    expect(screen.queryByRole("link", { name: /campaign 2/i })).not.toBeInTheDocument();
    expect(screen.getByText("1 waiting")).toBeInTheDocument();
  });

  it("relabels a decided campaign in any other view", async () => {
    search = "id=2";
    queueIs([item(1), item(2)]);
    render(<AdminCampaignReviewPage />);
    await screen.findByRole("link", { name: /campaign 2/i });
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "all" } });
    await screen.findByText("2 campaigns");

    click("stub approve");
    expect(screen.getByRole("link", { name: /campaign 2/i })).toHaveTextContent("Approved");
    expect(screen.getByRole("link", { name: /campaign 1/i })).toHaveTextContent(
      "Pending review",
    );
    expect(screen.getByText("2 campaigns")).toBeInTheDocument();
  });

  it("ignores an id it cannot read, and a queue that arrives too late", async () => {
    search = "id=nope";
    const pending = deferred<Queue>();
    vi.mocked(fetchReviewQueue).mockReturnValue(pending.promise);
    const { unmount } = render(<AdminCampaignReviewPage />);
    expect(screen.queryByTestId("detail")).not.toBeInTheDocument();
    unmount();
    pending.resolve({ ok: true, data: { items: [], count: 0, hasMore: false } });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("the permissions page", () => {
  const MATRIX: PermissionsMatrix = {
    axes: [
      {
        axis: "account",
        label: "Account",
        roles: ["admin", "member"],
        areas: [
          {
            area: "Commercial",
            features: [
              {
                key: "commercial.access",
                label: "Use the dashboard",
                description: "",
                locked: false,
                grants: { admin: true, member: false },
              },
              {
                key: "platform.access",
                label: "Use the admin site",
                description: "",
                locked: true,
                grants: { admin: true, member: false },
              },
            ],
          },
        ],
      },
      {
        axis: "group",
        label: "Group",
        roles: ["admin", "member"],
        areas: [
          {
            area: "Messages",
            features: [
              {
                key: "group.message.pin",
                label: "Pin a message",
                description: "",
                locked: false,
                grants: { admin: true },
              },
            ],
          },
        ],
      },
    ],
  };

  function matrixIs(matrix: PermissionsMatrix = MATRIX) {
    vi.mocked(fetchPermissionsMatrix).mockResolvedValue({ ok: true, matrix });
  }

  function row(label: string) {
    return within(screen.getByText(label).closest("tr")!);
  }

  beforeEach(() => matrixIs());

  it("lays out each axis as features against roles", async () => {
    render(<PermissionsPage />);
    expect(screen.getByText("Loading permissions…")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Group" })).toBeInTheDocument();
    expect(
      screen.getByText("Which areas of the product a person can reach at all."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What a person can do inside one conversation."),
    ).toBeInTheDocument();
    expect(screen.getByText("commercial.access")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(
      screen.getByText("What each role can use. Click a cell to change it."),
    ).toBeInTheDocument();
  });

  it("offers a button for each cell that may be changed, and none for a locked one", async () => {
    render(<PermissionsPage />);
    await screen.findByRole("heading", { name: "Account" });

    const editable = row("Use the dashboard").getAllByRole("button");
    expect(editable).toHaveLength(2);
    expect(editable[0]).toHaveAttribute("aria-pressed", "true");
    expect(editable[0]).toHaveAttribute("title", "Allowed — click to deny");
    expect(editable[1]).toHaveAttribute("aria-pressed", "false");
    expect(editable[1]).toHaveAttribute("title", "Click to allow");

    expect(row("Use the admin site").queryByRole("button")).not.toBeInTheDocument();
    expect(
      row("Use the admin site").getByTitle("Never grantable below account admin"),
    ).toBeInTheDocument();
    // A cell nobody ever wrote down is shown as its own thing.
    expect(
      row("Pin a message").getByTitle("No grant recorded. Denies, but nobody set it."),
    ).toBeInTheDocument();
  });

  it("changes a cell and shows the matrix the server sends back", async () => {
    const pending = deferred<Awaited<ReturnType<typeof setGrant>>>();
    vi.mocked(setGrant).mockReturnValue(pending.promise);
    render(<PermissionsPage />);
    await screen.findByRole("heading", { name: "Account" });

    const member = row("Use the dashboard").getAllByRole("button")[1];
    fireEvent.click(member);
    expect(setGrant).toHaveBeenCalledWith({
      feature: "commercial.access",
      role: "member",
      allowed: true,
    });
    expect(member).toBeDisabled();
    expect(row("Use the dashboard").getAllByRole("button")[0]).toBeEnabled();

    const next = structuredClone(MATRIX);
    next.axes[0].areas[0].features[0].grants.member = true;
    await act(async () => pending.resolve({ ok: true, matrix: next }));
    expect(row("Use the dashboard").getAllByRole("button")[1]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("denies an allowed cell, and allows one with no grant recorded", async () => {
    vi.mocked(setGrant).mockResolvedValue({ ok: true, matrix: MATRIX });
    render(<PermissionsPage />);
    await screen.findByRole("heading", { name: "Account" });

    fireEvent.click(row("Use the dashboard").getAllByRole("button")[0]);
    expect(setGrant).toHaveBeenLastCalledWith({
      feature: "commercial.access",
      role: "admin",
      allowed: false,
    });
    await waitFor(() =>
      expect(row("Use the dashboard").getAllByRole("button")[0]).toBeEnabled(),
    );

    fireEvent.click(row("Pin a message").getAllByRole("button")[1]);
    expect(setGrant).toHaveBeenLastCalledWith({
      feature: "group.message.pin",
      role: "member",
      allowed: true,
    });
  });

  it("shows why a change was refused, and clears that on the next try", async () => {
    vi.mocked(setGrant).mockResolvedValue({
      ok: false,
      message: "That would remove the last account admin.",
    });
    render(<PermissionsPage />);
    await screen.findByRole("heading", { name: "Account" });
    fireEvent.click(row("Use the dashboard").getAllByRole("button")[0]);
    expect(
      await screen.findByText("That would remove the last account admin."),
    ).toBeInTheDocument();

    const pending = deferred<Awaited<ReturnType<typeof setGrant>>>();
    vi.mocked(setGrant).mockReturnValue(pending.promise);
    fireEvent.click(row("Use the dashboard").getAllByRole("button")[1]);
    expect(
      screen.queryByText("That would remove the last account admin."),
    ).not.toBeInTheDocument();
    await act(async () => pending.resolve({ ok: true, matrix: MATRIX }));
  });

  it("is read-only without the edit feature, or while features load", async () => {
    features = { features: new Set(), loading: false };
    const first = render(<PermissionsPage />);
    await screen.findByRole("heading", { name: "Account" });
    expect(screen.getByText("What each role can use. Read-only.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    first.unmount();

    features = { features: new Set(["platform.permissions.edit"]), loading: true };
    render(<PermissionsPage />);
    await screen.findByRole("heading", { name: "Account" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says why the matrix could not be loaded", async () => {
    vi.mocked(fetchPermissionsMatrix).mockResolvedValue({
      ok: false,
      message: "You need the account admin role to view permissions.",
    });
    render(<PermissionsPage />);
    expect(
      await screen.findByText("You need the account admin role to view permissions."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading permissions…")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("ignores a matrix that arrives after the page has gone", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fetchPermissionsMatrix>>>();
    vi.mocked(fetchPermissionsMatrix).mockReturnValue(pending.promise);
    const { unmount } = render(<PermissionsPage />);
    unmount();
    pending.resolve({ ok: true, matrix: MATRIX });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});
