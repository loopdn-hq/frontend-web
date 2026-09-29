"use client";

import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NewCampaignLink } from "@/components/commercial/NewCampaignLink";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { Alert } from "@/components/ui";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { COMPANY_STATUS_LABEL, formatCents } from "@/lib/commercial/format";

/**
 * The commercial site's home page, at `/`: the first thing a company sees.
 *
 * A component rather than a route, because `/` is also loopdn.com's homepage
 * in the same build - src/app/page.tsx picks between the two by hostname.
 */
export function CommercialOverview() {
  const { company } = useCompany();

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <CommercialPageHeader
          title="Overview"
          description={
            company
              ? `How ${company.name} is doing`
              : "Your advertising at a glance"
          }
          actions={<NewCampaignLink />}
        />
        <CompanyNotice />
        {company?.status === "suspended" && (
          <Alert variant="error">
            This company is suspended, so none of its campaigns are running.
            Contact support to find out why.
          </Alert>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Ad balance"
            value={
              company
                ? formatCents(company.balanceCents, company.currency)
                : "—"
            }
          />
          <StatCard
            label="Company status"
            value={company ? COMPANY_STATUS_LABEL[company.status] : "—"}
          />
          <StatCard label="Running campaigns" value="—" />
        </section>

        <NotBuiltYet
          title="Performance, last 30 days"
          endpoint="GET /commercial/companies/{id}/report/"
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
