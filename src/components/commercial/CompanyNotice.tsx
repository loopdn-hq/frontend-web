"use client";

import { useCreateCompany } from "@/components/commercial/CompanyDialogs";
import { Alert } from "@/components/ui";
import { useCompany } from "@/lib/commercial/CompanyProvider";

/**
 * What a page says in place of company data it does not have. Nothing while
 * the company is loading or once there is one.
 *
 * Two different situations, worded differently on purpose: an account with no
 * company yet has something to do, while a list that failed to load does not
 * mean the company is gone - telling that person to set one up would be wrong.
 */
export function CompanyNotice() {
  const { company, status, reload } = useCompany();
  const openCreateCompany = useCreateCompany();

  if (company || status === "loading") return null;

  if (status === "unavailable") {
    return (
      <Alert variant="info">
        Your company details couldn&apos;t be loaded right now.{" "}
        <button
          type="button"
          onClick={reload}
          className="font-semibold underline underline-offset-2"
        >
          Try again
        </button>
      </Alert>
    );
  }

  // Having no company is allowed: the dashboard works without one, and this is
  // how each page that needs one says so.
  return (
    <Alert variant="info">
      Set up your company - create a company to start advertising on
      Loopd&apos;n.{" "}
      <button
        type="button"
        onClick={openCreateCompany}
        className="font-semibold underline underline-offset-2"
      >
        Create company
      </button>
    </Alert>
  );
}
