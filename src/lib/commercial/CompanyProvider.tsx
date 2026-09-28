"use client";

/**
 * Which company the dashboard is showing.
 *
 * One person can own several companies (two shops, an agency with clients),
 * so every page needs to know which one it is about. That answer lives here,
 * once, instead of in a `?advertiser=` on every URL.
 *
 * Split in two on purpose:
 *
 *   useCompanyList()   fetches; the dashboard layout decides what loading,
 *                         failure and "you have none yet" look like.
 *   CompanyProvider    only ever mounted with a non-empty list, so every
 *                         page's useCompany() gets a real Company and
 *                         never has to handle null.
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

export type CompanyListState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; companies: Company[] };

/**
 * The signed-in person's companies. Does nothing until `enabled`, so the
 * layout can hold the request until it knows the viewer has `ads.access`.
 */
export function useCompanyList(enabled: boolean): {
  state: CompanyListState;
  reload: () => void;
} {
  const [state, setState] = useState<CompanyListState>({
    status: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetchCompanies().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", companies: result.data }
          : { status: "failed", message: result.message },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  // Loading is set here, in the handler, not in the effect: the effect only
  // ever sets state from a response.
  const reload = useCallback(() => {
    setState({ status: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  return { state, reload };
}

type CompanyContextValue = {
  /** The company every page is currently about. */
  company: Company;
  companies: Company[];
  select: (id: number) => void;
  /** Re-fetch, e.g. after a top-up changes the balance. */
  reload: () => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({
  companies,
  reload,
  children,
}: {
  /** Never empty: the layout sends a person with none to /commercial/start/. */
  companies: Company[];
  reload: () => void;
  children: ReactNode;
}) {
  // Safe to read storage in the initializer: this mounts after the list has
  // been fetched in the browser, never during prerendering.
  const [selectedId, setSelectedId] = useState<number | null>(readSelected);

  const company =
    companies.find((item) => item.id === selectedId) ?? companies[0];

  const select = useCallback((id: number) => {
    setSelectedId(id);
    writeSelected(id);
  }, []);

  const value = useMemo(
    () => ({ company, companies, select, reload }),
    [company, companies, select, reload],
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const value = useContext(CompanyContext);
  if (!value) {
    throw new Error(
      "useCompany() must be used under app/commercial/(dashboard)/layout.tsx.",
    );
  }
  return value;
}
