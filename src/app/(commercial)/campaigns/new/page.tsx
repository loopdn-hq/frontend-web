"use client";

import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";

/**
 * /campaigns/new/ - the campaign builder.
 *
 * The steps are §11's, in its order. When this is built, each step is its own
 * component under components/commercial/builder/, and this page only holds which
 * step is showing - the enterprise builder is the pattern to follow.
 */
export default function CommercialNewCampaignPage() {
  return (
    <>
      <CommercialPageHeader
        title="New campaign"
        description="Build it now; it runs once it passes review."
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <NotBuiltYet
          title="Campaign builder"
          endpoint="POST /commercial/campaigns/"
        >
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>
              Objective - calls, texts, website visits, leads, bookings or group
              joins
            </li>
            <li>Where - country or state</li>
            <li>Which groups - by category and size</li>
            <li>Estimated reach - a range, never an exact count</li>
            <li>Budget - total, optional daily cap, dates, pacing</li>
            <li>Creative - headline, body, image</li>
            <li>Call to action - and submit for review</li>
          </ol>
        </NotBuiltYet>
      </div>
    </>
  );
}
