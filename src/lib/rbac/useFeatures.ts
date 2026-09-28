"use client";

/**
 * The signed-in account's features, fetched once per mount.
 *
 * `loading` matters: rendering a nav rail as though the answer were "no
 * features" would flash an empty menu on every page load, so callers hold
 * their gates open until it is false. `<Gate>` does this for you.
 */
import { useEffect, useState } from "react";

import {
  type AccountFeatures,
  fetchAccountFeatures,
} from "@/lib/rbac/features";

const EMPTY: AccountFeatures = new Set();

export type FeaturesState = {
  features: AccountFeatures;
  loading: boolean;
};

export function useFeatures(): FeaturesState {
  const [features, setFeatures] = useState<AccountFeatures>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAccountFeatures().then((next) => {
      if (cancelled) return;
      setFeatures(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { features, loading };
}
