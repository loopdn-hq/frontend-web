"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  belongsOnCommercialSite,
  isCommercialDashboardPath,
  isCommercialSite,
} from "@/lib/config/site";

/**
 * Keep each site to its own pages.
 *
 * commercial.loopdn.com and loopdn.com serve the same build, so every route
 * exists on both. On the commercial host, anything that is not the dashboard,
 * a sign-in page or a legal page goes to `/`, the dashboard. On the chat host,
 * the dashboard's pages (/campaigns/, /company/, ...) go to `/`, the homepage.
 *
 * In the browser, after the page has loaded, so the wrong page can show for a
 * moment first. Production can do the same at CloudFront, before any HTML is
 * sent; this is what makes it work on localhost too.
 */
export function CommercialSiteRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const misplaced = isCommercialSite()
      ? !belongsOnCommercialSite(pathname)
      : isCommercialDashboardPath(pathname);
    if (misplaced) router.replace("/");
  }, [pathname, router]);

  return null;
}
