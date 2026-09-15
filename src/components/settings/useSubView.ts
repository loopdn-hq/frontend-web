"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A section's second view - a picker, a list - shown in place of the section,
 * because the settings dialog has no router.
 *
 * Swapping views unmounts whatever had focus. So each row that opens a view
 * registers itself with `rowRef(name)`, and `close` puts focus back on the row
 * that opened it: a keyboard user lands where they left, not at the top of the
 * page. On the way in, the view focuses its own heading (SettingsHeading).
 */
export function useSubView() {
  const [view, setView] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    if (view !== null || returnTo.current === null) return;
    rows.current.get(returnTo.current)?.focus();
    returnTo.current = null;
  }, [view]);

  const rowRef = useCallback(
    (name: string) => (element: HTMLElement | null) => {
      if (element) rows.current.set(name, element);
      else rows.current.delete(name);
    },
    [],
  );

  return {
    view,
    open: (name: string) => setView(name),
    close: () => {
      returnTo.current = view;
      setView(null);
    },
    rowRef,
  };
}
