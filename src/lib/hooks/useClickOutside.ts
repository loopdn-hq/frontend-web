"use client";

import { useEffect, type RefObject } from "react";

/**
 * Call `onOutside` when a pointer goes down anywhere outside `ref`.
 *
 * `pointerdown`, not `click`: a click only lands after the button is released,
 * so a menu dismissed on click stays open through a drag that began outside it.
 * Down is also when a person has visibly committed to somewhere else.
 *
 * The listener is added on the document in the CAPTURE phase, so a child that
 * stops propagation cannot accidentally trap the menu open.
 *
 * ANYTHING MARKED `data-ignore-click-outside` IS EXEMPT. A menu's own trigger
 * lives outside the menu - especially when the menu is portalled - so without
 * this a second press on the trigger ran close-then-reopen and the button could
 * never put its own menu away.
 */
const EXEMPT = "[data-ignore-click-outside]";

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const handle = (event: PointerEvent) => {
      const element = ref.current;
      if (!element) return;
      if (!(event.target instanceof Node)) return;
      if (element.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest(EXEMPT)) {
        return;
      }
      onOutside();
    };

    document.addEventListener("pointerdown", handle, true);
    return () => document.removeEventListener("pointerdown", handle, true);
  }, [ref, active, onOutside]);
}
