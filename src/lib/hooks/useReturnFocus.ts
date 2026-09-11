"use client";

import { useEffect, useRef } from "react";

/**
 * Remember what was focused before something opened, and put focus back when
 * it closes.
 *
 * Without this, dismissing a menu or a dialog drops focus onto `<body>` and a
 * keyboard user is returned to the top of the page - they lose their place in
 * a long thread for the crime of pressing Escape.
 *
 * Reusable on purpose: the context menu needs it now, and `Modal` should adopt
 * it rather than growing a second copy.
 */
export function useReturnFocus(active: boolean) {
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previous.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    return () => {
      // Guard against returning focus to something that has since been
      // unmounted - a message removed while its menu was open, say.
      const target = previous.current;
      if (target && target.isConnected) target.focus();
      previous.current = null;
    };
  }, [active]);
}
