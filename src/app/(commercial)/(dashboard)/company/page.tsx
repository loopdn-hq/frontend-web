"use client";

import { CompanyForm } from "@/components/commercial/CompanyForm";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { CompanyStatusBadge } from "@/components/commercial/StatusBadge";
import { Alert, Skeleton, SkeletonRegion, useToast } from "@/components/ui";
import { useCompany } from "@/lib/commercial/CompanyProvider";

/**
 * /company/ - the active company's details, not the person's.
 *
 * Edits the company the sidebar has open; switching between companies is the
 * switcher's job, not this page's. Nothing here should ever edit the User: a
 * commercial account's own sign-in details are under Settings.
 */
export default function CommercialCompanyPage() {
  const { company, status, update } = useCompany();
  const toast = useToast();

  return (
    <>
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <CommercialPageHeader
          title="Company"
          description={
            company
              ? `${company.name} - what your ads are labelled with`
              : "What your ads are labelled with"
          }
        />
        <CompanyNotice />

        {company?.status === "suspended" && (
          <Alert variant="error">
            This company is suspended, so none of its campaigns are running.
            Contact support to find out why.
          </Alert>
        )}

        {company ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Company details
              </h2>
              <CompanyStatusBadge status={company.status} />
            </div>
            <CompanyForm
              company={company}
              submitLabel="Save changes"
              onSaved={(saved) => {
                update(saved);
                toast({
                  title: "Changes saved",
                  description: `${saved.name}'s details are up to date.`,
                });
              }}
            />
          </section>
        ) : (
          status === "loading" && (
            <SkeletonRegion label="Loading your company" className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </SkeletonRegion>
          )
        )}

        <NotBuiltYet title="Team">
          The people who may manage this company&apos;s campaigns - owner,
          manager, analyst (docs/rbac_plan.md, step 9).
        </NotBuiltYet>
      </div>
    </>
  );
}
