"use client";

import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";

/**
 * /company/ - the COMPANY's details, not the person's.
 *
 * Nothing here should ever edit the User: a commercial account's own sign-in
 * details are not company data, and one person may own several companies.
 */
export default function CommercialCompanyPage() {
  return (
    <>
      <CommercialPageHeader
        title="Company"
        description="What your ads are labelled with, and who runs them"
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <NotBuiltYet
          title="Company profile"
          endpoint="POST /commercial/companies/ · PATCH /commercial/companies/{id}/"
        >
          Name (shown as &ldquo;Sponsored · Name&rdquo; on every ad), website
          and contact email. The first time, this is where the company is
          created.
        </NotBuiltYet>
        <NotBuiltYet
          title="Your companies"
          endpoint="GET /commercial/companies/"
        >
          One person can run several - two shops, or an agency with clients. Add
          another here; each has its own campaigns, balance and billing, and the
          sidebar switches between them.
        </NotBuiltYet>
        <NotBuiltYet title="Team">
          The people who may manage this company&apos;s campaigns - owner,
          manager, analyst (docs/rbac_plan.md, step 9).
        </NotBuiltYet>
      </div>
    </>
  );
}
