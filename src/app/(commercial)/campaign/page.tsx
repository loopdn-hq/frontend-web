"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CampaignDetailSkeleton } from "@/components/commercial/CampaignDetail";

/**
 * /campaign/?id=12 - the old address of one campaign. A campaign now opens
 * beside the list, at /campaigns/?id=12; this only forwards there, so a link
 * or bookmark made before still lands on it.
 *
 * useSearchParams() must sit under Suspense or `next build` fails.
 */
export default function CommercialCampaignRedirectPage() {
  return (
    <Suspense fallback={<CampaignDetailSkeleton />}>
      <Forward />
    </Suspense>
  );
}

function Forward() {
  const router = useRouter();
  const id = Number(useSearchParams().get("id"));

  useEffect(() => {
    router.replace(
      Number.isInteger(id) && id > 0 ? `/campaigns/?id=${id}` : "/campaigns/",
    );
  }, [id, router]);

  return <CampaignDetailSkeleton />;
}
