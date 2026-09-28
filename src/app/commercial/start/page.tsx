"use client";

import Link from "next/link";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";

/**
 * /commercial/start/ - where a Loopd'n user creates their company.
 *
 * Outside (dashboard)/ because the person arriving here usually has no
 * `ads.access` and no company yet, which are exactly what that layout
 * requires. The dashboard sends anyone missing either one here.
 *
 * Creating a company never means a second account: the company is owned
 * by the account already signed in (backend docs/rbac_plan.md).
 */
export default function CommercialStartPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-600 uppercase">
            Loopd&apos;n Commercial
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Advertise to local groups
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Tell us about your company. Loopd&apos;n reviews it before any of
            your campaigns run.
          </p>
        </div>

        <NotBuiltYet
          title="Create your company"
          endpoint="POST /promote/advertisers/"
        >
          Company name, website and contact email. On success the server adds
          the advertiser role to this account, and this page sends you to
          /commercial/.
        </NotBuiltYet>

        <Link
          href="/chats/"
          className="inline-block text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Back to chats
        </Link>
      </div>
    </div>
  );
}
