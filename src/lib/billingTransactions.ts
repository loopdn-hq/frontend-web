// What the signed-in person has paid: plan subscriptions, Enterprise plan
// payments and credit top-ups. Money paid only - wallet usage (credits spent
// on SMS) is a different ledger and is not in this list.

import {
  apiRequest,
  asNumber,
  asText,
  isObject,
  isPresent,
  pageInfo,
  rowsOf,
  type ApiResult,
} from "@/lib/api/envelope";

export type TransactionRange = "7d" | "15d" | "30d" | "custom";

export type TransactionKind =
  "plan_subscription" | "enterprise_plan" | "credit_purchase";

export type TransactionFilters = {
  range: TransactionRange;
  /** YYYY-MM-DD, or "" while unpicked. Only read when the range is custom. */
  startDate: string;
  endDate: string;
  kind: TransactionKind | "all";
};

export type BillingTransaction = {
  id: number;
  kind: string;
  kindLabel: string;
  amountCents: number;
  currency: string;
  description: string;
  /** Stripe's hosted invoice or receipt page; "" when there is none. */
  receiptUrl: string;
  paidAt: string;
};

export type BillingTransactionPage = {
  transactions: BillingTransaction[];
  count: number;
  hasMore: boolean;
};

/** The API's own names for the filters, which is how a 400 keys its errors. */
export type TransactionField = "range" | "start_date" | "end_date" | "kind";

export type TransactionFieldErrors = Partial<Record<TransactionField, string>>;

const TRANSACTION_FIELDS: TransactionField[] = [
  "range",
  "start_date",
  "end_date",
  "kind",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD on the person's own calendar, not UTC's. */
export function todayIsoDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * What is wrong with a custom range that has both dates, keyed like the
 * server's own errors so either can sit beside the same control.
 *
 * A missing date is not an error - the person is still choosing - so it is
 * reported by `buildTransactionsQuery` returning null, not here. YYYY-MM-DD
 * compares correctly as text, which is all the comparisons below rely on.
 */
export function customRangeErrors(
  filters: TransactionFilters,
  today = todayIsoDate(),
): TransactionFieldErrors {
  const errors: TransactionFieldErrors = {};
  if (filters.range !== "custom") return errors;

  const { startDate, endDate } = filters;
  if (startDate && startDate > today) {
    errors.start_date = "The start date can't be in the future.";
  }
  if (endDate && endDate > today) {
    errors.end_date = "The end date can't be in the future.";
  } else if (startDate && endDate && endDate < startDate) {
    errors.end_date = "The end date can't be before the start date.";
  }
  return errors;
}

/**
 * The query string for one page, or null when nothing should be sent: a
 * custom range with a date missing, malformed, reversed or in the future.
 */
export function buildTransactionsQuery(
  filters: TransactionFilters,
  page = 1,
  today = todayIsoDate(),
): string | null {
  const params = new URLSearchParams({ range: filters.range });

  if (filters.range === "custom") {
    const { startDate, endDate } = filters;
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) return null;
    if (Object.keys(customRangeErrors(filters, today)).length > 0) return null;
    params.set("start_date", startDate);
    params.set("end_date", endDate);
  }

  if (filters.kind !== "all") params.set("kind", filters.kind);
  params.set("page", String(page));
  return params.toString();
}

function normalizeTransaction(item: unknown): BillingTransaction | null {
  if (!isObject(item) || typeof item.id !== "number") return null;
  const kind = asText(item.kind);
  return {
    id: item.id,
    kind,
    kindLabel: asText(item.kind_label, kind),
    amountCents: asNumber(item.amount_cents),
    currency: asText(item.currency),
    description: asText(item.description),
    receiptUrl: asText(item.receipt_url),
    paidAt: asText(item.paid_at),
  };
}

/** Only the filters' own keys: anything else has no control to sit beside. */
function transactionFieldErrors(
  errors: Record<string, string> | undefined,
): TransactionFieldErrors | undefined {
  if (!errors) return undefined;
  const known: TransactionFieldErrors = {};
  for (const field of TRANSACTION_FIELDS) {
    if (errors[field]) known[field] = errors[field];
  }
  return Object.keys(known).length > 0 ? known : undefined;
}

/**
 * One page of payments for a query from `buildTransactionsQuery`, newest
 * first as the server sent them.
 */
export async function fetchBillingTransactions(
  query: string,
): Promise<ApiResult<BillingTransactionPage>> {
  const result = await apiRequest(
    `/billing/transactions/?${query}`,
    {},
    "Couldn't load your transactions.",
  );
  if (!result.ok) {
    return {
      ...result,
      fieldErrors: transactionFieldErrors(result.fieldErrors),
    };
  }

  const transactions = rowsOf(result.data)
    .map(normalizeTransaction)
    .filter(isPresent);
  return {
    ok: true,
    data: { transactions, ...pageInfo(result.data, transactions.length) },
  };
}

/**
 * An amount in the row's own currency. `amountCents` is the smallest unit of
 * that currency, which is not always a hundredth - yen has no minor unit - so
 * the divisor comes from the currency rather than being assumed.
 */
export function formatTransactionAmount(
  amountCents: number,
  currency: string,
  locale?: string,
): string {
  try {
    const format = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(amountCents / 10 ** digits);
  } catch {
    // A code Intl does not know. Still the right number, labelled as sent.
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`.trim();
  }
}

/** Stripe's page, and nothing that is not a web address. */
export function receiptHref(receiptUrl: string): string | null {
  return /^https?:\/\//i.test(receiptUrl) ? receiptUrl : null;
}
