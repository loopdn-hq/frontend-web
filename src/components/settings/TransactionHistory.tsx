"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import {
  Button,
  Field,
  Input,
  Select,
  Skeleton,
  SkeletonRegion,
  type SelectOption,
} from "@/components/ui";
import {
  buildTransactionsQuery,
  customRangeErrors,
  fetchBillingTransactions,
  formatTransactionAmount,
  receiptHref,
  todayIsoDate,
  type BillingTransaction,
  type TransactionFieldErrors,
  type TransactionFilters,
  type TransactionKind,
  type TransactionRange,
} from "@/lib/billingTransactions";
import { cn } from "@/lib/ui/cn";

const RANGE_OPTIONS: SelectOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "15d", label: "Last 15 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
];

const KIND_OPTIONS: SelectOption[] = [
  { value: "all", label: "All" },
  { value: "plan_subscription", label: "Plan subscription" },
  { value: "enterprise_plan", label: "Enterprise plan" },
  { value: "credit_purchase", label: "Credit purchase" },
];

const DEFAULT_FILTERS: TransactionFilters = {
  range: "7d",
  startDate: "",
  endDate: "",
  kind: "all",
};

/**
 * What came back, and for which request. `key` is the whole point: a result
 * is only ever shown while its key matches the filters on screen, so an
 * answer to a question nobody is asking any more is simply never rendered -
 * whichever order the responses land in.
 */
type Loaded =
  | {
      key: string;
      ok: true;
      rows: BillingTransaction[];
      count: number;
      hasMore: boolean;
      page: number;
      moreError: string | null;
    }
  | {
      key: string;
      ok: false;
      message: string;
      fieldErrors: TransactionFieldErrors;
    };

// One template for the header and every row, so the columns cannot drift.
// Below `sm` there is no grid at all: each payment is a short stacked block.
const COLUMNS =
  "sm:grid sm:grid-cols-[9.5rem_minmax(0,1fr)_9rem_6.5rem_4.5rem] sm:items-center sm:gap-3";

/**
 * Money the signed-in person has paid - plan subscriptions, Enterprise plan
 * payments and credit top-ups - newest first, twenty at a time.
 *
 * Not wallet usage: credits spent on SMS are a different ledger.
 */
