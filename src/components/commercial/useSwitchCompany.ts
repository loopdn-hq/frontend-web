"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useCompany } from "@/lib/commercial/CompanyProvider";
import type { Company } from "@/lib/commercial/types";

/**
 * Pages that belong to one company - a single campaign, or the campaign
 * builder. When the active company changes under them, they go to the new
 * company's campaign list rather than show the old company's page.
 */
export function belongsToOneCompany(pathname: string): boolean {
  return (
    pathname.startsWith("/campaign/") || pathname.startsWith("/campaigns/new")
  );
}

/**
 * Switch the active company, from anywhere: the dropdown or the Companies
 * dialog. Keeps the section - Campaigns stays Campaigns - except on a page
 * that belongs to the company being left. Resolves to the new active company,
 * or null when the switch failed.
 */
export function useSwitchCompany(): (id: number) => Promise<Company | null> {
  const router = useRouter();
  const pathname = usePathname();
  const { switchTo } = useCompany();

  return useCallback(
    async (id: number) => {
      if (belongsToOneCompany(pathname)) router.push("/campaigns/");
      return switchTo(id);
    },
    [pathname, router, switchTo],
  );
}
