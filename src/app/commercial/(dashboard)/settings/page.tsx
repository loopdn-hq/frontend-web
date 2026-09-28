"use client";

import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";

/**
 * /commercial/settings/ - the COMPANY's details, not the person's.
 *
 * The person's own profile, password and notifications stay at /settings/.
 * Nothing here should ever edit the User.
 */
export default function CommercialSettingsPage() {
  return (
    <>
      <CommercialPageHeader
        title="Company settings"
        description="What your ads are labelled with, and how to reach you"
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <NotBuiltYet
          title="Company profile"
          endpoint="PATCH /promote/advertisers/{id}/"
        >
          Name (shown as &ldquo;Sponsored · Name&rdquo; on every ad), website
          and contact email.
        </NotBuiltYet>
      </div>
    </>
  );
}
