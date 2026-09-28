import type { ReactNode } from "react";

import { CommercialDrawerButton } from "@/components/commercial/CommercialShell";

/**
 * The title bar every commercial page starts with: the chat app's blue bar,
 * with the sidebar's drawer button on small screens.
 */
export function CommercialPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** Round buttons on the right, e.g. NewCampaignLink. */
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-slate-200 bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-white dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <CommercialDrawerButton className="-ml-2 text-white hover:bg-white/20" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{title}</h1>
            {description && (
              <p className="truncate text-sm text-white/80">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        )}
      </div>
    </header>
  );
}
