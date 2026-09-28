"use client";

import Link from "next/link";

import { Alert } from "@/components/ui";
import { useCompany } from "@/lib/commercial/CompanyProvider";

/**
 * What a page says in place of company data it does not have. Nothing while
 * the list is loading or once a company is there.
 *
 * Two different situations, worded differently on purpose: an account with no
 * company yet has something to do, while a list that failed to load does not
 * mean the company is gone - telling that person to set one up would be wrong.
 */
export function CompanyNotice() {
  const { company, status, reload } = useCompany();

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

  return (
    <Alert variant="info">
      Set up your company to start advertising: its name is what your ads are
      labelled with.{" "}
      <Link
        href="/company/"
        className="font-semibold underline underline-offset-2"
      >
        Set up your company
      </Link>
    </Alert>
  );
}
