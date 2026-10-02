"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Phone } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { Button, Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchLeads } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import type { Company, Lead } from "@/lib/commercial/types";

/**
 * /leads/ - people who got in touch because of an ad.
 *
 * Only what a person CHOSE to send this company: what they typed into a lead
 * campaign's form (slice 7a), and later a call or a text to a campaign's
 * tracking number. Never who saw an ad or who clicked one - the platform
 * knows that, and §13 of the product plan says it stays with the platform.
 */
export default function CommercialLeadsPage() {
  const { company } = useCompany();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <CommercialPageHeader
        title="Leads"
        description="People who contacted you through your campaigns"
      />
      <CompanyNotice />
      {/* Keyed by company: a switch starts afresh. */}
      {company && <Leads key={company.id} company={company} />}
      <NotBuiltYet title="Calls and texts">
        Calls and texts to each campaign&apos;s tracking number: when, which
        campaign, and for a call how long it lasted.
      </NotBuiltYet>
    </div>
  );
}

function Leads({ company }: { company: Company }) {
  const [items, setItems] = useState<Lead[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLeads(company.id).then((result) => {
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
  }, [company.id, token]);

  async function loadMore() {
    setLoadingMore(true);
    const result = await fetchLeads(company.id, { page: page + 1 });
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Form entries
        </h2>
        {!loading && !error && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {count} {count === 1 ? "lead" : "leads"}
          </p>
        )}
      </div>

      {loading ? (
        <SkeletonRegion label="Loading leads" className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </SkeletonRegion>
      ) : error ? (
        <LoadFailed
          what="your leads"
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setToken((current) => current + 1);
          }}
        />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No leads yet. Run a Leads campaign: its button opens a short form, and
          what people send you appears here.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
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
    </section>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold break-words text-slate-900 dark:text-slate-100">
          {lead.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <Link
            href={`/campaigns/?id=${lead.campaignId}`}
            className="hover:underline"
          >
            {lead.campaignName}
          </Link>
          {lead.createdAt && ` · ${formatWhen(lead.createdAt)}`}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-1.5 text-sky-600 hover:underline dark:text-sky-400"
          >
            <Phone className="h-4 w-4" aria-hidden />
            {lead.phone}
          </a>
        )}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="inline-flex min-w-0 items-center gap-1.5 break-all text-sky-600 hover:underline dark:text-sky-400"
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {lead.email}
          </a>
        )}
      </div>
      {lead.message && (
        <p className="mt-1.5 text-sm break-words whitespace-pre-line text-slate-700 dark:text-slate-300">
          {lead.message}
        </p>
      )}
    </li>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
