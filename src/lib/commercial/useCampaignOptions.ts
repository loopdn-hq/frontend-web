"use client";

import { useEffect, useState } from "react";
import { fetchCategories, fetchMarkets } from "./api";
import type { GroupCategory, Markets, Region } from "./types";

export type CampaignOptions = {
  categories: GroupCategory[];
  markets: Markets;
};

/**
 * The lists an audience is chosen from and described with: group categories,
 * and each country's regions. Served by the backend, so a new category or a
 * new market is a backend change only.
 */
export function useCampaignOptions(): {
  options: CampaignOptions | null;
  error: string | null;
  retry: () => void;
} {
  const [options, setOptions] = useState<CampaignOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCategories(), fetchMarkets()]).then(
      ([categories, markets]) => {
        if (cancelled) return;
        if (!categories.ok) return setError(categories.message);
        if (!markets.ok) return setError(markets.message);
        setOptions({ categories: categories.data, markets: markets.data });
        setError(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  return {
    options,
    error,
    retry: () => {
      setError(null);
      setToken((current) => current + 1);
    },
  };
}

/** The regions a campaign of a company in `country` can target. */
export function regionsOf(options: CampaignOptions, country: string): Region[] {
  return (
    options.markets.countries.find((item) => item.code === country)?.regions ??
    []
  );
}

/** "Philippines", from "PH". */
export function countryName(options: CampaignOptions, country: string): string {
  return (
    options.markets.countries.find((item) => item.code === country)?.name ??
    country
  );
}
