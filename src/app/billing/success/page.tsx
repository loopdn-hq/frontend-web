"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<BillingSuccessShell />}>
      <BillingSuccessContent />
    </Suspense>
  );
}

function BillingSuccessContent() {
  const searchParams = useSearchParams();
  const flow = searchParams.get("flow") ?? "";
  const plan = searchParams.get("plan") ?? "";
  const packageId = searchParams.get("package") ?? "";

  const detailMessage =
    flow === "plan" && plan
      ? `Selected plan: ${plan.toUpperCase()}.`
      : flow === "credits" && packageId
        ? `Credit package: ${packageId}.`
        : "";

  return <BillingSuccessShell detailMessage={detailMessage} />;
}

function BillingSuccessShell({
  detailMessage = "",
}: {
  detailMessage?: string;
}) {
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
        {detailMessage && (
          <p className="mt-2 text-xs font-medium text-emerald-700">
            {detailMessage}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings/"
            className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#059669_0%,#0284c7_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.3)] transition hover:brightness-110"
          >
            Back to Billing Settings
          </Link>
          <Link
            href="/chats/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go to Chats
          </Link>
        </div>
      </div>
    </div>
  );
}
