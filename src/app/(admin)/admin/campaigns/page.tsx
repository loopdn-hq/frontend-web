"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox, Loader2, MousePointerClick, Search } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import {
  ReviewDetail,
  ReviewDetailSkeleton,
} from "@/components/admin/review/ReviewDetail";
import { STATUS_TONE } from "@/components/admin/review/statusTone";
import {
  Badge,
  Button,
  Input,
  Select,
  Skeleton,
  SkeletonRegion,
} from "@/components/ui";
import { fetchReviewQueue } from "@/lib/admin/api";
import { formatBudget, formatDay } from "@/lib/admin/format";
import type {
  CampaignStatus,
  ReviewCampaign,
  ReviewQueueItem,
} from "@/lib/admin/types";
import { cn } from "@/lib/ui/cn";

/**
 * /admin/campaigns/ - campaign review (slice 2 of
 * backend/docs/campaigns_final_plan.md). The queue on the left, waiting for
 * review and oldest first; the picked campaign on the right (?id=12), to
 * approve or send back. On a phone, one side at a time.
 *
 * useSearchParams() must sit under Suspense or `next build` fails.
 */
export default function AdminCampaignReviewPage() {
  return (
    <Suspense fallback={<ReviewDetailSkeleton />}>
      <ReviewFromQuery />
    </Suspense>
  );
}

// Waiting for review first: it is the queue. The rest look things up.
const SHOWING: { value: CampaignStatus | "all"; label: string }[] = [
  { value: "pending_review", label: "Waiting for review" },
  { value: "approved", label: "Approved" },
  { value: "running", label: "Running" },
  { value: "draft", label: "Drafts" },
  { value: "all", label: "All campaigns" },
];

function ReviewFromQuery() {
  const id = Number(useSearchParams().get("id"));
  const selectedId = Number.isInteger(id) && id > 0 ? id : null;

  const [showing, setShowing] = useState<CampaignStatus | "all">(
    "pending_review",
  );
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  // Typing waits for a pause before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    fetchReviewQueue({ status: showing, search: query }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setItems(result.data.items);
      setCount(result.data.count);
      setHasMore(result.data.hasMore);
      setPage(1);
    });
    return () => {
      cancelled = true;
    };
  }, [showing, query, token]);

  async function loadMore() {
    setLoadingMore(true);
    const result = await fetchReviewQueue({
      status: showing,
      search: query,
      page: page + 1,
    });
    setLoadingMore(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPage(page + 1);
    setHasMore(result.data.hasMore);
    setItems((current) => [
      ...current,
      ...result.data.items.filter(
        (item) => !current.some((shown) => shown.id === item.id),
      ),
    ]);
  }

  // A decision changes the row - and, in the queue, takes it out.
  function decided(campaign: ReviewCampaign) {
    setItems((current) =>
      showing === "pending_review"
        ? current.filter((item) => item.id !== campaign.id)
        : current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  status: campaign.status,
                  statusLabel: campaign.statusLabel,
                }
              : item,
          ),
    );
    if (showing === "pending_review") {
      setCount((current) => Math.max(0, current - 1));
    }
  }

  const waitingView = showing === "pending_review" && !query;

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          "w-full min-w-0 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[22rem] xl:w-96 dark:border-slate-800 dark:bg-slate-950",
          selectedId ? "hidden" : "flex",
        )}
      >
        <div className="shrink-0 px-4 pt-5 pb-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Campaign review
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading || error
              ? "Campaigns companies have submitted"
              : waitingView
                ? `${count} waiting`
                : `${count} ${count === 1 ? "campaign" : "campaigns"}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2 px-4 pb-3">
          <div className="w-44 shrink-0">
            <Select
              aria-label="Show"
              value={showing}
              options={SHOWING}
              className="h-10 py-0 pr-9 pl-3 text-sm"
              onChange={(event) =>
                setShowing(event.target.value as CampaignStatus | "all")
              }
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search by campaign or company"
              placeholder="Campaign or company"
              value={search}
              className="h-10 py-0 pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          {loading ? (
            <SkeletonRegion
              label="Loading the queue"
              className="space-y-1 px-4"
            >
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </SkeletonRegion>
          ) : error ? (
            <div className="px-4">
              <LoadFailed
                what="the review queue"
                message={error}
                onRetry={() => {
                  setLoading(true);
                  setError(null);
                  setToken((current) => current + 1);
                }}
              />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              {waitingView
                ? "Nothing waiting for review."
                : "No campaigns match."}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                  />
                ))}
              </ul>
              {hasMore && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    )}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 overflow-y-auto",
          selectedId ? "block" : "hidden lg:block",
        )}
      >
        {selectedId ? (
          // Keyed so moving between two campaigns resets instead of showing
          // the old one while the new one loads.
          <ReviewDetail
            key={selectedId}
            campaignId={selectedId}
            onDecided={decided}
          />
        ) : loading ? null : (
          <Empty waiting={waitingView && items.length === 0} />
        )}
      </section>
    </div>
  );
}

function QueueRow({
  item,
  selected,
}: {
  item: ReviewQueueItem;
  selected: boolean;
}) {
  return (
    <li>
      <Link
        href={`/admin/campaigns/?id=${item.id}`}
        scroll={false}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "block border-l-[3px] px-4 py-3 transition",
          selected
            ? "border-violet-500 bg-violet-50 dark:bg-slate-800"
            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-900",
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.name || "Untitled campaign"}
          </span>
          <Badge tone={STATUS_TONE[item.status]} className="shrink-0">
            {item.statusLabel}
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-400">
          {item.companyName} · {item.objectiveLabel}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
          {formatBudget(item.totalBudgetCents, item.currency)}
          {item.submittedAt && ` · submitted ${formatDay(item.submittedAt)}`}
        </span>
      </Link>
    </li>
  );
}

function Empty({ waiting }: { waiting: boolean }) {
  const Icon = waiting ? Inbox : MousePointerClick;
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Icon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {waiting ? "Nothing waiting for review" : "Pick a campaign"}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {waiting
          ? "Campaigns appear here when companies submit them."
          : "Its checks, company, creatives and history show here."}
      </p>
    </div>
  );
}
