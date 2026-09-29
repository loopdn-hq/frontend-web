"use client";

import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";

/**
 * /reports/, labelled "Analytics" - how the company's campaigns are doing, all
 * of them at once. Not /analytics/: that is a chat page in the same build.
 *
 * Aggregates only, ever. A breakdown row covering too few members comes back
 * suppressed rather than as a number, or a narrow slice would be a member
 * count for one identifiable group (advertising plan, 2d).
 */
export default function CommercialReportsPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
        <CommercialPageHeader
          title="Analytics"
          description="How your campaigns are performing"
        />
        <CompanyNotice />
        <NotBuiltYet
          title="Performance over time"
          endpoint="GET /commercial/companies/{id}/report/"
        >
          Delivered, reach, clicks, calls, texts and conversions, day by day,
          across every campaign.
        </NotBuiltYet>
        <NotBuiltYet
          title="By campaign"
          endpoint="GET /commercial/campaigns/{id}/report/"
        >
          Spend and cost per result for each campaign, side by side.
        </NotBuiltYet>
        <NotBuiltYet title="By group category and region">
          Where your results came from, in aggregate only: small slices come
          back suppressed, never as a number.
        </NotBuiltYet>
      </div>
    </>
  );
}
