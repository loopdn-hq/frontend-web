"use client";

import { NewCampaignLink } from "@/components/commercial/NewCampaignLink";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { Alert } from "@/components/ui";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { COMPANY_STATUS_LABEL, formatCents } from "@/lib/commercial/format";

/** /commercial/ - the first thing a company sees. */
export default function CommercialOverviewPage() {
  const { company } = useCompany();

  return (
    <>
      <CommercialPageHeader
        title="Overview"
        description={`How ${company.name} is doing`}
        actions={<NewCampaignLink />}
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        {company.status === "pending" && (
          <Alert variant="info">
            Loopd&apos;n is reviewing your company. You can build campaigns now;
            none will run until the review is done.
          </Alert>
        )}
        {company.status === "suspended" && (
          <Alert variant="error">
            This company is suspended, so none of its campaigns are running.
            Contact support to find out why.
          </Alert>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Ad balance"
            value={formatCents(company.balanceCents)}
          />
          <StatCard
            label="Company status"
            value={COMPANY_STATUS_LABEL[company.status]}
          />
          <StatCard label="Running campaigns" value="—" />
        </section>

        <NotBuiltYet
          title="Performance, last 30 days"
          endpoint="GET /promote/advertisers/{id}/report/"
        >
          Delivered, reach, clicks, calls, texts and cost per result, summed
          across this company&apos;s campaigns. Aggregates only; small
          breakdowns come back suppressed, never as a number.
        </NotBuiltYet>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </article>
  );
}
