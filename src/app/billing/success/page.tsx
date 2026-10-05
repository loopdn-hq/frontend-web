"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Skeleton, SkeletonRegion } from "@/components/ui";
import { getAccessToken } from "@/lib/auth/client";
import {
  buildTransactionsQuery,
  fetchBillingTransactions,
  formatTransactionAmount,
  receiptHref,
  type BillingTransaction,
  type TransactionKind,
} from "@/lib/billingTransactions";

/** Where the page sends the person once they have seen their receipt. */
const AFTER_PAYMENT_HREF = "/chats/";
const REDIRECT_SECONDS = 10;

// The payment is recorded by Stripe's webhook, a moment after the person is
// back - so the receipt is asked for a few times before giving up on it.
const RECEIPT_ATTEMPTS = 4;
const RECEIPT_RETRY_MS = 2_000;
// Checkout carries nothing back that names the payment, so the receipt is the
// newest payment of the right kind - and only if it was made just now.
// Without this, a webhook that is running late would show last month's
// invoice under "Payment Successful".
const RECEIPT_MAX_AGE_MS = 15 * 60_000;

type ReceiptLookup =
  | { status: "loading" }
  | { status: "found"; receipt: BillingTransaction }
  | { status: "none" }
  // The desktop app opens checkout in the system browser, which may never
  // have signed in. There is no receipt to read and nowhere to redirect to.
  | { status: "signed-out" };

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<BillingSuccessShell />}>
      <BillingSuccessContent />
    </Suspense>
  );
}

function kindForFlow(flow: string): TransactionKind | "all" {
  if (flow === "plan") return "plan_subscription";
  if (flow === "credits") return "credit_purchase";
  return "all";
}

function isJustPaid(row: BillingTransaction): boolean {
  const paidAt = new Date(row.paidAt).getTime();
  return (
    !Number.isNaN(paidAt) && Math.abs(Date.now() - paidAt) < RECEIPT_MAX_AGE_MS
  );
}

function BillingSuccessContent() {
  const router = useRouter();
  const flow = useSearchParams().get("flow") ?? "";
  const kind = kindForFlow(flow);

  const [lookup, setLookup] = useState<ReceiptLookup>({ status: "loading" });
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [stayed, setStayed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const query = buildTransactionsQuery(
      { range: "7d", startDate: "", endDate: "", kind },
      1,
    );

    async function look() {
      if (query === null) return;
      const result = await fetchBillingTransactions(query);
      if (cancelled) return;
      if (!result.ok) {
        setLookup({ status: getAccessToken() ? "none" : "signed-out" });
        return;
      }
      // Newest first from the server, so the first row is the candidate.
      const newest = result.data.transactions[0];
      if (newest && isJustPaid(newest)) {
        setLookup({ status: "found", receipt: newest });
        return;
      }
      attempt += 1;
      if (attempt >= RECEIPT_ATTEMPTS) {
        setLookup({ status: "none" });
        return;
      }
      timer = setTimeout(look, RECEIPT_RETRY_MS);
    }

    look();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind]);

  // The countdown waits for the receipt lookup to settle, so the ten seconds
  // are ten seconds of something to read, not of a loading state.
  const counting =
    !stayed &&
    secondsLeft > 0 &&
    (lookup.status === "found" || lookup.status === "none");

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(
      () => setSecondsLeft((seconds) => seconds - 1),
      1_000,
    );
    return () => clearInterval(timer);
  }, [counting]);

  const due = !stayed && secondsLeft <= 0;
  useEffect(() => {
    if (due) router.replace(AFTER_PAYMENT_HREF);
  }, [due, router]);

  return (
    <BillingSuccessShell>
      {lookup.status === "loading" && (
        <SkeletonRegion
          label="Loading your receipt"
          className="mt-6 space-y-2 rounded-2xl border border-slate-200 p-4"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </SkeletonRegion>
      )}

      {lookup.status === "found" && <Receipt receipt={lookup.receipt} />}

      {lookup.status === "none" && (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Your receipt isn&apos;t ready yet. It will appear under Settings →
          Transactions as soon as Stripe confirms the payment, usually within a
          minute.
        </p>
      )}

      {counting && (
        <p className="mt-4 text-sm text-slate-600">
          Taking you to your chats in{" "}
          <span className="font-semibold text-slate-900">{secondsLeft}</span>{" "}
          {secondsLeft === 1 ? "second" : "seconds"}.{" "}
          <button
            type="button"
            onClick={() => setStayed(true)}
            className="font-semibold text-sky-700 underline-offset-2 hover:underline"
          >
            Stay on this page
          </button>
        </p>
      )}
    </BillingSuccessShell>
  );
}

function Receipt({ receipt }: { receipt: BillingTransaction }) {
  const href = receiptHref(receipt.receiptUrl);
  const paidAt = new Date(receipt.paidAt);
  return (
    <section
      aria-labelledby="receipt-heading"
      className="mt-6 rounded-2xl border border-slate-200 p-4"
    >
      <h2
        id="receipt-heading"
        className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
      >
        Receipt
      </h2>
      <p className="mt-1 text-3xl font-bold text-slate-900">
        {formatTransactionAmount(receipt.amountCents, receipt.currency)}
      </p>
      <dl className="mt-3 divide-y divide-slate-100 text-sm">
        {receipt.description && (
          <ReceiptLine label="Description" value={receipt.description} />
        )}
        <ReceiptLine label="Type" value={receipt.kindLabel} />
        {!Number.isNaN(paidAt.getTime()) && (
          <ReceiptLine
            label="Paid"
            value={paidAt.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
        )}
      </dl>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
        >
          View Stripe receipt
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function BillingSuccessShell({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_25%_20%,#d9f4ff_0%,#eef8ff_40%,#f8fcff_100%)] px-6 py-12 sm:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 text-slate-900 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.22em] text-emerald-700 uppercase">
          Billing
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-emerald-800">
          Payment Successful
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          Your checkout is complete. Plan changes and wallet updates are applied
          after Stripe confirms payment through webhook processing.
        </p>
        {children}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={AFTER_PAYMENT_HREF}
            className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#059669_0%,#0284c7_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.3)] transition hover:brightness-110"
          >
            Go to Chats
          </Link>
          <Link
            href="/settings/#transactions"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View Transactions
          </Link>
        </div>
      </div>
    </div>
  );
}