export function TransactionHistory() {
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);

  const today = todayIsoDate();
  // Null while a custom range is incomplete or wrong: nothing is sent.
  const query = buildTransactionsQuery(filters, 1, today);
  // Every filter is in the query, so a change of any of them is a new key and
  // a fresh first page. `attempt` makes a retry a new key too.
  const key = query === null ? null : `${query}#${attempt}`;

  useEffect(() => {
    if (query === null || key === null) return;
    let cancelled = false;
    fetchBillingTransactions(query).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? {
              key,
              ok: true,
              rows: result.data.transactions,
              count: result.data.count,
              hasMore: result.data.hasMore,
              page: 1,
              moreError: null,
            }
          : {
              key,
              ok: false,
              message: result.message,
              fieldErrors: result.fieldErrors ?? {},
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [query, key]);

  // Null with a key means the request for these filters is still out.
  const current = loaded !== null && loaded.key === key ? loaded : null;
  const isLoadingMore = key !== null && loadingMoreKey === key;

  // The client's own complaint wins over the server's for the same control:
  // it is about what is in the box right now.
  const fieldErrors: TransactionFieldErrors = {
    ...(current && !current.ok ? current.fieldErrors : {}),
    ...customRangeErrors(filters, today),
  };
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  function change(patch: Partial<TransactionFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
  }

  async function loadMore() {
    if (key === null || !current?.ok) return;
    const page = current.page + 1;
    const nextQuery = buildTransactionsQuery(filters, page, today);
    if (nextQuery === null) return;

    setLoadingMoreKey(key);
    const result = await fetchBillingTransactions(nextQuery);
    setLoadingMoreKey((pending) => (pending === key ? null : pending));
    // Appended only to the list it was asked for. If the filters moved on
    // while this was in the air, `shown.key` is no longer ours and it is
    // dropped.
    setLoaded((shown) => {
      if (!shown || !shown.ok || shown.key !== key) return shown;
      if (!result.ok) return { ...shown, moreError: result.message };
      return {
        ...shown,
        page,
        count: result.data.count,
        hasMore: result.data.hasMore,
        moreError: null,
        rows: [
          ...shown.rows,
          ...result.data.transactions.filter(
            (row) => !shown.rows.some((existing) => existing.id === row.id),
          ),
        ],
      };
    });
  }

  return (
    <section
      aria-labelledby="transaction-history-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <h3
        id="transaction-history-heading"
        className="font-medium text-slate-900 dark:text-slate-100"
      >
        Transactions
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Payments for your plan and credit top-ups.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          label="Period"
          htmlFor="transactions-range"
          error={fieldErrors.range}
        >
          <Select
            id="transactions-range"
            value={filters.range}
            state={fieldErrors.range ? "error" : "default"}
            options={RANGE_OPTIONS}
            onChange={(event) =>
              change({ range: event.target.value as TransactionRange })
            }
          />
        </Field>
        <Field
          label="Payment type"
          htmlFor="transactions-kind"
          error={fieldErrors.kind}
        >
          <Select
            id="transactions-kind"
            value={filters.kind}
            state={fieldErrors.kind ? "error" : "default"}
            options={KIND_OPTIONS}
            onChange={(event) =>
              change({ kind: event.target.value as TransactionKind | "all" })
            }
          />
        </Field>

        {filters.range === "custom" && (
          <>
            <Field
              label="Start date"
              htmlFor="transactions-start"
              error={fieldErrors.start_date}
            >
              <Input
                id="transactions-start"
                type="date"
                value={filters.startDate}
                max={filters.endDate || today}
                state={fieldErrors.start_date ? "error" : "default"}
                onChange={(event) => change({ startDate: event.target.value })}
              />
            </Field>
            <Field
              label="End date"
              htmlFor="transactions-end"
              error={fieldErrors.end_date}
            >
              <Input
                id="transactions-end"
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                max={today}
                state={fieldErrors.end_date ? "error" : "default"}
                onChange={(event) => change({ endDate: event.target.value })}
              />
            </Field>
          </>
        )}
      </div>

      <div className="mt-4">
        {key === null ? (
          <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
            {hasFieldErrors
              ? "Fix the dates above to see your transactions."
              : "Choose a start and an end date to see your transactions."}
          </p>
        ) : current === null ? (
          <SkeletonRegion label="Loading transactions" className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </SkeletonRegion>
        ) : !current.ok ? (
          hasFieldErrors ? (
            <p
              role="alert"
              className="py-4 text-sm text-slate-500 dark:text-slate-400"
            >
              Fix the highlighted filter to see your transactions.
            </p>
          ) : (
            <LoadFailed
              what="your transactions"
              message={current.message}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          )
        ) : current.rows.length === 0 ? (
          <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
            No transactions in this period.
          </p>
        ) : (
          <>
            <div
              aria-hidden
              className={cn(
                "hidden border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400",
                COLUMNS,
              )}
            >
              <span>Date</span>
              <span>Description</span>
              <span>Type</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Receipt</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {current.rows.map((row) => (
                <TransactionRow key={row.id} row={row} />
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing {current.rows.length} of{" "}
                {Math.max(current.count, current.rows.length)}
              </p>
              {current.hasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Load more
                </Button>
              )}
            </div>
            {current.moreError && (
              <p role="alert" className="mt-2 text-xs text-rose-600">
                {current.moreError}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TransactionRow({ row }: { row: BillingTransaction }) {
  const href = receiptHref(row.receiptUrl);
  return (
    <li className={cn("space-y-0.5 py-3 text-sm sm:space-y-0", COLUMNS)}>
      <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
        {formatWhen(row.paidAt)}
      </p>
      <p className="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">
        {row.description || "—"}
      </p>
      <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
        {row.kindLabel}
      </p>
      <p className="font-semibold text-slate-900 sm:text-right dark:text-slate-100">
        {formatTransactionAmount(row.amountCents, row.currency)}
      </p>
      <p className="sm:text-right">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
          >
            Receipt
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </p>
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
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
