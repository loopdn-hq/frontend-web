"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, ReceiptText, Wallet } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { AddFundsDialog } from "@/components/commercial/AddFundsDialog";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { Alert, Button, Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchTransactions } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { formatCents } from "@/lib/commercial/format";
import type { Company, Transaction } from "@/lib/commercial/types";
import { cn } from "@/lib/ui/cn";

/**
 * /balance/, labelled "Billing" - the company's ad money and its ledger. Not
 * /billing/: that is the chat plans' Stripe return page in the same build.
 *
 * This is NOT /settings/#billing. That page is the person's plan and their
 * Communication Wallet (prepaid SMS/voice credit, billing.Wallet). This is
 * the company's ad money (commercial.Company). Two meanings of "wallet" is how
 * a refund ends up paying for somebody's SMS, so the two never share a
 * component, a type or a word on screen.
 *
 * useSearchParams() (for `?checkout=` on the way back from Stripe) must sit
 * under Suspense or `next build` fails.
 */
export default function CommercialBalancePage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
      <Suspense fallback={<BalanceSkeleton />}>
        <Balance />
      </Suspense>
    </div>
  );
}

function Balance() {
  const { company, reload } = useCompany();
  const checkout = useSearchParams().get("checkout");
  const [adding, setAdding] = useState(false);

  // The balance moves on Stripe's webhook, a moment after the person is back:
  // read it fresh on arrival, and again shortly after a payment.
  useEffect(() => {
    reload();
    if (checkout !== "success") return;
    const timers = [3_000, 8_000].map((delay) => setTimeout(reload, delay));
    return () => timers.forEach(clearTimeout);
    // `reload` is stable for the page's life; run once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  return (
    <>
      <CommercialPageHeader
        title="Billing"
        description="Your company's ad money: add funds, and see where it went."
        actions={
          company && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add funds
            </Button>
          )
        }
      />
      <CompanyNotice />

      {checkout === "success" && (
        <Alert variant="success">
          Payment received. Your balance updates as soon as Stripe confirms it,
          usually within a minute.
        </Alert>
      )}
      {checkout === "cancelled" && (
        <Alert variant="info">Payment cancelled. Nothing was charged.</Alert>
      )}

      {company && (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <Bucket
              icon={Wallet}
              label="Available"
              value={formatCents(company.balanceCents, company.currency)}
              note="Free to use for a new campaign."
              strong
            />
            <Bucket
              icon={ReceiptText}
              label="Set aside"
              value={formatCents(company.reservedCents, company.currency)}
              note="Committed to submitted campaigns and not spent yet. Unspent money comes back when a campaign is withdrawn or ends."
            />
          </section>

          {/* Keyed by company: a switch starts the ledger afresh. */}
          <Ledger key={company.id} company={company} />

          <AddFundsDialog
            company={company}
            isOpen={adding}
            onClose={() => setAdding(false)}
          />
        </>
      )}
    </>
  );
}

function Bucket({
  icon: Icon,
  label,
  value,
  note,
  strong = false,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  note: string;
  strong?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border p-4",
        strong
          ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
      )}
    >
      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
    </article>
  );
}

/** Every movement of the company's money, newest first, twenty at a time. */
function Ledger({ company }: { company: Company }) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [token, setToken] = useState(0);

  // Read again whenever the balances move, so a credit that just arrived
  // shows its row too.
  const balances = `${company.balanceCents}:${company.reservedCents}`;

  useEffect(() => {
    let cancelled = false;
    fetchTransactions(company.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setRows(result.data.transactions);
        setHasMore(result.data.hasMore);
        setPage(1);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [company.id, balances, token]);

  async function loadMore() {
    setLoadingMore(true);
    const result = await fetchTransactions(company.id, page + 1);
    setLoadingMore(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPage(page + 1);
    setHasMore(result.data.hasMore);
    setRows((current) => [
      ...current,
      ...result.data.transactions.filter(
        (row) => !current.some((shown) => shown.id === row.id),
      ),
    ]);
  }

  const money = (cents: number) => formatCents(cents, company.currency);
  const signed = (cents: number) =>
    cents > 0 ? `+${money(cents)}` : cents < 0 ? `−${money(-cents)}` : "";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
        Transactions
      </h2>
      {loading ? (
        <SkeletonRegion label="Loading transactions" className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </SkeletonRegion>
      ) : error ? (
        <div className="p-4">
          <LoadFailed
            what="your transactions"
            message={error}
            onRetry={() => {
              setError(null);
              setToken((current) => current + 1);
            }}
          />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          No money has moved yet. Add funds to start a campaign.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {row.label}
                    {row.campaignId !== null && (
                      <>
                        {" · "}
                        <Link
                          href={`/campaigns/?id=${row.campaignId}`}
                          className="text-sky-600 hover:underline dark:text-sky-400"
                        >
                          {row.campaignName}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatWhen(row.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  {row.availableChangeCents !== 0 && (
                    <p
                      className={cn(
                        "font-semibold",
                        row.availableChangeCents > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-900 dark:text-slate-100",
                      )}
                    >
                      {signed(row.availableChangeCents)}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Available {money(row.availableAfterCents)} · Set aside{" "}
                    {money(row.reservedAfterCents)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="flex justify-center border-t border-slate-100 p-3 dark:border-slate-800">
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

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function BalanceSkeleton() {
  return (
    <SkeletonRegion label="Loading billing" className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-48" />
    </SkeletonRegion>
  );
}
