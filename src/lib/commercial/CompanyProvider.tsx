"use client";

/**
 * Which company the dashboard is showing.
 *
 * One person can own several companies (two shops, an agency with clients),
 * so every page needs to know which one it is about. That answer lives here,
 * once, instead of in a `?advertiser=` on every URL.
 *
 * The dashboard never waits for it. The provider loads the list in the
 * background, and `company` is null until one is there - while loading, when
 * the account has none yet, or when the list could not be fetched. Each page
 * shows what it can without one, rather than the whole dashboard showing an
 * error in its place.
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
import { fetchCompanies } from "./api";
import type { Company } from "./types";

// localStorage, not the URL: which company you last looked at is a
// preference of this browser, not part of any page's address.
const SELECTED_KEY = "loopdn_commercial_company";

function readSelected(): number | null {
  try {
    const value = Number(window.localStorage.getItem(SELECTED_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeSelected(id: number): void {
  try {
    window.localStorage.setItem(SELECTED_KEY, String(id));
  } catch {
    // Private mode or storage full: the choice lasts this visit only.
  }
}

/**
 * loading      the list has not come back yet
 * ready        it has; `companies` may be empty
 * unavailable  it could not be fetched - not fatal, pages carry on without it
 */
export type CompaniesStatus = "loading" | "ready" | "unavailable";

type CompanyContextValue = {
  /** The company every page is about, or null while there is none to show. */
  company: Company | null;
  companies: Company[];
  status: CompaniesStatus;
  select: (id: number) => void;
  /** Re-fetch, e.g. after a top-up changes the balance. */
  reload: () => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<CompaniesStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  // Safe to read storage in the initializer: this only ever mounts in the
  // browser, under a frame that renders nothing during prerendering.
  const [selectedId, setSelectedId] = useState<number | null>(readSelected);

  useEffect(() => {
    let cancelled = false;

    fetchCompanies().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCompanies(result.data);
        setStatus("ready");
      } else {
        setStatus("unavailable");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const company =
    companies.find((item) => item.id === selectedId) ?? companies[0] ?? null;

  const select = useCallback((id: number) => {
    setSelectedId(id);
    writeSelected(id);
  }, []);

  // Loading is set here, in the handler, not in the effect: the effect only
  // ever sets state from a response.
  const reload = useCallback(() => {
    setStatus("loading");
    setReloadToken((token) => token + 1);
  }, []);

  const value = useMemo(
    () => ({ company, companies, status, select, reload }),
    [company, companies, status, select, reload],
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
