"use client";

import { AdminPageHeader } from "@/components/admin/AdminShell";

/**
 * /admin/campaigns/ - campaign review. Its place on the admin site, ahead of
 * slice 2 of backend/docs/campaigns_final_plan.md, which builds it. It says
 * plainly what will be here and what it waits on, rather than mocking a queue.
 */
export default function AdminCampaignReviewPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <AdminPageHeader
        title="Campaign review"
        description="Campaigns companies have submitted, waiting for Loopd'n to approve them."
      />

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          The review queue
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>Every campaign waiting for review, oldest first.</li>
          <li>
            Each one&apos;s audience, budget, creatives and where their buttons
            go, with the automatic checks&apos; results.
          </li>
          <li>
            Approve, or reject with notes the company sees. Rejecting returns
            its reserved budget.
          </li>
        </ul>
        <p className="mt-3 font-mono text-xs text-slate-500">
          Needs GET /commercial/review/campaigns/ · POST
          /commercial/campaigns/&#123;id&#125;/approve/ · reject/ - behind
          platform.campaign.review
        </p>
        <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
          Not built yet. Until it is, a campaign is approved for testing by hand
          in the database.
        </p>
      </section>
    </div>
  );
}
