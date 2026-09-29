"use client";

import { Fragment, type ReactNode } from "react";

import { CommercialShell } from "@/components/commercial/CommercialShell";
import { CompanyDialogsProvider } from "@/components/commercial/CompanyDialogs";
import { useCompany } from "@/lib/commercial/CompanyProvider";

/**
 * A dashboard page, with the sidebar around it.
 *
 * Having a company is not required to be here. Somebody who has just signed up,
 * or signs in with none yet, gets the dashboard like anybody else; the pages
 * that need a company say so and offer "Create company" (CompanyNotice), and so
 * does the switcher. Both open the one "Create company" modal
 * (CompanyDialogs), which also holds "Companies" - View all companies.
 *
 * The page is keyed by the active company, so switching company starts every
 * page from a clean loading state instead of showing the previous company's
 * data under the new name.
 */
export function CommercialDashboard({ children }: { children: ReactNode }) {
  const { company } = useCompany();

  return (
    <CompanyDialogsProvider>
      <CommercialShell>
        <Fragment key={company?.id ?? "none"}>{children}</Fragment>
      </CommercialShell>
    </CompanyDialogsProvider>
  );
}
