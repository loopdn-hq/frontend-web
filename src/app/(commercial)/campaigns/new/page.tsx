"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  BuilderSkeleton,
  CampaignBuilder,
} from "@/components/commercial/builder/CampaignBuilder";
import { isStepKey } from "@/components/commercial/builder/steps";
import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { useCompany } from "@/lib/commercial/CompanyProvider";

/**
 * /campaigns/new/ - the campaign builder. `?id=12&step=audience` resumes a
 * draft at a step; with no id it starts a new one.
 *
 * A query string, not /campaigns/12/edit/: this is a static export. And
 * useSearchParams() must sit under Suspense or `next build` fails - the page
 * is prerendered with no query string at all.
 */
export default function CommercialNewCampaignPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <Suspense fallback={<BuilderSkeleton />}>
        <BuilderFromQuery />
      </Suspense>
    </div>
  );
}

function BuilderFromQuery() {
  const params = useSearchParams();
  const { company } = useCompany();

  const id = Number(params.get("id"));
  const campaignId = Number.isInteger(id) && id > 0 ? id : null;
  const rawStep = params.get("step");
  const step = isStepKey(rawStep) ? rawStep : "objective";

  return (
    <>
      {/* Back to the draft in the list when editing one, else to the list. */}
      <Link
        href={campaignId ? `/campaigns/?id=${campaignId}` : "/campaigns/"}
        className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to campaigns
      </Link>
      <CommercialPageHeader
        title={campaignId ? "Edit campaign" : "New campaign"}
        description="Build it now; it runs once it passes review."
      />
      {/* A campaign belongs to a company: without one, say so first. */}
      <CompanyNotice />
      {company && (
        <CampaignBuilder
          campaignId={campaignId}
          step={step}
          company={company}
        />
      )}
    </>
  );
}
