"use client";

import { CommercialDashboard } from "@/components/commercial/CommercialDashboard";
import { CommercialFrame } from "@/components/commercial/CommercialFrame";
import { CommercialOverview } from "@/components/commercial/CommercialOverview";
import { MarketingHome } from "@/components/site/MarketingHome";
import { useIsAdminSite, useIsCommercialSite } from "@/lib/config/site";

/**
 * `/` is two pages in one build: loopdn.com's homepage, and the commercial
 * dashboard's overview on commercial.loopdn.com. On admin.loopdn.com it is
 * nothing: SiteRedirect moves it to /admin/, and the homepage should not
 * flash on the staff site meanwhile.
 *
 * The exported HTML is always the homepage - it is rendered at build time,
 * with no hostname - so the homepage stays whole for anybody reading the page
 * as served. On the commercial host the dashboard replaces it once the page is
 * running, which can show the homepage for a moment first; CloudFront can
 * serve the dashboard straight away in production.
 *
 * The one file outside the commercial area allowed to import from it
 * (eslint.config.mjs): this is where the two sites meet.
 */
export default function RootPage() {
  const commercialSite = useIsCommercialSite();
  const adminSite = useIsAdminSite();

  if (adminSite) return null;

  if (commercialSite) {
    return (
      <CommercialFrame>
        <CommercialDashboard>
          <CommercialOverview />
        </CommercialDashboard>
      </CommercialFrame>
    );
  }

  return <MarketingHome />;
}
