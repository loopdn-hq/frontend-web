"use client";

import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { useAuth } from "@/lib/auth/client";

/**
 * /account/, labelled "Settings" - the signed-in PERSON's settings, not the
 * company's. Company details are at /company/, because one person may own
 * several companies. Not /settings/: that is a chat page in the same build.
 */
export default function CommercialAccountPage() {
  const { session } = useAuth();

  return (
    <>
      <CommercialPageHeader
        title="Settings"
        description="Your sign-in details and notifications"
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <NotBuiltYet title="Sign-in">
          Your email, username ({session}) and password.
        </NotBuiltYet>
        <NotBuiltYet title="Notifications">
          Emails about your campaigns: a review result, a campaign starting or
          ending, a balance running low.
        </NotBuiltYet>
      </div>
    </>
  );
}
