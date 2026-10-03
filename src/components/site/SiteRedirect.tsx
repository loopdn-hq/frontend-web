"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  adminSiteUrl,
  belongsOnAdminSite,
  belongsOnCommercialSite,
  isAdminPath,
  isAdminSite,
  isCommercialDashboardPath,
  isCommercialSite,
} from "@/lib/config/site";

/**
 * Keep each site to its own pages.
 *
 * loopdn.com, commercial.loopdn.com and admin.loopdn.com serve the same
 * build, so every route exists on all three:
 *
 *   admin host       anything but /admin/..., signing in or a legal page
 *                    goes to /admin/, the admin overview
 *   commercial host  anything but the dashboard, signing in or a legal page
 *                    goes to `/`, the dashboard
 *   chat host        the dashboard's pages (/campaigns/, ...) go to `/`, the
 *                    homepage; /admin/... goes to the same page on the admin
 *                    site, so an old link or the chat menu's Permissions item
 *                    still lands where it meant to
 *
 * In the browser, after the page has loaded, so the wrong page can show for a
 * moment first. Production can do the same at CloudFront, before any HTML is
 * sent; this is what makes it work on localhost too.
 */
export function SiteRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAdminSite()) {
      if (!belongsOnAdminSite(pathname)) router.replace("/admin/");
      return;
    }
    if (isCommercialSite()) {
      if (!belongsOnCommercialSite(pathname)) router.replace("/");
      return;
    }
    if (isAdminPath(pathname)) {
      // Another origin: a full page load, with the query kept.
      window.location.replace(adminSiteUrl(pathname + window.location.search));
      return;
    }
    if (isCommercialDashboardPath(pathname)) router.replace("/");
  }, [pathname, router]);

  return null;
}
