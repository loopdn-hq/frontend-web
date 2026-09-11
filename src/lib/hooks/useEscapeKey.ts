"use client";

import { useEffect } from "react";

/**
 * Run `onEscape` while `active`, for anything dismissible.
 *
 * Lifted out of Modal, which had this inline and unexported - the context menu
 * needs the same behaviour, and two copies is how one of them quietly stops
 * being maintained.
 *
 * Listens on keydown rather than keyup so it fires before a focused control
 * can act on the same press, and only while active so a page with several
 * dismissible things does not stack idle listeners.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;

    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [active, onEscape]);
}
