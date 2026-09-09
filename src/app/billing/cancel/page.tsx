"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function BillingCancelPage() {
  const [flow, setFlow] = useState("");
  const [plan, setPlan] = useState("");
  const [packageId, setPackageId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFlow(params.get("flow") ?? "");
    setPlan(params.get("plan") ?? "");
    setPackageId(params.get("package") ?? "");
  }, []);

  const detailMessage =
    flow === "plan" && plan
      ? `Selected plan was ${plan.toUpperCase()}.`
      : flow === "credits" && packageId
        ? `Selected credit package was ${packageId}.`
        : "";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_25%_20%,#ffe8de_0%,#fff4ef_40%,#fffaf8_100%)] px-6 py-12 sm:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-slate-900 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-700 uppercase">
          Billing
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-amber-800">
          Checkout Cancelled
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          No payment was completed. You can review plans and restart checkout at
          any time from your billing settings.
        </p>
        {detailMessage && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            {detailMessage}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings/"
            className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#d97706_0%,#ea580c_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,119,6,0.3)] transition hover:brightness-110"
          >
            Back to Billing Settings
          </Link>
          <Link
            href="/pricing/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
