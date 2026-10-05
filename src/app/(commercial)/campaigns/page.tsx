"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Megaphone, MousePointerClick, Search } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import {
  CampaignDetail,
  CampaignDetailSkeleton,
} from "@/components/commercial/CampaignDetail";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NewCampaignLink } from "@/components/commercial/NewCampaignLink";
import { ObjectiveIcon } from "@/components/commercial/ObjectiveIcon";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { CampaignStatusBadge } from "@/components/commercial/StatusBadge";
import {
  Button,
  Input,
  Select,
  Skeleton,
  SkeletonRegion,
} from "@/components/ui";
import { fetchCampaignPage } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import {
  CAMPAIGN_OBJECTIVE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  campaignName,
  formatCents,
} from "@/lib/commercial/format";
import type { Campaign, CampaignStatus, Company } from "@/lib/commercial/types";
import { cn } from "@/lib/ui/cn";

/**
 * /campaigns/ - the company's campaigns on the left, and the one picked on
 * the right, like a chat list and its conversation. `?id=12` is the one
 * picked. On a phone there is room for one side at a time: the list, or the
 * campaign with "← Campaigns" back to it.
 *
 * A query string, not /campaigns/12/: this is a static export, and a dynamic
 * segment would need every campaign id at build time. useSearchParams() must
 * sit under Suspense or `next build` fails.
 */
export default function CommercialCampaignsPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <CampaignsFromQuery />
    </Suspense>
  );
}

function CampaignsFromQuery() {
  const { company } = useCompany();
  const id = Number(useSearchParams().get("id"));
  const selectedId = Number.isInteger(id) && id > 0 ? id : null;

  if (!company) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <CommercialPageHeader title="Campaigns" actions={<NewCampaignLink />} />
        <CompanyNotice />
      </div>
    );
  }

  // Keyed by company: switching company starts from a clean loading state
  // instead of flashing the previous one's campaigns.
  return (
    <Workspace key={company.id} company={company} selectedId={selectedId} />
  );
}

// "All campaigns", then one status at a time, in the order a campaign moves.
const STATUS_FILTERS: { value: "" | CampaignStatus; label: string }[] = [
  { value: "", label: "All campaigns" },
  ...(
    [
      "draft",
      "pending_review",
      "approved",
      "running",
      "paused",
      "ended",
    ] as const
  ).map((status) => ({ value: status, label: CAMPAIGN_STATUS_LABEL[status] })),
];

