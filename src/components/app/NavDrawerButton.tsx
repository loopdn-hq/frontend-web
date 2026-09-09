"use client";

import { PanelLeft } from "lucide-react";
import { useAppShell } from "@/lib/app/AppShellProvider";

/**
 * Opens the nav rail as an overlay drawer below md, where the rail is hidden.
 *
 *Each route places this in its own header rather than the shell floating one
 * globally, because a fixed button would collide with the back button in
 * HomeShell's conversation view.
 */
export function NavDrawerButton({ className = "" }: { className?: string }) {
  const { openNavDrawer } = useAppShell();

  return (
    <button
      type="button"
      onClick={openNavDrawer}
      aria-label="Open navigation"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition md:hidden ${className}`}
    >
      <PanelLeft className="h-5 w-5" />
    </button>
  );
}
