import type { ReactNode } from "react";

/**
 * A page's title, at the top of its content column.
 *
 * Not in the blue bar: that bar belongs to the whole dashboard and holds the
 * company switcher (CommercialShell), so a page's own title sits under it,
 * lined up with the page's content.
 */
export function CommercialPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** The page's main action on the right, e.g. NewCampaignLink. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