function Workspace({
  company,
  selectedId,
}: {
  company: Company;
  selectedId: number | null;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | CampaignStatus>("");
  const [search, setSearch] = useState("");
  // What the list was last asked for: typing waits for a pause first.
  const [query, setQuery] = useState("");
  const filtering = statusFilter !== "" || query !== "";

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    // The rows shown stay until the new ones arrive, so typing doesn't flash.
    fetchCampaignPage({
      companyId: company.id,
      status: statusFilter || undefined,
      search: query,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setCampaigns(result.data.campaigns);
          setCount(result.data.count);
          setHasMore(result.data.hasMore);
          setPage(1);
          setError(null);
        } else {
          setError(result.message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company.id, reloadToken, statusFilter, query]);

  async function loadMore() {
    setLoadingMore(true);
    const result = await fetchCampaignPage({
      companyId: company.id,
      page: page + 1,
      status: statusFilter || undefined,
      search: query,
    });
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(result.message);
      return;
    }
    setMoreError(null);
    setPage(page + 1);
    setHasMore(result.data.hasMore);
    // A campaign created meanwhile shifts the pages; never show one twice.
    setCampaigns((current) => [
      ...current,
      ...result.data.campaigns.filter(
        (campaign) => !current.some((shown) => shown.id === campaign.id),
      ),
    ]);
  }

  function changed(updated: Campaign) {
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === updated.id ? updated : campaign,
      ),
    );
  }

  function deleted(id: number) {
    setCampaigns((current) => current.filter((campaign) => campaign.id !== id));
    setCount((current) => Math.max(0, current - 1));
    router.replace("/campaigns/", { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          "w-full min-w-0 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[22rem] xl:w-96 dark:border-slate-800 dark:bg-slate-950",
          selectedId ? "hidden" : "flex",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-5 pb-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Campaigns
            </h1>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {company.name}
              {!isLoading &&
                !error &&
                ` · ${count} ${filtering ? "matching" : count === 1 ? "campaign" : "campaigns"}`}
            </p>
          </div>
          <NewCampaignLink />
        </div>

        <div className="flex shrink-0 gap-2 px-4 pb-3">
          <div className="w-36 shrink-0">
            <Select
              aria-label="Show campaigns"
              value={statusFilter}
              options={STATUS_FILTERS}
              className="h-10 py-0 pr-9 pl-3 text-sm"
              onChange={(event) =>
                setStatusFilter(event.target.value as "" | CampaignStatus)
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
              aria-label="Search campaigns"
              placeholder="Search campaigns…"
              value={search}
              className="h-10 py-0 pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {isLoading ? (
            <SkeletonRegion
              label="Loading campaigns"
              className="space-y-1 px-2"
            >
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </SkeletonRegion>
          ) : error ? (
            <div className="px-2">
              <LoadFailed
                what="your campaigns"
                message={error}
                onRetry={() => {
                  setIsLoading(true);
                  setError(null);
                  setReloadToken((token) => token + 1);
                }}
              />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
              {filtering
                ? "No campaigns match."
                : `No campaigns for ${company.name} yet.`}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {campaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    selected={campaign.id === selectedId}
                  />
                ))}
              </ul>
              {moreError && (
                <p className="px-3 pt-2 text-sm text-rose-600">{moreError}</p>
              )}
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
          <CampaignDetail
            key={selectedId}
            campaignId={selectedId}
            onChanged={changed}
            onDeleted={() => deleted(selectedId)}
          />
        ) : isLoading ? null : campaigns.length === 0 && !filtering ? (
          <NoCampaigns companyName={company.name} />
        ) : (
          <NothingPicked />
        )}
      </section>
    </div>
  );
}

/** One campaign in the list, as a chat is in the chat list. */
function CampaignRow({
  campaign,
  selected,
}: {
  campaign: Campaign;
  selected: boolean;
}) {
  return (
    <li>
      <Link
        href={`/campaigns/?id=${campaign.id}`}
        scroll={false}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 border-l-[3px] px-3 py-3 transition",
          selected
            ? "border-sky-500 bg-sky-50 dark:bg-slate-800"
            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-900",
        )}
      >
        <ObjectiveIcon objective={campaign.objective} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {campaignName(campaign)}
            </span>
            <CampaignStatusBadge
              status={campaign.status}
              className="shrink-0"
            />
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {CAMPAIGN_OBJECTIVE_LABEL[campaign.objective]} ·{" "}
            {campaign.totalBudgetCents === null
              ? "No budget yet"
              : formatCents(campaign.totalBudgetCents, campaign.currency)}
          </span>
        </span>
        <span className="shrink-0 self-start pt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {shortDate(campaign.createdAt)}
        </span>
      </Link>
    </li>
  );
}

/** "10/1/26", as the chat list dates its rows. */
function shortDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
      });
}

function NothingPicked() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <MousePointerClick className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Pick a campaign
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Its budget, audience, creatives and history show here.
      </p>
    </div>
  );
}

/** Names the company, so nobody wonders whether they are looking at the right one. */
function NoCampaigns({ companyName }: { companyName: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Megaphone className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        No campaigns for {companyName} yet
      </p>
      <div className="mt-4">
        <NewCampaignLink />
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0">
      <SkeletonRegion
        label="Loading campaigns"
        className="w-full space-y-2 border-r border-slate-200 p-4 lg:w-[22rem] xl:w-96 dark:border-slate-800"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </SkeletonRegion>
      <div className="hidden flex-1 lg:block">
        <CampaignDetailSkeleton />
      </div>
    </div>
  );
}
