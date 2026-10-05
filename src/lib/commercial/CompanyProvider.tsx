"use client";

/**
 * Which company the dashboard is working in - the active company - and the
 * others the person can switch to.
 *
 * The server remembers the choice per person (GET/PUT active-company/), so it
 * follows them to another browser, and it is context only: every page still
 * names its company in its own requests, and the server checks each one. The
 * browser keeps no copy of its own to trust.
 *
 * The dashboard never waits for it, and never requires one. `company` is null
 * while loading, when the person has no company yet (allowed - pages offer
 * "Create company"), or when it could not be fetched, and each page shows what
 * it can without one.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchActiveCompany,
  fetchCompanyPage,
  switchActiveCompany,
} from "./api";
import type { Company } from "./types";

/**
 * loading      the answer has not come back yet
 * ready        it has; `company` is null only when they have none
 * unavailable  it could not be fetched - not fatal, pages carry on without it
 */
export type CompaniesStatus = "loading" | "ready" | "unavailable";

type CompanyContextValue = {
  /** The active company, or null while there is none to show. */
  company: Company | null;
  /** Every company the person manages, the active one included. */
  /**
   * The first page of the person's companies (ten, by name), plus the active
   * one - enough for the dropdown. The Companies dialog pages through the rest.
   */
  companies: Company[];
  /** How many companies they have in all. */
  companyCount: number;
  status: CompaniesStatus;
  /** Which company a switch is waiting on, so the switcher can say so. */
  switchingTo: number | null;
  /** Make another of their companies the active one. The company, or null if the switch failed. */
  switchTo: (id: number) => Promise<Company | null>;
  /**
   * Take a company just created, which the server has already made the
   * active one. For an edit, use `update`.
   */
  adopt: (company: Company) => void;
  /**
   * Take an edited company the server just returned. Unlike `adopt`, it does
   * not make it the active one: any of the person's companies can be edited.
   */
  update: (company: Company) => void;
  /** Re-fetch, e.g. after a top-up changes the balance. */
  reload: () => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

function withCompany(companies: Company[], company: Company): Company[] {
  return companies.some((item) => item.id === company.id)
    ? companies.map((item) => (item.id === company.id ? company : item))
    : [...companies, company];
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyCount, setCompanyCount] = useState(0);
  const [status, setStatus] = useState<CompaniesStatus>("loading");
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Both at once: the active company decides what every page shows, the
    // list only fills the switcher.
    Promise.all([fetchActiveCompany(), fetchCompanyPage()]).then(
      ([active, list]) => {
        if (cancelled) return;
        if (active.ok && list.ok) {
          setCompany(active.data);
          const firstPage = list.data.companies;
          setCompanies(
            active.data ? withCompany(firstPage, active.data) : firstPage,
          );
          setCompanyCount(list.data.count);
          setStatus("ready");
        } else {
          setStatus("unavailable");
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Loading is set here, in the handler, not in the effect: the effect only
  // ever sets state from a response.
  const reload = useCallback(() => {
    setStatus("loading");
    setReloadToken((token) => token + 1);
  }, []);

  const switchTo = useCallback(
    async (id: number) => {
      setSwitchingTo(id);
      const result = await switchActiveCompany(id);
      setSwitchingTo(null);

      if (result.ok) {
        setCompany(result.data);
        setCompanies((current) => withCompany(current, result.data));
        return result.data;
      }
      // Most likely it is no longer theirs. Start again from what the server
      // says they have, rather than guess.
      reload();
      return null;
    },
    [reload],
  );

  const adopt = useCallback((next: Company) => {
    setCompany(next);
    setCompanies((current) => withCompany(current, next));
    // Only ever given a company just created, so there is one more in all.
    setCompanyCount((count) => count + 1);
    setStatus("ready");
  }, []);

  const update = useCallback((next: Company) => {
    setCompanies((current) => withCompany(current, next));
    setCompany((current) => (current?.id === next.id ? next : current));
  }, []);

  const value = useMemo(
    () => ({
      company,
      companies,
      companyCount,
      status,
      switchingTo,
      switchTo,
      adopt,
      update,
      reload,
    }),
    [
      company,
      companies,
      companyCount,
      status,
      switchingTo,
      switchTo,
      adopt,
      update,
      reload,
    ],
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const value = useContext(CompanyContext);
  if (!value) {
    throw new Error("useCompany() must be used under CommercialFrame.");
  }
  return value;
}
