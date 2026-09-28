"use client";

import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";

/**
 * /leads/ - people who got in touch because of an ad.
 *
 * Only what a person CHOSE to send this company: a call or a text to a
 * campaign's tracking number, or a form they filled in. Never who saw an ad or
 * who clicked one - the platform knows that, and §13 of the product plan says
 * it stays with the platform.
 */
export default function CommercialLeadsPage() {
  return (
    <>
      <CommercialPageHeader
        title="Leads"
        description="People who contacted you through your campaigns"
      />
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
        <CompanyNotice />
        <NotBuiltYet
          title="Calls and texts"
          endpoint="GET /commercial/companies/{id}/leads/"
        >
          Calls and texts to each campaign&apos;s tracking number: when, which
          campaign, and for a call how long it lasted.
        </NotBuiltYet>
        <NotBuiltYet title="Form entries">
          What people sent through a lead or booking form in your ad - only what
          they typed in and chose to send.
        </NotBuiltYet>
      </div>
    </>
  );
}
