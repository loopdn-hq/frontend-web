"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy text, and report for a moment that it worked.
 *
 * `copied` is the confirmation affordance the UI needs; the project has no
 * general-purpose toast (ActivityToasts is hardwired to notification frames),
 * so the caller renders its own brief acknowledgement from this flag.
 *
 * The clipboard API is unavailable on insecure origins and can be refused by
 * permission, so failure is reported rather than thrown - a copy that silently
 * did nothing is worse than one that says so.
 */
export function useCopyToClipboard(resetAfterMs = 1600) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);

  // A component unmounted between the copy and the reset would otherwise set
  // state after teardown.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      if (!navigator.clipboard?.writeText) {
        setError("Copying is not available in this browser.");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setError("");
        setCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), resetAfterMs);
        return true;
      } catch {
        setError("Could not copy that.");
        return false;
      }
    },
    [resetAfterMs],
  );

  return { copy, copied, error };
}
